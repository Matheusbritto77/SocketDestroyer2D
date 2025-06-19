const redisClient = require('../../config/redis');
const mongoClient = require('../../config/mongo');

class ResilientStorage {
  constructor() {
    this.localCache = new Map();
    this.messageCache = new Map();
    this.isRedisHealthy = true;
    this.isMongoHealthy = true;
    this.maxCacheSize = 1000; // Limite máximo de mensagens em cache
    this.setupHealthChecks();
  }

  setupHealthChecks() {
    // Monitora a saúde do Redis
    redisClient.on('error', () => {
      if (this.isRedisHealthy) {
        console.log('[RESILIENT] Redis indisponível, usando cache local');
        this.isRedisHealthy = false;
      }
    });

    redisClient.on('connect', () => {
      if (!this.isRedisHealthy) {
        console.log('[RESILIENT] Redis reconectado, sincronizando dados');
        this.isRedisHealthy = true;
        this.syncToRedis();
      }
    });

    // Monitora a saúde do MongoDB
    mongoClient.on('close', () => {
      if (this.isMongoHealthy) {
        console.log('[RESILIENT] MongoDB indisponível, usando cache local');
        this.isMongoHealthy = false;
      }
    });

    mongoClient.on('connect', () => {
      if (!this.isMongoHealthy) {
        console.log('[RESILIENT] MongoDB reconectado, sincronizando dados');
        this.isMongoHealthy = true;
        this.syncToMongo();
      }
    });
  }

  async set(key, value, expireInSeconds = null) {
    try {
      if (this.isRedisHealthy) {
        if (expireInSeconds) {
          await redisClient.setEx(key, expireInSeconds, JSON.stringify(value));
        } else {
          await redisClient.set(key, JSON.stringify(value));
        }
      }
    } catch (error) {
      console.log('[RESILIENT] Falha ao salvar no Redis, usando cache local');
      this.isRedisHealthy = false;
    }

    // Sempre salva no cache local como fallback
    this.localCache.set(key, {
      value,
      expireAt: expireInSeconds ? Date.now() + (expireInSeconds * 1000) : null
    });
  }

  async get(key) {
    // Tenta primeiro o cache local
    const localData = this.localCache.get(key);
    if (localData) {
      if (localData.expireAt && localData.expireAt < Date.now()) {
        this.localCache.delete(key);
        return null;
      }
      return localData.value;
    }

    // Se Redis estiver saudável, tenta buscar dele
    if (this.isRedisHealthy) {
      try {
        const value = await redisClient.get(key);
        if (value) {
          return JSON.parse(value);
        }
      } catch (error) {
        console.log('[RESILIENT] Falha ao ler do Redis, usando cache local');
        this.isRedisHealthy = false;
      }
    }

    return null;
  }

  async saveMessage(roomId, message) {
    const roomMessages = this.messageCache.get(roomId) || [];
    roomMessages.push({
      ...message,
      timestamp: Date.now()
    });

    // Mantém apenas as últimas N mensagens para gerenciar memória
    if (roomMessages.length > this.maxCacheSize) {
      roomMessages.splice(0, roomMessages.length - this.maxCacheSize);
    }

    this.messageCache.set(roomId, roomMessages);

    // Tenta salvar no MongoDB se estiver saudável
    if (this.isMongoHealthy) {
      try {
        const db = mongoClient.db();
        await db.collection(`messages_${roomId}`).insertOne(message);
      } catch (error) {
        console.log('[RESILIENT] Falha ao salvar mensagem no MongoDB, mantendo apenas em cache');
        this.isMongoHealthy = false;
      }
    }
  }

  async getMessages(roomId, limit = 50) {
    // Primeiro tenta o cache local
    const cachedMessages = this.messageCache.get(roomId) || [];
    
    // Se MongoDB estiver saudável, tenta buscar mensagens antigas
    if (this.isMongoHealthy) {
      try {
        const db = mongoClient.db();
        const oldMessages = await db.collection(`messages_${roomId}`)
          .find()
          .sort({ timestamp: -1 })
          .limit(limit)
          .toArray();
        
        return [...oldMessages, ...cachedMessages].slice(-limit);
      } catch (error) {
        console.log('[RESILIENT] Falha ao ler mensagens do MongoDB, usando apenas cache');
        this.isMongoHealthy = false;
      }
    }

    return cachedMessages.slice(-limit);
  }

  async syncToRedis() {
    if (!this.isRedisHealthy) return;

    try {
      for (const [key, data] of this.localCache.entries()) {
        if (!data.expireAt || data.expireAt > Date.now()) {
          const ttl = data.expireAt ? Math.ceil((data.expireAt - Date.now()) / 1000) : null;
          await this.set(key, data.value, ttl);
        }
      }
      console.log('[RESILIENT] Dados sincronizados com Redis');
    } catch (error) {
      console.log('[RESILIENT] Falha ao sincronizar com Redis');
      this.isRedisHealthy = false;
    }
  }

  async syncToMongo() {
    if (!this.isMongoHealthy) return;

    try {
      const db = mongoClient.db();
      for (const [roomId, messages] of this.messageCache.entries()) {
        if (messages.length > 0) {
          await db.collection(`messages_${roomId}`).insertMany(
            messages.filter(msg => !msg._id) // Insere apenas mensagens que não vieram do MongoDB
          );
        }
      }
      console.log('[RESILIENT] Mensagens sincronizadas com MongoDB');
    } catch (error) {
      console.log('[RESILIENT] Falha ao sincronizar com MongoDB');
      this.isMongoHealthy = false;
    }
  }

  // Limpa mensagens antigas periodicamente para gerenciar memória
  startCleanupTask() {
    setInterval(() => {
      const now = Date.now();
      
      // Limpa cache local expirado
      for (const [key, data] of this.localCache.entries()) {
        if (data.expireAt && data.expireAt < now) {
          this.localCache.delete(key);
        }
      }

      // Limpa mensagens antigas do cache
      for (const [roomId, messages] of this.messageCache.entries()) {
        if (messages.length > this.maxCacheSize) {
          this.messageCache.set(roomId, messages.slice(-this.maxCacheSize));
        }
      }
    }, 60000); // Executa a cada minuto
  }
}

// Exporta uma única instância para ser usada em toda a aplicação
module.exports = new ResilientStorage(); 