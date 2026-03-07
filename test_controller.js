import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { publicacionController } from './src/features/publicaciones/publicacion.controller.js';
import { validate } from './src/shared/middlewares/validate.middleware.js';
import { publicacionSchema } from './src/features/publicaciones/publicacion.schema.js';
import { errorHandler } from './src/shared/middlewares/error.middleware.js';
import FormData from 'form-data';

const app = express();
app.use(express.json());

// Mock authenticate middleware
const mockAuthenticate = (req, res, next) => {
  req.user = { id: 1, rol_nombre: 'Administrador' };
  next();
};

const uploadMemory = multer.memoryStorage();
const upload = multer({ storage: uploadMemory });

app.post(
  '/api/publicaciones',
  mockAuthenticate,
  upload.single('imagen'),
  validate(publicacionSchema.createSchema),
  publicacionController.createPublicacion
);

app.use(errorHandler);

const PORT = 3055;
const server = app.listen(PORT, async () => {
    try {
        console.log('Test server running on port '+PORT);
        
        // Simular FormData
        const form = new FormData();
        form.append('titulo', 'This is a test title');
        form.append('contenido', 'This is test content');
        form.append('autor_id', '1');

        const fetch = (await import('node-fetch')).default;
        
        const response = await fetch(`http://localhost:${PORT}/api/publicaciones`, {
            method: 'POST',
            body: form
        });
        
        const json = await response.json();
        console.log('Response:', json);
    } catch(e) {
        console.error('Fetch error:', e);
    } finally {
        server.close();
        process.exit(0);
    }
});
