# ChatSocket - Sistema de Chat em Tempo Real Avançado com Socket.IO

## Descrição
Sistema de chat em tempo real com suporte a salas públicas, mensagens privadas, autenticação permanente e temporária, utilizando Socket.IO com otimizações de performance e resiliência.

## 🚀 Funcionalidades Principais

### Autenticação e Usuários
- **Usuários Registrados**: Registro permanente com email/senha no PostgreSQL
- **Usuários Temporários**: Autenticação rápida apenas com username
- **Sistema de Permissões**: Apenas usuários registrados podem criar salas públicas
- **Sessões Persistentes**: Login/logout com histórico de atividades

### Salas e Chat
- **Salas Públicas**: Criadas por usuários registrados
- **Sala Especial "match"**: Sala pública para matchmaking (não pode ser criada/removida)
- **Histórico de Mensagens**: Persistência em MongoDB com cache otimizado
- **Indicador de Digitação**: Notificação em tempo real
- **Status de Usuário**: Online, away, busy, offline

### Performance e Otimizações
- **Cache Inteligente**: Cache local + Redis com fallback automático
- **Batch Processing**: Processamento em lote de mensagens (50 mensagens/5s)
- **Rate Limiting**: Proteção contra spam e ataques
- **Sanitização Avançada**: Suporte a HTML seguro e emojis
- **Connection Pooling**: Gerenciamento eficiente de conexões
- **Compressão Socket.IO**: Redução de tráfego de rede
- **Adapter Redis**: Escalabilidade horizontal

### Resiliência e Monitoramento
- **Watchdog Automático**: Monitoramento e reinício automático
- **Fallback de Storage**: Cache local quando Redis/MongoDB indisponível
- **Health Checks**: Verificação contínua de serviços
- **Recovery Automático**: Reconexão e sincronização de dados

## 📋 Eventos Socket.IO

### Autenticação e Registro
```javascript
// Registro permanente
socket.emit('register', {
  email: 'user@example.com', 
  password: 'senha123', 
  username: 'usuario'
});

// Login permanente
socket.emit('login', {
  email: 'user@example.com', 
  password: 'senha123'
});

// Autenticação temporária
socket.emit('authenticate', {
  username: 'usuario_temp'
});
```

### Gerenciamento de Salas
```javascript
// Criar sala (apenas usuários registrados)
socket.emit('create_room', {
  name: 'Minha Sala', 
  description: 'Descrição da sala'
});

// Listar salas públicas
socket.emit('get_rooms');

// Entrar em sala
socket.emit('join_room', { room: 'room_id' });

// Sair de sala
socket.emit('leave_room', { room: 'room_id' });
```

### Mensagens e Status
```javascript
// Enviar mensagem
socket.emit('send_message', {
  content: 'Olá, mundo! 😀', 
  room: 'room_id'
});

// Atualizar status
socket.emit('update_status', { status: 'away' });

// Indicar digitação
socket.emit('typing', {
  room: 'room_id', 
  isTyping: true
});

// Ping para latência
socket.emit('ping_latency');
```

### Respostas do Servidor
```javascript
// Resposta de autenticação
socket.on('auth_response', (data) => {
  console.log(data.success, data.message, data.user);
});

// Lista de salas
socket.on('rooms_list', (data) => {
  console.log(data.rooms);
});

// Mensagem recebida
socket.on('message', (data) => {
  console.log(data.from, data.content, data.room, data.timestamp);
});

// Status de usuário
socket.on('user_status', (data) => {
  console.log(data.username, data.status);
});

// Indicador de digitação
socket.on('typing_status', (data) => {
  console.log(data.room, data.username, data.isTyping);
});

// Histórico de mensagens
socket.on('message_history', (data) => {
  console.log(data.room, data.messages);
});

// Erro
socket.on('error', (data) => {
  console.log(data.message);
});
```

## 🏗️ Arquitetura

### Camadas do Sistema
```
src/
├── app.js                    # Ponto de entrada da aplicação
├── config/
│   ├── postgres.js          # Configuração PostgreSQL (usuários/salas)
│   ├── redis.js             # Configuração Redis (cache/tempo real)
│   └── mongo.js             # Configuração MongoDB (histórico)
├── server/
│   ├── index.js             # Servidor Socket.IO
│   ├── layers/
│   │   ├── connection.js    # Gerenciamento de conexões Socket.IO
│   │   ├── user.js          # Lógica de usuários e mensagens
│   │   ├── room.js          # Gerenciamento de salas
│   │   └── match.js         # Sistema de matchmaking
│   └── utils/
│       ├── cache.js         # Sistema de cache otimizado
│       ├── rateLimiter.js   # Rate limiting e proteção
│       ├── batchProcessor.js # Processamento em lote
│       ├── sanitizer.js     # Sanitização de mensagens
│       ├── resilientStorage.js # Storage resiliente
│       └── migratePostgres.js # Migrations automáticas
└── watchdog/
    ├── index.js             # Ponto de entrada do watchdog
    └── monitor.js           # Monitoramento de serviços
```

