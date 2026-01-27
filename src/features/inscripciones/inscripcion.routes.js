import { Router } from 'express';
import { inscripcionController } from './inscripcion.controller.js';

const router = Router();

// POST http://localhost:3000/api/inscripciones
// ⚠️ CAMBIO AQUÍ: 'crearInscripcion' -> 'inscribir'
router.post('/', inscripcionController.inscribir);

// GET http://localhost:3000/api/inscripciones
router.get('/', inscripcionController.listarInscripciones);

export default router;