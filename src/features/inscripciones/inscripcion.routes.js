import { Router } from 'express';
import { inscripcionController } from './inscripcion.controller.js';

const router = Router();

// POST http://localhost:3000/api/inscripciones
// ⚠️ CAMBIO AQUÍ: 'crearInscripcion' -> 'inscribir'
router.post('/', inscripcionController.inscribir);

// GET http://localhost:3000/api/inscripciones
router.get('/', inscripcionController.listarInscripciones);

// GET: Listado por alumno (CORREGIDO el nombre del controlador)
router.get('/alumno/:alumnoId', inscripcionController.listarPorAlumno); //

// GET: Detalle de una sola inscripción
router.get('/:id', inscripcionController.obtenerDetalle);

// DELETE: Cancelar inscripción
router.delete('/:id', inscripcionController.eliminar);

export default router;