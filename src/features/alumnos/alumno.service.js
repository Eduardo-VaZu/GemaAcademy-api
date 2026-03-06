import { prisma } from '../../config/database.config.js';
import { ApiError } from '../../shared/utils/error.util.js';
import { alumnoLogic } from './logic/alumno.logic.js';

export const alumnoService = {
  actualizarMiPerfil: async (usuarioId, datos) => {
    return await prisma.$transaction(async (tx) => {
      await alumnoLogic.actualizarDatosBaseUsuario(tx, usuarioId, datos);

      const alumnoActual = await tx.alumnos.findUnique({
        where: { usuario_id: usuarioId },
        select: { usuario_id: true, direccion_id: true },
      });

      if (!alumnoActual) {
        throw new ApiError('Alumno no encontrado', 404);
      }

      const direccionId = await alumnoLogic.gestionarDireccion(
        tx,
        alumnoActual.direccion_id,
        datos
      );

      return await alumnoLogic.actualizarPerfilMedico(tx, usuarioId, direccionId, datos);
    });
  },
  obtenerMiPerfil: async (usuarioId) => {
    // Realizamos una consulta anidada para traer todo el expediente
    const perfil = await prisma.usuarios.findUnique({
      where: { id: usuarioId },
      include: {
        alumnos: {
          include: {
            direcciones: true, // Traemos calle, distrito y referencia
          },
        },
      },
    });

    if (!perfil) throw new ApiError('Alumno no encontrado', 404);
    return perfil;
  },
};
