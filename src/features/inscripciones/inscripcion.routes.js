import { Router } from 'express';
import { inscripcionController } from './inscripcion.controller.js';

const router = Router();

// POST http://localhost:3000/api/inscripciones
router.post('/', inscripcionController.crearInscripcion);

// GET http://localhost:3000/api/inscripciones
router.get('/', inscripcionController.listarInscripciones);

export default router;