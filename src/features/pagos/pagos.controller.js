import { pagosService } from './pagos.service.js';

export const pagosController = {
  reportarPago: async (req, res) => {
    try {
      // Esperamos: deuda_id, monto, metodo_pago, codigo_operacion, voucher_url
      const resultado = await pagosService.registrarPago(req.body);
      
      res.status(201).json({
        status: 'success',
        message: 'Pago reportado correctamente. Esperando validación del admin.',
        data: resultado,
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  }
};