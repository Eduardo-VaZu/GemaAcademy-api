import { prisma } from '../../config/database.config.js';
import bcrypt from 'bcryptjs';
import { ApiError } from '../../shared/utils/error.util.js';
import { VALID_ROLES, ROLE_REQUIRED_FIELDS } from '../../constants/roles.constants.js';
import { sendCredentialsEmail } from '../../shared/utils/mailer.js';

export const usuarioService = {
  createUser: async (userData) => {
    const {
      email,
      password,
      tipo_documento_id,
      numero_documento,
      rol_id,
      fecha_nacimiento,
      rolNombre: providedRolNombre,
      datosRolEspecifico = {},
      ...otrosdatos
    } = userData;

    const fechaConvertida = fecha_nacimiento ? new Date(fecha_nacimiento) : null;

    if (fechaConvertida && isNaN(fechaConvertida.getTime())) {
      throw new ApiError('Formato de fecha de nacimiento inválido', 400);
    }

    const rolNombre = providedRolNombre || rol_id || VALID_ROLES.ALUMNO;

    const emailExistente = await prisma.usuarios.findUnique({
      where: {
        email,
      },
    });

    if (emailExistente) {
      throw new ApiError('El email ya esta registrado');
    }

    if (typeof rolNombre === 'string' && !Object.values(VALID_ROLES).includes(rolNombre)) {
      throw new ApiError(
        `El rol '${rolNombre}' no es válido`,
        400,
        `Los roles permitidos son: ${Object.values(VALID_ROLES).join(', ')}`
      );
    }

    let rol;
    if (typeof rolNombre === 'string') {
      const rolNombreNormalizado =
        rolNombre.charAt(0).toUpperCase() + rolNombre.slice(1).toLowerCase();

      rol = await prisma.roles.findUnique({
        where: {
          nombre: rolNombreNormalizado,
        },
      });
    } else {
      rol = await prisma.roles.findUnique({
        where: {
          id: rolNombre,
        },
      });
    }

    if (!rol) {
      throw new ApiError(`El rol '${rolNombre}' no existe en la base de datos`, 400);
    }

    const resolvedRoleName = rol.nombre.toLowerCase();

    const requiredFields = ROLE_REQUIRED_FIELDS[resolvedRoleName] || [];
    const missingFields = requiredFields.filter((field) => !datosRolEspecifico[field]);

    if (missingFields.length > 0) {
      throw new ApiError(
        `Campos obligatorios faltantes para el rol ${resolvedRoleName}: ${missingFields.join(', ')}`,
        400
      );
    }

    const passwordToUse = password || numero_documento;

    if (!passwordToUse) {
      throw new ApiError('Es necesario un número de documento para generar la contraseña');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(passwordToUse, saltRounds);

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
        await createRoleSpecificData(tx, rolNombre, nuevoUsuario.id, datosRolEspecifico);

        return nuevoUsuario;
      },
      {
        maxWait: 5000,
        timeout: 10000,
      }
    );

    try {
      // Solo enviamos el correo si es un Alumno, según el diseño de tu mailer
      if (resolvedRoleName === VALID_ROLES.ALUMNO) {
        await sendCredentialsEmail(user.email, user.nombres, passwordToUse);
      }
    } catch (error) {
      console.error('Error enviando el correo:', error);
    }

    return {
      id: user.id,
      email: user.email,
      nombres: user.nombres,
      apellidos: user.apellidos,
      rol: rol.nombre,
      mensaje: 'Usuario creado exitosamente',
    };
  },

  getUserById: async (userId) => {
    return await prisma.usuarios.findUnique({
      where: { id: userId },
      include: {
        roles: true,
        alumnos: {
          include: {
            direcciones: true,
          },
        },
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
        alumnos: true,
        roles: true,
        credenciales_usuario: true,
      },
    });
  },

  updateStudentProfile: async (userId, payload) => {
    const usuarioId = Number.parseInt(userId);

    if (isNaN(usuarioId)) {
      throw new ApiError('ID de usuario inválido', 400);
    }

    const usuario = await prisma.usuarios.findUnique({
      where: { id: usuarioId },
      include: {
        alumnos: {
          include: {
            direcciones: true,
            alumnos_contactos: true,
          },
        },
        roles: true,
        credenciales_usuario: true,
      },
    });

    if (!usuario) {
      throw new ApiError('Usuario no encontrado', 404);
    }

    if (!usuario.alumnos) {
      throw new ApiError('El usuario no corresponde a un alumno', 400);
    }

    const {
      password,
      direccion_completa,
      distrito,
      ciudad,
      referencia,
      contacto_emergencia,
      datosRolEspecifico,
    } = payload;

    const direccion =
      direccion_completa !== undefined ||
      distrito !== undefined ||
      ciudad !== undefined ||
      referencia !== undefined
        ? { direccion_completa, distrito, ciudad, referencia }
        : null;

    const alumnoUpdates = {};
    if (datosRolEspecifico) {
      if (datosRolEspecifico.condiciones_medicas !== undefined) {
        alumnoUpdates.condiciones_medicas = datosRolEspecifico.condiciones_medicas;
      }
      if (datosRolEspecifico.seguro_medico !== undefined) {
        alumnoUpdates.seguro_medico = datosRolEspecifico.seguro_medico;
      }
      if (datosRolEspecifico.grupo_sanguineo !== undefined) {
        alumnoUpdates.grupo_sanguineo = datosRolEspecifico.grupo_sanguineo;
      }
    }

    return await prisma.$transaction(async (tx) => {
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);

        if (usuario.credenciales_usuario) {
          await tx.credenciales_usuario.update({
            where: { usuario_id: usuarioId },
            data: { hash_contrasena: hashedPassword },
          });
        } else {
          await tx.credenciales_usuario.create({
            data: { usuario_id: usuarioId, hash_contrasena: hashedPassword },
          });
        }
      }

      if (Object.keys(alumnoUpdates).length > 0) {
        await tx.alumnos.update({
          where: { usuario_id: usuarioId },
          data: alumnoUpdates,
        });
      }

      if (direccion) {
        if (usuario.alumnos.direccion_id) {
          const direccionData = {};
          if (direccion.direccion_completa !== undefined) {
            direccionData.direccion_completa = direccion.direccion_completa;
          }
          if (direccion.distrito !== undefined) {
            direccionData.distrito = direccion.distrito;
          }
          if (direccion.ciudad !== undefined) {
            direccionData.ciudad = direccion.ciudad;
          }
          if (direccion.referencia !== undefined) {
            direccionData.referencia = direccion.referencia;
          }

          if (Object.keys(direccionData).length > 0) {
            await tx.direcciones.update({
              where: { id: usuario.alumnos.direccion_id },
              data: direccionData,
            });
          }
        } else {
          if (!direccion.direccion_completa || !direccion.distrito) {
            throw new ApiError(
              'direccion_completa y distrito son requeridos para crear una dirección',
              400
            );
          }
          const nuevaDireccion = await tx.direcciones.create({
            data: {
              direccion_completa: direccion.direccion_completa,
              distrito: direccion.distrito,
              ciudad: direccion.ciudad || 'Lima',
              referencia: direccion.referencia || null,
            },
          });

          await tx.alumnos.update({
            where: { usuario_id: usuarioId },
            data: { direccion_id: nuevaDireccion.id },
          });
        }
      }

      if (contacto_emergencia) {
        const contactoExistente = await tx.alumnos_contactos.findFirst({
          where: { alumno_id: usuarioId, es_principal: true },
        });

        if (contactoExistente) {
          await tx.alumnos_contactos.update({
            where: { id: contactoExistente.id },
            data: {
              nombre_completo: contacto_emergencia.nombre_completo,
              telefono: contacto_emergencia.telefono,
              relacion: contacto_emergencia.relacion || null,
            },
          });
        } else {
          await tx.alumnos_contactos.create({
            data: {
              alumno_id: usuarioId,
              nombre_completo: contacto_emergencia.nombre_completo,
              telefono: contacto_emergencia.telefono,
              relacion: contacto_emergencia.relacion || null,
              es_principal: true,
            },
          });
        }
      }

      return await tx.usuarios.findUnique({
        where: { id: usuarioId },
        include: {
          roles: true,
          alumnos: {
            include: {
              direcciones: true,
              alumnos_contactos: true,
            },
          },
          profesores: true,
          administrador: {
            include: { sedes: true },
          },
        },
      });
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

  getUsersByRol: async (rolOrId) => {
    const isNumber = !isNaN(rolOrId);

    const usuarios = await prisma.usuarios.findMany({
      where: {
        activo: true,
        roles: isNumber
          ? { id: parseInt(rolOrId) }
          : { nombre: { equals: rolOrId, mode: 'insensitive' } },
      },
      include: {
        roles: true,
        // Solo trae los datos del rol, no vuelvas a incluir 'usuarios' dentro de ellos
        alumnos: {
          select: {
            condiciones_medicas: true,
            seguro_medico: true,
            grupo_sanguineo: true,
          },
        },
        profesores: {
          select: {
            especializacion: true,
          },
        },
      },
      orderBy: { nombres: 'asc' },
    });

    return usuarios;
  },

  async getDashboardStats() {
    const counts = await prisma.usuarios.groupBy({
      by: ['rol_id'],
      where: {
        activo: true,
      },
      _count: {
        id: true,
      },
    });

    const roles = await prisma.roles.findMany({
      select: {
        id: true,
        nombre: true,
      },
    });

    const stats = roles.reduce((acc, rol) => {
      const group = counts.find((c) => c.rol_id === rol.id);
      acc[rol.nombre.toLowerCase()] = group ? group._count.id : 0;
      return acc;
    }, {});

    return stats;
  },
};

