const WebSocket = require('ws');
const { createClient } = require('redis');
const { MongoClient } = require('mongodb');
const { exec } = require('child_process');
const path = require('path');

class WatchdogMonitor {
  constructor() {
    this.isServerHealthy = false;
    this.isRedisHealthy = false;
    this.isMongoHealthy = false;
    this.restartAttempts = 0;
    this.maxRestartAttempts = 5;
    this.restartCooldown = 60000; // 1 minuto entre tentativas
    this.lastRestartTime = 0;
    this.serverProcess = null;
    
    // Configurações de monitoramento
    this.checkInterval = 5000; // 5 segundos
    this.healthyThreshold = 3; // Precisa de 3 checks saudáveis seguidos
    this.unhealthyThreshold = 2; // 2 falhas seguidas para considerar não saudável
    
    this.healthChecks = {
      server: 0,
      redis: 0,
      mongo: 0
    };
  }

  async start() {
    console.log('[WATCHDOG] Iniciando monitoramento...');
    
    // Inicia o servidor principal se não estiver rodando
    await this.startMainServer();
    
    // Inicia o loop de monitoramento
    this.startMonitoring();
  }

  async startMainServer() {
    try {
      const serverPath = path.resolve(__dirname, '../app.js');
      
      // Mata qualquer processo existente na porta 8080
      await this.killProcessOnPort(8080);
      
      // Inicia o servidor como um processo separado
      this.serverProcess = exec(`node ${serverPath}`, (error, stdout, stderr) => {
        if (error) {
          console.error('[WATCHDOG] Erro ao iniciar servidor:', error);
          return;
        }
        console.log('[WATCHDOG] Saída do servidor:', stdout);
      });

      this.serverProcess.on('exit', (code) => {
        console.log(`[WATCHDOG] Processo do servidor encerrado com código ${code}`);
        this.isServerHealthy = false;
        this.handleServerFailure();
      });

      // Aguarda o servidor iniciar
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('[WATCHDOG] Servidor principal iniciado');
    } catch (error) {
      console.error('[WATCHDOG] Erro ao iniciar servidor principal:', error);
      throw error;
    }
  }

  async killProcessOnPort(port) {
    return new Promise((resolve, reject) => {
      const command = process.platform === 'win32' 
        ? `FOR /F "tokens=5" %P IN ('netstat -a -n -o ^| findstr :${port}') DO TaskKill /PID %P /F /T`
        : `lsof -ti:${port} | xargs kill -9`;
        
      exec(command, (error) => {
        if (error && !error.message.includes('não foi encontrado')) {
          console.log('[WATCHDOG] Nenhum processo encontrado na porta', port);
        }
        resolve();
      });
    });
  }

  startMonitoring() {
    console.log('[WATCHDOG] Iniciando ciclo de monitoramento');
    
    setInterval(async () => {
      await this.checkServices();
      this.evaluateHealth();
    }, this.checkInterval);
  }

  async checkServices() {
    // Verifica WebSocket
    try {
      const ws = new WebSocket('ws://localhost:8080');
      await new Promise((resolve, reject) => {
        ws.on('open', () => {
          this.healthChecks.server++;
          ws.close();
          resolve();
        });
        ws.on('error', reject);
        setTimeout(reject, 2000);
      });
    } catch (error) {
      this.healthChecks.server = Math.max(0, this.healthChecks.server - 1);
      console.error('[WATCHDOG] Erro ao verificar servidor WebSocket:', error.message);
    }

    // Verifica Redis
    try {
      const redis = createClient({
        url: process.env.REDIS_EXTERNAL_URL || 'redis://localhost:6379'
      });
      await redis.connect();
      await redis.ping();
      await redis.quit();
      this.healthChecks.redis++;
    } catch (error) {
      this.healthChecks.redis = Math.max(0, this.healthChecks.redis - 1);
      console.error('[WATCHDOG] Erro ao verificar Redis:', error.message);
    }

    // Verifica MongoDB
    try {
      const mongo = new MongoClient(
        process.env.MONGO_EXTERNAL_URL || 'mongodb://localhost:27017/chatdb'
      );
      await mongo.connect();
      await mongo.db('admin').command({ ping: 1 });
      await mongo.close();
      this.healthChecks.mongo++;
    } catch (error) {
      this.healthChecks.mongo = Math.max(0, this.healthChecks.mongo - 1);
      console.error('[WATCHDOG] Erro ao verificar MongoDB:', error.message);
    }
  }

  evaluateHealth() {
    const now = Date.now();
    const services = {
      'Servidor WebSocket': this.healthChecks.server,
      'Redis': this.healthChecks.redis,
      'MongoDB': this.healthChecks.mongo
    };

    console.log('[WATCHDOG] Status dos serviços:');
    for (const [service, health] of Object.entries(services)) {
      const status = health >= this.healthyThreshold ? 'SAUDÁVEL' : 'NÃO SAUDÁVEL';
      console.log(`- ${service}: ${status} (${health}/${this.healthyThreshold})`);
    }

    // Verifica se algum serviço crítico está não saudável
    if (this.healthChecks.server < this.unhealthyThreshold) {
      console.log('[WATCHDOG] Servidor WebSocket não está saudável!');
      this.handleServerFailure();
    }
  }

  async handleServerFailure() {
    const now = Date.now();
    
    // Verifica cooldown entre reinícios
    if (now - this.lastRestartTime < this.restartCooldown) {
      console.log('[WATCHDOG] Aguardando cooldown para tentar reiniciar...');
      return;
    }

    // Verifica número máximo de tentativas
    if (this.restartAttempts >= this.maxRestartAttempts) {
      console.error('[WATCHDOG] Número máximo de tentativas de reinício atingido!');
      console.error('[WATCHDOG] ALERTA CRÍTICO: Sistema instável!');
      // Aqui você pode adicionar notificação para equipe de operações
      return;
    }

    console.log('[WATCHDOG] Tentando reiniciar servidor...');
    this.restartAttempts++;
    this.lastRestartTime = now;

    try {
      // Mata o processo atual se existir
      if (this.serverProcess) {
        this.serverProcess.kill('SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Reinicia o servidor
      await this.startMainServer();
      
      // Reseta contadores se o servidor iniciar com sucesso
      this.restartAttempts = 0;
      this.healthChecks.server = 0;
      console.log('[WATCHDOG] Servidor reiniciado com sucesso');
    } catch (error) {
      console.error('[WATCHDOG] Falha ao reiniciar servidor:', error);
    }
  }
}

// Exporta uma instância única do watchdog
const watchdog = new WatchdogMonitor();
module.exports = watchdog; 