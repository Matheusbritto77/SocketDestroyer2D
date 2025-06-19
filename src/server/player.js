// Módulo Player: gerencia jogadores e suas naves
class Player {
  constructor(id) {
    this.id = id;
    this.x = 500; // posição inicial x
    this.y = 500; // posição inicial y
    this.life = 100;
    this.shield = 50;
    this.damage = 10;
    this.speed = 5;
    this.lastPing = Date.now();
    this.ms = 0;
  }

  move(dx, dy) {
    this.x += dx * this.speed;
    this.y += dy * this.speed;
  }

  updatePing() {
    const now = Date.now();
    this.ms = now - this.lastPing;
    this.lastPing = now;
    return this.ms;
  }
}

const players = new Map();

function createPlayer(id) {
  const player = new Player(id);
  players.set(id, player);
  return player;
}

function getPlayer(id) {
  return players.get(id);
}

function removePlayer(id) {
  players.delete(id);
}

function getAllPlayers() {
  return Array.from(players.values());
}

module.exports = { createPlayer, getPlayer, removePlayer, getAllPlayers };
