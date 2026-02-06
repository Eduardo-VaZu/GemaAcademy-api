import { Router } from 'express';
import { pagosController } from './pagos.controller.js';

const router = Router();

// POST http://localhost:3000/api/pagos/reportar
router.post('/reportar', pagosController.reportarPago);
router.post('/validar', pagosController.validarPagoAdmin);
// GET: Listar todos los pagos (Para la tabla de Admin)
router.get('/', pagosController.listarPagos);

// GET: Ver detalle de un pago específico
router.get('/:id', pagosController.obtenerPago);

// DELETE: Borrar un registro (Cuidado: afecta auditoría)
router.delete('/:id', pagosController.eliminarPago);

export default router;