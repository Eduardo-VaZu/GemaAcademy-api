import { Router } from 'express';
import { alumnoController } from './alumno.controller.js';

const router = Router();

// PUT /api/alumno/mi-perfil
// ⚠️ Se ha quitado el middleware de autenticación temporalmente
router.put('/mi-perfil', alumnoController.actualizarMiPerfil);

export default router;