import { horarioService } from './horario.service.js';

export const horarioController = {
  getHorarios: async (req, res) => {
    try {
      const horarios = await horarioService.getAllHorarios();
      res.json({
        status: 'success',
        data: horarios,
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Error al obtener horarios',
        detail: error.message,
      });
    }
  },

  createHorario: async (req, res) => {
    try {
      const nuevoHorario = await horarioService.createHorario(req.body);
      res.status(201).json({
        status: 'success',
        message: 'Horario creado exitosamente',
        data: nuevoHorario,
      });
    } catch (error) {
      // Manejo de error específico de Prisma (clave única violada)
      if (error.code === 'P2002') {
        return res.status(400).json({
          status: 'error',
          message: 'Ya existe un horario en esa Cancha, Día y Hora.',
        });
      }

      res.status(400).json({
        status: 'error',
        message: 'No se pudo crear el horario',
        detail: error.message,
      });
    }
  },
};
