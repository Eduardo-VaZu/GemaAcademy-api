import app from './app.js';
import { PORT, NODE_ENV } from './config.js';

app.listen(PORT, () => {
  console.log(`🚀 Server running in ${NODE_ENV} mode on port http://localhost:${PORT}/health`);
});
