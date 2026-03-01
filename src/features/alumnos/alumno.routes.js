import { Router } from 'express';
import { alumnoController } from './alumno.controller.js';
import { authenticate } from '../../shared/middlewares/auth.middleware.js';

const router = Router();

// Solo pedimos que el usuario esté logueado
router.use(authenticate);

// PUT /api/alumno/mi-perfil
router.put('/mi-perfil', alumnoController.actualizarMiPerfil);

export default router;