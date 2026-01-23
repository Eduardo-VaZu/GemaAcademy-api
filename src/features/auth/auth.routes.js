import { Router } from 'express';
import { authController } from './auth.controller.js';
import { authenticate } from './middlewares/auth.middleware.js';

const router = Router();

// Rutas públicas (no requieren autenticación)
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

// Rutas protegidas (requieren autenticación)
router.get('/profile', authenticate, authController.getProfile);

export default router;
