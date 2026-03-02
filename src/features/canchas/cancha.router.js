import express from 'express';
import canchaController from './cancha.controller.js';
import { validate } from '../../shared/middlewares/validate.middleware.js';
import { canchaSchema } from './cancha.schema.js';

const router = express.Router();

router.post('/', validate(canchaSchema.createSchema), canchaController.create);
router.get('/', canchaController.getAll);
router.get('/:id', canchaController.getById);
router.put('/:id', validate(canchaSchema.updateSchema), canchaController.update);
router.delete('/:id', canchaController.delete);

export default router;
