import { prisma } from '../../config/database.config.js';
import bcrypt from 'bcryptjs';
import { VALID_ROLES, ROLE_REQUIRED_FIELDS } from '../../constants/roles.constants.js';

export const usuarioService = {
  createUser: async (userData) => {
    const {
      email,
      password,
      tipo_documento_id,
      numero_documento,
      rol_id = VALID_ROLES.ALUMNO,
      datosRolEspecifico = {},
      ...otrosdatos
    } = userData;

    try {
      const emailExistente = await prisma.usuarios.findUnique({
        where: {
          email,
        },
      });
      if (emailExistente) {
        throw new Error('El email ya esta registrado');
      }

      const rolNombreBusqueda = rol_id.charAt(0).toUpperCase() + rol_id.slice(1).toLowerCase();

      const rol = await prisma.roles.findUnique({
        where: {
          nombre: rolNombreBusqueda,
        },
      });
      if (!rol) {
        throw (
          new Error(`El rol '${rolNombreBusqueda}' no existe en la base de datos`) +
          `Los roles permitidos son: ${VALID_ROLES.join(', ')}`
        );
      }

      const requiredFields = ROLE_REQUIRED_FIELDS[rol_id] || [];
      const missingFields = requiredFields.filter((field) => !datosRolEspecifico[field]);

      if (missingFields.length > 0) {
        throw new Error(
          `Campos obligatorios faltantes para el rol ${rolNombreBusqueda}: ${missingFields.join(', ')}`
        );
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const user = await prisma.$transaction(
        async (tx) => {
          const nuevoUsuario = await tx.usuarios.create({
            data: {
              email,
              rol_id: rol.id,
              tipo_documento_id: tipo_documento_id || null,
              numero_documento: numero_documento || null,
              ...otrosdatos,
              activo: true,
            },
          });

          await tx.credenciales_usuario.create({
            data: {
              usuario_id: nuevoUsuario.id,
              hash_contrasena: hashedPassword,
            },
          });

          const rolNombre = rol.nombre.toLowerCase();

          if (rolNombre === VALID_ROLES.ALUMNO) {
            await tx.alumnos.create({
              data: {
                usuario_id: nuevoUsuario.id,
                condiciones_medicas: datosRolEspecifico.condiciones_medicas || null,
                seguro_medico: datosRolEspecifico.seguro_medico || null,
                grupo_sanguineo: datosRolEspecifico.grupo_sanguineo || null,
              },
            });
          } else if (rolNombre === VALID_ROLES.PROFESOR) {
            await tx.profesores.create({
              data: {
                usuario_id: nuevoUsuario.id,
                especializacion: datosRolEspecifico.especializacion || null,
                tarifa_hora: datosRolEspecifico.tarifa_hora
                  ? parseFloat(datosRolEspecifico.tarifa_hora)
                  : null,
              },
            });
          } else if (rolNombre === VALID_ROLES.ADMINISTRADOR) {
            if (!datosRolEspecifico.cargo) {
              throw new Error('El campo "cargo" es obligatorio para administradores');
            }
            await tx.administrador.create({
              data: {
                usuario_id: nuevoUsuario.id,
                cargo: datosRolEspecifico.cargo,
                sede_id: datosRolEspecifico.sede_id || null,
                area: datosRolEspecifico.area || null,
              },
            });
          }

          return nuevoUsuario;
        },
        {
          maxWait: 5000,
          timeout: 10000,
        }
      );

      return {
        id: user.id,
        email: user.email,
        nombres: user.nombres,
        apellidos: user.apellidos,
        rol: rol.nombre,
        mensaje: 'Usuario creado exitosamente',
      };
    } catch (error) {
      console.error('Error en servicio createUser:', error);
      throw error;
    }
  },

  getUserById: async (userId) => {
    return await prisma.usuarios.findUnique({
      where: { id: userId },
      include: {
        roles: true,
        alumnos: true,
        profesores: true,
        administrador: {
          include: {
            sedes: true,
          },
        },
      },
    });
  },

  getUserByEmail: async (email) => {
    return await prisma.usuarios.findUnique({
      where: { email },
      include: {
        roles: true,
        credenciales_usuario: true,
      },
    });
  },

  isValidRole: (rol) => {
    return Object.values(VALID_ROLES).includes(rol.toLowerCase());
  },

  getRoleDescription: (rol) => {
    const descriptions = {
      [VALID_ROLES.ALUMNO]: 'Estudiante de la academia',
      [VALID_ROLES.PROFESOR]: 'Instructor de clases',
      [VALID_ROLES.ADMINISTRADOR]: 'Administrador del sistema',
    };
    return descriptions[rol.toLowerCase()] || 'Rol desconocido';
  },
};
