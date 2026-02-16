import { Router } from 'express';
import { usuarioController } from './usuario.controller.js';
import { authenticate } from '../../shared/middlewares/auth.middleware.js';
import { authorize } from '../../shared/middlewares/authorize.middleware.js';
import { validate } from '../../validation/middlewares/validate.middleware.js';
import { schemas } from '../../validation/index.js';

const router = Router();

router.post('/register', usuarioController.register);

router.post('/validate-role', usuarioController.validateRole);

router.get(
  '/:id',
  authenticate,
  authorize('profesor', 'administrador', 'alumno'),
  usuarioController.getUserProfile
);

router.get('/role/:rol', usuarioController.getUsersByRol);

router.get('/count/usuarios-stats', usuarioController.getUsuariosStats);

router.put(
  '/:id',
  authenticate,
  validate(schemas.usuarioSchema.updateUserSchema),
  usuarioController.updateStudentProfile
);

export default router;
