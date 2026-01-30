import { usuarioService } from './usuario.service.js';
import { apiResponse } from '../../shared/utils/response.util.js';
import { catchAsync } from '../../shared/utils/catchAsync.util.js';
import { ApiError } from '../../shared/utils/error.util.js';
import { validateRoleSpecificData } from '../../shared/utils/roleValidation.util.js';

export const usuarioController = {
  register: catchAsync(async (req, res) => {
    const { rol_id, datosRolEspecifico } = req.body;

    if (datosRolEspecifico) {
      const validationResult = validateRoleSpecificData(rol_id, datosRolEspecifico);

      if (!validationResult.valid) {
        throw new ApiError('Error en validación de datos del rol', 400, validationResult.errors);
      }
    }

    const usuario = await usuarioService.createUser(req.body);

    return apiResponse.created(res, {
      message: 'Usuario creado exitosamente',
      data: {
        id: usuario.id,
        email: usuario.email,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        rol: usuario.rol,
      },
    });
  }),

  getUserProfile: catchAsync(async (req, res) => {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      throw new ApiError('ID de usuario inválido', 400);
    }

    const usuario = await usuarioService.getUserById(userId);

    if (!usuario) {
      throw new ApiError('Usuario no encontrado', 404);
    }

    return apiResponse.success(res, {
      data: usuario,
    });
  }),

  validateRole: catchAsync(async (req, res) => {
    const { rol_id, datosRolEspecifico } = req.body;

    if (!rol_id) {
      throw new ApiError('rol_id es requerido', 400);
    }

    const validationResult = validateRoleSpecificData(rol_id, datosRolEspecifico || {});

    return apiResponse.success(res, {
      data: {
        rol: rol_id,
        valido: validationResult.valid,
        mensajes:
          validationResult.errors.length > 0 ? validationResult.errors : ['Rol y datos válidos'],
      },
    });
  }),
};
