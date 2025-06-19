// Camada de conexão: gerencia a entrada do usuário e delega para matchmaking/sala
const { handleUserMessage, handleDisconnect } = require('./user');

function handleConnection(ws, wss) {
  ws.user = null; // Será preenchido após o usuário enviar o nome

  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      ws.send(JSON.stringify({ error: 'Mensagem inválida' }));
      return;
    }
    handleUserMessage(ws, wss, data);
  });

  ws.on('close', () => {
    handleDisconnect(ws, wss);
  });
}

module.exports = { handleConnection }; 