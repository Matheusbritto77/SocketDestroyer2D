// Módulo de eventos para WebSocket
const universe = require("./universe");
const {
  getPlayer,
  createPlayer,
  removePlayer,
  getAllPlayers,
} = require("./player");

function handleMessage(ws, message) {
  let data;
  try {
    data = JSON.parse(message);
  } catch (e) {
    ws.send(JSON.stringify({ error: "Mensagem inválida" }));
    return;
  }

  const player = getPlayer(ws.clientId);
  if (!player) return;

  switch (data.type) {
    case "move": {
      // dx, dy: direção do movimento
      player.move(data.dx, data.dy);
      universe.checkAndExpand(player.x, player.y);
      // Atualiza o ping automaticamente
      player.updatePing();
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
        }),
      );
      break;
    }
    case "ping": {
      const ms = player.updatePing();
      ws.send(JSON.stringify({ type: "pong", ms }));
      break;
    }
    case "get_status": {
      ws.send(
        JSON.stringify({
          type: "status",
          life: player.life,
          shield: player.shield,
          damage: player.damage,
          speed: player.speed,
          x: player.x,
          y: player.y,
          ms: player.ms,
          universeSize: universe.getSize(),
        }),
      );
      break;
    }
    default:
      ws.send(JSON.stringify({ error: "Tipo de evento desconhecido" }));
  }
}

module.exports = { handleMessage };
