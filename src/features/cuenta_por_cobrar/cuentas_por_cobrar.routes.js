import { Router } from 'express';
import { CuentasPorCobrarController } from './cuentas_por_cobrar.controller.js';

const router = Router();

router.post('/', CuentasPorCobrarController.crear);
router.get('/', CuentasPorCobrarController.listar);
router.get('/:id', CuentasPorCobrarController.obtenerUno);
router.put('/:id', CuentasPorCobrarController.actualizar);
router.delete('/:id', CuentasPorCobrarController.eliminar);
// GET /api/cuentas/historial/16 -> Trae todo lo del alumno con ID 16
router.get('/historial/:alumnoId', CuentasPorCobrarController.obtenerHistorialAlumno);

export default router;