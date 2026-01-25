import { Router } from 'express';
import { usuarioController } from './usuario.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { userSchemas } from '../../validation/validation.user/index.js';

const router = Router();

router.post('/register', validate(userSchemas.registerUserSchema), usuarioController.register);

export default router;
