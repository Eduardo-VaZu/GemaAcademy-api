import express from 'express';
import canchaController from './cancha.controller.js';
import { validateRequest } from '../../validation/middlewares/validate.middleware.js';
import { schemas } from '../../validation/index.js';

const router = express.Router();

router.post('/', validateRequest(schemas.canchaSchema.createSchema), canchaController.create);
router.get('/', canchaController.getAll);
router.get('/:id', canchaController.getById);
router.put('/:id', validateRequest(schemas.canchaSchema.updateSchema), canchaController.update);
router.delete('/:id', canchaController.delete);

export default router;
