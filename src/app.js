import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { logger } from './shared/utils/logger.util.js';

import { CORS_CREDENTIALS, CORS_ORIGIN } from './config/secret.config.js';
import { errorHandler } from './shared/middlewares/error.middleware.js';

import healthRoutes from './features/health/health.router.js';
import horarioRoutes from './features/horarios/horario.routes.js';
import usuarioRoutes from './features/usuarios/usuario.routes.js';
import alumnoRoutes from './features/alumnos/alumno.routes.js';
import profesorRoutes from './features/profesores/profesor.routes.js';
import administradorRoutes from './features/administradores/administrador.routes.js';
import authRoutes from './features/auth/auth.routes.js';
import rolesRoutes from './features/roles/roles.routes.js';
import inscripcionRoutes from './features/inscripciones/inscripcion.routes.js';
import pagosRoutes from './features/pagos/pagos.routes.js';
import sedeRoutes from './features/sedes/sede.routers.js';

const app = express();
const morganFormat = ':method :url :status :response-time ms';

// Middlewares
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: CORS_CREDENTIALS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(
  morgan(morganFormat, {
    stream: {
      write: (message) => {
        const logObject = {
          method: message.split(' ')[0],
          url: message.split(' ')[1],
          status: message.split(' ')[2],
          responseTime: message.split(' ')[3],
        };
        logger.http(JSON.stringify(logObject));
      },
    },
  })
);
app.use(helmet());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/horarios', horarioRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/alumnos', alumnoRoutes);
app.use('/api/profesores', profesorRoutes);
app.use('/api/administradores', administradorRoutes);
app.use('/api/inscripciones', inscripcionRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/sedes', sedeRoutes);

app.use(errorHandler);

export default app;
