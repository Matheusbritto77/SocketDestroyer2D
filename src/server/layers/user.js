const { joinMatchQueue, leaveMatchQueue, tryMatchUsers, removeFromRoom, sendToRoom, updateOnlineCount } = require('./match');
const resilientStorage = require('../utils/resilientStorage');
const roomManager = require('./room');
const rateLimiter = require('../utils/rateLimiter');
const batchProcessor = require('../utils/batchProcessor');
const sanitizer = require('../utils/sanitizer');
const cache = require('../utils/cache');

// Estrutura do usuário:
// socket.user = {
//   id: number|null,
//   email: string|null,
//   username: string,
//   isRegistered: boolean,
//   rooms: Set<string>,
//   status: 'online' | 'away' | 'busy',
//   lastActivity: number
// }

const onlineUsers = new Map();

async function handleUserMessage(socket, io, data) {
  try {
    // Rate limiting
    if (!rateLimiter.middleware(socket, data)) return;

    // Registro permanente
    if (!socket.user && data.type === 'register') {
      console.log('[USER] Iniciando registro de usuário:', data.email);
      if (!data.email || !data.password || !data.username) {
        throw new Error('Dados de registro incompletos');
      }
      try {
        const user = await roomManager.registerUser(data.email, data.password, data.username);
        console.log('[USER] Usuário registrado com sucesso:', user);
        socket.user = {
          id: user.id,
          email: user.email,
          username: user.username,
          isRegistered: true,
          rooms: new Set(),
          status: 'online',
          lastActivity: Date.now()
        };
        onlineUsers.set(socket.user.username, socket);
        socket.emit('register_response', { success: true, message: 'Registrado com sucesso', user: { email: user.email, username: user.username } });
        return;
      } catch (error) {
        console.error('[USER] Erro no registro:', error);
        socket.emit('register_response', { success: false, message: error.message });
        return;
      }
    }

    // Autenticação permanente
    if (!socket.user && data.type === 'login') {
      if (!data.email || !data.password) {
        throw new Error('Dados de login incompletos');
      }
      const user = await roomManager.authenticateUser(data.email, data.password);
      socket.user = {
        id: user.id,
        email: user.email,
        username: user.username,
        isRegistered: true,
        rooms: new Set(),
        status: 'online',
        lastActivity: Date.now()
      };
      onlineUsers.set(socket.user.username, socket);
      socket.emit('login_response', { success: true, message: 'Login realizado', user: { email: user.email, username: user.username } });
      return;
    }

    // Autenticação temporária (apenas username)
    if (!socket.user && data.type === 'auth') {
      if (!data.username || typeof data.username !== 'string') {
        throw new Error('Nome de usuário inválido');
      }
      if (onlineUsers.has(data.username)) {
        throw new Error('Nome de usuário já está em uso');
      }
      socket.user = {
        id: null,
        email: null,
        username: data.username,
        isRegistered: false,
        rooms: new Set(),
        status: 'online',
        lastActivity: Date.now()
      };
      onlineUsers.set(socket.user.username, socket);
      socket.emit('auth_response', { success: true, message: 'Autenticado como usuário temporário', user: { username: socket.user.username } });
      return;
    }

    if (!socket.user) {
      throw new Error('Você precisa se autenticar primeiro');
    }

    socket.user.lastActivity = Date.now();

    switch (data.type) {
      case 'create_room':
        console.log('[USER] Iniciando criação de sala:', data.name);
        if (!socket.user.isRegistered) {
          throw new Error('Apenas usuários registrados podem criar salas públicas');
        }
        if (!data.name || typeof data.name !== 'string') {
          throw new Error('Nome da sala inválido');
        }
        try {
          const room = await roomManager.createPublicRoom(data.name, data.description || '', socket.user.id);
          console.log('[USER] Sala criada com sucesso:', room);
          socket.emit('room_created', room);
        } catch (error) {
          console.error('[USER] Erro ao criar sala:', error);
          socket.emit('error', { message: error.message });
        }
        break;

      case 'get_rooms':
        console.log('[USER] Iniciando listagem de salas');
        try {
          const rooms = await roomManager.getPublicRooms();
          console.log('[USER] Salas encontradas:', rooms.length);
          socket.emit('rooms_list', { rooms });
        } catch (error) {
          console.error('[USER] Erro ao listar salas:', error);
          socket.emit('error', { message: error.message });
        }
        break;

      case 'join_room':
        if (!data.room) throw new Error('Nome da sala inválido');
        // Só pode entrar em salas públicas existentes
        const roomData = await roomManager.getRoomById(data.room);
        if (!roomData) throw new Error('Sala não encontrada');
        await roomManager.addUserToRoom(data.room, socket.user.username);
        socket.user.rooms.add(data.room);
        
        // Usa rooms nativas do Socket.IO
        socket.join(data.room);
        socket.rooms.add(data.room);
        
        socket.emit('room_joined', { room: roomData });
        
        // Notifica todos na sala usando Socket.IO rooms
        const roomUsers = await roomManager.getRoomUsers(data.room);
        io.to(data.room).emit('room_users', {
          room: data.room,
          users: roomUsers
        });
        
        // Carrega histórico recente
        const history = await resilientStorage.getMessages(data.room, 50);
        socket.emit('message_history', { room: data.room, messages: history });
        break;

      case 'leave_room':
        if (!data.room) throw new Error('Nome da sala inválido');
        await roomManager.removeUserFromRoom(data.room, socket.user.username);
        socket.user.rooms.delete(data.room);
        
        // Sai da room nativa do Socket.IO
        socket.leave(data.room);
        socket.rooms.delete(data.room);
        
        // Notifica atualização de usuários
        const updatedUsers = await roomManager.getRoomUsers(data.room);
        io.to(data.room).emit('room_users', {
          room: data.room,
          users: updatedUsers
        });
        break;

      case 'message':
        if (!data.content || !data.room) throw new Error('Mensagem ou sala inválida');
        if (!socket.user.rooms.has(data.room)) throw new Error('Você não está nesta sala');
        
        // Sanitiza e valida emojis
        const sanitized = sanitizer.processMessage(data.content);
        if (!sanitized) throw new Error('Mensagem vazia ou inválida');
        
        const msg = {
          type: 'message',
          from: socket.user.username,
          content: sanitized,
          room: data.room,
          timestamp: Date.now()
        };
        
        // Batch processing
        batchProcessor.addMessage(msg);
        
        // Cache local
        cache.addMessage(data.room, msg);
        
        // Broadcast usando Socket.IO rooms
        io.to(data.room).emit('message', msg);
        break;

      case 'status':
        if (!['online', 'away', 'busy'].includes(data.status)) throw new Error('Status inválido');
        socket.user.status = data.status;
        broadcastUserStatus(io, socket.user.username, data.status);
        break;

      case 'typing':
        if (!data.room || typeof data.isTyping !== 'boolean') throw new Error('Parâmetros inválidos');
        if (!socket.user.rooms.has(data.room)) throw new Error('Você não está nesta sala');
        
        // Broadcast typing status usando Socket.IO rooms
        io.to(data.room).emit('typing_status', {
          room: data.room,
          username: socket.user.username,
          isTyping: data.isTyping
        });
        break;

      case 'join_match_queue':
        await joinMatchQueue(socket, io);
        break;

      case 'leave_match_queue':
        await leaveMatchQueue(socket);
        break;

      case 'ping':
        socket.emit('pong', { ms: Date.now() });
        break;

      default:
        throw new Error('Tipo de mensagem inválido');
    }
  } catch (error) {
    socket.emit('error', { message: error.message });
  }
}

function handleDisconnect(socket, io) {
  if (!socket.user) return;
  
  // Remove de todas as rooms do Socket.IO
  socket.user.rooms.forEach(async room => {
    await roomManager.removeUserFromRoom(room, socket.user.username);
    socket.leave(room);
    
    // Notifica atualização de usuários
    const updatedUsers = await roomManager.getRoomUsers(room);
    io.to(room).emit('room_users', {
      room: room,
      users: updatedUsers
    });
  });
  
  broadcastUserStatus(io, socket.user.username, 'offline');
  onlineUsers.delete(socket.user.username);
}

// Funções auxiliares adaptadas para Socket.IO
function broadcastToRoom(io, room, message) {
  io.to(room).emit(message.type, message);
}

function broadcastUserStatus(io, username, status) {
  io.emit('user_status', {
    username: username,
    status: status
  });
}

module.exports = { handleUserMessage, handleDisconnect }; 