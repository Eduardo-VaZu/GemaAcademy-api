import { Router } from 'express';
import { usuarioController } from './usuario.controller.js';
import { authenticate } from '../../shared/middlewares/auth.middleware.js';
import { authorize } from '../../shared/middlewares/authorize.middleware.js';
import { validate, validateParams } from '../../shared/middlewares/validate.middleware.js';
import { usuarioSchema } from './usuario.schema.js';

const router = Router();

router.post('/register', validate(usuarioSchema.registerUserSchema), usuarioController.register);

router.post(
  '/validate-role',
  validate(usuarioSchema.validateRoleSchema),
  usuarioController.validateRole
);

router.get(
  '/:id',
  authenticate,
  authorize('Coordinador', 'Administrador', 'Alumno'),
  validateParams(usuarioSchema.idParamSchema),
  usuarioController.getUserProfile
);

router.get(
  '/role/:rol',
  validateParams(usuarioSchema.rolParamSchema),
  usuarioController.getUsersByRol
);

router.get('/count/usuarios-stats', usuarioController.getUsuariosStats);

router.put(
  '/:id',
  authenticate,
  validateParams(usuarioSchema.idParamSchema),
  validate(usuarioSchema.updateUserSchema),
  usuarioController.updateStudentProfile
);

export default router;
