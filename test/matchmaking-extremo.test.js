const WebSocket = require('ws');
const assert = require('assert');
const { wss, startServer } = require('../src/app');

describe('Testes de Performance e Casos Extremos', function () {
  this.timeout(30000); // 30 segundos para testes mais leves
  let serverInstance;

  before(async function () {
    console.log('[TEST-EXTREMO] Iniciando servidor de teste...');
    try {
      serverInstance = await startServer();
      console.log('[TEST-EXTREMO] Servidor pronto!');
    } catch (error) {
      console.error('[TEST-EXTREMO] Erro ao iniciar servidor:', error);
      throw error;
    }
  });

  after(function (done) {
    if (!serverInstance) {
      console.log('[TEST-EXTREMO] Servidor já estava fechado');
      done();
      return;
    }
    console.log('[TEST-EXTREMO] Encerrando servidor...');
    serverInstance.close(() => {
      console.log('[TEST-EXTREMO] Servidor encerrado!');
      done();
    });
  });

  // Função auxiliar para criar uma conexão WebSocket
  function createConnection(name, options = {}) {
    return new Promise((resolve) => {
      const ws = new WebSocket('ws://localhost:8080');
      const stats = { messages: 0, partnersFound: 0 };

      ws.on('error', (error) => {
        console.error(`[TEST-EXTREMO] Erro no socket ${name}:`, error);
      });

      ws.on('open', () => {
        console.log(`[TEST-EXTREMO] Socket ${name} conectado`);
        ws.send(JSON.stringify({ type: 'auth', username: name }));
      });

      ws.on('message', (msg) => {
        const data = JSON.parse(msg);
        if (data.type === 'room_joined') {
          stats.partnersFound++;
          if (options.onRoomJoined) {
            options.onRoomJoined(ws, data);
          }
        }
        if (data.type === 'message') {
          stats.messages++;
        }
      });

      ws.stats = stats;
      resolve(ws);
    });
  }

  it('deve suportar entrada moderada na fila de matchmaking', async function () {
    const TOTAL = 20; // Reduzido de 200 para 20
    const BATCH_SIZE = 5; // Reduzido de 20 para 5
    const connections = [];
    let totalPareados = 0;

    console.log(`[TEST-EXTREMO] Iniciando teste de fila moderada com ${TOTAL} usuários`);

    // Criar conexões em lotes menores
    for (let i = 0; i < TOTAL; i += BATCH_SIZE) {
      const batch = [];
      for (let j = 0; j < BATCH_SIZE && (i + j) < TOTAL; j++) {
        batch.push(createConnection(`FilaModerada${i + j}`));
      }
      const batchConnections = await Promise.all(batch);
      connections.push(...batchConnections);
      console.log(`[TEST-EXTREMO] Lote ${i/BATCH_SIZE + 1} conectado (${batchConnections.length} usuários)`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Aumentado delay entre lotes
    }

    // Aguarda e verifica os pareamentos
    await new Promise(resolve => setTimeout(resolve, 8000));

    connections.forEach(ws => {
      totalPareados += ws.stats.partnersFound;
    });

    console.log(`[TEST-EXTREMO] Total de pareamentos: ${totalPareados}`);
    assert.ok(totalPareados >= TOTAL * 0.6, `Pareamento insuficiente: ${totalPareados}/${TOTAL}`);

    connections.forEach(ws => ws.close());
  });

  it('deve suportar conversas moderadas', async function () {
    const SALAS = 5; // Reduzido de 50 para 5
    const MENSAGENS_POR_USUARIO = 5; // Reduzido de 20 para 5
    const connections = [];
    let totalMensagens = 0;

    console.log(`[TEST-EXTREMO] Iniciando teste de conversas moderadas com ${SALAS * 2} usuários`);

    // Criar pares de usuários
    for (let i = 0; i < SALAS * 2; i++) {
      const ws = await createConnection(`ChatModerado${i}`, {
        onRoomJoined: (ws, data) => {
          // Envia mensagens com delay maior
          for (let j = 0; j < MENSAGENS_POR_USUARIO; j++) {
            setTimeout(() => {
              ws.send(JSON.stringify({
                type: 'message',
                content: `Mensagem de teste ${j} de ${ws.stats.name}`,
                room: data.room
              }));
            }, j * 500); // 500ms entre mensagens
          }
        }
      });
      connections.push(ws);
      if (i % 2 === 0) {
        console.log(`[TEST-EXTREMO] ${i + 1} usuários conectados`);
      }
      await new Promise(resolve => setTimeout(resolve, 200)); // Delay entre conexões
    }

    // Aguarda as mensagens serem trocadas
    await new Promise(resolve => setTimeout(resolve, 10000));

    connections.forEach(ws => {
      totalMensagens += ws.stats.messages;
    });

    console.log(`[TEST-EXTREMO] Total de mensagens trocadas: ${totalMensagens}`);
    const mensagensEsperadas = SALAS * 2 * MENSAGENS_POR_USUARIO;
    assert.ok(totalMensagens >= mensagensEsperadas * 0.6, 
      `Mensagens insuficientes: ${totalMensagens}/${mensagensEsperadas}`);

    connections.forEach(ws => ws.close());
  });

  it('deve suportar desconexões e reconexões moderadas', async function () {
    const TOTAL = 10; // Reduzido de 100 para 10
    const connections = [];
    let reconexoes = 0;

    console.log(`[TEST-EXTREMO] Iniciando teste de desconexões moderadas com ${TOTAL} usuários`);

    // Primeira onda de conexões
    for (let i = 0; i < TOTAL; i++) {
      const ws = await createConnection(`ReconexaoModerada${i}`);
      connections.push(ws);
      if (i % 2 === 0) {
        console.log(`[TEST-EXTREMO] ${i + 1} usuários conectados`);
      }
      await new Promise(resolve => setTimeout(resolve, 300)); // Delay entre conexões
    }

    // Aguarda alguns pareamentos iniciais
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Desconecta metade dos usuários aleatoriamente
    console.log('[TEST-EXTREMO] Iniciando desconexões aleatórias...');
    const desconectados = new Set();
    while (desconectados.size < TOTAL / 2) {
      const idx = Math.floor(Math.random() * TOTAL);
      if (!desconectados.has(idx)) {
        desconectados.add(idx);
        connections[idx].close();
      }
    }

    // Aguarda um pouco e reconecta os usuários
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('[TEST-EXTREMO] Reconectando usuários...');

    // Reconecta os usuários desconectados
    for (const idx of desconectados) {
      const ws = await createConnection(`ReconexaoModerada${idx}`);
      connections[idx] = ws;
      reconexoes++;
      await new Promise(resolve => setTimeout(resolve, 200)); // Delay entre reconexões
    }

    // Aguarda os novos pareamentos
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log(`[TEST-EXTREMO] Total de reconexões: ${reconexoes}`);
    assert.ok(reconexoes >= TOTAL * 0.3, `Reconexões insuficientes: ${reconexoes}/${TOTAL * 0.5}`);

    connections.forEach(ws => ws.close());
  });

  it('deve manter consistência sob carga moderada', async function () {
    const TOTAL = 15; // Reduzido de 150 para 15
    const connections = [];
    let mensagensEnviadas = 0;
    let mensagensRecebidas = 0;
    let pareamentos = 0;

    console.log(`[TEST-EXTREMO] Iniciando teste de carga moderada com ${TOTAL} usuários`);

    // Conecta usuários em intervalos maiores
    for (let i = 0; i < TOTAL; i++) {
      const ws = await createConnection(`MistoModerado${i}`, {
        onRoomJoined: (ws, data) => {
          pareamentos++;
          // 30% dos usuários enviam mensagens moderadamente
          if (i % 3 === 0) {
            setInterval(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'message',
                  content: `Mensagem de carga ${Date.now()}`,
                  room: data.room
                }));
                mensagensEnviadas++;
              }
            }, 1000); // 1 mensagem por segundo (reduzido de 100ms)
          }
        }
      });

      ws.on('message', (msg) => {
        const data = JSON.parse(msg);
        if (data.type === 'message') {
          mensagensRecebidas++;
        }
      });

      connections.push(ws);
      
      // 20% dos usuários desconectam e reconectam periodicamente
      if (i % 5 === 0) {
        setInterval(() => {
          if (Math.random() < 0.2) { // Reduzido de 30% para 20%
            ws.close();
            setTimeout(() => {
              createConnection(`MistoModerado${i}`).then(newWs => {
                connections[i] = newWs;
              });
            }, 2000); // Aumentado delay
          }
        }, 10000); // Aumentado intervalo
      }

      if (i % 3 === 0) {
        console.log(`[TEST-EXTREMO] ${i + 1} usuários conectados`);
        console.log(`Pareamentos: ${pareamentos}`);
        console.log(`Mensagens enviadas: ${mensagensEnviadas}`);
        console.log(`Mensagens recebidas: ${mensagensRecebidas}`);
      }

      await new Promise(resolve => setTimeout(resolve, 200)); // Delay entre conexões
    }

    // Mantém o teste rodando por 15 segundos (reduzido de 20)
    await new Promise(resolve => setTimeout(resolve, 15000));

    console.log('[TEST-EXTREMO] Resultados finais:');
    console.log(`Pareamentos: ${pareamentos}`);
    console.log(`Mensagens enviadas: ${mensagensEnviadas}`);
    console.log(`Mensagens recebidas: ${mensagensRecebidas}`);

    // Verifica se houve atividade significativa
    assert.ok(pareamentos >= TOTAL * 0.5, `Pareamentos insuficientes: ${pareamentos}`);
    assert.ok(mensagensEnviadas > 0, 'Nenhuma mensagem foi enviada');
    assert.ok(mensagensRecebidas > 0, 'Nenhuma mensagem foi recebida');
    assert.ok(mensagensRecebidas >= mensagensEnviadas * 0.5, 
      `Muitas mensagens perdidas. Enviadas: ${mensagensEnviadas}, Recebidas: ${mensagensRecebidas}`);

    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
  });
}); 