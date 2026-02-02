import { Router } from 'express';
import { recuperacionController } from './recuperacion.controller.js';
import { authenticate } from '../../shared/middlewares/auth.middleware.js';
import { authorize } from '../../shared/middlewares/authorize.middleware.js';

const router = Router();

router.use(authenticate);

// POST /api/recuperaciones/validar-elegibilidad
router.post(
    '/validar-elegibilidad',
    authorize('alumno', 'administrador'),
    recuperacionController.validarElegibilidad
);

// POST /api/recuperaciones
router.post(
    '/agendar-recuperacion',
    authorize('alumno', 'administrador'),
    recuperacionController.agendarRecuperacion
);

export default router;