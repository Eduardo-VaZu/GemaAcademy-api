import { Router } from 'express';
import * as notificacionesController from './notificaciones.controller.js';

const router = Router();

// GET /api/notificaciones
router.get('/', notificacionesController.getNotificaciones);

// PATCH /api/notificaciones/:id/leer
router.patch('/:id/leer', notificacionesController.patchMarcarLeida);

export default router;