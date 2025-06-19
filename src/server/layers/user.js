const { joinMatchQueue, leaveMatchQueue, tryMatchUsers, removeFromRoom, sendToRoom, updateOnlineCount } = require('./match');
const resilientStorage = require('../utils/resilientStorage');
const roomManager = require('./room');
const rateLimiter = require('../utils/rateLimiter');
const batchProcessor = require('../utils/batchProcessor');
const sanitizer = require('../utils/sanitizer');
const cache = require('../utils/cache');

// Estrutura do usuário:
// ws.user = {
//   id: number|null,
//   email: string|null,
//   username: string,
//   isRegistered: boolean,
//   rooms: Set<string>,
//   status: 'online' | 'away' | 'busy',
//   lastActivity: number
// }

const onlineUsers = new Map();

async function handleUserMessage(ws, wss, data) {
  try {
    // Rate limiting
    if (!rateLimiter.middleware(ws, data)) return;

    // Registro permanente
    if (!ws.user && data.type === 'register') {
      if (!data.email || !data.password || !data.username) {
        throw new Error('Dados de registro incompletos');
      }
      const user = await roomManager.registerUser(data.email, data.password, data.username);
      ws.user = {
        id: user.id,
        email: user.email,
        username: user.username,
        isRegistered: true,
        rooms: new Set(),
        status: 'online',
        lastActivity: Date.now()
      };
      onlineUsers.set(ws.user.username, ws);
      ws.send(JSON.stringify({ type: 'register_response', success: true, message: 'Registrado com sucesso', user: { email: user.email, username: user.username } }));
      return;
    }

    // Autenticação permanente
    if (!ws.user && data.type === 'login') {
      if (!data.email || !data.password) {
        throw new Error('Dados de login incompletos');
      }
      const user = await roomManager.authenticateUser(data.email, data.password);
      ws.user = {
        id: user.id,
        email: user.email,
        username: user.username,
        isRegistered: true,
        rooms: new Set(),
        status: 'online',
        lastActivity: Date.now()
      };
      onlineUsers.set(ws.user.username, ws);
      ws.send(JSON.stringify({ type: 'login_response', success: true, message: 'Login realizado', user: { email: user.email, username: user.username } }));
      return;
    }

    // Autenticação temporária (apenas username)
    if (!ws.user && data.type === 'auth') {
      if (!data.username || typeof data.username !== 'string') {
        throw new Error('Nome de usuário inválido');
      }
      if (onlineUsers.has(data.username)) {
        throw new Error('Nome de usuário já está em uso');
      }
      ws.user = {
        id: null,
        email: null,
        username: data.username,
        isRegistered: false,
        rooms: new Set(),
        status: 'online',
        lastActivity: Date.now()
      };
      onlineUsers.set(ws.user.username, ws);
      ws.send(JSON.stringify({ type: 'auth_response', success: true, message: 'Autenticado como usuário temporário', user: { username: ws.user.username } }));
      return;
    }

    if (!ws.user) {
      throw new Error('Você precisa se autenticar primeiro');
    }

    ws.user.lastActivity = Date.now();

    switch (data.type) {
      case 'create_room':
        if (!ws.user.isRegistered) {
          throw new Error('Apenas usuários registrados podem criar salas públicas');
        }
        if (!data.name || typeof data.name !== 'string') {
          throw new Error('Nome da sala inválido');
        }
        const room = await roomManager.createPublicRoom(data.name, data.description || '', ws.user.id);
        ws.send(JSON.stringify({ type: 'room_created', room }));
        break;

      case 'get_rooms':
        const rooms = await roomManager.getPublicRooms();
        ws.send(JSON.stringify({ type: 'rooms_list', rooms }));
        break;

      case 'join_room':
        if (!data.room) throw new Error('Nome da sala inválido');
        // Só pode entrar em salas públicas existentes
        const roomData = await roomManager.getRoomById(data.room);
        if (!roomData) throw new Error('Sala não encontrada');
        await roomManager.addUserToRoom(data.room, ws.user.username);
        ws.user.rooms.add(data.room);
        ws.send(JSON.stringify({ type: 'room_joined', room: roomData }));
        // Notifica todos na sala
        broadcastToRoom(wss, data.room, {
          type: 'room_users',
          room: data.room,
          users: await roomManager.getRoomUsers(data.room)
        });
        // Carrega histórico recente
        const history = await resilientStorage.getMessages(data.room, 50);
        ws.send(JSON.stringify({ type: 'message_history', room: data.room, messages: history }));
        break;

      case 'leave_room':
        if (!data.room) throw new Error('Nome da sala inválido');
        await roomManager.removeUserFromRoom(data.room, ws.user.username);
        ws.user.rooms.delete(data.room);
        broadcastToRoom(wss, data.room, {
          type: 'room_users',
          room: data.room,
          users: await roomManager.getRoomUsers(data.room)
        });
        break;

      case 'message':
        if (!data.content || !data.room) throw new Error('Mensagem ou sala inválida');
        if (!ws.user.rooms.has(data.room)) throw new Error('Você não está nesta sala');
        // Sanitiza e valida emojis
        const sanitized = sanitizer.processMessage(data.content);
        if (!sanitized) throw new Error('Mensagem vazia ou inválida');
        const msg = {
          type: 'message',
          from: ws.user.username,
          content: sanitized,
          room: data.room,
          timestamp: Date.now()
        };
        // Batch processing
        batchProcessor.addMessage(msg);
        // Cache local
        cache.addMessage(data.room, msg);
        // Broadcast
        broadcastToRoom(wss, data.room, msg);
        break;

      case 'status':
        if (!['online', 'away', 'busy'].includes(data.status)) throw new Error('Status inválido');
        ws.user.status = data.status;
        broadcastUserStatus(wss, ws.user.username, data.status);
        break;

      case 'typing':
        if (!data.room || typeof data.isTyping !== 'boolean') throw new Error('Parâmetros inválidos');
        if (!ws.user.rooms.has(data.room)) throw new Error('Você não está nesta sala');
        broadcastToRoom(wss, data.room, {
          type: 'typing_status',
          room: data.room,
          username: ws.user.username,
          isTyping: data.isTyping
        });
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', ms: Date.now() }));
        break;

      default:
        throw new Error('Tipo de mensagem inválido');
    }
  } catch (error) {
    ws.send(JSON.stringify({ type: 'error', message: error.message }));
  }
}

function handleDisconnect(ws, wss) {
  if (!ws.user) return;
  ws.user.rooms.forEach(async room => {
    await roomManager.removeUserFromRoom(room, ws.user.username);
    broadcastToRoom(wss, room, {
      type: 'room_users',
      room: room,
      users: await roomManager.getRoomUsers(room)
    });
  });
  broadcastUserStatus(wss, ws.user.username, 'offline');
  onlineUsers.delete(ws.user.username);
}

// Funções auxiliares
function broadcastToRoom(wss, room, message) {
  wss.clients.forEach(client => {
    if (client.user && client.user.rooms.has(room)) {
      client.send(JSON.stringify(message));
    }
  });
}

function broadcastUserStatus(wss, username, status) {
  wss.clients.forEach(client => {
    if (client.user) {
      client.send(JSON.stringify({
        type: 'user_status',
        username: username,
        status: status
      }));
    }
  });
}

module.exports = { handleUserMessage, handleDisconnect }; 