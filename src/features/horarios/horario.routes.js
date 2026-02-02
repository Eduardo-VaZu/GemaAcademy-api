import { Router } from 'express';
import { horarioController } from './horario.controller.js';
import { validate } from '../../validation/middlewares/validate.middleware.js';
import { schemas } from '../../validation/index.js';

const router = Router();

router.get('/', horarioController.getHorarios);
router.post('/', validate(schemas.horarioSchema.createHorarioSchema), horarioController.createHorario);

export default router;
