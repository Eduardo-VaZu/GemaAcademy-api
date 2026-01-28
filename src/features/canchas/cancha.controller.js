import canchaService from './cancha.service.js';

const canchaController = {
  create: async (req, res) => {
    try {
      const cancha = await canchaService.create(req.body);
      res.status(201).json({
        status: 'success',
        message: 'Cancha creada exitosamente',
        data: cancha,
      });
    } catch (error) {
      if (error.message === 'Sede no encontrada') {
        return res.status(404).json({
          status: 'error',
          message: 'Sede no encontrada',
        });
      }
      res.status(500).json({
        status: 'error',
        message: 'Error al crear cancha',
        detail: error.message,
      });
    }
  },

  getAll: async (req, res) => {
    try {
      const canchas = await canchaService.getAll();
      res.status(200).json({
        status: 'success',
        data: canchas,
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Error al obtener canchas',
        detail: error.message,
      });
    }
  },

  getById: async (req, res) => {
    try {
      const cancha = await canchaService.getById(req.params.id);
      if (!cancha) {
        return res.status(404).json({
          status: 'error',
          message: 'Cancha no encontrada',
        });
      }
      res.status(200).json({
        status: 'success',
        data: cancha,
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Error al obtener la cancha',
        detail: error.message,
      });
    }
  },

  update: async (req, res) => {
    try {
      const cancha = await canchaService.update(req.params.id, req.body);
      res.status(200).json({
        status: 'success',
        message: 'Cancha actualizada exitosamente',
        data: cancha,
      });
    } catch (error) {
      if (error.code === 'P2025' || error.message === 'Cancha no encontrada') {
        return res.status(404).json({
          status: 'error',
          message: 'Cancha no encontrada',
        });
      }
      if (error.message === 'Sede no encontrada') {
        return res.status(404).json({
          status: 'error',
          message: 'Sede no encontrada',
        });
      }
      res.status(500).json({
        status: 'error',
        message: 'Error al actualizar cancha',
        detail: error.message,
      });
    }
  },

  delete: async (req, res) => {
    try {
      const cancha = await canchaService.delete(req.params.id);
      res.status(200).json({
        status: 'success',
        message: 'Cancha eliminada exitosamente',
        data: cancha,
      });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          status: 'error',
          message: 'Cancha no encontrada',
        });
      }
      res.status(500).json({
        status: 'error',
        message: 'Error al eliminar cancha',
        detail: error.message,
      });
    }
  },
};

export default canchaController;
