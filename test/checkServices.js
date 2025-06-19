require('dotenv').config();
const { createClient } = require('redis');
const { MongoClient } = require('mongodb');
const net = require('net');

async function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    const onError = () => {
      socket.destroy();
      resolve(false);
    };

    socket.setTimeout(1000);
    socket.once('error', onError);
    socket.once('timeout', onError);

    socket.connect(port, '127.0.0.1', () => {
      socket.end();
      resolve(true);
    });
  });
}

async function waitForPort(port, retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    const isRunning = await checkPort(port);
    if (isRunning) return true;
    console.log(`[CHECK] Aguardando serviço na porta ${port} iniciar... (tentativa ${i + 1}/${retries})`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  return false;
}

async function checkServices() {
  console.log('[CHECK] Verificando serviços necessários...');

  // Verifica se a porta 8080 está livre
  const port8080 = await checkPort(8080);
  if (port8080) {
    console.error('[CHECK] ERRO: Porta 8080 já está em uso!');
    process.exit(1);
  }
  console.log('[CHECK] Porta 8080 está livre ✓');

  // Verifica variáveis de ambiente
  if (!process.env.REDIS_EXTERNAL_URL) {
    console.error('[CHECK] ERRO: REDIS_EXTERNAL_URL não configurada!');
    process.exit(1);
  }

  if (!process.env.MONGO_EXTERNAL_URL) {
    console.error('[CHECK] ERRO: MONGO_EXTERNAL_URL não configurada!');
    process.exit(1);
  }

  // Tenta conectar ao Redis
  try {
    console.log('[CHECK] Testando conexão com Redis...');
    const redis = createClient({
      url: process.env.REDIS_EXTERNAL_URL
    });
    await redis.connect();
    await redis.ping();
    await redis.quit();
    console.log('[CHECK] Conexão com Redis testada com sucesso ✓');
  } catch (error) {
    console.error('[CHECK] ERRO: Falha ao conectar ao Redis:', error);
    process.exit(1);
  }

  // Tenta conectar ao MongoDB
  try {
    console.log('[CHECK] Testando conexão com MongoDB...');
    const mongo = new MongoClient(process.env.MONGO_EXTERNAL_URL);
    await mongo.connect();
    await mongo.db('admin').command({ ping: 1 });
    await mongo.close();
    console.log('[CHECK] Conexão com MongoDB testada com sucesso ✓');
  } catch (error) {
    console.error('[CHECK] ERRO: Falha ao conectar ao MongoDB:', error);
    process.exit(1);
  }

  console.log('[CHECK] Todos os serviços estão disponíveis! ✓');
}

// Executa as verificações
checkServices().catch(error => {
  console.error('[CHECK] Erro inesperado:', error);
  process.exit(1);
}); 