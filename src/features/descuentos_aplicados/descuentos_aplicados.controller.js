import { DescuentosAplicadosService } from './descuentos_aplicados.service.js';

export const DescuentosAplicadosController = {
  async aplicarBeneficio(req, res) {
    try {
      const { cuenta_id, tipo_beneficio_id, admin_id, motivo } = req.body;

      // Validación rápida de campos obligatorios
      if (!cuenta_id || !tipo_beneficio_id || !admin_id) {
        return res.status(400).json({ 
          ok: false, 
          error: "Faltan datos obligatorios (cuenta, beneficio o admin)" 
        });
      }
      
      const result = await DescuentosAplicadosService.aplicar({
        cuenta_id: parseInt(cuenta_id),
        tipo_beneficio_id: parseInt(tipo_beneficio_id),
        admin_id: parseInt(admin_id),
        motivo
      });

      res.status(201).json({ 
        ok: true, 
        message: result.mensaje || "Descuento aplicado con éxito", 
        data: result.descuento 
      });

    } catch (error) {
      console.error("Error en Descuentos Controller:", error.message);
      res.status(400).json({ ok: false, error: error.message || "Error al procesar el beneficio" });
    }
  },

  async verHistorialCuenta(req, res) {
    try {
      const { cuentaId } = req.params;
      if (!cuentaId) throw new Error("ID de cuenta no proporcionado");

      const result = await DescuentosAplicadosService.obtenerPorCuenta(cuentaId);
      res.json({ ok: true, data: result });
    } catch (error) {
      console.error("Error obteniendo historial:", error.message);
      res.status(500).json({ ok: false, error: "No se pudo recuperar el historial de descuentos" });
    }
  }
};