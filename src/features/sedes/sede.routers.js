import { Router } from 'express';
import { sedeController } from './sede.controller.js';
import { authenticate } from '../../shared/middlewares/auth.middleware.js';
import { authorize } from '../../shared/middlewares/authorize.middleware.js';

const router = Router();

router.get('/', sedeController.getAllSedes);
router.get('/:id', sedeController.getSedeById);

router.post('/', authenticate, authorize('Administrador'), sedeController.createSede);

router.put('/:id', authenticate, authorize('Administrador'), sedeController.updateSede);

router.delete('/:id', authenticate, authorize('Administrador'), sedeController.desactivarSede);

export default router;
