const WebSocket = require('ws');
const assert = require('assert');
const { wss, startServer } = require('../src/app');

describe('Sistema de Matchmaking e Chat', function () {
  this.timeout(15000);
  let serverInstance;
  let ws1, ws2;

  before(async function () {
    console.log('[TEST] Iniciando servidor de teste...');
    try {
      serverInstance = await startServer();
      console.log('[TEST] Servidor pronto!');
    } catch (error) {
      console.error('[TEST] Erro ao iniciar servidor:', error);
      throw error;
    }
  });

  after(function (done) {
    if (!serverInstance) {
      console.log('[TEST] Servidor já estava fechado');
      done();
      return;
    }
    console.log('[TEST] Encerrando servidor...');
    serverInstance.close(() => {
      console.log('[TEST] Servidor encerrado!');
      done();
    });
  });

  beforeEach(function () {
    // Limpa as conexões antes de cada teste
    ws1 = null;
    ws2 = null;
  });

  afterEach(function () {
    // Fecha as conexões após cada teste
    if (ws1 && ws1.readyState === WebSocket.OPEN) ws1.close();
    if (ws2 && ws2.readyState === WebSocket.OPEN) ws2.close();
  });

  it('deve registrar dois usuários, formar uma sala e trocar mensagens', function (done) {
    let salaId = null;
    let mensagensRecebidas = 0;
    const TOTAL_MENSAGENS = 5;
    console.log('[TEST] Iniciando teste de registro e chat...');
    
    ws1 = new WebSocket('ws://localhost:8080');
    ws2 = new WebSocket('ws://localhost:8080');

    ws1.on('error', (error) => console.error('[TEST] Erro no ws1:', error));
    ws2.on('error', (error) => console.error('[TEST] Erro no ws2:', error));

    ws1.on('open', () => {
      console.log('[TEST] ws1 conectado, registrando Alice...');
      ws1.send(JSON.stringify({ type: 'register', name: 'Alice' }));
    });

    ws2.on('open', () => {
      console.log('[TEST] ws2 conectado, registrando Bob...');
      ws2.send(JSON.stringify({ type: 'register', name: 'Bob' }));
    });

    ws1.on('message', (msg) => {
      const data = JSON.parse(msg);
      console.log('[TEST] ws1 recebeu:', data);
      if (data.type === 'room_joined') {
        salaId = data.roomId;
        console.log('[TEST] Alice entrou na sala:', salaId);
        // Envia múltiplas mensagens
        for (let i = 0; i < TOTAL_MENSAGENS; i++) {
          setTimeout(() => {
            ws1.send(JSON.stringify({ type: 'chat', text: `Mensagem ${i + 1} de Alice` }));
          }, i * 100);
        }
      }
      if (data.type === 'chat') {
        mensagensRecebidas++;
        if (mensagensRecebidas === TOTAL_MENSAGENS * 2) { // Recebeu todas as mensagens
          console.log('[TEST] Teste de chat completo!');
          done();
        }
      }
    });

    ws2.on('message', (msg) => {
      const data = JSON.parse(msg);
      console.log('[TEST] ws2 recebeu:', data);
      if (data.type === 'room_joined') {
        salaId = data.roomId;
        console.log('[TEST] Bob entrou na sala:', salaId);
        // Envia múltiplas mensagens
        for (let i = 0; i < TOTAL_MENSAGENS; i++) {
          setTimeout(() => {
            ws2.send(JSON.stringify({ type: 'chat', text: `Mensagem ${i + 1} de Bob` }));
          }, i * 100);
        }
      }
      if (data.type === 'chat') {
        mensagensRecebidas++;
        if (mensagensRecebidas === TOTAL_MENSAGENS * 2) { // Recebeu todas as mensagens
          console.log('[TEST] Teste de chat completo!');
          done();
        }
      }
    });
  });

  it('deve retornar ambos para a fila se um sair da sala', function (done) {
    console.log('[TEST] Iniciando teste de saída da sala...');
    ws1 = new WebSocket('ws://localhost:8080');
    ws2 = new WebSocket('ws://localhost:8080');
    let saiu = 0;
    let voltouParaFila = 0;

    ws1.on('error', (error) => console.error('[TEST] Erro no ws1:', error));
    ws2.on('error', (error) => console.error('[TEST] Erro no ws2:', error));

    ws1.on('open', () => {
      console.log('[TEST] ws1 conectado, registrando Carol...');
      ws1.send(JSON.stringify({ type: 'register', name: 'Carol' }));
    });

    ws2.on('open', () => {
      console.log('[TEST] ws2 conectado, registrando Dave...');
      ws2.send(JSON.stringify({ type: 'register', name: 'Dave' }));
    });

    ws1.on('message', (msg) => {
      const data = JSON.parse(msg);
      console.log('[TEST] ws1 recebeu:', data);
      if (data.type === 'room_joined') {
        console.log('[TEST] Carol saindo da sala...');
        setTimeout(() => {
          ws1.send(JSON.stringify({ type: 'leave_room' }));
        }, 500);
      }
      if (data.type === 'partner_left') {
        saiu++;
        console.log('[TEST] Saída confirmada:', saiu);
      }
      if (data.type === 'queue') {
        voltouParaFila++;
        console.log('[TEST] Voltou para fila:', voltouParaFila);
        if (voltouParaFila === 2) {
          console.log('[TEST] Teste de saída completo!');
          done();
        }
      }
    });

    ws2.on('message', (msg) => {
      const data = JSON.parse(msg);
      console.log('[TEST] ws2 recebeu:', data);
      if (data.type === 'partner_left') {
        saiu++;
        console.log('[TEST] Saída confirmada:', saiu);
      }
      if (data.type === 'queue') {
        voltouParaFila++;
        console.log('[TEST] Voltou para fila:', voltouParaFila);
        if (voltouParaFila === 2) {
          console.log('[TEST] Teste de saída completo!');
          done();
        }
      }
    });
  });

  it('deve lidar com reconexão após desconexão', function (done) {
    console.log('[TEST] Iniciando teste de reconexão...');
    let reconectou = false;
    
    ws1 = new WebSocket('ws://localhost:8080');
    
    ws1.on('error', (error) => console.error('[TEST] Erro no ws1:', error));

    ws1.on('open', () => {
      if (!reconectou) {
        console.log('[TEST] Primeira conexão, registrando Eve...');
        ws1.send(JSON.stringify({ type: 'register', name: 'Eve' }));
        
        // Força desconexão após registro
        setTimeout(() => {
          console.log('[TEST] Forçando desconexão...');
          ws1.close();
          
          // Reconecta após um breve delay
          setTimeout(() => {
            console.log('[TEST] Tentando reconexão...');
            reconectou = true;
            ws1 = new WebSocket('ws://localhost:8080');
            ws1.on('open', () => {
              console.log('[TEST] Reconectado, registrando Eve novamente...');
              ws1.send(JSON.stringify({ type: 'register', name: 'Eve' }));
            });
            ws1.on('message', (msg) => {
              const data = JSON.parse(msg);
              console.log('[TEST] Recebido após reconexão:', data);
              if (data.type === 'registered') {
                console.log('[TEST] Reconexão bem-sucedida!');
                done();
              }
            });
          }, 1000);
        }, 500);
      }
    });
  });
}); 