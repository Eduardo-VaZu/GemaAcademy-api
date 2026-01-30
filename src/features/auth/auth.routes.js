import { Router } from 'express';
import { authController } from './auth.controller.js';
import { authenticate } from '../../shared/middlewares/auth.middleware.js';
import { validate } from '../../validation/middlewares/validate.middleware.js';
import { schemas } from '../../validation/index.js';

import { loginLimiter } from '../../shared/middlewares/rateLimit.middleware.js';

const router = Router();

// Rutas públicas (no requieren autenticación)
router.post('/login', loginLimiter, validate(schemas.authSchema.loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

// Rutas protegidas (requieren autenticación) -> obtener el perfil del usuario
router.get('/profile', authenticate, authController.getProfile);
// Rutas protegidas (requieren autenticación) -> cerrar todas las sesiones del usuario activas
router.post('/logout-all', authenticate, authController.revokeAllSessions);

export default router;
