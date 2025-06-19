const { createPlayer, getPlayer, removePlayer, getAllPlayers } = require('../src/server/player');

describe('Player', () => {
  afterEach(() => {
    // Limpa todos os jogadores após cada teste
    getAllPlayers().forEach((p) => removePlayer(p.id));
  });

  test('cria um player corretamente', () => {
    const player = createPlayer('abc');
    expect(player.id).toBe('abc');
    expect(player.life).toBe(100);
    expect(player.shield).toBe(50);
    expect(player.damage).toBe(10);
    expect(player.speed).toBe(5);
    expect(player.x).toBe(500);
    expect(player.y).toBe(500);
  });

  test('move o player corretamente', () => {
    const player = createPlayer('move');
    player.move(1, 0); // direita
    expect(player.x).toBe(505);
    expect(player.y).toBe(500);
    player.move(0, -1); // cima
    expect(player.x).toBe(505);
    expect(player.y).toBe(495);
  });

  test('atualiza o ping do player', (done) => {
    const player = createPlayer('ping');
    setTimeout(() => {
      const ms = player.updatePing();
      expect(ms).toBeGreaterThanOrEqual(9);
      expect(ms).toBeLessThan(300);
      done();
    }, 10);
  });

  test('remove player corretamente', () => {
    createPlayer('remover');
    expect(getPlayer('remover')).toBeDefined();
    removePlayer('remover');
    expect(getPlayer('remover')).toBeUndefined();
  });
}); 