### Banco de Dados
- **PostgreSQL**: Usuários registrados, salas públicas, permissões
- **Redis**: Cache de salas, mensagens recentes, filas, adapter Socket.IO
- **MongoDB**: Histórico de mensagens, logs de atividade

## 🛠️ Instalação e Configuração

### Pré-requisitos
- Node.js 16+
- PostgreSQL 12+
- Redis 6+
- MongoDB 4.4+

### Instalação
```bash
# Clone o repositório
git clone <repository-url>
cd socketdestroyer2D

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
```

### Configuração do Ambiente
Crie um arquivo `.env` com as seguintes variáveis:

```env
# Serviços Externos
REDIS_EXTERNAL_URL=redis://localhost:6379
MONGO_EXTERNAL_URL=mongodb://localhost:27017/chatdb
PG_EXTERNAL_HOST=localhost
PG_EXTERNAL_PORT=5432
PG_USER=postgres
PG_PASSWORD=sua_senha
PG_DATABASE=chatdb

# Configurações do Servidor
PORT=8080
NODE_ENV=development
```

### Inicialização
```bash
# Verificar serviços
npm run test:check

# Iniciar servidor com watchdog (recomendado)
npm start

# Iniciar apenas o servidor (sem watchdog)
npm run start:server

# Iniciar com watchdog (mesmo que npm start)
npm run start:watchdog

# Executar testes
npm test

# Executar linting
npm run lint

# Formatar código
npm run format
```

## 🧪 Testes

### Testes Disponíveis
- **Testes Básicos**: Funcionalidades principais do chat
- **Testes de Resiliência**: Recuperação de falhas
- **Testes de Performance**: Carga moderada (otimizados para localhost)

### Executar Testes
```bash
# Todos os testes
npm test

# Testes específicos
npm run test:basic
npm run test:resilience
npm run test:performance
```

## 📊 Monitoramento e Métricas

### Health Checks
- Verificação automática de serviços a cada 5 segundos
- Reinício automático em caso de falha
- Logs detalhados de status

### Métricas Disponíveis
- Usuários online
- Mensagens por segundo
- Taxa de hit do cache
- Latência de resposta
- Status dos serviços

### Logs
```
[SOCKET.IO] Servidor Socket.IO iniciado na porta 8080
[USER] Usuário 'alice' registrado com sucesso
[ROOM] Sala 'geral' criada por alice
[CACHE] Hit rate: 85.2%
[BATCH] Processadas 23 mensagens em lote
[WATCHDOG] Serviços saudáveis: Socket.IO ✓ Redis ✓ MongoDB ✓
```

## 🔒 Segurança

### Proteções Implementadas
- **Rate Limiting**: Limite de requisições por usuário/IP
- **Sanitização**: Remoção de HTML malicioso
- **Validação**: Verificação de entrada de dados
- **Autenticação**: Sistema seguro de login/registro
- **Bloqueio**: Proteção contra spam e ataques

### Configurações de Segurança
```javascript
// Rate Limiting
message: 30/minuto
auth: 5/5minutos
join: 10/minuto
create_room: 3/5minutos
register: 3/10minutos

// Sanitização
maxMessageLength: 1000 caracteres
allowedHTMLTags: ['b', 'i', 'em', 'strong', 'u', 'br']
allowedEmojis: 200+ emojis verificados
```

## 🚀 Deploy

### Produção
```bash
# Com watchdog (recomendado - padrão)
npm start

# Sem watchdog (apenas servidor)
npm run start:server
```

### Docker (opcional)
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
CMD ["npm", "start"]
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença ISC. Veja o arquivo `LICENSE` para mais detalhes.

## 🆘 Suporte

Para suporte e dúvidas:
- Abra uma issue no GitHub
- Consulte a documentação dos eventos Socket.IO
- Verifique os logs do servidor para debugging

## 🔄 Roadmap

- [ ] Interface web administrativa
- [ ] API REST para administração
- [ ] Suporte a arquivos e mídia
- [ ] Criptografia end-to-end
- [ ] Sistema de moderação
- [ ] Integração com sistemas externos
- [ ] Métricas e analytics avançados
- [ ] Suporte a múltiplos idiomas
- [ ] Notificações push
- [ ] Chat em grupo (mais de 2 usuários)
