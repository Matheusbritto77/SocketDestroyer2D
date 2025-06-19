const WebSocket = require("ws");
const redisClient = require("../config/redis");
const { createPlayer, removePlayer, getPlayer } = require("./player");
const { handleMessage } = require("./events");
const universe = require("./universe");

const GLOBAL_ROOM = "global_room";

const wss = new WebSocket.Server({ port: 8080 });

wss.on("listening", () => {
  console.log("Servidor WebSocket rodando na porta 8080");
});

wss.on("connection", async (ws) => {
  console.log("Novo cliente conectado");

  // Adiciona o cliente à sala global no Redis
  const clientId = Date.now() + "-" + Math.random();
  await redisClient.sAdd(GLOBAL_ROOM, clientId);
  ws.clientId = clientId;

  // Cria o player
  createPlayer(clientId);

  // Envia mensagem de boas-vindas
  ws.send(
    JSON.stringify({ msg: "Bem-vindo à sala global!", sala: GLOBAL_ROOM }),
  );

  ws.on("message", (message) => {
    handleMessage(ws, message);
  });

  ws.on("close", async () => {
    // Remove o cliente da sala global ao desconectar
    await redisClient.sRem(GLOBAL_ROOM, ws.clientId);
    removePlayer(ws.clientId);
    console.log("Cliente saiu:", ws.clientId);
  });
});

// Função para enviar updates periódicos para todos os clientes conectados
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN && ws.clientId) {
      const player = getPlayer(ws.clientId);
      if (player) {
        ws.send(
          JSON.stringify({
            type: "update",
            life: player.life,
            shield: player.shield,
            damage: player.damage,
            speed: player.speed,
            x: player.x,
            y: player.y,
            ms: player.ms,
            universeSize: universe.getSize(),
          })
        );
      }
    }
  });
}, 200); // envia a cada 200ms (~5x por segundo)
