import { usuarioService } from './usuario.service.js';
import { apiResponse } from '../../shared/utils/response.util.js';
import { catchAsync } from '../../shared/utils/catchAsync.util.js';
import { ApiError } from '../../shared/utils/error.util.js';
import { validateRoleSpecificData } from '../../shared/utils/roleValidation.util.js';

export const usuarioController = {
  register: catchAsync(async (req, res) => {
    const { rol_id, datosRolEspecifico } = req.body;

    // 1. Validación de datos específicos según el rol
    if (datosRolEspecifico && typeof rol_id === 'string') {
      const validationResult = validateRoleSpecificData(rol_id, datosRolEspecifico);

      if (!validationResult.valid) {
        throw new ApiError('Error en validación de datos del rol', 400, validationResult.errors);
      }
    }

    // 2. Creación del usuario
    const usuario = await usuarioService.createUser(req.body);

    // 3. Respuesta estructurada para el Alumno
    return apiResponse.created(res, {
      message: '¡Inscripción exitosa! Los detalles de tu cuenta han sido enviados a tu correo electrónico.',
      data: {
        id: usuario.id,
        username: usuario.username,
        email: usuario.email,
        nombres: usuario.nombres,
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

  getUsersByRol: catchAsync(async (req, res) => {
    const { rol } = req.params;

    if (!rol) {
      throw new ApiError('Es necesario especificar un rol o ID', 400);
    }

    const usuarios = await usuarioService.getUsersByRol(rol);

    return apiResponse.success(res, {
      message: `Usuarios con rol ${rol} obtenidos exitosamente`,
      data: usuarios,
    });
  }),

  updateStudentProfile: catchAsync(async (req, res) => {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      throw new ApiError('ID de usuario inválido', 400);
    }

    const usuarioActualizado = await usuarioService.updateStudentProfile(userId, req.body);

    return apiResponse.success(res, {
      message: 'Perfil del estudiante actualizado exitosamente',
      data: usuarioActualizado,
    });
  }),

  getUsuariosStats: catchAsync(async (req, res) => {
    const stats = await usuarioService.getDashboardStats();

    return apiResponse.success(res, {
      message: 'Estadísticas de usuarios obtenidas exitosamente',
      data: stats,
    });
  }),
};
