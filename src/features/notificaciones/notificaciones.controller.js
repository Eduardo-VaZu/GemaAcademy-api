import { notificacionesService } from './notificaciones.service.js';

export const getNotificaciones = async (req, res) => {
  try {
    const usuarioId = req.user.id; // Extraemos el ID del token
    const data = await notificacionesService.obtenerPorUsuario(usuarioId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 🔥 Nuevo controlador para el conteo
export const getConteoNoLeidas = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const conteo = await notificacionesService.obtenerConteoNoLeidas(usuarioId);
    res.json({ success: true, data: conteo });
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