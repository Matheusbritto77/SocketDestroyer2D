# SocketDestroyer2D

## Descrição
Jogo multiplayer 2D com universo infinito, naves, atributos e comunicação em tempo real via WebSocket.

## Eventos WebSocket

### Enviar para o servidor:
- `{"type": "move", "dx": <número>, "dy": <número>}`
  - Move a nave do jogador.
- `{"type": "ping"}`
  - Solicita o tempo de resposta (ms).
- `{"type": "get_status"}`
  - Solicita os atributos e posição do jogador.

### Recebidos do servidor:
- `{"type": "update", "x": <número>, "y": <número>, "universeSize": <número>}`
  - Atualização de posição e tamanho do universo.
- `{"type": "pong", "ms": <número>}`
  - Resposta ao ping.
- `{"type": "status", "life": <número>, "shield": <número>, "damage": <número>, "speed": <número>, "x": <número>, "y": <número>, "ms": <número>, "universeSize": <número>}`
  - Status completo do jogador.
- `{"error": <mensagem>}`
  - Mensagem de erro.

## Desenvolvimento
- Código padronizado com ESLint e Prettier.
- Testes automatizados com Jest (em breve).
- Estrutura modular por camadas.

## Estrutura Modular (Layer-Based)

```
src/
  app.js              # Ponto de entrada da aplicação
  config/
    redis.js          # Configuração do Redis
  server/
    index.js          # Servidor WebSocket
```

## Como rodar

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Crie um arquivo `.env` com as configurações do Redis.
3. Inicie a aplicação:
   ```bash
   npm start
   ```

O servidor irá rodar na porta 8080.

## Melhorias futuras
- Autenticação JWT
- Persistência de dados
- Frontend React
- Monitoramento e clusterização
- Docker e CI/CD
