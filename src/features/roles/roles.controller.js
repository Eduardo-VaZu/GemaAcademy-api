import { rolesService } from './roles.service.js';
import { catchAsync } from '../../shared/utils/catchAsync.util.js';
import { apiResponse } from '../../shared/utils/response.util.js';
import { ApiError } from '../../shared/utils/error.util.js';

export const rolesController = {
  getAllRoles: catchAsync(async (req, res) => {
    const roles = await rolesService.getAllRoles();

    return apiResponse.success(res, {
      message: 'Roles obtenidos exitosamente',
      data: roles,
    });
  }),

  getRoleById: catchAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    const role = await rolesService.getRoleById(id);

    if (!role) {
      throw new ApiError('Rol no encontrado', 404);
    }

    return apiResponse.success(res, {
      message: 'Rol obtenido exitosamente',
      data: role,
    });
  }),

  createRole: catchAsync(async (req, res) => {
    const role = await rolesService.createRole(req.body);

    return apiResponse.success(res, {
      message: 'Rol creado exitosamente',
      data: role,
    });
  }),

  updateRole: catchAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    const role = await rolesService.updateRole(id, req.body);

    return apiResponse.success(res, {
      message: 'Rol actualizado exitosamente',
      data: role,
    });
  }),

  deleteRole: catchAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    await rolesService.deleteRole(id);

    return apiResponse.success(res, {
      message: 'Rol eliminado exitosamente',
    });
  }),
};
