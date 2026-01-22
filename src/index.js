import app from './app.js';
import { PORT, NODE_ENV } from './config.js';

app.listen(PORT, () => {
  console.log(`🚀 Server running in ${NODE_ENV} mode`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});