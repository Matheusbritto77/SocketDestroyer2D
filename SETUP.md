# Guia de Configuração - ChatSocket

## Pré-requisitos

### Software Necessário
- **Node.js** 16+ (recomendado: 18+)
- **PostgreSQL** 12+ 
- **Redis** 6+
- **MongoDB** 4.4+

### Instalação dos Bancos de Dados

#### PostgreSQL
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Windows
# Baixe e instale do site oficial: https://www.postgresql.org/download/windows/

# macOS
brew install postgresql
```

#### Redis
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install redis-server

# Windows
# Use WSL2 ou Docker: docker run -d -p 6379:6379 redis:alpine

# macOS
brew install redis
```

#### MongoDB
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install mongodb

# Windows
# Baixe e instale do site oficial: https://www.mongodb.com/try/download/community

# macOS
brew install mongodb-community
```

## Configuração do Projeto

### 1. Clone e Instalação
```bash
git clone <repository-url>
cd socketdestroyer2D
npm install
```

### 2. Configuração do Ambiente
Crie um arquivo `.env` na raiz do projeto:

```env
# Configurações dos Serviços Externos
REDIS_EXTERNAL_URL=redis://localhost:6379
MONGO_EXTERNAL_URL=mongodb://localhost:27017/chatdb
PG_EXTERNAL_HOST=localhost
PG_EXTERNAL_PORT=5432
PG_USER=postgres
PG_PASSWORD=sua_senha_aqui
PG_DATABASE=chatdb

# Configurações do Servidor
PORT=8080
NODE_ENV=development

# Configurações de Performance
BATCH_SIZE=50
BATCH_INTERVAL=5000
CACHE_MAX_SIZE=1000
RATE_LIMIT_WINDOW=60000

# Configurações de Segurança
MAX_MESSAGE_LENGTH=1000
ALLOWED_HTML_TAGS=b,i,em,strong,u,br,p,span,h1,h2,h3,h4,h5,h6,ul,ol,li,blockquote,code,pre
```

### 3. Configuração dos Bancos

#### PostgreSQL
```sql
-- Conecte ao PostgreSQL
psql -U postgres

-- Crie o banco de dados
CREATE DATABASE chatdb;

-- Crie um usuário (opcional)
CREATE USER chatuser WITH PASSWORD 'senha_segura';
GRANT ALL PRIVILEGES ON DATABASE chatdb TO chatuser;

-- Saia do psql
\q
```

#### Redis
```bash
# Inicie o Redis
sudo systemctl start redis-server

# Verifique se está rodando
redis-cli ping
# Deve retornar: PONG
```

#### MongoDB
```bash
# Inicie o MongoDB
sudo systemctl start mongod

# Verifique se está rodando
mongo --eval "db.runCommand('ping')"
# Deve retornar: { "ok" : 1 }
```

## Verificação da Instalação

### 1. Verificar Serviços
```bash
npm run test:check
```

### 2. Preparar Ambiente de Teste
```bash
npm run test:prepare
```

### 3. Executar Testes
```bash
# Todos os testes
npm test

