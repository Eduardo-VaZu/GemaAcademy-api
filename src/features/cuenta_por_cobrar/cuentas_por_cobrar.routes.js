import { Router } from 'express';
import { CuentasPorCobrarController } from './cuentas_por_cobrar.controller.js';

const router = Router();

router.post('/', CuentasPorCobrarController.crear);
router.get('/', CuentasPorCobrarController.listar);
router.get('/:id', CuentasPorCobrarController.obtenerUno);
router.put('/:id', CuentasPorCobrarController.actualizar);
router.delete('/:id', CuentasPorCobrarController.eliminar);

export default router;