import { nivelService } from './niveles.service.js';
import { catchAsync } from '../../shared/utils/catchAsync.util.js';
import { apiResponse } from '../../shared/utils/response.util.js';
import { ApiError } from '../../shared/utils/error.util.js';

export const nivelController = {
  createNivel: catchAsync(async (req, res) => {
    const data = req.body;
    const newNivel = await nivelService.createNivel(data);
    if (!newNivel) {
      throw new ApiError('Error al crear el nivel', 400);
    }
    apiResponse.success(res, { data: newNivel, message: 'Nivel creado exitosamente' });
  }),
  getAllNiveles: catchAsync(async (req, res) => {
    const niveles = await nivelService.getAllNiveles();
    if (!niveles || niveles.length === 0) {
      throw new ApiError('No se encontraron niveles', 404);
    }
    apiResponse.success(res, { data: niveles, message: 'Niveles obtenidos exitosamente' });
  }),
  updateNivel: catchAsync(async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const updatedNivel = await nivelService.updateNivel(id, data);
    if (!updatedNivel) {
      throw new ApiError('Nivel no encontrado', 404);
    }
    apiResponse.success(res, { data: updatedNivel, message: 'Nivel actualizado exitosamente' });
  }),
  deleteNivel: catchAsync(async (req, res) => {
    const { id } = req.params;
    const deletedNivel = await nivelService.deleteNivel(id);
    if (!deletedNivel) {
      throw new ApiError('Nivel no encontrado', 404);
    }
    apiResponse.success(res, { data: deletedNivel, message: 'Nivel eliminado exitosamente' });
  }),
};
