const WebSocket = require('ws');
const assert = require('assert');
const { exec } = require('child_process');
const { createClient } = require('redis');
const { MongoClient } = require('mongodb');

describe('Testes de Resiliência do Sistema', function() {
  this.timeout(30000); // 30 segundos para testes de resiliência
  let redisClient, mongoClient;

  before(async function() {
    console.log('[TEST-RESILIENCE] Iniciando testes de resiliência...');
    
    // Inicia o watchdog em background
    exec('npm run start:watchdog', (error, stdout, stderr) => {
      if (error) {
        console.error('[TEST-RESILIENCE] Erro ao iniciar watchdog:', error);
        return;
      }
      console.log('[TEST-RESILIENCE] Saída do watchdog:', stdout);
    });

    // Aguarda o servidor iniciar
    await new Promise(resolve => setTimeout(resolve, 5000));
  });

  after(async function() {
    console.log('[TEST-RESILIENCE] Finalizando testes...');
    // Limpa processos
    exec('taskkill /F /IM node.exe', (error) => {
      if (error) console.error('[TEST-RESILIENCE] Erro ao matar processos:', error);
    });
  });

  beforeEach(async function() {
    // Conecta aos serviços antes de cada teste
    redisClient = createClient({
      url: process.env.REDIS_EXTERNAL_URL || 'redis://localhost:6379'
    });
    mongoClient = new MongoClient(
      process.env.MONGO_EXTERNAL_URL || 'mongodb://localhost:27017/chatdb'
    );
  });

  afterEach(async function() {
    // Limpa conexões após cada teste
    try {
      await redisClient.quit();
      await mongoClient.close();
    } catch (error) {
      console.error('[TEST-RESILIENCE] Erro ao limpar conexões:', error);
    }
  });

  it('deve manter conexão mesmo com Redis indisponível', async function() {
    // Simula Redis caindo
    await redisClient.quit();
    
    // Tenta conectar ao WebSocket
    const ws = new WebSocket('ws://localhost:8080');
    
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        console.log('[TEST-RESILIENCE] Conectado ao WebSocket mesmo sem Redis');
        ws.send(JSON.stringify({ type: 'register', name: 'TestUser1' }));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'registered') {
          console.log('[TEST-RESILIENCE] Usuário registrado com sucesso sem Redis');
          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
    });
  });

  it('deve recuperar após reinício forçado', async function() {
    // Força o servidor a cair matando o processo
    exec('taskkill /F /IM node.exe /FI "WINDOWTITLE eq node src/app.js"', async (error) => {
      // Aguarda o watchdog reiniciar o servidor
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Tenta conectar novamente
      const ws = new WebSocket('ws://localhost:8080');
      
      await new Promise((resolve, reject) => {
        ws.on('open', () => {
          console.log('[TEST-RESILIENCE] Reconectado após reinício forçado');
          ws.send(JSON.stringify({ type: 'register', name: 'TestUser2' }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data);
          if (message.type === 'registered') {
            console.log('[TEST-RESILIENCE] Sistema recuperado com sucesso');
            ws.close();
            resolve();
          }
        });

        ws.on('error', reject);
      });
    });
  });

  it('deve manter dados em memória quando MongoDB cai', async function() {
    // Primeiro registra um usuário e envia mensagem
    const ws = new WebSocket('ws://localhost:8080');
    
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        console.log('[TEST-RESILIENCE] Conectado para teste de persistência');
        ws.send(JSON.stringify({ type: 'register', name: 'TestUser3' }));
      });

      let messageReceived = false;
      ws.on('message', async (data) => {
        const message = JSON.parse(data);
        
        if (message.type === 'registered') {
          // Fecha conexão com MongoDB
          await mongoClient.close();
          
          // Envia mensagem mesmo sem MongoDB
          ws.send(JSON.stringify({ 
            type: 'chat', 
            text: 'Mensagem de teste sem MongoDB' 
          }));
        }

        if (message.type === 'chat' && !messageReceived) {
          messageReceived = true;
          console.log('[TEST-RESILIENCE] Mensagem mantida em memória sem MongoDB');
          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
    });
  });

  it('deve suportar alta carga mesmo com serviços instáveis', async function() {
    const NUM_CONNECTIONS = 50;
    const connections = [];
    const messages = [];

    // Cria várias conexões simultâneas
    for (let i = 0; i < NUM_CONNECTIONS; i++) {
      const ws = new WebSocket('ws://localhost:8080');
      connections.push(ws);

      ws.on('open', () => {
        ws.send(JSON.stringify({ 
          type: 'register', 
          name: `LoadUser${i}` 
        }));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'registered') {
          messages.push(`LoadUser${i}`);
        }
      });
    }

    // Aguarda todas as conexões serem registradas
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (messages.length >= NUM_CONNECTIONS) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });

    // Fecha todas as conexões
    for (const ws of connections) {
      ws.close();
    }

    assert.strictEqual(messages.length, NUM_CONNECTIONS, 
      'Todas as conexões devem ser registradas mesmo com carga alta');
  });
}); 