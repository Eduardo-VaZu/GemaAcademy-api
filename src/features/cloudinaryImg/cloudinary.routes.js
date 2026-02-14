import express from 'express';
import multer from 'multer';
import { uploadFile } from './cloudinary.controller.js';

const router = express.Router();

// Configuración de Multer
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('¡Solo se permiten imágenes!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
});

// Rutas
router.post('/upload', upload.single('imagen'), uploadFile);

export default router;
