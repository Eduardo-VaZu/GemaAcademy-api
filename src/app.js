import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
// Importamos la BD para usarla más adelante o hacer health-check real
import { prisma } from './config/database.js'; 
import horarioRoutes from './features/horario/horario.routes.js';
import usuarioRoutes from './features/usuario/usuario.routes.js';
import alumnoRoutes from './features/alumno/alumno.routes.js';
import profesorRoutes from './features/profesor/profesor.routes.js';
import administradorRoutes from './features/administrador/administrador.routes.js';
import authRoutes from './features/auth/auth.routes.js';
import rolesRoutes from './features/roles/roles.routes.js';

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/horarios', horarioRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/alumnos', alumnoRoutes);
app.use('/api/profesores', profesorRoutes);
app.use('/api/administradores', administradorRoutes);


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
    console.error('❌ Database connection error:', error);
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }

});

export default app;
