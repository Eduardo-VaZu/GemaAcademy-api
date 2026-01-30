import { sedeService } from './sede.service.js';
import { apiResponse } from '../../shared/utils/response.util.js';
import { catchAsync } from '../../shared/utils/catchAsync.util.js';
import { ApiError } from '../../shared/utils/error.util.js';

export const sedeController = {
  createSede: catchAsync(async (req, res) => {
    const { sedeData } = req.body;
    if (!sedeData) {
      throw new ApiError('No se proporcionó datos de la sede', 400);
    }
    if (!sedeData.direccion) {
      throw new ApiError('Los campos nombre y dirección son obligatorios', 400);
    }
    const sede = await sedeService.createSede(sedeData);
    return apiResponse.created(res, {
      message: 'Sede creada exitosamente',
      data: sede,
    });
  }),

  getAllSedes: catchAsync(async (req, res) => {
    const filter = {
      activo: req.query.activo,
      distrito: req.query.distrito,
      tipo_instalacion: req.query.tipo_instalacion,
      page: req.query.page,
      limit: req.query.limit,
    };

    const result = await sedeService.getAllSedes(filter);
    return apiResponse.success(res, {
      message: 'Sedes obtenidas exitosamente',
      data: result.data,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  }),

  getSedeById: catchAsync(async (req, res) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      throw new ApiError('ID de sede inválido', 400);
    }

    const sede = await sedeService.getSedeById(id);

    if (!sede) {
      throw new ApiError('Sede no encontrada', 404);
    }

    return apiResponse.success(res, {
      message: 'Sede obtenida exitosamente',
      data: sede,
    });
  }),

  updateSede: catchAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    const { sedeData } = req.body;

    if (isNaN(id)) {
      throw new ApiError('ID de sede inválido', 400);
    }

    const sede = await sedeService.updateSede(id, sedeData);

    if (!sede) {
      throw new ApiError('Sede no encontrada', 404);
    }

    return apiResponse.success(res, {
      message: 'Sede actualizada exitosamente',
      data: sede,
    });
  }),

  updateDefuseSede: catchAsync(async (req, res) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      throw new ApiError('ID de sede inválido', 400);
    }

    const sede = await sedeService.updateDefuseSede(id);

    if (!sede) {
      throw new ApiError('Sede no encontrada', 404);
    }

    return apiResponse.noContent(res);
  }),

  updateActiveSede: catchAsync(async (req, res) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      throw new ApiError('ID de sede inválido', 400);
    }

    const sede = await sedeService.updateActiveSede(id);

    if (!sede) {
      throw new ApiError('Sede no encontrada', 404);
    }

    return apiResponse.noContent(res);
  }),
};