# Testes específicos
npm run test:basic
npm run test:resilience
npm run test:performance
```

## Inicialização

### Modo Desenvolvimento (com watchdog)
```bash
npm start
```

### Modo Desenvolvimento (apenas servidor)
```bash
npm run start:server
```

### Modo Produção (com watchdog - recomendado)
```bash
npm start
```

## Estrutura de Dados

### Tabelas PostgreSQL (criadas automaticamente)

#### registered_users
- `id`: ID único do usuário
- `email`: Email único do usuário
- `password_hash`: Hash da senha (bcrypt)
- `username`: Nome de usuário único
- `created_at`: Data de criação
- `last_login`: Último login
- `is_active`: Status ativo

#### public_rooms
- `id`: ID único da sala
- `room_id`: ID da sala para WebSocket
- `name`: Nome da sala
- `description`: Descrição da sala
- `created_by`: ID do usuário criador
- `created_at`: Data de criação
- `is_active`: Status ativo
- `max_users`: Limite de usuários

#### room_members
- `id`: ID único do membro
- `room_id`: ID da sala
- `username`: Nome do usuário
- `joined_at`: Data de entrada
- `is_online`: Status online

### Coleções MongoDB (criadas automaticamente)

#### messages_[room_id]
- `_id`: ID único da mensagem
- `from`: Usuário que enviou
- `content`: Conteúdo da mensagem
- `room`: ID da sala
- `timestamp`: Timestamp da mensagem

## Troubleshooting

### Problemas Comuns

#### 1. Erro de Conexão com PostgreSQL
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solução:**
- Verifique se o PostgreSQL está rodando
- Confirme as credenciais no `.env`
- Verifique se o banco `chatdb` existe

#### 2. Erro de Conexão com Redis
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
**Solução:**
- Verifique se o Redis está rodando
- Teste com `redis-cli ping`

#### 3. Erro de Conexão com MongoDB
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solução:**
- Verifique se o MongoDB está rodando
- Confirme a URL no `.env`

#### 4. Porta 8080 em Uso
```
Error: listen EADDRINUSE :::8080
```
**Solução:**
- Mude a porta no `.env`
- Ou mate o processo usando a porta 8080

### Logs e Debug

#### Habilitar Logs Detalhados
```bash
# Adicione ao .env
DEBUG=*
NODE_ENV=development
```

#### Verificar Status dos Serviços
```bash
# PostgreSQL
psql -U postgres -d chatdb -c "SELECT version();"

# Redis
redis-cli info server

# MongoDB
mongo --eval "db.version()"
```

## Performance e Otimização

### Configurações Recomendadas para Produção

#### PostgreSQL
```sql
-- Aumentar conexões máximas
ALTER SYSTEM SET max_connections = 200;

-- Otimizar para carga de leitura
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';

-- Recarregar configurações
SELECT pg_reload_conf();
```

#### Redis
```bash
# Configurar persistência
echo "save 900 1" >> /etc/redis/redis.conf
echo "save 300 10" >> /etc/redis/redis.conf
echo "save 60 10000" >> /etc/redis/redis.conf

# Reiniciar Redis
sudo systemctl restart redis-server
```

#### MongoDB
```javascript
// Configurar índices
db.messages_roomId.createIndex({timestamp: -1})
db.messages_roomId.createIndex({room: 1, timestamp: -1})
```

### Monitoramento

#### Métricas Importantes
- Usuários online simultâneos
- Taxa de mensagens por segundo
- Latência de resposta
- Uso de memória e CPU
- Taxa de hit do cache

#### Ferramentas de Monitoramento
- **PM2**: Para monitoramento de processos Node.js
- **Redis Commander**: Interface web para Redis
- **MongoDB Compass**: Interface para MongoDB
- **pgAdmin**: Interface para PostgreSQL

## Segurança

### Configurações de Segurança

#### Rate Limiting
- Mensagens: 30/minuto por usuário
- Autenticação: 5/5minutos por IP
- Criação de salas: 3/5minutos por usuário

#### Sanitização
- HTML permitido: tags básicas de formatação
- Emojis: lista de 200+ emojis verificados
- Tamanho máximo: 1000 caracteres por mensagem

#### Autenticação
- Senhas: hash bcrypt com salt
- Sessões: baseadas em WebSocket
- Usuários temporários: apenas username

### Recomendações de Segurança

1. **Use HTTPS em produção**
2. **Configure firewall adequadamente**
3. **Monitore logs de acesso**
4. **Implemente backup regular dos dados**
5. **Use variáveis de ambiente para credenciais**
6. **Atualize dependências regularmente**

## Suporte

Para problemas e dúvidas:
1. Verifique os logs do servidor
2. Execute os testes para verificar funcionalidade
3. Consulte a documentação dos eventos WebSocket
4. Abra uma issue no GitHub com detalhes do problema 