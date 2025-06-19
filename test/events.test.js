const { createPlayer, removePlayer } = require('../src/server/player');
const universe = require('../src/server/universe');
const { handleMessage } = require('../src/server/events');

describe('Events', () => {
  let ws;
  beforeEach(() => {
    universe.size = 1000;
    ws = { clientId: 'test', send: jest.fn() };
    createPlayer('test');
  });
  afterEach(() => {
    removePlayer('test');
  });

  test('move envia update e expande universo', () => {
    handleMessage(ws, JSON.stringify({ type: 'move', dx: 100, dy: 0 }));
    expect(ws.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"update"')
    );
    expect(universe.getSize()).toBeGreaterThan(1000);
  });

  test('ping envia pong', () => {
    handleMessage(ws, JSON.stringify({ type: 'ping' }));
    expect(ws.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"pong"')
    );
  });

  test('get_status envia status', () => {
    handleMessage(ws, JSON.stringify({ type: 'get_status' }));
    expect(ws.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"status"')
    );
  });

  test('mensagem inválida retorna erro', () => {
    handleMessage(ws, 'mensagem inválida');
    expect(ws.send).toHaveBeenCalledWith(
      expect.stringContaining('Mensagem inválida')
    );
  });

  test('evento desconhecido retorna erro', () => {
    handleMessage(ws, JSON.stringify({ type: 'desconhecido' }));
    expect(ws.send).toHaveBeenCalledWith(
      expect.stringContaining('Tipo de evento desconhecido')
    );
  });
}); 