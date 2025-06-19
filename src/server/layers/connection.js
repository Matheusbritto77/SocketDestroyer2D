// Camada de conexão: gerencia conexões WebSocket e autenticação
const { handleUserMessage, handleDisconnect } = require('./user');

function handleConnection(ws, wss) {
  ws.isAlive = true;
  ws.user = null;

  // Configuração do heartbeat
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // Intervalo de ping para cada cliente
  const pingInterval = setInterval(() => {
    if (ws.isAlive === false) {
      clearInterval(pingInterval);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  }, 30000);

  ws.on('message', async (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      ws.send(JSON.stringify({ 
        type: 'error',
        message: 'Formato de mensagem inválido'
      }));
      return;
    }

    // Log básico para debug
    console.log(`[WS] Mensagem recebida: ${data.type}`);

    try {
      await handleUserMessage(ws, wss, data);
    } catch (error) {
      console.error('[WS] Erro ao processar mensagem:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Erro interno do servidor'
      }));
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    handleDisconnect(ws, wss);
  });

  ws.on('error', (error) => {
    console.error('[WS] Erro na conexão:', error);
    clearInterval(pingInterval);
    ws.terminate();
  });
}

module.exports = { handleConnection }; 