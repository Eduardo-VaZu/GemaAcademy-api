import { Router } from 'express';
import multer from 'multer'; // Importamos multer directamente aquí
import { publicacionController } from './publicacion.controller.js';
import { authenticate } from '../../shared/middlewares/auth.middleware.js';
import { authorize } from '../../shared/middlewares/authorize.middleware.js';

const router = Router();

// ==========================================
// Configuración de Multer (Igual que en lesiones)
// ==========================================
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

router.use(authenticate);

// ==========================================
// RUTAS DE LECTURA (Públicas o para usuarios)
// ==========================================
router.get('/', authorize('Administrador'), publicacionController.getAllPublicaciones);
router.get('/:id', authorize('Administrador'), publicacionController.getPublicacionById);

// ==========================================
// RUTAS DE ADMINISTRADOR
// ==========================================
router.post(
  '/',
  authorize('Administrador'),
  upload.single('imagen'),
  publicacionController.createPublicacion
);

router.put(
  '/:id',
  authorize('Administrador'),
  upload.single('imagen'), // También aquí por si editan la foto
  publicacionController.updatePublicacion
);

router.patch(
  '/:id/desactivar',
  authorize('Administrador'),
  publicacionController.updateDefusePublicacion
);

router.patch(
  '/:id/activar',
  authorize('Administrador'),
  publicacionController.updateActivePublicacion
);

router.delete(
  '/:id',
  authorize('Administrador'),
  publicacionController.deletePublicacion
);

export default router;