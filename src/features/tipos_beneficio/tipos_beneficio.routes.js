import { Router } from 'express';
import { TiposBeneficioController } from './tipos_beneficio.controller.js';

const router = Router();

router.post('/', TiposBeneficioController.crear);
router.get('/', TiposBeneficioController.listar);

export default router;