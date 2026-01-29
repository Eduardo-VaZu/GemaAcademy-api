import { Router } from 'express';
import { sedeController } from './sede.controller.js';
import { authenticate } from '../../shared/middlewares/auth.middleware.js';
import { authorize } from '../../shared/middlewares/authorize.middleware.js';
import {
  validate,
  validateParams,
  validateQuery,
} from '../../validation/middlewares/validate.middleware.js';
import { schemas } from '../../validation/index.js';

const router = Router();

router.get('/', validateQuery(schemas.sedeSchema.sedeQuerySchema), sedeController.getAllSedes);
router.get(
  '/:id',
  validateParams(schemas.sedeSchema.sedeIdParamSchema),
  sedeController.getSedeById
);

router.post(
  '/',
  authenticate,
  authorize('Administrador'),
  validate(schemas.sedeSchema.createSedeSchema),
  sedeController.createSede
);

router.put(
  '/:id',
  authenticate,
  authorize('Administrador'),
  validateParams(schemas.sedeSchema.sedeIdParamSchema),
  validate(schemas.sedeSchema.updateSedeSchema),
  sedeController.updateSede
);

router.patch(
  '/:id/desactivar',
  authenticate,
  authorize('Administrador'),
  validateParams(schemas.sedeSchema.sedeIdParamSchema),
  sedeController.desactivarSede
);

router.patch(
  '/:id/activar',
  authenticate,
  authorize('Administrador'),
  validateParams(schemas.sedeSchema.sedeIdParamSchema),
  sedeController.updateActiveSede
);

export default router;
