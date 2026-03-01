import { prisma } from '../../config/database.config.js';

export const alumnoService = {
  actualizarMiPerfil: async (usuarioId, datos) => {
    return await prisma.$transaction(async (tx) => {
      const {
        email, telefono_personal, fecha_nacimiento,
        condiciones_medicas, seguro_medico, grupo_sanguineo,
        direccion_completa, distrito, ciudad, referencia
      } = datos;

      const idParsed = parseInt(usuarioId);

      // 1. Actualizar Tabla: USUARIOS
      const dataUsuario = {};
      if (email) dataUsuario.email = email;
      if (telefono_personal) dataUsuario.telefono_personal = telefono_personal;
      if (fecha_nacimiento) dataUsuario.fecha_nacimiento = new Date(fecha_nacimiento);

      if (Object.keys(dataUsuario).length > 0) {
        await tx.usuarios.update({ where: { id: idParsed }, data: dataUsuario });
      }

      // 2. Actualizar Tabla: ALUMNOS (y Direcciones)
      const alumnoActual = await tx.alumnos.findUnique({ where: { usuario_id: idParsed } });
      if (!alumnoActual) throw new Error('Alumno no encontrado');

      let currentDireccionId = alumnoActual.direccion_id;
      const hayDatosDireccion = direccion_completa || distrito || referencia;

      if (hayDatosDireccion) {
        const dataDir = {
          ...(direccion_completa && { direccion_completa }),
          ...(distrito && { distrito }),
          ...(referencia && { referencia }),
          ciudad: ciudad || "Lima"
        };

        if (currentDireccionId) {
          await tx.direcciones.update({ where: { id: currentDireccionId }, data: dataDir });
        } else if (direccion_completa && distrito) {
          const nuevaDir = await tx.direcciones.create({ data: dataDir });
          currentDireccionId = nuevaDir.id;
        }
      }

      const dataAlumno = {
        ...(condiciones_medicas && { condiciones_medicas }),
        ...(seguro_medico && { seguro_medico }),
        ...(grupo_sanguineo && { grupo_sanguineo }),
        ...(currentDireccionId && { direccion_id: currentDireccionId })
      };

      return await tx.alumnos.update({
        where: { usuario_id: idParsed },
        data: dataAlumno,
        include: { usuarios: true, direcciones: true }
      });
    });
  }
};