import { Router } from 'express';
import { CatalogoController } from './catalogo.controller.js';

const router = Router();
const controller = new CatalogoController();

// Ruta para obtener todos los conceptos activos
router.get('/', controller.getAll);

// Ruta para obtener un solo concepto por su ID
router.get('/:id', controller.getById);

// Ruta para crear un nuevo concepto (Mensualidad, Inscripción, etc.)
router.post('/', controller.create);

// Ruta para actualizar un concepto existente
router.put('/:id', controller.update);

// Ruta para eliminar (borrado lógico) un concepto
router.delete('/:id', controller.delete);

export default router;