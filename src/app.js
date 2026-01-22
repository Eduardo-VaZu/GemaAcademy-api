import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
// Importamos la BD para usarla más adelante o hacer health-check real
import { prisma } from './config/database.js'; 
import horarioRoutes from './routes/horario.routes.js';

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/horarios', horarioRoutes);

// Health Check Route (Mejorado para verificar BD también)
app.get('/health', async (req, res) => {
  try {
    // Intentamos una consulta simple para ver si la BD responde
    await prisma.$queryRaw`SELECT 1`; 
    
    res.json({
      status: 'ok',
      database: 'connected',
      message: 'Gema Academy API is running',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default app;
