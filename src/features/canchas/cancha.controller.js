import canchaService from './cancha.service.js';
import { catchAsync } from '../../shared/utils/catchAsync.util.js';
import { apiResponse } from '../../shared/utils/response.util.js';
import { ApiError } from '../../shared/utils/error.util.js';

const canchaController = {
  create: catchAsync(async (req, res) => {
    const cancha = await canchaService.create(req.body);

    return apiResponse.created(res, {
      message: 'Cancha creada exitosamente',
      data: cancha,
    });
  }),

  getAll: catchAsync(async (req, res) => {
    const canchas = await canchaService.getAll();
    return apiResponse.success(res, {
      message: 'Canchas obtenidas exitosamente',
      data: canchas,
    });
  }),

  getById: catchAsync(async (req, res) => {
    const cancha = await canchaService.getById(req.params.id);
    if (!cancha) {
      throw new ApiError('Cancha no encontrada', 404);
    }
    return apiResponse.success(res, {
      message: 'Cancha obtenida exitosamente',
      data: cancha,
    });
  }),

  update: catchAsync(async (req, res) => {
    const cancha = await canchaService.update(req.params.id, req.body);
    return apiResponse.success(res, {
      message: 'Cancha actualizada exitosamente',
      data: cancha,
    });
  }),

  delete: catchAsync(async (req, res) => {
    await canchaService.delete(req.params.id);
    return apiResponse.noContent(res);
  }),
};

export default canchaController;
