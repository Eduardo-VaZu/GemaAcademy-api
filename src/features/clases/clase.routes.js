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
  authorize('Administrador'),
  validate(claseSchema.reprogramarMasivoSchema),
  claseController.reprogramarMasivo
);

// Obtener detalle de un horario (alumnos inscritos, info general)
router.get(
  '/:horario_id/detalle',
  authorize('Administrador', 'Profesor'),
  claseController.obtenerDetalle
);

export default router;
