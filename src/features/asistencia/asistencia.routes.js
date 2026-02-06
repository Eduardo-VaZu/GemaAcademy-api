import { Router } from 'express';
import { asistenciaController } from './asistencia.controller.js';
import { authenticate } from '../../shared/middlewares/auth.middleware.js';
import { authorize } from '../../shared/middlewares/authorize.middleware.js';

const router = Router();

// ======================================================
// 🔓 RUTAS PÚBLICAS (Sin Token por ahora)
// ======================================================

// Buscar asistencias por ID de alumno
router.get('/alumno/:alumnoId', asistenciaController.listarPorAlumno);

// Listado general de asistencias
router.get('/', asistenciaController.listarTodas);


// ======================================================
// 🔒 RUTAS PROTEGIDAS (Necesitan Token)
// ======================================================
router.use(authenticate); 

// Endpoint: PATCH /api/asistencias/:id
// Solo profesores y admins pueden marcar asistencia
router.patch(
    '/:id',
    authorize(['profesor', 'administrador']),
    asistenciaController.marcarAsistencia
);

export default router;