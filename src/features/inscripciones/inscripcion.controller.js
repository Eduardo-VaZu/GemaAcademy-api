import { inscripcionService } from './inscripcion.service.js';

export const inscripcionController = {

  crearInscripcion: async (req, res) => {
    try {
      const nuevaInscripcion = await inscripcionService.inscribirAlumno(req.body);
      
      res.status(201).json({
        status: 'success',
        message: '¡Inscripción exitosa!',
        data: nuevaInscripcion,
      });

    } catch (error) {
      // Manejo de errores específicos
      
      // 1. Error de duplicado (Prisma P2002): El alumno ya está en esa clase
      if (error.code === 'P2002') {
        return res.status(400).json({
          status: 'error',
          message: 'Este alumno YA está inscrito en este horario.',
        });
      }

      // 2. Error de cupos llenos (El que lanzamos nosotros en el servicio)
      if (error.message === 'SOLD_OUT') {
        return res.status(409).json({ // 409 Conflict
          status: 'error',
          message: 'Lo sentimos, este horario ya no tiene vacantes disponibles.',
        });
      }

      // 3. Error si el horario no existe
      if (error.message === 'El horario indicado no existe.') {
        return res.status(404).json({
          status: 'error',
          message: error.message,
        });
      }

      // Error genérico
      console.error(error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno al procesar la inscripción',
        detail: error.message
      });
    }
  },

  listarInscripciones: async (req, res) => {
    try {
      const lista = await inscripcionService.getAllInscripciones();
      res.json({
        status: 'success',
        data: lista,
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Error al obtener inscripciones',
        detail: error.message
      });
    }
  }
};