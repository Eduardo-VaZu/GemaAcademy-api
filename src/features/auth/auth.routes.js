import { Router } from 'express';
import { authController } from './auth.controller.js';
import { authenticate } from '../../shared/middlewares/auth.middleware.js';
import { validate } from '../../shared/middlewares/validate.middleware.js';
import { authSchema } from './auth.schema.js';

import { loginLimiter } from '../../shared/middlewares/rateLimit.middleware.js';

const router = Router();

router.post('/login', loginLimiter, validate(authSchema.loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

router.get('/profile', authenticate, authController.getProfile);
router.post('/logout-all', authenticate, authController.revokeAllSessions);

router.post(
  '/completar-email',
  authenticate,
  validate(authSchema.completarEmailSchema),
  authController.completarEmail
);

router.post(
  '/forgot-password',
  validate(authSchema.forgotPasswordSchema),
  authController.forgotPassword
);
router.post(
  '/reset-password',
  validate(authSchema.resetPasswordSchema),
  authController.resetPassword
);

export default router;
