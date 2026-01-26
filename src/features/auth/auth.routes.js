import { Router } from 'express';
import { authController } from './auth.controller.js';
import { authenticate } from '../../shared/middlewares/auth.middleware.js';
import { validate } from '../../validation/middlewares/validate.middleware.js';
import { schemas } from '../../validation/index.js';

const router = Router();

// Rutas públicas (no requieren autenticación)
router.post('/login', validate(schemas.authSchema.loginSchema), authController.login);
router.post('/refresh', validate(schemas.authSchema.refreshSchema), authController.refresh);
router.post('/logout', validate(schemas.authSchema.logoutSchema), authController.logout);

// Rutas protegidas (requieren autenticación)
router.get('/profile', authenticate, authController.getProfile);

export default router;
