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

// ✅ Corrección en asistencia.routes.js
router.use(authenticate); 

router.get(
    '/agenda/hoy', 
    authorize('Profesor'), // Sin corchetes
    asistenciaController.listarClasesHoy
);

router.patch(
    '/:id',
    authorize('Profesor', 'Administrador'), // Sin corchetes
    asistenciaController.marcarAsistencia
);

export default router;