const WebSocket = require("ws");
const { handleConnection } = require('./layers/connection');

function createServer() {
  return new Promise((resolve, reject) => {
    try {
      const wss = new WebSocket.Server({ port: 8080 });
      let serverStarted = false;

      wss.on("error", (error) => {
        console.error("[SERVER] Erro no WebSocket:", error);
        if (!serverStarted) {
          reject(error);
        }
      });

      wss.on("listening", () => {
        console.log("[SERVER] Servidor WebSocket de Matchmaking/Chat rodando na porta 8080");
        serverStarted = true;
        resolve(wss);
      });

      wss.on("connection", (ws) => {
        console.log("[SERVER] Nova conexão recebida");
        handleConnection(ws, wss);
      });

      wss.on("close", () => {
        console.log("[SERVER] Servidor WebSocket encerrado");
      });

      // Se não iniciar em 10 segundos, rejeita
      const timeoutId = setTimeout(() => {
        if (!serverStarted) {
          console.error("[SERVER] Timeout ao iniciar servidor WebSocket");
          wss.close(() => {
            reject(new Error("Timeout ao iniciar servidor WebSocket"));
          });
        }
      }, 10000);

      // Limpa o timeout se o servidor iniciar com sucesso
      wss.on("listening", () => {
        clearTimeout(timeoutId);
      });

    } catch (error) {
      console.error("[SERVER] Erro ao criar servidor:", error);
      reject(error);
    }
  });
}

module.exports = createServer();
