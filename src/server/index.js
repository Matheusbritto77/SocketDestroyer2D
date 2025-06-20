const { createServer } = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const redisClient = require('../config/redis');
const { handleConnection } = require('./layers/connection');

function createSocketIOServer() {
  return new Promise((resolve, reject) => {
    try {
      // Cria servidor HTTP
      const httpServer = createServer();
      
      // Cria servidor Socket.IO com configurações avançadas
      const io = new Server(httpServer, {
        cors: {
          origin: "*", // Em produção, especifique domínios permitidos
          methods: ["GET", "POST"]
        },
        transports: ['websocket', 'polling'], // Suporte a fallback
        allowEIO3: true, // Compatibilidade com Engine.IO v3
        pingTimeout: 60000, // 60 segundos
        pingInterval: 25000, // 25 segundos
        upgradeTimeout: 10000, // 10 segundos
        maxHttpBufferSize: 1e6, // 1MB
        allowRequest: (req, callback) => {
          // Middleware de autorização (opcional)
          callback(null, true);
        }
      });

      // Configura adapter Redis para escalabilidade
      const pubClient = redisClient.duplicate();
      const subClient = redisClient.duplicate();
      
      io.adapter(createAdapter(pubClient, subClient));

      // Namespace principal para chat
      const chatNamespace = io.of('/chat');
      
      // Namespace para matchmaking
      const matchNamespace = io.of('/match');

      // Middleware de autenticação para chat
      chatNamespace.use((socket, next) => {
        // Log de conexão
        console.log(`[SOCKET.IO] Nova conexão: ${socket.id} - IP: ${socket.handshake.address}`);
        next();
      });

      // Middleware de autenticação para matchmaking
      matchNamespace.use((socket, next) => {
        console.log(`[SOCKET.IO] Nova conexão matchmaking: ${socket.id}`);
        next();
      });

      // Manipula conexões no namespace de chat
      chatNamespace.on('connection', (socket) => {
        console.log(`[SOCKET.IO] Usuário conectado ao chat: ${socket.id}`);
        handleConnection(socket, chatNamespace, 'chat');
      });

      // Manipula conexões no namespace de matchmaking
      matchNamespace.on('connection', (socket) => {
        console.log(`[SOCKET.IO] Usuário conectado ao matchmaking: ${socket.id}`);
        handleConnection(socket, matchNamespace, 'match');
      });

      // Manipula conexões no namespace principal
      io.on('connection', (socket) => {
        console.log(`[SOCKET.IO] Usuário conectado ao namespace principal: ${socket.id}`);
        handleConnection(socket, io, 'main');
      });

      // Inicia o servidor HTTP
      const port = process.env.PORT || 8080;
      httpServer.listen(port, () => {
        console.log(`[SOCKET.IO] Servidor Socket.IO rodando na porta ${port}`);
        console.log(`[SOCKET.IO] Namespaces disponíveis: /, /chat, /match`);
        resolve(io);
      });

      // Tratamento de erros
      httpServer.on('error', (error) => {
        console.error('[SOCKET.IO] Erro no servidor:', error);
        if (!httpServer.listening) {
          reject(error);
        }
      });

      // Graceful shutdown
      process.on('SIGTERM', () => {
        console.log('[SOCKET.IO] Recebido SIGTERM, encerrando servidor...');
        httpServer.close(() => {
          console.log('[SOCKET.IO] Servidor encerrado');
          process.exit(0);
        });
      });

    } catch (error) {
      console.error('[SOCKET.IO] Erro ao criar servidor:', error);
      reject(error);
    }
  });
}

module.exports = createSocketIOServer();
