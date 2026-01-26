import { usuarioService } from './usuario.service.js';
import {
  getInvalidRoleMessage,
  validateRoleSpecificData,
} from '../../shared/utils/roleValidation.util.js';

export const usuarioController = {
  register: async (req, res) => {
    try {
      const { rol_id, datosRolEspecifico } = req.body;

      if (datosRolEspecifico) {
        const validationResult = validateRoleSpecificData(rol_id, datosRolEspecifico);

        if (!validationResult.valid) {
          console.warn('⚠️ Validación fallida:', validationResult.errors);
          return res.status(400).json({
            status: 'error',
            message: 'Error en validación de datos del rol',
            errors: validationResult.errors,
            code: 'INVALID_ROLE_DATA',
          });
        }
      }

      const usuario = await usuarioService.createUser(req.body);

      res.status(201).json({
        status: 'success',
        message: 'Usuario creado exitosamente',
        data: {
          id: usuario.id,
          email: usuario.email,
          nombres: usuario.nombres,
          apellidos: usuario.apellidos,
          rol: usuario.rol,
        },
      });
    } catch (error) {
      if (error.message.includes('ya está registrado')) {
        return res.status(400).json({
          status: 'error',
          message: error.message,
          code: 'EMAIL_DUPLICATED',
        });
      }

      if (error.code === 'P2002') {
        return res.status(400).json({
          status: 'error',
          message: 'El email ya está registrado en el sistema',
          code: 'EMAIL_DUPLICATED',
        });
      }

      if (error.message.includes('no existe en la base de datos')) {
        return res.status(400).json({
          status: 'error',
          message: error.message,
          hint: getInvalidRoleMessage(),
          code: 'INVALID_ROLE',
        });
      }

      if (error.message.includes('obligatorios faltantes')) {
        return res.status(400).json({
          status: 'error',
          message: error.message,
          code: 'MISSING_REQUIRED_FIELDS',
        });
      }

      if (error.code === 'P2002' && error.meta?.target?.includes('uq_documento')) {
        return res.status(400).json({
          status: 'error',
          message: 'Este número de documento ya está registrado',
          code: 'DOCUMENT_DUPLICATE',
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Error al crear usuario',
        detail:
          process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor',
        code: 'REGISTRATION_ERROR',
      });
    }
  },

  getUserProfile: async (req, res) => {
    try {
      const userId = parseInt(req.params.id);

      if (isNaN(userId)) {
        return res.status(400).json({
          status: 'error',
          message: 'ID de usuario inválido',
          code: 'INVALID_USER_ID',
        });
      }

      const usuario = await usuarioService.getUserById(userId);

      if (!usuario) {
        return res.status(404).json({
          status: 'error',
          message: 'Usuario no encontrado',
          code: 'USER_NOT_FOUND',
        });
      }

      res.json({
        status: 'success',
        data: usuario,
      });
    } catch (error) {
      console.error('Error al obtener perfil:', error.message);
      res.status(500).json({
        status: 'error',
        message: 'Error al obtener perfil de usuario',
        detail: process.env.NODE_ENV === 'development' ? error.message : null,
        code: 'GET_PROFILE_ERROR',
      });
    }
  },

  validateRole: async (req, res) => {
    try {
      const { rol_id, datosRolEspecifico } = req.body;

      if (!rol_id) {
        return res.status(400).json({
          status: 'error',
          message: 'rol_id es requerido',
        });
      }

      const validationResult = validateRoleSpecificData(rol_id, datosRolEspecifico || {});

      res.json({
        status: 'success',
        valid: validationResult.valid,
        errors: validationResult.errors,
        data: {
          rol: rol_id,
          valido: validationResult.valid,
          mensajes:
            validationResult.errors.length > 0 ? validationResult.errors : ['Rol y datos válidos'],
        },
      });
    } catch (error) {
      console.error('Error en validación de rol:', error.message);
      res.status(500).json({
        status: 'error',
        message: 'Error al validar rol',
        detail: error.message,
      });
    }
  },
};
