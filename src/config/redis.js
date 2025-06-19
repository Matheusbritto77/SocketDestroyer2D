require("dotenv").config();
const { createClient } = require("redis");

if (!process.env.REDIS_EXTERNAL_URL) {
  console.error('[REDIS] AVISO: REDIS_EXTERNAL_URL não configurada, usando modo de contingência');
}

const client = createClient({
  url: process.env.REDIS_EXTERNAL_URL || 'redis://localhost:6379'
});

client.on("error", (err) => {
  console.error('[REDIS] Erro de conexão:', err);
  // Não encerra o processo, permite que a aplicação continue em modo de contingência
});

client.on("connect", () => {
  console.log('[REDIS] Conectado com sucesso!');
});

// Tenta conectar ao Redis, mas não falha se não conseguir
client.connect().catch(err => {
  console.error('[REDIS] Falha ao conectar:', err);
  // Não encerra o processo, permite que a aplicação continue em modo de contingência
});

module.exports = client;
