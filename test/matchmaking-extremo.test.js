const WebSocket = require('ws');
const assert = require('assert');
const { wss, startServer } = require('../src/app');

describe('Estresse e Casos Extremos do Matchmaking/Chat', function () {
  this.timeout(60000); // 1 minuto para testes pesados
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
        ws.send(JSON.stringify({ type: 'register', name }));
      });

      ws.on('message', (msg) => {
        const data = JSON.parse(msg);
        if (data.type === 'room_joined') {
          stats.partnersFound++;
          if (options.onRoomJoined) {
            options.onRoomJoined(ws, data);
          }
        }
        if (data.type === 'chat') {
          stats.messages++;
        }
      });

      ws.stats = stats;
      resolve(ws);
    });
  }

  it('deve suportar entrada em massa na fila de matchmaking', async function () {
    const TOTAL = 200;
    const BATCH_SIZE = 20;
    const connections = [];
    let totalPareados = 0;

    console.log(`[TEST-EXTREMO] Iniciando teste de fila em massa com ${TOTAL} usuários`);

    // Criar conexões em lotes para não sobrecarregar
    for (let i = 0; i < TOTAL; i += BATCH_SIZE) {
      const batch = [];
      for (let j = 0; j < BATCH_SIZE && (i + j) < TOTAL; j++) {
        batch.push(createConnection(`FilaMassa${i + j}`));
      }
      const batchConnections = await Promise.all(batch);
      connections.push(...batchConnections);
      console.log(`[TEST-EXTREMO] Lote ${i/BATCH_SIZE + 1} conectado (${batchConnections.length} usuários)`);
      await new Promise(resolve => setTimeout(resolve, 500)); // Espera entre lotes
    }

    // Aguarda e verifica os pareamentos
    await new Promise(resolve => setTimeout(resolve, 10000));

    connections.forEach(ws => {
      totalPareados += ws.stats.partnersFound;
    });

    console.log(`[TEST-EXTREMO] Total de pareamentos: ${totalPareados}`);
    assert.ok(totalPareados >= TOTAL * 0.8, `Pareamento insuficiente: ${totalPareados}/${TOTAL}`);

    connections.forEach(ws => ws.close());
  });

  it('deve suportar conversas intensivas em massa', async function () {
    const SALAS = 50; // 100 usuários em 50 salas
    const MENSAGENS_POR_USUARIO = 20;
    const connections = [];
    let totalMensagens = 0;

    console.log(`[TEST-EXTREMO] Iniciando teste de conversas em massa com ${SALAS * 2} usuários`);

    // Criar pares de usuários
    for (let i = 0; i < SALAS * 2; i++) {
      const ws = await createConnection(`ChatMassa${i}`, {
        onRoomJoined: (ws, data) => {
          // Envia mensagens rapidamente após entrar na sala
          for (let j = 0; j < MENSAGENS_POR_USUARIO; j++) {
            setTimeout(() => {
              ws.send(JSON.stringify({
                type: 'chat',
                text: `Mensagem de teste ${j} de ${ws.stats.name}`
              }));
            }, Math.random() * 2000); // Distribui as mensagens em 2 segundos
          }
        }
      });
      connections.push(ws);
      if (i % 10 === 0) {
        console.log(`[TEST-EXTREMO] ${i + 1} usuários conectados`);
      }
    }

    // Aguarda as mensagens serem trocadas
    await new Promise(resolve => setTimeout(resolve, 15000));

    connections.forEach(ws => {
      totalMensagens += ws.stats.messages;
    });

    console.log(`[TEST-EXTREMO] Total de mensagens trocadas: ${totalMensagens}`);
    const mensagensEsperadas = SALAS * 2 * MENSAGENS_POR_USUARIO;
    assert.ok(totalMensagens >= mensagensEsperadas * 0.8, 
      `Mensagens insuficientes: ${totalMensagens}/${mensagensEsperadas}`);

    connections.forEach(ws => ws.close());
  });

  it('deve suportar desconexões e reconexões em massa', async function () {
    const TOTAL = 100;
    const connections = [];
    let reconexoes = 0;

    console.log(`[TEST-EXTREMO] Iniciando teste de desconexões em massa com ${TOTAL} usuários`);

    // Primeira onda de conexões
    for (let i = 0; i < TOTAL; i++) {
      const ws = await createConnection(`ReconexaoMassa${i}`);
      connections.push(ws);
      if (i % 10 === 0) {
        console.log(`[TEST-EXTREMO] ${i + 1} usuários conectados`);
      }
    }

    // Aguarda alguns pareamentos iniciais
    await new Promise(resolve => setTimeout(resolve, 5000));

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
      const ws = await createConnection(`ReconexaoMassa${idx}`);
      connections[idx] = ws;
      reconexoes++;
    }

    // Aguarda os novos pareamentos
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log(`[TEST-EXTREMO] Total de reconexões: ${reconexoes}`);
    assert.ok(reconexoes >= TOTAL * 0.4, `Reconexões insuficientes: ${reconexoes}/${TOTAL * 0.5}`);

    connections.forEach(ws => ws.close());
  });

  it('deve manter consistência sob carga mista', async function () {
    const TOTAL = 150;
    const connections = [];
    let mensagensEnviadas = 0;
    let mensagensRecebidas = 0;
    let pareamentos = 0;

    console.log(`[TEST-EXTREMO] Iniciando teste de carga mista com ${TOTAL} usuários`);

    // Conecta usuários em intervalos curtos
    for (let i = 0; i < TOTAL; i++) {
      const ws = await createConnection(`MistoCarga${i}`, {
        onRoomJoined: (ws, data) => {
          pareamentos++;
          // 30% dos usuários enviam mensagens intensivamente
          if (i % 3 === 0) {
            setInterval(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'chat',
                  text: `Mensagem de carga ${Date.now()}`
                }));
                mensagensEnviadas++;
              }
            }, 100); // 10 mensagens por segundo
          }
        }
      });

      ws.on('message', (msg) => {
        const data = JSON.parse(msg);
        if (data.type === 'chat') {
          mensagensRecebidas++;
        }
      });

      connections.push(ws);
      
      // 20% dos usuários desconectam e reconectam periodicamente
      if (i % 5 === 0) {
        setInterval(() => {
          if (Math.random() < 0.3) { // 30% de chance de reconexão
            ws.close();
            setTimeout(() => {
              createConnection(`MistoCarga${i}`).then(newWs => {
                connections[i] = newWs;
              });
            }, 1000);
          }
        }, 5000);
      }

      if (i % 10 === 0) {
        console.log(`[TEST-EXTREMO] ${i + 1} usuários conectados`);
        console.log(`Pareamentos: ${pareamentos}`);
        console.log(`Mensagens enviadas: ${mensagensEnviadas}`);
        console.log(`Mensagens recebidas: ${mensagensRecebidas}`);
      }

      await new Promise(resolve => setTimeout(resolve, 50)); // Pequeno delay entre conexões
    }

    // Mantém o teste rodando por 20 segundos
    await new Promise(resolve => setTimeout(resolve, 20000));

    console.log('[TEST-EXTREMO] Resultados finais:');
    console.log(`Pareamentos: ${pareamentos}`);
    console.log(`Mensagens enviadas: ${mensagensEnviadas}`);
    console.log(`Mensagens recebidas: ${mensagensRecebidas}`);

    // Verifica se houve atividade significativa
    assert.ok(pareamentos >= TOTAL * 0.7, `Pareamentos insuficientes: ${pareamentos}`);
    assert.ok(mensagensEnviadas > 0, 'Nenhuma mensagem foi enviada');
    assert.ok(mensagensRecebidas > 0, 'Nenhuma mensagem foi recebida');
    assert.ok(mensagensRecebidas >= mensagensEnviadas * 0.7, 
      `Muitas mensagens perdidas. Enviadas: ${mensagensEnviadas}, Recebidas: ${mensagensRecebidas}`);

    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
  });
}); 