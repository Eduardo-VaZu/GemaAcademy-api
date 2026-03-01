import { alumnoService } from './alumno.service.js';

export const alumnoController = {
  actualizarMiPerfil: async (req, res) => {
    try {
      // Usamos el ID que inyectó el middleware 'authenticate'
      const usuarioId = req.user?.id || req.usuario?.id; 

      if (!usuarioId) {
        throw new Error("Sesión inválida o expirada.");
      }

      const perfilActualizado = await alumnoService.actualizarMiPerfil(usuarioId, req.body);

      res.status(200).json({
        success: true,
        message: '¡Perfil actualizado!',
        data: perfilActualizado
      });
    } catch (error) {
      console.error('[Alumno Controller Error]:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Error al actualizar.'
      });
    }
  }
};