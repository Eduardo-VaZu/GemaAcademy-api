import { Router } from 'express';
import { lesionController } from './lesion.controller.js';
import { authenticate } from '../../shared/middlewares/auth.middleware.js';
import { authorize } from '../../shared/middlewares/authorize.middleware.js';

const router = Router();

// Todas las rutas requieren autenticación (token válido)
router.use(authenticate);

// ==========================================
// RUTAS DE ALUMNO
// ==========================================

// Solicitar una lesión
// POST /api/lesiones
router.post(
    '/',
    authorize('Alumno'),
    lesionController.crearSolicitud
);

// Ver mi historial
// GET /api/lesiones/mis-solicitudes
router.get(
    '/mis-solicitudes',
    authorize('Alumno'),
    lesionController.obtenerMisSolicitudes
);

// ==========================================
// RUTAS DE ADMINISTRADOR
// ==========================================

// Ver cola de pendientes
// GET /api/lesiones/pendientes
router.get(
    '/pendientes',
    authorize('Administrador'),
    lesionController.obtenerPendientes
);

// Evaluar una solicitud (Aprobar/Rechazar)
// POST /api/lesiones/15/evaluar
router.post(
    '/:solicitudId/evaluar',
    authorize('Administrador'),
    lesionController.evaluarSolicitud
);

export default router;