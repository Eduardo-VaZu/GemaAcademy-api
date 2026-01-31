import { pagosService } from './pagos.service.js';

export const pagosController = {
  reportarPago: async (req, res) => {
    try {
      const resultado = await pagosService.registrarPago(req.body);
      
      res.status(201).json({
        status: 'success',
        message: '¡Pago reportado! Tus cupos están en validación por el administrador.',
        data: resultado,
      });

    } catch (error) {
      // Diferenciamos errores de "no encontrado" vs errores de lógica
      const statusCode = error.message.includes("no existe") ? 404 : 400;
      
      res.status(statusCode).json({
        status: 'error',
        message: error.message,
      });
    }
  },
  validarPagoAdmin: async (req, res) => {
    try {
      // ❌ ANTES (Mal):
      // const data = { ...req.body, usuario_admin_id: 1 }; 

      // ✅ AHORA (Bien): 
      // Esperamos que nos digan QUIÉN es el admin en el cuerpo de la petición (req.body)
      const { pago_id, accion, notas, usuario_admin_id } = req.body;

      if (!usuario_admin_id) {
        throw new Error("Se requiere el ID del administrador (usuario_admin_id).");
      }

      const data = { pago_id, accion, notas, usuario_admin_id };

      const resultado = await pagosService.validarPago(data);
      
      res.status(200).json({
        status: 'success',
        message: resultado.resultado,
        data: resultado
      });

    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  }
};