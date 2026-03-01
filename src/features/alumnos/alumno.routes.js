import { Router } from 'express';
import { alumnoController } from './alumno.controller.js';
// Importa tus middlewares reales (ajusta la ruta según tu proyecto)
import { verificarToken } from '../../middlewares/auth.middleware.js'; 

const router = Router();

// PUT /api/alumnos/mi-perfil
// Solo un usuario logueado puede acceder a esta ruta
router.put('/mi-perfil', verificarToken, alumnoController.actualizarMiPerfil);

export default router;