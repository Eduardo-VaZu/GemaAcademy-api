import { Router } from 'express';
import { rolesController } from '../controllers/roles.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';

const router = Router();

// Rutas públicas - Listar roles (para que usuarios puedan ver opciones al registrarse)
router.get('/', rolesController.getAllRoles);
router.get('/:id', rolesController.getRoleById);

// Rutas protegidas - Solo administradores pueden crear/modificar/eliminar roles
router.post('/', authenticate, authorize('Administrador'), rolesController.createRole);
router.put('/:id', authenticate, authorize('Administrador'), rolesController.updateRole);
router.delete('/:id', authenticate, authorize('Administrador'), rolesController.deleteRole);

export default router;
