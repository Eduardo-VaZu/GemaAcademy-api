import { Router } from 'express';
import { rolesController } from './roles.controller.js';
import { authenticate } from '../../shared/middlewares/auth.middleware.js';
import { authorize } from '../../shared/middlewares/authorize.middleware.js';
import { validate } from '../../validation/middlewares/validate.middleware.js';
import { schemas } from '../../validation/index.js';

const router = Router();

// Rutas públicas - Listar roles (para que usuarios puedan ver opciones al registrarse)
router.get('/', rolesController.getAllRoles);
router.get('/:id', rolesController.getRoleById);

// Rutas protegidas - Solo administradores pueden crear/modificar/eliminar roles
router.post('/', authenticate, authorize('Administrador'), rolesController.createRole);
router.put('/:id', authenticate, authorize('Administrador'), rolesController.updateRole);
router.delete('/:id', authenticate, authorize('Administrador'), rolesController.deleteRole);

export default router;
