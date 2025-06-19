// Carrega as variáveis de ambiente primeiro
require('dotenv').config();

const createServer = require('./server');
const resilientStorage = require('./server/utils/resilientStorage');
const runMigrations = require('./server/utils/migratePostgres');

// Inicializa as conexões com os bancos de dados
require("./config/redis");
require("./config/mongo");
require("./config/postgres");

// Inicia a limpeza periódica do cache
resilientStorage.startCleanupTask();

// Executa migrations do Postgres antes de iniciar o servidor
const startServer = async () => {
  try {
    await runMigrations();
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
  startServer: () => startServer()
};
