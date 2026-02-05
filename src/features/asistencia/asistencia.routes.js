import { Router } from 'express';
import { asistenciaController } from './asistencia.controller.js';
import { authenticate } from '../../shared/middlewares/auth.middleware.js';
import { authorize } from '../../shared/middlewares/authorize.middleware.js';

const router = Router();

router.use(authenticate);

// Endpoint: PATCH /api/asistencias/:id
// Body: { "estado": "FALTA", "comentario": "No vino" }
router.patch(
    '/:id',
    // Solo profesores y admins pueden tomar lista
    authorize(['profesor', 'administrador']),
    asistenciaController.marcarAsistencia
);

export default router;