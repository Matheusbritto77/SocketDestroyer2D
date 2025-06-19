const universe = require('../src/server/universe');

describe('Universe', () => {
  beforeEach(() => {
    universe.size = 1000; // resetar tamanho
  });

  test('tamanho inicial do universo', () => {
    expect(universe.getSize()).toBe(1000);
  });

  test('expande ao chegar na borda direita', () => {
    const expanded = universe.checkAndExpand(960, 500);
    expect(expanded).toBe(true);
    expect(universe.getSize()).toBe(1500);
  });

  test('expande ao chegar na borda esquerda', () => {
    const expanded = universe.checkAndExpand(40, 500);
    expect(expanded).toBe(true);
    expect(universe.getSize()).toBe(1500);
  });

  test('expande ao chegar na borda superior', () => {
    const expanded = universe.checkAndExpand(500, 40);
    expect(expanded).toBe(true);
    expect(universe.getSize()).toBe(1500);
  });

  test('expande ao chegar na borda inferior', () => {
    const expanded = universe.checkAndExpand(500, 960);
    expect(expanded).toBe(true);
    expect(universe.getSize()).toBe(1500);
  });

  test('não expande se longe da borda', () => {
    const expanded = universe.checkAndExpand(500, 500);
    expect(expanded).toBe(false);
    expect(universe.getSize()).toBe(1000);
  });
}); 