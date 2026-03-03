import { prisma } from '../../config/database.config.js';
import bcrypt from 'bcryptjs';
import { ApiError } from '../../shared/utils/error.util.js';
import { VALID_ROLES } from '../roles/roles.constants.js';
import { emailService } from '../../shared/services/brevo.email.service.js';

export const usuarioService = {
  createUser: async (userData) => {
    const {
      email,
      password,
      username: providedUsername,
      tipo_documento_id,
      numero_documento,
      rol_id,
      fecha_nacimiento,
      especializacion,
      sede_id,
      cargo,
      area,
      direccion_id,
      condiciones_medicas,
      seguro_medico,
      grupo_sanguineo,
      rolNombre: providedRolNombre,
      contacto_emergencia,
      parentesco,
      datosRolEspecifico,
      direccion,
      ...otrosdatos
    } = userData;

    const datosRol = {
      especializacion,
      sede_id,
      cargo,
      area,
      direccion_id,
      condiciones_medicas,
      seguro_medico,
      grupo_sanguineo,
      direccion,
      ...datosRolEspecifico,
    };

    const fechaConvertida = fecha_nacimiento ? new Date(fecha_nacimiento) : null;
    const rolNombre = providedRolNombre || rol_id || VALID_ROLES.ALUMNO;

    let rol;
    if (typeof rolNombre === 'string') {
      const rolNombreNormalizado =
        rolNombre.charAt(0).toUpperCase() + rolNombre.slice(1).toLowerCase();
      rol = await prisma.roles.findUnique({
        where: { nombre: rolNombreNormalizado },
        select: { id: true, nombre: true },
      });
    } else {
      rol = await prisma.roles.findUnique({
        where: { id: parseInt(rolNombre) },
        select: { id: true, nombre: true },
      });
    }

    if (!rol) throw new ApiError(`El rol '${rolNombre}' no existe`, 400);

    if (tipo_documento_id && numero_documento) {
      const existeDocumento = await prisma.usuarios.findFirst({
        where: { tipo_documento_id, numero_documento },
        select: { id: true },
      });
      if (existeDocumento) {
        throw new ApiError(`El documento ${numero_documento} ya se encuentra registrado`, 400);
      }
    }

    if (providedUsername) {
      const existeUsername = await prisma.usuarios.findUnique({
        where: { username: providedUsername },
        select: { id: true },
      });
      if (existeUsername) {
        throw new ApiError(`El nombre de usuario '${providedUsername}' ya está en uso`, 400);
      }
    }

    const user = await prisma.$transaction(async (tx) => {
      const nuevoUsuario = await tx.usuarios.create({
        data: {
          username: `temp_${Date.now()}`,
          email: email || null,
          rol_id: rol.id,
          tipo_documento_id: tipo_documento_id || null,
          numero_documento: numero_documento || null,
          fecha_nacimiento: fechaConvertida,
          ...otrosdatos,
          activo: true,
        },
      });

      const primerNombre = otrosdatos.nombres.split(' ')[0].toLowerCase();
      const primerApellido = otrosdatos.apellidos.split(' ')[0].toLowerCase();
      const finalUsername =
        providedUsername || `${primerNombre}.${primerApellido}${nuevoUsuario.id}`;

      const passwordToHash = password || finalUsername;
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(passwordToHash, saltRounds);
      const usuarioActualizado = await tx.usuarios.update({
        where: { id: nuevoUsuario.id },
        data: { username: finalUsername },
      });

      await tx.credenciales_usuario.create({
        data: {
          usuario_id: nuevoUsuario.id,
          hash_contrasena: hashedPassword,
        },
      });

      await createRoleSpecificData(tx, rol.nombre.toLowerCase(), nuevoUsuario.id, datosRol);

      if (rol.nombre.toLowerCase() === 'alumno' && contacto_emergencia) {
        const nombreEmergencia = `Emergencia ${otrosdatos.nombres}`;

        const contactoExistente = await tx.alumnos_contactos.findFirst({
          where: {
            alumno_id: nuevoUsuario.id,
            telefono: contacto_emergencia,
          },
        });

        if (!contactoExistente) {
          await tx.alumnos_contactos.create({
            data: {
              alumno_id: nuevoUsuario.id,
              nombre_completo: nombreEmergencia,
              telefono: contacto_emergencia,
              relacion: parentesco,
              es_principal: true,
            },
          });
        }
      }

      return usuarioActualizado;
    });

    if (user.email) {
      emailService
        .sendCredentialsEmail(user.email, user.nombres, user.username, password)
        .catch(() => {});
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      nombres: user.nombres,
      rol: rol.nombre,
    };
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
    const usuario = await prisma.usuarios.findUnique({
      where: { id: userId },
      select: {
        id: true,
        alumnos: {
          select: {
            usuario_id: true,
            direccion_id: true,
            direcciones: { select: { id: true } },
            alumnos_contactos: { where: { es_principal: true }, select: { id: true } },
          },
        },
        credenciales_usuario: { select: { usuario_id: true } },
      },
    });

    if (!usuario) throw new ApiError('Usuario no encontrado', 404);
    if (!usuario.alumnos) throw new ApiError('El usuario no corresponde a un alumno', 400);

    const usuarioId = userId;

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
        select: {
          id: true,
          username: true,
          email: true,
          nombres: true,
          apellidos: true,
          telefono_personal: true,
          fecha_nacimiento: true,
          genero: true,
          activo: true,
          roles: { select: { id: true, nombre: true } },
          alumnos: {
            select: {
              condiciones_medicas: true,
              seguro_medico: true,
              grupo_sanguineo: true,
              direcciones: {
                select: {
                  id: true,
                  direccion_completa: true,
                  distrito: true,
                  ciudad: true,
                  referencia: true,
                },
              },
              alumnos_contactos: {
                select: {
                  id: true,
                  nombre_completo: true,
                  telefono: true,
                  relacion: true,
                  es_principal: true,
                },
              },
            },
          },
        },
      });
    });
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
        coordinadores: {
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
    [VALID_ROLES.COORDINADOR]: async () => {
      await tx.coordinadores.create({
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
