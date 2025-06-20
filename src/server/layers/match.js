const resilientStorage = require('../utils/resilientStorage');

// Chaves para armazenamento
const MATCH_QUEUE_KEY = 'matchQueue';
const ROOMS_KEY = 'rooms';
const ONLINE_USERS_KEY = 'onlineUsers';

let roomCounter = 1;

// Cache local para a fila de matchmaking
let matchQueueCache = [];
let roomsCache = new Map();
let onlineCountCache = 0;

async function joinMatchQueue(socket, io) {
  try {
    matchQueueCache.push(socket.user.username);
    await resilientStorage.set(MATCH_QUEUE_KEY, matchQueueCache);
    
    socket.user.roomId = null;
    socket.emit('queue_joined', { message: 'Aguardando outro usuário para formar uma sala...' });
    await updateOnlineCount(io);
    console.log(`[MATCH] Usuário ${socket.user.username} entrou na fila.`);
  } catch (error) {
    console.error('[MATCH] Erro ao entrar na fila:', error);
    socket.emit('error', { message: 'Erro ao entrar na fila. Tente novamente.' });
  }
}

async function leaveMatchQueue(socket) {
  try {
    if (!socket.user) return;
    matchQueueCache = matchQueueCache.filter(name => name !== socket.user.username);
    await resilientStorage.set(MATCH_QUEUE_KEY, matchQueueCache);
    await updateOnlineCount();
    console.log(`[MATCH] Usuário ${socket.user.username} saiu da fila.`);
  } catch (error) {
    console.error('[MATCH] Erro ao sair da fila:', error);
  }
}

async function tryMatchUsers(io) {
  try {
    while (matchQueueCache.length >= 2) {
      const ws1Name = matchQueueCache.shift();
      const ws2Name = matchQueueCache.shift();
      
      if (!ws1Name || !ws2Name) {
        console.log('[MATCH] Fila vazia ou erro ao obter usuários');
        break;
      }

      const socket1 = findSocketByName(io, ws1Name);
      const socket2 = findSocketByName(io, ws2Name);
      
      if (!socket1 || !socket2) {
        console.log(`[MATCH] Falha ao encontrar sockets para ${ws1Name} e ${ws2Name}`);
        // Devolve os usuários para a fila se não encontrar os sockets
        if (ws1Name) matchQueueCache.push(ws1Name);
        if (ws2Name) matchQueueCache.push(ws2Name);
        continue;
      }

      const roomId = 'room_' + (roomCounter++);
      const roomData = [ws1Name, ws2Name];
      roomsCache.set(roomId, roomData);
      await resilientStorage.set(`${ROOMS_KEY}:${roomId}`, roomData);
      
      // Adiciona ambos os usuários à room do Socket.IO
      socket1.join(roomId);
      socket2.join(roomId);
      
      socket1.user.roomId = roomId;
      socket2.user.roomId = roomId;
      
      socket1.emit('room_joined', { roomId, partner: socket2.user.username });
      socket2.emit('room_joined', { roomId, partner: socket1.user.username });
      
      console.log(`[MATCH] Sala criada: ${roomId} (${ws1Name} <-> ${ws2Name})`);
    }

    // Atualiza a fila no armazenamento resiliente
    await resilientStorage.set(MATCH_QUEUE_KEY, matchQueueCache);
  } catch (error) {
    console.error('[MATCH] Erro ao tentar formar pares:', error);
  }
}

async function removeFromRoom(io, socket) {
  try {
    const roomId = socket.user && socket.user.roomId;
    if (!roomId) return;

    const users = roomsCache.get(roomId) || await resilientStorage.get(`${ROOMS_KEY}:${roomId}`);
    if (!users) return;

    for (const name of users) {
      const clientSocket = findSocketByName(io, name);
      if (clientSocket) {
        clientSocket.user.roomId = null;
        clientSocket.leave(roomId);
        clientSocket.emit('partner_left');
        await joinMatchQueue(clientSocket, io);
        console.log(`[MATCH] Usuário ${name} removido da sala ${roomId} e voltou para fila.`);
      }
    }

    roomsCache.delete(roomId);
    await resilientStorage.set(`${ROOMS_KEY}:${roomId}`, null); // Marca como removido
    console.log(`[MATCH] Sala ${roomId} removida.`);
  } catch (error) {
    console.error('[MATCH] Erro ao remover da sala:', error);
  }
}

async function sendToRoom(io, roomId, message) {
  try {
    const users = roomsCache.get(roomId) || await resilientStorage.get(`${ROOMS_KEY}:${roomId}`);
    if (!users) return;

    // Usa Socket.IO rooms para broadcast
    io.to(roomId).emit('message', message);

    if (message.type === 'chat') {
      await resilientStorage.saveMessage(roomId, message);
      console.log(`[CHAT] Mensagem salva na sala ${roomId}: ${message.from}: ${message.text}`);
    }
  } catch (error) {
    console.error('[MATCH] Erro ao enviar mensagem para sala:', error);
  }
}

function findSocketByName(io, name) {
  // Busca o socket pelo nome do usuário
  for (const [socketId, socket] of io.sockets.sockets) {
    if (socket.user && socket.user.username === name) return socket;
  }
  return null;
}

async function updateOnlineCount(io) {
  try {
    if (!io) return;
    const count = io.engine.clientsCount;
    onlineCountCache = count;
    await resilientStorage.set(ONLINE_USERS_KEY, count);
    
    // Notifica todos os clientes
    io.emit('online_count', { count });
    console.log(`[ONLINE] Usuários online: ${count}`);
  } catch (error) {
    console.error('[MATCH] Erro ao atualizar contagem de usuários:', error);
  }
}

// Inicializa os caches do armazenamento resiliente
async function initializeCache() {
  try {
    const queue = await resilientStorage.get(MATCH_QUEUE_KEY);
    if (queue) matchQueueCache = queue;

    const onlineCount = await resilientStorage.get(ONLINE_USERS_KEY);
    if (onlineCount) onlineCountCache = onlineCount;

    console.log('[MATCH] Cache inicializado com sucesso');
  } catch (error) {
    console.error('[MATCH] Erro ao inicializar cache:', error);
  }
}

// Chama a inicialização
initializeCache();

module.exports = {
  joinMatchQueue,
  leaveMatchQueue,
  tryMatchUsers,
  removeFromRoom,
  sendToRoom,
  updateOnlineCount
}; 