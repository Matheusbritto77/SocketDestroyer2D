require("dotenv").config();
const { MongoClient } = require("mongodb");

if (!process.env.MONGO_EXTERNAL_URL) {
  console.error('[MONGO] AVISO: MONGO_EXTERNAL_URL não configurada, usando modo de contingência');
}

const client = new MongoClient(process.env.MONGO_EXTERNAL_URL || 'mongodb://localhost:27017/chatdb');

// Tenta conectar ao MongoDB, mas não falha se não conseguir
client.connect()
  .then(() => {
    console.log('[MONGO] Conectado com sucesso!');
  })
  .catch(err => {
    console.error('[MONGO] Falha ao conectar:', err);
    // Não encerra o processo, permite que a aplicação continue em modo de contingência
  });

module.exports = client;
