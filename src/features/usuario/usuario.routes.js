import { Router } from 'express';
import { usuarioController } from './usuario.controller.js';

const router = Router();

// Rutas de usuarios se definirán aquí
router.post('/register', usuarioController.register);

export default router;
