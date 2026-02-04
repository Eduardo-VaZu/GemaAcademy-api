import express from 'express';
import { nivelController } from './niveles.controller.js';

const router = express.Router();

router.post('/', nivelController.createNivel);
router.get('/', nivelController.getAllNiveles);
router.put('/:id', nivelController.updateNivel);
router.delete('/:id', nivelController.deleteNivel);

export default router;
