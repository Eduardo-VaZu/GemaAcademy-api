import { Router } from 'express';
import { DescuentosAplicadosController } from './descuentos_aplicados.controller.js';

const router = Router();

// POST: Para aplicar el descuento (Lo que hará Eddy)
router.post('/aplicar', DescuentosAplicadosController.aplicarBeneficio);

// GET: Para ver qué descuentos tiene una cuenta (Lo que verá Javier en su recibo)
router.get('/cuenta/:cuentaId', DescuentosAplicadosController.verHistorialCuenta);

export default router;