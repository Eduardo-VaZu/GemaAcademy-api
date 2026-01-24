import { Router } from 'express';
import { authController } from './auth.controller.js';
import { authenticate } from './middlewares/auth.middleware.js';
import {
  validate,
  loginSchema,
  refreshSchema,
  logoutSchema,
} from './validation/auth.validation.js';

const router = Router();

// Rutas públicas (no requieren autenticación)
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/logout', validate(logoutSchema), authController.logout);

// Rutas protegidas (requieren autenticación)
router.get('/profile', authenticate, authController.getProfile);

export default router;
