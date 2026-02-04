import { DescuentosAplicadosService } from './descuentos_aplicados.service.js';

export const DescuentosAplicadosController = {
  async aplicarBeneficio(req, res) {
    try {
      // En JS destruramos directamente del body
      const { cuenta_id, tipo_beneficio_id, admin_id, motivo } = req.body;
      
      const result = await DescuentosAplicadosService.aplicar({
        cuenta_id,
        tipo_beneficio_id,
        admin_id,
        motivo
      });

      res.status(201).json({ 
        ok: true, 
        message: "Descuento aplicado con éxito", 
        data: result 
      });

    } catch (error) {
      console.error(error);
      // Enviamos el mensaje de error controlado (ej: "Cuenta no encontrada")
      res.status(400).json({ ok: false, error: error.message || "Error al procesar" });
    }
  },

  async verHistorialCuenta(req, res) {
    try {
      const { cuentaId } = req.params;
      const result = await DescuentosAplicadosService.obtenerPorCuenta(cuentaId);
      res.json({ ok: true, data: result });
    } catch (error) {
      console.error(error);
      res.status(500).json({ ok: false, error: "Error interno" });
    }
  }
};