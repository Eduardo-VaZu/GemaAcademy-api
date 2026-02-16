import { Router } from 'express';
import { recuperacionController } from './recuperacion.controller.js';
import { authenticate } from '../../shared/middlewares/auth.middleware.js';
import { authorize } from '../../shared/middlewares/authorize.middleware.js';

const router = Router();

router.use(authenticate);

// GET /api/recuperaciones/pendientes
router.get(
    '/pendientes',
    authorize('Alumno'),
    recuperacionController.obtenerPendientes
);

// POST /api/recuperaciones/validar-elegibilidad
router.post(
    '/validar-elegibilidad',
    authorize('Alumno', 'Administrador'),
    recuperacionController.validarElegibilidad
);

// POST /api/recuperaciones
router.post(
    '/agendar-recuperacion',
    authorize('Alumno', 'Administrador'),
    recuperacionController.agendarRecuperacion
);

export default router;