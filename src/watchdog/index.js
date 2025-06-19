require('dotenv').config();
const watchdog = require('./monitor');

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  console.error('[WATCHDOG] Erro não capturado:', error);
  // O watchdog continua rodando mesmo com erros não capturados
});

process.on('unhandledRejection', (error) => {
  console.error('[WATCHDOG] Promise rejeitada não tratada:', error);
  // O watchdog continua rodando mesmo com promessas rejeitadas
});

// Inicia o watchdog
console.log('[WATCHDOG] Iniciando watchdog do sistema...');
watchdog.start().catch(error => {
  console.error('[WATCHDOG] Erro fatal ao iniciar watchdog:', error);
  process.exit(1);
}); 