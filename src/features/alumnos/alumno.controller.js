import { alumnoService } from './alumno.service.js';

export const alumnoController = {
  actualizarMiPerfil: async (req, res) => {
    try {
      // 🛡️ SEGURIDAD CRÍTICA: Tomamos el ID del token JWT, NUNCA del cliente
      const usuarioId = req.usuario.id; // Asumiendo que tu middleware de auth inyecta req.usuario

      // Le pasamos TODO el req.body, porque nuestro service ya está blindado
      // y se encargará de ignorar los campos que no estén permitidos
      const perfilActualizado = await alumnoService.actualizarMiPerfil(usuarioId, req.body);

      res.status(200).json({
        success: true,
        message: 'Tu perfil ha sido actualizado correctamente.',
        data: perfilActualizado
      });
    } catch (error) {
      console.error('[Alumno Controller Error]:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Error al actualizar el perfil.'
      });
    }
  }
};