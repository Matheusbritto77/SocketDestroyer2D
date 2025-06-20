// Camada de conexão: gerencia conexões Socket.IO e autenticação
const { handleUserMessage, handleDisconnect } = require('./user');

function handleConnection(socket, io, namespace) {
  // Inicializa dados do usuário
  socket.user = null;
  socket.namespace = namespace;
  socket.rooms = new Set();

  console.log(`[SOCKET.IO] Nova conexão no namespace ${namespace}: ${socket.id}`);

  // Middleware de heartbeat personalizado
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });

  // Evento de autenticação
  socket.on('authenticate', async (data, callback) => {
    try {
      await handleUserMessage(socket, io, { type: 'auth', ...data });
      if (callback) {
        callback({ success: true, message: 'Autenticado com sucesso' });
      }
    } catch (error) {
      if (callback) {
        callback({ success: false, message: error.message });
      } else {
        socket.emit('error', { message: error.message });
      }
    }
  });

  // Evento de registro
  socket.on('register', async (data, callback) => {
    try {
      await handleUserMessage(socket, io, { type: 'register', ...data });
      if (callback) {
        callback({ success: true, message: 'Registrado com sucesso' });
      }
    } catch (error) {
      if (callback) {
        callback({ success: false, message: error.message });
      } else {
        socket.emit('error', { message: error.message });
      }
    }
  });

  // Evento de login
  socket.on('login', async (data, callback) => {
    try {
      await handleUserMessage(socket, io, { type: 'login', ...data });
      if (callback) {
        callback({ success: true, message: 'Login realizado com sucesso' });
      }
    } catch (error) {
      if (callback) {
        callback({ success: false, message: error.message });
      } else {
        socket.emit('error', { message: error.message });
      }
    }
  });

  // Evento de entrada em sala
  socket.on('join_room', async (data, callback) => {
    try {
      await handleUserMessage(socket, io, { type: 'join_room', ...data });
      if (callback) {
        callback({ success: true, message: 'Entrou na sala com sucesso' });
      }
    } catch (error) {
      if (callback) {
        callback({ success: false, message: error.message });
      } else {
        socket.emit('error', { message: error.message });
      }
    }
  });

  // Evento de saída de sala
  socket.on('leave_room', async (data, callback) => {
    try {
      await handleUserMessage(socket, io, { type: 'leave_room', ...data });
      if (callback) {
        callback({ success: true, message: 'Saiu da sala com sucesso' });
      }
    } catch (error) {
      if (callback) {
        callback({ success: false, message: error.message });
      } else {
        socket.emit('error', { message: error.message });
      }
    }
  });

  // Evento de criação de sala
  socket.on('create_room', async (data, callback) => {
    try {
      await handleUserMessage(socket, io, { type: 'create_room', ...data });
      if (callback) {
        callback({ success: true, message: 'Sala criada com sucesso' });
      }
    } catch (error) {
      if (callback) {
        callback({ success: false, message: error.message });
      } else {
        socket.emit('error', { message: error.message });
      }
    }
  });

  // Evento de listagem de salas
  socket.on('get_rooms', async (callback) => {
    try {
      await handleUserMessage(socket, io, { type: 'get_rooms' });
      if (callback) {
        callback({ success: true, message: 'Salas listadas com sucesso' });
      }
    } catch (error) {
      if (callback) {
        callback({ success: false, message: error.message });
      } else {
        socket.emit('error', { message: error.message });
      }
    }
  });

  // Evento de envio de mensagem
  socket.on('send_message', async (data, callback) => {
    try {
      await handleUserMessage(socket, io, { type: 'message', ...data });
      if (callback) {
        callback({ success: true, message: 'Mensagem enviada com sucesso' });
      }
    } catch (error) {
      if (callback) {
        callback({ success: false, message: error.message });
      } else {
        socket.emit('error', { message: error.message });
      }
    }
  });

  // Evento de atualização de status
  socket.on('update_status', async (data, callback) => {
    try {
      await handleUserMessage(socket, io, { type: 'status', ...data });
      if (callback) {
        callback({ success: true, message: 'Status atualizado com sucesso' });
      }
    } catch (error) {
      if (callback) {
        callback({ success: false, message: error.message });
      } else {
        socket.emit('error', { message: error.message });
      }
    }
  });

  // Evento de digitação
  socket.on('typing', async (data, callback) => {
    try {
      await handleUserMessage(socket, io, { type: 'typing', ...data });
      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      if (callback) {
        callback({ success: false, message: error.message });
      } else {
        socket.emit('error', { message: error.message });
      }
    }
  });

  // Evento de entrada na fila de matchmaking
  socket.on('join_match_queue', async (callback) => {
    try {
      await handleUserMessage(socket, io, { type: 'join_match_queue' });
      if (callback) {
        callback({ success: true, message: 'Entrou na fila de matchmaking' });
      }
    } catch (error) {
      if (callback) {
        callback({ success: false, message: error.message });
      } else {
        socket.emit('error', { message: error.message });
      }
    }
  });

  // Evento de saída da fila de matchmaking
  socket.on('leave_match_queue', async (callback) => {
    try {
      await handleUserMessage(socket, io, { type: 'leave_match_queue' });
      if (callback) {
        callback({ success: true, message: 'Saiu da fila de matchmaking' });
      }
    } catch (error) {
      if (callback) {
        callback({ success: false, message: error.message });
      } else {
        socket.emit('error', { message: error.message });
      }
    }
  });

  // Evento de ping para latência
  socket.on('ping_latency', (callback) => {
    const startTime = Date.now();
    if (callback) {
      callback({ timestamp: startTime });
    }
  });

  // Evento de desconexão
  socket.on('disconnect', (reason) => {
    console.log(`[SOCKET.IO] Usuário desconectado: ${socket.id} - Razão: ${reason}`);
    handleDisconnect(socket, io);
  });

  // Evento de reconexão
  socket.on('reconnect', () => {
    console.log(`[SOCKET.IO] Usuário reconectado: ${socket.id}`);
    // Aqui você pode implementar lógica de recuperação de estado
  });

  // Evento de erro
  socket.on('error', (error) => {
    console.error(`[SOCKET.IO] Erro no socket ${socket.id}:`, error);
  });

  // Evento de desconexão forçada
  socket.on('force_disconnect', () => {
    console.log(`[SOCKET.IO] Desconexão forçada: ${socket.id}`);
    socket.disconnect(true);
  });

  // Evento de heartbeat personalizado
  socket.on('heartbeat', () => {
    socket.emit('heartbeat_response', { timestamp: Date.now() });
  });

  // Evento de solicitação de informações do usuário
  socket.on('get_user_info', (callback) => {
    if (socket.user) {
      callback({
        success: true,
        user: {
          id: socket.user.id,
          username: socket.user.username,
          email: socket.user.email,
          isRegistered: socket.user.isRegistered,
          status: socket.user.status,
          rooms: Array.from(socket.rooms)
        }
      });
    } else {
      callback({ success: false, message: 'Usuário não autenticado' });
    }
  });

  // Evento de solicitação de estatísticas
  socket.on('get_stats', (callback) => {
    const stats = {
      totalConnections: io.engine.clientsCount,
      namespace: namespace,
      socketId: socket.id,
      userAuthenticated: !!socket.user,
      roomsJoined: socket.rooms.size
    };
    callback(stats);
  });
}

module.exports = { handleConnection }; 