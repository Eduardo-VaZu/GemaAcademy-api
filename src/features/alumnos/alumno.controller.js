import { alumnoService } from './alumno.service.js';

export const alumnoController = {
  actualizarMiPerfil: async (req, res) => {
    try {
      // Usamos req.user o req.usuario según tu middleware 'authenticate'
      const usuarioId = req.user?.id || req.usuario?.id;

      if (!usuarioId) {
        return res.status(401).json({ success: false, message: "Sesión no identificada" });
      }

      const perfilActualizado = await alumnoService.actualizarMiPerfil(usuarioId, req.body);

      res.status(200).json({
        success: true,
        message: '¡Perfil actualizado correctamente!',
        data: perfilActualizado
      });
    } catch (error) {
      console.error("❌ ERROR EN PERFIL:", error);
      res.status(400).json({ success: false, message: error.message });
    }
  }
};