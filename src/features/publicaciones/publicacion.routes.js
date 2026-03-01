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


// ==========================================
// RUTAS DE LECTURA (Públicas o para usuarios)
// ==========================================
router.get('/', publicacionController.getAllPublicaciones);
router.get('/:id', publicacionController.getPublicacionById);

// ==========================================
// RUTAS DE ADMINISTRADOR
// ==========================================
router.post(
  '/',
  upload.single('imagen'), 
  (req, res, next) => {
    // 🔍 MONITOREO EN CONSOLA
    console.log("=== NUEVA PETICIÓN DE PUBLICACIÓN ===");
    console.log("Body recibido:", req.body);
    console.log("Archivo (req.file):", req.file ? req.file.originalname : "❌ NO LLEGÓ IMAGEN");
    console.log("Admin logueado (req.user):", req.user ? req.user.id : "❌ NO HAY USER EN REQ");
    next(); // Pasa al controlador
  },
  publicacionController.createPublicacion
);

router.put(
  '/:id',
  authenticate,
  authorize('Administrador'),
  upload.single('imagen'), // También aquí por si editan la foto
  publicacionController.updatePublicacion
);

router.patch(
  '/:id/desactivar',
  authenticate,
  authorize('Administrador'),
  publicacionController.updateDefusePublicacion
);

router.patch(
  '/:id/activar',
  authenticate,
  authorize('Administrador'),
  publicacionController.updateActivePublicacion
);

router.delete(
  '/:id',
  authenticate,
  authorize('Administrador'),
  publicacionController.deletePublicacion
);

export default router;