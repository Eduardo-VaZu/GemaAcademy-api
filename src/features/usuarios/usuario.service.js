import { ApiError } from '../../shared/utils/error.util.js';

import { usuarioLogic } from './logic/usuario.logic.js';
import { prisma } from '../../config/database.config.js';

import { dashboardService } from './services/dashboard.service.js';
import { reporteService } from './services/reporte.service.js';
import { validateRoleSpecificData } from './validators/usuario.validator.js';

export const usuarioService = {
  createUser: async (userData) => {
    return await usuarioLogic.procesarCreacionUsuario(userData);
  },

  getUserById: async (userId) => {
    const usuario = await prisma.usuarios.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        nombres: true,
        apellidos: true,
        telefono_personal: true,
        fecha_nacimiento: true,
        genero: true,
        tipo_documento_id: true,
        numero_documento: true,
        activo: true,
        roles: { select: { id: true, nombre: true } },
        alumnos: {
          select: {
            condiciones_medicas: true,
            seguro_medico: true,
            grupo_sanguineo: true,
            direccion_id: true,
            direcciones: {
              select: {
                id: true,
                direccion_completa: true,
                distrito: true,
                ciudad: true,
                referencia: true,
              },
            },
          },
        },
        coordinadores: { select: { usuario_id: true, especializacion: true } },
        administrador: {
          select: {
            usuario_id: true,
            cargo: true,
            area: true,
            sedes: { select: { id: true, nombre: true } },
          },
        },
      },
    });

    if (!usuario) throw new ApiError('Usuario no encontrado', 404);
    return usuario;
  },

  getUserByUsername: async (username) => {
    return await prisma.usuarios.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        email: true,
        nombres: true,
        apellidos: true,
        telefono_personal: true,
        rol_id: true,
        activo: true,
        roles: { select: { id: true, nombre: true } },
        alumnos: {
          select: { condiciones_medicas: true, seguro_medico: true, grupo_sanguineo: true },
        },
        credenciales_usuario: { select: { hash_contrasena: true } },
      },
    });
  },

  updateStudentProfile: async (userId, payload) => {
    return await usuarioLogic.procesarActualizacionPerfilAlumno(userId, payload);
  },

  getUsersByRol: async (rolOrId) => {
    const isNumber = !Number.isNaN(Number(rolOrId));

    const usuarios = await prisma.usuarios.findMany({
      where: {
        activo: true,
        roles: isNumber
          ? { id: Number.parseInt(rolOrId) }
          : { nombre: { equals: rolOrId, mode: 'insensitive' } },
      },
      select: {
        id: true,
        username: true,
        email: true,
        nombres: true,
        apellidos: true,
        telefono_personal: true,
        activo: true,
        roles: { select: { id: true, nombre: true } },
        alumnos: {
          select: {
            condiciones_medicas: true,
            seguro_medico: true,
            grupo_sanguineo: true,
          },
        },
        coordinadores: {
          select: {
            especializacion: true,
          },
        },
        administrador: {
          select: {
            cargo: true,
            area: true,
          },
        },
      },
      orderBy: { nombres: 'asc' },
    });

    return usuarios;
  },

  validateRole: async (payload) => {
    const { rol_id, datosRolEspecifico } = payload;
    const validationResult = validateRoleSpecificData(
      typeof rol_id === 'string' ? rol_id : '',
      datosRolEspecifico || {}
    );
    return {
      rol: rol_id,
      valido: validationResult.valid,
      mensajes:
        validationResult.errors.length > 0 ? validationResult.errors : ['Rol y datos válidos'],
    };
  },

  // Rutas delegadas a servicios especialistas
  getDashboardStats: dashboardService.getDashboardStats,
  getDetailedExcelReport: reporteService.getDetailedExcelReport,
};
