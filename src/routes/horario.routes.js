import { Router } from 'express';
import { horarioController } from '../controllers/horario.controller.js';

const router = Router();

router.get('/', horarioController.getHorarios);
router.post('/', horarioController.createHorario);

export default router;