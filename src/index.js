import app from './app.js';
import { PORT, NODE_ENV } from './config/secret.config.js';
import { scheduleTokenCleanup } from './features/auth/utils/cleanupTokens.js';

// 1. CAMBIO AQUÍ: Importamos la función directamente, no un servicio/objeto
import { iniciarCronJobs } from './features/cron/cron-jobs.service.js';

app.listen(PORT, () => {
  console.log(`🚀 Server running in ${NODE_ENV} mode`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  
  scheduleTokenCleanup();

  // 2. CAMBIO AQUÍ: Ejecutamos la función directamente
  iniciarCronJobs(); 
});