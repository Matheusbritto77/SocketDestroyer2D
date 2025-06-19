const resilientStorage = require('./resilientStorage');

class BatchProcessor {
  constructor() {
    this.messageBatch = [];
    this.maxBatchSize = 50;
    this.flushInterval = 5000; // 5 segundos
    this.isProcessing = false;
    
    // Inicia o processamento em lote
    this.startBatchProcessing();
  }

  // Adiciona mensagem ao lote
  addMessage(message) {
    this.messageBatch.push({
      ...message,
      timestamp: Date.now()
    });

    // Se o lote estiver cheio, processa imediatamente
    if (this.messageBatch.length >= this.maxBatchSize) {
      this.flushBatch();
    }
  }

  // Processa o lote de mensagens
  async flushBatch() {
    if (this.isProcessing || this.messageBatch.length === 0) {
      return;
    }

    this.isProcessing = true;
    const batch = [...this.messageBatch];
    this.messageBatch = [];

    try {
      // Agrupa mensagens por sala
      const messagesByRoom = {};
      batch.forEach(msg => {
        if (!messagesByRoom[msg.room]) {
          messagesByRoom[msg.room] = [];
        }
        messagesByRoom[msg.room].push(msg);
      });

      // Salva mensagens em lote para cada sala
      const promises = Object.entries(messagesByRoom).map(([room, messages]) => {
        return this.saveBatchToStorage(room, messages);
      });

      await Promise.all(promises);
      
      console.log(`[BATCH] Processadas ${batch.length} mensagens em lote`);
    } catch (error) {
      console.error('[BATCH] Erro ao processar lote:', error);
      
      // Em caso de erro, adiciona as mensagens de volta ao lote
      this.messageBatch.unshift(...batch);
    } finally {
      this.isProcessing = false;
    }
  }

  // Salva lote de mensagens no storage
  async saveBatchToStorage(room, messages) {
    try {
      // Salva no MongoDB em lote
      if (resilientStorage.isMongoHealthy) {
        const db = resilientStorage.mongoClient.db();
        await db.collection('room_messages').insertMany(
          messages.map(msg => ({
            roomId: room,
            ...msg
          }))
        );
      }

      // Atualiza cache local
      const cache = require('./cache');
      cache.addMessage(room, messages[messages.length - 1]); // Adiciona apenas a última para o cache
      
    } catch (error) {
      console.error(`[BATCH] Erro ao salvar lote para sala ${room}:`, error);
      throw error;
    }
  }

  // Inicia o processamento periódico
  startBatchProcessing() {
    setInterval(() => {
      this.flushBatch();
    }, this.flushInterval);
  }

  // Força o processamento do lote atual
  async forceFlush() {
    await this.flushBatch();
  }

  // Estatísticas do processamento em lote
  getStats() {
    return {
      batchSize: this.messageBatch.length,
      maxBatchSize: this.maxBatchSize,
      isProcessing: this.isProcessing,
      flushInterval: this.flushInterval
    };
  }
}

module.exports = new BatchProcessor(); 