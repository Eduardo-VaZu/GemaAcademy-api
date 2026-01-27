import { sedeService } from './sede.service';

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
      if (!sedeData.nombre || !sedeData.direccion) {
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
};
