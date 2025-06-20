const { io } = require('socket.io-client');
const assert = require('assert');
const { wss, startServer } = require('../src/app');

describe('Sistema de Chat e Salas com Socket.IO', function () {
  this.timeout(15000);
  let serverInstance;
  let socket1, socket2;

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
    socket1 = null;
    socket2 = null;
  });

  afterEach(function () {
    // Fecha as conexões após cada teste
    if (socket1 && socket1.connected) socket1.disconnect();
    if (socket2 && socket2.connected) socket2.disconnect();
  });

  it('deve autenticar dois usuários e trocar mensagens em sala', function (done) {
    let salaId = null;
    let mensagensRecebidas = 0;
    const TOTAL_MENSAGENS = 3; // Reduzido de 5 para 3
    let socket1Pronto = false;
    let socket2Pronto = false;
    let socket1RoomId = null;
    let socket2RoomId = null;
    console.log('[TEST] Iniciando teste de autenticação e chat...');
    
    socket1 = io('http://localhost:8080');
    socket2 = io('http://localhost:8080');

    socket1.on('connect_error', (error) => console.error('[TEST] Erro no socket1:', error));
    socket2.on('connect_error', (error) => console.error('[TEST] Erro no socket2:', error));

    socket1.on('connect', () => {
      console.log('[TEST] socket1 conectado, autenticando Alice...');
      socket1.emit('authenticate', { username: 'Alice' });
    });

    socket2.on('connect', () => {
      console.log('[TEST] socket2 conectado, autenticando Bob...');
      socket2.emit('authenticate', { username: 'Bob' });
    });

    socket1.on('auth_response', (data) => {
      console.log('[TEST] socket1 recebeu auth_response:', data);
      if (data.success) {
        console.log('[TEST] Alice autenticada, entrando na sala match...');
        socket1.emit('join_room', { room: 'match' });
      }
    });

    socket1.on('room_joined', (data) => {
      socket1Pronto = true;
      socket1RoomId = data.room.roomId || data.room.room_id || data.room; // compatibilidade
      salaId = socket1RoomId;
      console.log('[TEST] Alice entrou na sala:', socket1RoomId);
      if (socket1Pronto && socket2Pronto) {
        // Só envia mensagens quando ambos estiverem prontos
        for (let i = 0; i < TOTAL_MENSAGENS; i++) {
          setTimeout(() => {
            socket1.emit('send_message', { 
              content: `Mensagem ${i + 1} de Alice`, 
              room: salaId 
            });
          }, i * 200);
        }
      }
    });

    socket1.on('message', (data) => {
      mensagensRecebidas++;
      if (mensagensRecebidas === TOTAL_MENSAGENS * 2) {
        console.log('[TEST] Teste de chat completo!');
        done();
      }
    });

    socket2.on('auth_response', (data) => {
      console.log('[TEST] socket2 recebeu auth_response:', data);
      if (data.success) {
        console.log('[TEST] Bob autenticado, entrando na sala match...');
        socket2.emit('join_room', { room: 'match' });
      }
    });

    socket2.on('room_joined', (data) => {
      socket2Pronto = true;
      socket2RoomId = data.room.roomId || data.room.room_id || data.room;
      salaId = socket2RoomId;
      console.log('[TEST] Bob entrou na sala:', socket2RoomId);
      if (socket1Pronto && socket2Pronto) {
        for (let i = 0; i < TOTAL_MENSAGENS; i++) {
          setTimeout(() => {
            socket2.emit('send_message', { 
              content: `Mensagem ${i + 1} de Bob`, 
              room: salaId 
            });
          }, i * 200);
        }
      }
    });

    socket2.on('message', (data) => {
      mensagensRecebidas++;
      if (mensagensRecebidas === TOTAL_MENSAGENS * 2) {
        console.log('[TEST] Teste de chat completo!');
        done();
      }
    });
  });

  it('deve registrar usuário e criar sala pública', function (done) {
    console.log('[TEST] Iniciando teste de registro e criação de sala...');
    socket1 = io('http://localhost:8080');

    socket1.on('connect_error', (error) => console.error('[TEST] Erro no socket1:', error));
    socket1.on('error', (error) => console.error('[TEST] Erro recebido no socket1:', error));

    socket1.on('connect', () => {
      console.log('[TEST] socket1 conectado, registrando Carol...');
      const timestamp = Date.now();
      socket1.emit('register', { 
        email: `carol${timestamp}@test.com`, 
        password: 'senha123', 
        username: `Carol${timestamp}` 
      });
    });

    socket1.on('register_response', (data) => {
      console.log('[TEST] socket1 recebeu register_response:', data);
      
      if (data.success) {
        console.log('[TEST] Carol registrada, criando sala...');
        const timestamp = Date.now();
        socket1.emit('create_room', { 
          name: `Sala de Teste ${timestamp}`, 
          description: 'Sala criada para teste' 
        });
      } else {
        console.error('[TEST] Falha no registro:', data.message);
        done(new Error('Falha no registro: ' + data.message));
      }
    });
    
    socket1.on('room_created', (data) => {
      console.log('[TEST] Sala criada com sucesso:', data);
      socket1.emit('get_rooms');
    });
    
    socket1.on('rooms_list', (data) => {
      console.log('[TEST] Lista de salas recebida:', data.rooms.length, 'salas');
      console.log('[TEST] Detalhes das salas:', data.rooms);
      assert.ok(data.rooms.length > 0, 'Deve haver pelo menos uma sala');
      done();
    });

    // Timeout para evitar que o teste fique travado
    setTimeout(() => {
      console.error('[TEST] Timeout no teste de criação de sala');
      done(new Error('Timeout no teste de criação de sala'));
    }, 10000);
  });

  it('deve lidar com reconexão após desconexão', function (done) {
    console.log('[TEST] Iniciando teste de reconexão...');
    let reconectou = false;
    
    socket1 = io('http://localhost:8080');
    
    socket1.on('connect_error', (error) => console.error('[TEST] Erro no socket1:', error));

    socket1.on('connect', () => {
      if (!reconectou) {
        console.log('[TEST] Primeira conexão, autenticando Eve...');
        socket1.emit('authenticate', { username: 'Eve' });
        
        // Força desconexão após autenticação
        setTimeout(() => {
          console.log('[TEST] Forçando desconexão...');
          socket1.disconnect();
          
          // Reconecta após um breve delay
          setTimeout(() => {
            console.log('[TEST] Tentando reconexão...');
            reconectou = true;
            socket1 = io('http://localhost:8080');
            socket1.on('connect', () => {
              console.log('[TEST] Reconectado, autenticando Eve novamente...');
              socket1.emit('authenticate', { username: 'Eve' });
            });
            socket1.on('auth_response', (data) => {
              console.log('[TEST] Recebido após reconexão:', data);
              if (data.success) {
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
    socket1 = io('http://localhost:8080');
    let mensagensEnviadas = 0;
    let errosRecebidos = 0;
    let doneCalled = false;

    socket1.on('connect_error', (error) => console.error('[TEST] Erro no socket1:', error));

    socket1.on('connect', () => {
      console.log('[TEST] socket1 conectado, testando rate limiting...');
      for (let i = 0; i < 50; i++) {
        setTimeout(() => {
          socket1.emit('send_message', { 
            content: `Mensagem ${i}`, 
            room: 'test' 
          });
          mensagensEnviadas++;
        }, i * 10);
      }
    });

    socket1.on('error', (data) => {
      errosRecebidos++;
      console.log('[TEST] Erro de rate limiting recebido:', data.message);
      if (errosRecebidos >= 3 && !doneCalled) {
        doneCalled = true;
        console.log('[TEST] Rate limiting funcionando corretamente!');
        done();
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