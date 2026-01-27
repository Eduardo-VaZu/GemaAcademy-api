import { inscripcionService } from './inscripcion.service.js';

export const inscripcionController = {

  // 🚀 NUEVO: Inscribir Paquete (1 o más horarios)
  inscribir: async (req, res) => {
    try {
      // Esperamos: { "alumno_id": 6, "horario_ids": [1, 2] }
      const nuevaInscripcion = await inscripcionService.inscribirPaquete(req.body);
      
      res.status(201).json({
        status: 'success',
        message: '¡Inscripción de paquete exitosa!',
        data: nuevaInscripcion,
      });

    } catch (error) {
      // Manejo de errores específicos
      
      // 1. Error de duplicado (Prisma P2002)
      if (error.code === 'P2002') {
        return res.status(400).json({
          status: 'error',
          message: 'El alumno ya está inscrito en uno de los horarios seleccionados.',
        });
      }

      // 2. Errores de Negocio (Sold Out, No hay precio, etc.)
      // Estos son los que lanzamos con "throw new Error" en el servicio
      if (error.message.includes('AGOTADO') || error.message.includes('No existe un plan')) {
        return res.status(409).json({ // 409 Conflict
          status: 'error',
          message: error.message,
        });
      }

      // 3. Error si un horario no existe
      if (error.message.includes('no existe')) {
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

  // Listar (Igual que antes)
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