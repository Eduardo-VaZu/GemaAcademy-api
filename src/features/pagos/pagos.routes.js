import { Router } from 'express';
import { pagosController } from './pagos.controller.js';

const router = Router();

// POST http://localhost:3000/api/pagos/reportar
router.post('/reportar', pagosController.reportarPago);

export default router;