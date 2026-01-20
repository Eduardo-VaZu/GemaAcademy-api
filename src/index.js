import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

// Configuración de variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares de seguridad y utilidad
app.use(helmet()); // Seguridad de cabeceras HTTP
app.use(cors()); // Permitir peticiones desde otros orígenes
app.use(morgan('dev')); // Logging de peticiones en consola
app.use(express.json()); // Parseo de cuerpo JSON
app.use(express.urlencoded({ extended: true })); // Parseo de formularios

// Ruta de prueba
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Gema Academy API is running',
    timestamp: new Date().toISOString(),
  });
});

// Inicio del servidor
app.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port http://localhost:${PORT}/health`);
});
