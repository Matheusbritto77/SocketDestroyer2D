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

async function joinMatchQueue(ws, wss) {
  try {
    matchQueueCache.push(ws.user.name);
    await resilientStorage.set(MATCH_QUEUE_KEY, matchQueueCache);
    
    ws.user.roomId = null;
    ws.send(JSON.stringify({ type: 'queue', message: 'Aguardando outro usuário para formar uma sala...' }));
    await updateOnlineCount(wss);
    console.log(`[MATCH] Usuário ${ws.user.name} entrou na fila.`);
  } catch (error) {
    console.error('[MATCH] Erro ao entrar na fila:', error);
    ws.send(JSON.stringify({ type: 'error', message: 'Erro ao entrar na fila. Tente novamente.' }));
  }
}

async function leaveMatchQueue(ws) {
  try {
    if (!ws.user) return;
    matchQueueCache = matchQueueCache.filter(name => name !== ws.user.name);
    await resilientStorage.set(MATCH_QUEUE_KEY, matchQueueCache);
    await updateOnlineCount();
    console.log(`[MATCH] Usuário ${ws.user.name} saiu da fila.`);
  } catch (error) {
    console.error('[MATCH] Erro ao sair da fila:', error);
  }
}

async function tryMatchUsers(wss) {
  try {
    while (matchQueueCache.length >= 2) {
      const ws1Name = matchQueueCache.shift();
      const ws2Name = matchQueueCache.shift();
      
      if (!ws1Name || !ws2Name) {
        console.log('[MATCH] Fila vazia ou erro ao obter usuários');
        break;
      }

      const ws1 = findWSByName(wss, ws1Name);
      const ws2 = findWSByName(wss, ws2Name);
      
      if (!ws1 || !ws2) {
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
      
      ws1.user.roomId = roomId;
      ws2.user.roomId = roomId;
      ws1.send(JSON.stringify({ type: 'room_joined', roomId, partner: ws2.user.name }));
      ws2.send(JSON.stringify({ type: 'room_joined', roomId, partner: ws1.user.name }));
      console.log(`[MATCH] Sala criada: ${roomId} (${ws1Name} <-> ${ws2Name})`);
    }

    // Atualiza a fila no armazenamento resiliente
    await resilientStorage.set(MATCH_QUEUE_KEY, matchQueueCache);
  } catch (error) {
    console.error('[MATCH] Erro ao tentar formar pares:', error);
  }
}

async function removeFromRoom(wss, ws) {
  try {
    const roomId = ws.user && ws.user.roomId;
    if (!roomId) return;

    const users = roomsCache.get(roomId) || await resilientStorage.get(`${ROOMS_KEY}:${roomId}`);
    if (!users) return;

    for (const name of users) {
      const client = findWSByName(wss, name);
      if (client) {
        client.user.roomId = null;
        client.send(JSON.stringify({ type: 'partner_left' }));
        await joinMatchQueue(client, wss);
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

async function sendToRoom(wss, roomId, message) {
  try {
    const users = roomsCache.get(roomId) || await resilientStorage.get(`${ROOMS_KEY}:${roomId}`);
    if (!users) return;

    for (const name of users) {
      const client = findWSByName(wss, name);
      if (client && client.readyState === 1) {
        client.send(JSON.stringify(message));
      }
    }

    if (message.type === 'chat') {
      await resilientStorage.saveMessage(roomId, message);
      console.log(`[CHAT] Mensagem salva na sala ${roomId}: ${message.from}: ${message.text}`);
    }
  } catch (error) {
    console.error('[MATCH] Erro ao enviar mensagem para sala:', error);
  }
}

function findWSByName(wss, name) {
  for (const client of wss.clients) {
    if (client.user && client.user.name === name) return client;
  }
  return null;
}

async function updateOnlineCount(wss) {
  try {
    if (!wss) return;
    let count = 0;
    for (const client of wss.clients) {
      if (client.user) count++;
    }
    onlineCountCache = count;
    await resilientStorage.set(ONLINE_USERS_KEY, count);
    
    // Notifica todos os clientes
    for (const client of wss.clients) {
      if (client.readyState === 1) { // Verifica se o cliente ainda está conectado
        client.send(JSON.stringify({ type: 'online_count', count }));
      }
    }
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