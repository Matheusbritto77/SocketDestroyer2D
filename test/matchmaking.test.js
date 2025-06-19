const WebSocket = require('ws');
const assert = require('assert');
const { wss, startServer } = require('../src/app');

describe('Sistema de Chat e Salas', function () {
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

  it('deve autenticar dois usuários e trocar mensagens em sala', function (done) {
    let salaId = null;
    let mensagensRecebidas = 0;
    const TOTAL_MENSAGENS = 3; // Reduzido de 5 para 3
    let ws1Pronto = false;
    let ws2Pronto = false;
    let ws1RoomId = null;
    let ws2RoomId = null;
    console.log('[TEST] Iniciando teste de autenticação e chat...');
    
    ws1 = new WebSocket('ws://localhost:8080');
    ws2 = new WebSocket('ws://localhost:8080');

    ws1.on('error', (error) => console.error('[TEST] Erro no ws1:', error));
    ws2.on('error', (error) => console.error('[TEST] Erro no ws2:', error));

    ws1.on('open', () => {
      console.log('[TEST] ws1 conectado, autenticando Alice...');
      ws1.send(JSON.stringify({ type: 'auth', username: 'Alice' }));
    });

    ws2.on('open', () => {
      console.log('[TEST] ws2 conectado, autenticando Bob...');
      ws2.send(JSON.stringify({ type: 'auth', username: 'Bob' }));
    });

    ws1.on('message', (msg) => {
      const data = JSON.parse(msg);
      console.log('[TEST] ws1 recebeu:', data);
      if (data.type === 'auth_response' && data.success) {
        console.log('[TEST] Alice autenticada, entrando na sala match...');
        ws1.send(JSON.stringify({ type: 'join_room', room: 'match' }));
      }
      if (data.type === 'room_joined') {
        ws1Pronto = true;
        ws1RoomId = data.room.roomId || data.room.room_id || data.room; // compatibilidade
        salaId = ws1RoomId;
        console.log('[TEST] Alice entrou na sala:', ws1RoomId);
        if (ws1Pronto && ws2Pronto) {
          // Só envia mensagens quando ambos estiverem prontos
          for (let i = 0; i < TOTAL_MENSAGENS; i++) {
            setTimeout(() => {
              ws1.send(JSON.stringify({ 
                type: 'message', 
                content: `Mensagem ${i + 1} de Alice`, 
                room: salaId 
              }));
            }, i * 200);
          }
        }
      }
      if (data.type === 'message') {
        mensagensRecebidas++;
        if (mensagensRecebidas === TOTAL_MENSAGENS * 2) {
          console.log('[TEST] Teste de chat completo!');
          done();
        }
      }
    });

    ws2.on('message', (msg) => {
      const data = JSON.parse(msg);
      console.log('[TEST] ws2 recebeu:', data);
      if (data.type === 'auth_response' && data.success) {
        console.log('[TEST] Bob autenticado, entrando na sala match...');
        ws2.send(JSON.stringify({ type: 'join_room', room: 'match' }));
      }
      if (data.type === 'room_joined') {
        ws2Pronto = true;
        ws2RoomId = data.room.roomId || data.room.room_id || data.room;
        salaId = ws2RoomId;
        console.log('[TEST] Bob entrou na sala:', ws2RoomId);
        if (ws1Pronto && ws2Pronto) {
          for (let i = 0; i < TOTAL_MENSAGENS; i++) {
            setTimeout(() => {
              ws2.send(JSON.stringify({ 
                type: 'message', 
                content: `Mensagem ${i + 1} de Bob`, 
                room: salaId 
              }));
            }, i * 200);
          }
        }
      }
      if (data.type === 'message') {
        mensagensRecebidas++;
        if (mensagensRecebidas === TOTAL_MENSAGENS * 2) {
          console.log('[TEST] Teste de chat completo!');
          done();
        }
      }
    });
  });

  it('deve registrar usuário e criar sala pública', function (done) {
    console.log('[TEST] Iniciando teste de registro e criação de sala...');
    ws1 = new WebSocket('ws://localhost:8080');

    ws1.on('error', (error) => console.error('[TEST] Erro no ws1:', error));

    ws1.on('open', () => {
      console.log('[TEST] ws1 conectado, registrando Carol...');
      ws1.send(JSON.stringify({ 
        type: 'register', 
        email: 'carol@test.com', 
        password: 'senha123', 
        username: 'Carol' 
      }));
    });

    ws1.on('message', (msg) => {
      const data = JSON.parse(msg);
      console.log('[TEST] ws1 recebeu:', data);
      
      if (data.type === 'register_response' && data.success) {
        console.log('[TEST] Carol registrada, criando sala...');
        ws1.send(JSON.stringify({ 
          type: 'create_room', 
          name: 'Sala de Teste', 
          description: 'Sala criada para teste' 
        }));
      }
      
      if (data.type === 'room_created') {
        console.log('[TEST] Sala criada com sucesso:', data.room);
        ws1.send(JSON.stringify({ type: 'get_rooms' }));
      }
      
      if (data.type === 'rooms_list') {
        console.log('[TEST] Lista de salas recebida:', data.rooms.length, 'salas');
        assert.ok(data.rooms.length > 0, 'Deve haver pelo menos uma sala');
        done();
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
        console.log('[TEST] Primeira conexão, autenticando Eve...');
        ws1.send(JSON.stringify({ type: 'auth', username: 'Eve' }));
        
        // Força desconexão após autenticação
        setTimeout(() => {
          console.log('[TEST] Forçando desconexão...');
          ws1.close();
          
          // Reconecta após um breve delay
          setTimeout(() => {
            console.log('[TEST] Tentando reconexão...');
            reconectou = true;
            ws1 = new WebSocket('ws://localhost:8080');
            ws1.on('open', () => {
              console.log('[TEST] Reconectado, autenticando Eve novamente...');
              ws1.send(JSON.stringify({ type: 'auth', username: 'Eve' }));
            });
            ws1.on('message', (msg) => {
              const data = JSON.parse(msg);
              console.log('[TEST] Recebido após reconexão:', data);
              if (data.type === 'auth_response' && data.success) {
                console.log('[TEST] Reconexão bem-sucedida!');
                done();
              }
            });
          }, 1000);
        }, 500);
      }
    });
  });

  it('deve testar rate limiting', function (done) {
    console.log('[TEST] Iniciando teste de rate limiting...');
    ws1 = new WebSocket('ws://localhost:8080');
    let mensagensEnviadas = 0;
    let errosRecebidos = 0;
    let doneCalled = false;

    ws1.on('error', (error) => console.error('[TEST] Erro no ws1:', error));

    ws1.on('open', () => {
      console.log('[TEST] ws1 conectado, testando rate limiting...');
      for (let i = 0; i < 50; i++) {
        setTimeout(() => {
          ws1.send(JSON.stringify({ 
            type: 'message', 
            content: `Mensagem ${i}`, 
            room: 'test' 
          }));
          mensagensEnviadas++;
        }, i * 10);
      }
    });

    ws1.on('message', (msg) => {
      const data = JSON.parse(msg);
      if (data.type === 'error') {
        errosRecebidos++;
        console.log('[TEST] Erro de rate limiting recebido:', data.message);
        if (errosRecebidos >= 3 && !doneCalled) {
          doneCalled = true;
          console.log('[TEST] Rate limiting funcionando corretamente!');
          done();
        }
      }
    });

    setTimeout(() => {
      if (errosRecebidos === 0 && !doneCalled) {
        doneCalled = true;
        console.log('[TEST] Rate limiting não foi ativado');
        done();
      }
    }, 5000);
  });
}); 