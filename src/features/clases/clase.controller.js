import { claseService } from './clase.service.js';
import { catchAsync } from '../../shared/utils/catchAsync.util.js';
import { apiResponse } from '../../shared/utils/response.util.js';

export const claseController = {
  reprogramarMasivo: catchAsync(async (req, res) => {
    const {
      horario_origen_id,
      fecha_origen,
      fecha_destino,
      hora_inicio_destino,
      hora_fin_destino,
      motivo,
    } = req.body;
    const usuario_admin_id = req.user.id; // Asumimos que viene del token (admin)

    const resultado = await claseService.reprogramarMasivamente({
      horario_origen_id,
      fecha_origen,
      fecha_destino,
      hora_inicio_destino,
      hora_fin_destino,
      motivo,
      usuario_admin_id,
    });

    return apiResponse.success(res, {
      message: 'Proceso de reprogramación masiva completado',
      data: resultado,
    });
  }),

  obtenerDetalle: catchAsync(async (req, res) => {
    const { horario_id } = req.params;
    const detalle = await claseService.obtenerDetalleClase(horario_id);
    return apiResponse.success(res, { data: detalle });
  }),

  obtenerFechasDisponibles: catchAsync(async (req, res) => {
    const { horario_id } = req.params;
    const fechas = await claseService.obtenerFechasDisponibles(horario_id);
    return apiResponse.success(res, { data: fechas });
  }),
};
