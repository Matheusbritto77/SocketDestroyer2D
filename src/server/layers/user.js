const { joinMatchQueue, leaveMatchQueue, tryMatchUsers, removeFromRoom, sendToRoom, updateOnlineCount } = require('./match');
const resilientStorage = require('../utils/resilientStorage');

// ws.user = { name, roomId, tracking }

async function handleUserMessage(ws, wss, data) {
  try {
    if (!ws.user && data.type === 'register' && typeof data.name === 'string') {
      ws.user = { name: data.name, roomId: null, tracking: data.tracking || {} };
      try {
        // Armazena dados de rastreio usando a camada resiliente
        await resilientStorage.set('tracking:' + ws.user.name, ws.user.tracking, 600);
      } catch (error) {
        console.error('[USER] Erro ao salvar dados de rastreio:', error);
        // Continua mesmo com erro, dados ficarão em memória
      }

      ws.send(JSON.stringify({ type: 'registered', name: ws.user.name }));
      await joinMatchQueue(ws, wss);
      await tryMatchUsers(wss);
      await updateOnlineCount(wss);
      return;
    }

    if (!ws.user) {
      ws.send(JSON.stringify({ error: 'Você precisa se registrar primeiro.' }));
      return;
    }

    if (data.type === 'chat' && typeof data.text === 'string') {
      if (!ws.user.roomId) {
        ws.send(JSON.stringify({ error: 'Você não está em uma sala.' }));
        return;
      }
      const message = {
        type: 'chat',
        text: data.text,
        from: ws.user.name,
        timestamp: Date.now()
      };
      
      // Salva a mensagem usando a camada resiliente
      await resilientStorage.saveMessage(ws.user.roomId, message);
      
      await sendToRoom(wss, ws.user.roomId, message);
      return;
    }

    if (data.type === 'leave_room') {
      if (ws.user.roomId) {
        await removeFromRoom(wss, ws);
        ws.send(JSON.stringify({ type: 'left_room' }));
        await joinMatchQueue(ws, wss);
        await tryMatchUsers(wss);
        await updateOnlineCount(wss);
      }
      return;
    }
  } catch (error) {
    console.error('[USER] Erro ao processar mensagem:', error);
    try {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Erro ao processar sua mensagem. Por favor, tente novamente.' 
      }));
    } catch (sendError) {
      console.error('[USER] Erro ao enviar mensagem de erro:', sendError);
    }
  }
}

async function handleDisconnect(ws, wss) {
  try {
    if (!ws.user) return;
    console.log(`[USER] Usuário ${ws.user.name} desconectou`);
    await removeFromRoom(wss, ws);
    await leaveMatchQueue(ws);
    await updateOnlineCount(wss);
  } catch (error) {
    console.error('[USER] Erro ao processar desconexão:', error);
  }
}

module.exports = { handleUserMessage, handleDisconnect }; 