import { prisma } from '../../config/database.config.js';
import { ApiError } from '../../shared/utils/error.util.js';

export const alumnoService = {
  actualizarMiPerfil: async (usuarioId, datos) => {
    const {
      email,
      telefono_personal,
      fecha_nacimiento,
      condiciones_medicas,
      seguro_medico,
      grupo_sanguineo,
      direccion_completa,
      distrito,
      ciudad,
      referencia,
    } = datos;

    return await prisma.$transaction(async (tx) => {
      // 1. Actualizar Tabla: USUARIOS (solo si hay campos)
      const dataUsuario = {};
      if (email) dataUsuario.email = email;
      if (telefono_personal) dataUsuario.telefono_personal = telefono_personal;
      if (fecha_nacimiento) dataUsuario.fecha_nacimiento = new Date(fecha_nacimiento);

      if (Object.keys(dataUsuario).length > 0) {
        await tx.usuarios.update({ where: { id: usuarioId }, data: dataUsuario });
      }

      // 2. Verificar que el alumno existe
      const alumnoActual = await tx.alumnos.findUnique({
        where: { usuario_id: usuarioId },
        select: { usuario_id: true, direccion_id: true },
      });

      if (!alumnoActual) {
        throw new ApiError('Alumno no encontrado', 404);
      }

      // 3. Actualizar o crear dirección
      let direccionId = alumnoActual.direccion_id;
      const hayDatosDireccion = direccion_completa || distrito || referencia;

      if (hayDatosDireccion) {
        const dataDir = {
          ...(direccion_completa && { direccion_completa }),
          ...(distrito && { distrito }),
          ...(referencia && { referencia }),
          ciudad: ciudad || 'Lima',
        };

        if (direccionId) {
          await tx.direcciones.update({ where: { id: direccionId }, data: dataDir });
        } else if (direccion_completa && distrito) {
          const nuevaDir = await tx.direcciones.create({ data: dataDir });
          direccionId = nuevaDir.id;
        }
      }

      // 4. Actualizar datos médicos del alumno
      const dataAlumno = {
        ...(condiciones_medicas && { condiciones_medicas }),
        ...(seguro_medico && { seguro_medico }),
        ...(grupo_sanguineo && { grupo_sanguineo }),
        ...(direccionId && { direccion_id: direccionId }),
      };

      return await tx.alumnos.update({
        where: { usuario_id: usuarioId },
        data: dataAlumno,
        select: {
          usuario_id: true,
          condiciones_medicas: true,
          seguro_medico: true,
          grupo_sanguineo: true,
          usuarios: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
              email: true,
              telefono_personal: true,
              fecha_nacimiento: true,
            },
          },
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
      });
    });
  },
};
