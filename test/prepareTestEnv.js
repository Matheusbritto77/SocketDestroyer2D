require('dotenv').config();
const redisClient = require('../src/config/redis');
const mongoClient = require('../src/config/mongo');
const pgClient = require('../src/config/postgres');

async function cleanRedis() {
  try {
    console.log('[TEST-ENV] Iniciando limpeza do Redis...');
    await redisClient.flushAll();
    console.log('[TEST-ENV] Redis limpo com sucesso!');
  } catch (error) {
    console.error('[TEST-ENV] Erro ao limpar Redis:', error);
    throw error;
  }
}

async function cleanMongo() {
  try {
    console.log('[TEST-ENV] Iniciando limpeza do MongoDB...');
    const dbName = process.env.MONGO_DB || 'chatdb';
    const db = mongoClient.db(dbName);
    const collections = await db.collections();
    
    if (collections.length === 0) {
      console.log('[TEST-ENV] Nenhuma coleção encontrada no MongoDB.');
      return;
    }

    let removidas = 0;
    for (const col of collections) {
      if (col.collectionName.startsWith('messages_')) {
        await col.drop();
        removidas++;
        console.log(`[TEST-ENV] Coleção MongoDB removida: ${col.collectionName}`);
      }
    }
    console.log(`[TEST-ENV] Total de ${removidas} coleções removidas do MongoDB.`);
  } catch (error) {
    console.error('[TEST-ENV] Erro ao limpar MongoDB:', error);
    throw error;
  }
}

async function cleanPostgres() {
  try {
    console.log('[TEST-ENV] Iniciando limpeza do PostgreSQL...');
    
    // Remove dados de teste das tabelas
    await pgClient.query('DELETE FROM room_members WHERE username LIKE \'%Test%\' OR username LIKE \'%Carol%\' OR username LIKE \'%Alice%\' OR username LIKE \'%Bob%\' OR username LIKE \'%Eve%\'');
    await pgClient.query('DELETE FROM public_rooms WHERE name LIKE \'%Test%\' OR name LIKE \'%Sala de Teste%\'');
    await pgClient.query('DELETE FROM registered_users WHERE email LIKE \'%test.com\' OR username LIKE \'%Carol%\' OR username LIKE \'%Alice%\' OR username LIKE \'%Bob%\' OR username LIKE \'%Eve%\'');
    
    console.log('[TEST-ENV] PostgreSQL limpo com sucesso!');
  } catch (error) {
    console.error('[TEST-ENV] Erro ao limpar PostgreSQL:', error);
    throw error;
  }
}

async function prepare() {
  console.log('[TEST-ENV] Iniciando preparação do ambiente de teste...');
  try {
    await Promise.all([
      cleanRedis(),
      cleanMongo(),
      cleanPostgres()
    ]);
    console.log('[TEST-ENV] Ambiente de teste preparado com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('[TEST-ENV] Erro fatal na preparação do ambiente:', error);
    process.exit(1);
  }
}

// Adiciona handler para erros não tratados
process.on('unhandledRejection', (error) => {
  console.error('[TEST-ENV] Erro não tratado:', error);
  process.exit(1);
});

prepare(); 