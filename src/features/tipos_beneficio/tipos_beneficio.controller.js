import { TiposBeneficioService } from './tipos_beneficio.service.js';

export const TiposBeneficioController = {
  async crear(req, res) {
    try {
      const result = await TiposBeneficioService.create(req.body);
      res.status(201).json({ ok: true, data: result });
    } catch (error) {
      console.error(error);
      res.status(500).json({ ok: false, message: "Error al crear tipo" });
    }
  },

  async listar(req, res) {
    try {
      const result = await TiposBeneficioService.getAll();
      res.json({ ok: true, data: result });
    } catch (error) {
      console.error(error);
      res.status(500).json({ ok: false, message: "Error al listar tipos" });
    }
  }
};