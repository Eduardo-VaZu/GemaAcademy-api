import express from 'express';
import { nivelController } from './niveles.controller.js';

const router = express.Router();

router.get('/', nivelController.getAllNiveles);

export default router;