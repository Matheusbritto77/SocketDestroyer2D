class CacheManager {
  constructor() {
    this.roomCache = new Map();
    this.messageCache = new Map();
    this.userCache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0
    };
    
    // Configurações
    this.maxRoomCacheSize = 1000;
    this.maxMessageCacheSize = 5000;
    this.maxUserCacheSize = 2000;
    
    // Inicia limpeza periódica
    this.startCleanup();
  }

  // Cache de salas
  setRoom(roomId, roomData) {
    this.roomCache.set(roomId, {
      ...roomData,
      lastAccess: Date.now(),
      accessCount: (this.roomCache.get(roomId)?.accessCount || 0) + 1
    });
    
    if (this.roomCache.size > this.maxRoomCacheSize) {
      this.cleanupLRU(this.roomCache);
    }
    this.stats.sets++;
  }

  getRoom(roomId) {
    const room = this.roomCache.get(roomId);
    if (room) {
      room.lastAccess = Date.now();
      room.accessCount++;
      this.stats.hits++;
      return room;
    }
    this.stats.misses++;
    return null;
  }

  // Cache de mensagens
  setMessages(roomId, messages) {
    this.messageCache.set(roomId, {
      messages,
      lastUpdate: Date.now(),
      count: messages.length
    });
    
    if (this.messageCache.size > this.maxMessageCacheSize) {
      this.cleanupLRU(this.messageCache);
    }
    this.stats.sets++;
  }

  getMessages(roomId) {
    const cache = this.messageCache.get(roomId);
    if (cache) {
      this.stats.hits++;
      return cache.messages;
    }
    this.stats.misses++;
    return null;
  }

  addMessage(roomId, message) {
    const cache = this.messageCache.get(roomId);
    if (cache) {
      cache.messages.push(message);
      cache.lastUpdate = Date.now();
      cache.count = cache.messages.length;
      
      // Mantém apenas as últimas 100 mensagens em cache
      if (cache.messages.length > 100) {
        cache.messages = cache.messages.slice(-100);
        cache.count = 100;
      }
    }
  }

  // Cache de usuários
  setUser(username, userData) {
    this.userCache.set(username, {
      ...userData,
      lastAccess: Date.now()
    });
    
    if (this.userCache.size > this.maxUserCacheSize) {
      this.cleanupLRU(this.userCache);
    }
    this.stats.sets++;
  }

  getUser(username) {
    const user = this.userCache.get(username);
    if (user) {
      user.lastAccess = Date.now();
      this.stats.hits++;
      return user;
    }
    this.stats.misses++;
    return null;
  }

  // Limpeza LRU
  cleanupLRU(cache) {
    const entries = Array.from(cache.entries());
    entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
    
    // Remove 20% dos itens menos usados
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      cache.delete(entries[i][0]);
    }
  }

  startCleanup() {
    setInterval(() => {
      this.cleanupLRU(this.roomCache);
      this.cleanupLRU(this.messageCache);
      this.cleanupLRU(this.userCache);
      
      console.log(`[CACHE] Stats - Hits: ${this.stats.hits}, Misses: ${this.stats.misses}, Hit Rate: ${((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(2)}%`);
    }, 300000); // A cada 5 minutos
  }

  getStats() {
    return {
      ...this.stats,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses),
      roomCacheSize: this.roomCache.size,
      messageCacheSize: this.messageCache.size,
      userCacheSize: this.userCache.size
    };
  }

  clear() {
    this.roomCache.clear();
    this.messageCache.clear();
    this.userCache.clear();
    this.stats = { hits: 0, misses: 0, sets: 0 };
  }
}

module.exports = new CacheManager(); 