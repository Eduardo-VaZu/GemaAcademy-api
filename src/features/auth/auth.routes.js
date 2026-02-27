import { Router } from 'express';
import { authController } from './auth.controller.js';
import { authenticate } from '../../shared/middlewares/auth.middleware.js';
import { validate } from '../../validation/middlewares/validate.middleware.js';
import { schemas } from '../../validation/index.js';

import { loginLimiter } from '../../shared/middlewares/rateLimit.middleware.js';

const router = Router();

router.post('/login', loginLimiter, validate(schemas.authSchema.loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

router.get('/profile', authenticate, authController.getProfile);
router.post('/logout-all', authenticate, authController.revokeAllSessions);

router.post(
  '/completar-email',
  authenticate,
  validate(schemas.authSchema.completarEmailSchema),
  authController.completarEmail
);

router.post(
  '/forgot-password',
  validate(schemas.authSchema.forgotPasswordSchema),
  authController.forgotPassword
);
router.post(
  '/reset-password',
  validate(schemas.authSchema.resetPasswordSchema),
  authController.resetPassword
);

export default router;
