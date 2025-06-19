// Carrega as variáveis de ambiente primeiro
require('dotenv').config();

const createServer = require('./server');
const resilientStorage = require('./server/utils/resilientStorage');

// Inicializa as conexões com os bancos de dados
require("./config/redis");
require("./config/mongo");

// Inicia a limpeza periódica do cache
resilientStorage.startCleanupTask();

// Aguarda o servidor estar pronto
const startServer = async () => {
  try {
    const wss = await createServer;
    console.log("[SERVER] WebSocket iniciado com sucesso");
    return wss;
  } catch (error) {
    console.error("[SERVER] Falha ao iniciar WebSocket:", error);
    throw error;
  }
};

// Exporta a função de inicialização
module.exports = {
  wss: createServer,
  startServer: () => createServer
};
