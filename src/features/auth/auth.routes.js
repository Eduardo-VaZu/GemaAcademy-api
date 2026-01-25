import { Router } from 'express';
import { authController } from './auth.controller.js';
import { authenticate } from './middlewares/auth.middleware.js';
import { validate } from '../../commons/middlewares/validate.middleware.js';
import { authSchemas } from '../../validation/validation.auth/index.js';

const router = Router();

// Rutas públicas (no requieren autenticación)
router.post('/login', validate(authSchemas.loginSchema), authController.login);
router.post('/refresh', validate(authSchemas.refreshSchema), authController.refresh);
router.post('/logout', validate(authSchemas.logoutSchema), authController.logout);

// Rutas protegidas (requieren autenticación)
router.get('/profile', authenticate, authController.getProfile);

export default router;