const createRoleSpecificData = async (tx, rolNombre, usuarioId, datos) => {
  const roleHandlers = {
    [VALID_ROLES.ALUMNO]: async () => {
      let direccionId = null;

      if (datos.direccion && datos.direccion.direccion_completa) {
        const nuevaDireccion = await tx.direcciones.create({
          data: {
            direccion_completa: datos.direccion.direccion_completa,
            distrito: datos.direccion.distrito,
            ciudad: datos.direccion.ciudad || 'Lima',
            referencia: datos.direccion.referencia || null,
          },
        });
        direccionId = nuevaDireccion.id;
      }

      await tx.alumnos.create({
        data: {
          usuario_id: usuarioId,
          direccion_id: direccionId,
          condiciones_medicas: datos.condiciones_medicas || null,
          seguro_medico: datos.seguro_medico || null,
          grupo_sanguineo: datos.grupo_sanguineo || null,
        },
      });
    },
    [VALID_ROLES.PROFESOR]: async () => {
      await tx.profesores.create({
        data: {
          usuario_id: usuarioId,
          especializacion: datos.especializacion || null,
        },
      });
    },
    [VALID_ROLES.ADMINISTRADOR]: async () => {
      if (!datos.cargo) {
        throw new ApiError('El campo "cargo" es obligatorio para administradores', 400);
      }
      await tx.administrador.create({
        data: {
          usuario_id: usuarioId,
          cargo: datos.cargo,
          sede_id: datos.sede_id || null,
          area: datos.area || null,
        },
      });
    },
  };

  const handler = roleHandlers[rolNombre];
  if (handler) {
    await handler();
  }
};
