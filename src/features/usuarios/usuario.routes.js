import { Router } from 'express';
import { usuarioController } from './usuario.controller.js';
import { authenticate } from '../../shared/middlewares/auth.middleware.js';
import { authorize } from '../../shared/middlewares/authorize.middleware.js';
import { validate } from '../../validation/middlewares/validate.middleware.js';
import { schemas } from '../../validation/index.js';

const router = Router();

router.post(
  '/register',
  validate(schemas.usuarioSchema.registerUserSchema),
  usuarioController.register
);

router.post('/validate-role', usuarioController.validateRole);

router.get(
  '/:id',
  authenticate,
  authorize(['profesor', 'administrador']),
  usuarioController.getUserProfile
);

export default router;
