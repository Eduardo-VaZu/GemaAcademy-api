import { Router } from 'express';
import { claseController } from './clase.controller.js';
import { authenticate } from '../../shared/middlewares/auth.middleware.js';
import { authorize } from '../../shared/middlewares/authorize.middleware.js';
import { validate } from '../../validation/middlewares/validate.middleware.js';
import { claseSchema } from './clase.schema.js';

const router = Router();

router.use(authenticate);

// Solo administradores pueden reprogramar masivamente
router.post(
  '/reprogramar-masivo',
  authorize('administrador'),
  validate(claseSchema.reprogramarMasivoSchema),
  claseController.reprogramarMasivo
);

export default router;
