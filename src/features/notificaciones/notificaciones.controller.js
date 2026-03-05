import { notificacionesService } from './notificaciones.service.js';

export const getNotificaciones = async (req, res) => {
  try {
    const data = await notificacionesService.obtenerTodas();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const patchMarcarLeida = async (req, res) => {
  try {
    const { id } = req.params;
    await notificacionesService.marcarComoLeida(id);
    res.json({ success: true, message: 'Notificación leída' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};