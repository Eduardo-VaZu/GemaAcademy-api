import { sedeService } from './sede.service.js';

export const sedeController = {
  createSede: async (req, res) => {
    try {
      const { sedeData } = req.body;
      if (!sedeData) {
        return res.status(400).json({
          status: 'error',
          message: 'No se proporcionó datos de la sede',
        });
      }
      if (!sedeData.direccion) {
        return res.status(400).json({
          status: 'error',
          message: 'Los campos nombre y dirección son obligatorios',
        });
      }
      const sede = await sedeService.createSede(sedeData);
      res.status(201).json({
        status: 'success',
        message: 'Sede creada exitosamente',
        data: sede,
      });
    } catch (error) {
      console.error('Error al crear la sede:', error);
      if (error.message.includes('ya existe')) {
        return res.status(409).json({
          status: 'error',
          message: error.message,
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Error al crear la sede',
        detail: error.message,
      });
    }
  },

  getAllSedes: async (req, res) => {
    try {
      const filter = {
        activo: req.query.activo,
        distrito: req.query.distrito,
        tipo_instalacion: req.query.tipo_instalacion,
        page: req.query.page,
        limit: req.query.limit,
      };

      const result = await sedeService.getAllSedes(filter);
      res.json({
        status: 'success',
        data: result.data,
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      console.error('Error al obtener sedes:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error al obtener sedes',
        detail: error.message,
      });
    }
  },

  getSedeById: async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({
          status: 'error',
          message: 'ID de sede inválido',
          code: 'INVALID_ID',
        });
      }

      const sede = await sedeService.getSedeById(id);

      if (!sede) {
        return res.status(404).json({
          status: 'error',
          message: 'Sede no encontrada',
          code: 'SEDE_NOT_FOUND',
        });
      }

      res.json({
        status: 'success',
        data: sede,
      });
    } catch (error) {
      console.error('Error al obtener sede:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error al obtener sede',
        detail: error.message,
      });
    }
  },

  updateSede: async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { sedeData } = req.body;

      if (isNaN(id)) {
        return res.status(400).json({
          status: 'error',
          message: 'ID de sede inválido',
          code: 'INVALID_ID',
        });
      }

      const sede = await sedeService.updateSede(id, sedeData);

      if (!sede) {
        return res.status(404).json({
          status: 'error',
          message: 'Sede no encontrada',
          code: 'SEDE_NOT_FOUND',
        });
      }

      res.json({
        status: 'success',
        data: sede,
      });
    } catch (error) {
      console.error('Error al actualizar sede:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error al actualizar sede',
        detail: error.message,
      });
    }
  },

  desactivarSede: async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({
          status: 'error',
          message: 'ID de sede inválido',
          code: 'INVALID_ID',
        });
      }

      const sede = await sedeService.desactivarSede(id);

      if (!sede) {
        return res.status(404).json({
          status: 'error',
          message: 'Sede no encontrada',
          code: 'SEDE_NOT_FOUND',
        });
      }

      res.json({
        status: 'success',
        data: sede,
      });
    } catch (error) {
      console.error('Error al desactivar sede:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error al desactivar sede',
        detail: error.message,
      });
    }
  },

  updateActiveSede: async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({
          status: 'error',
          message: 'ID de sede inválido',
          code: 'INVALID_ID',
        });
      }

      const sede = await sedeService.updateActiveSede(id);

      if (!sede) {
        return res.status(404).json({
          status: 'error',
          message: 'Sede no encontrada',
          code: 'SEDE_NOT_FOUND',
        });
      }

      res.json({
        status: 'success',
        data: sede,
      });
    } catch (error) {
      console.error('Error al activar sede:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error al activar sede',
        detail: error.message,
      });
    }
  },
};
