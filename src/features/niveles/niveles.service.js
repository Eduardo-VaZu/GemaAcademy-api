import { prisma } from '../../config/database.config.js';
import { ApiError } from '../../shared/utils/error.util.js';

export const nivelService = {
  createNivel: async (data) => {
    const nivelExistente = await prisma.niveles_entrenamiento.findUnique({
      where: { nombre: data.nombre },
    });

    if (nivelExistente) {
      throw new ApiError('El nivel ya existe', 409);
    }

    return await prisma.niveles_entrenamiento.create({
      data,
    });
  },

  getAllNiveles: async () => {
    const niveles = await prisma.niveles_entrenamiento.findMany({
      orderBy: {
        nombre: 'asc',
      },
    });

    if (!niveles || niveles.length === 0) {
      throw new ApiError('No se encontraron niveles', 404);
    }

    return niveles;
  },
  updateNivel: async (id, data) => {
    const nivelExistente = await prisma.niveles_entrenamiento.findUnique({
      where: { id: Number.parseInt(id) },
    });

    if (!nivelExistente) {
      throw new ApiError('Nivel no encontrado', 404);
    }

    return await prisma.niveles_entrenamiento.update({
      where: { id: Number.parseInt(id) },
      data,
    });
  },
  deleteNivel: async (id) => {
    const nivelId = Number.parseInt(id);
    const nivelExistente = await prisma.niveles_entrenamiento.findUnique({
      where: { id: nivelId },
    });

    if (!nivelExistente) {
      throw new ApiError('Nivel no encontrado', 404);
    }

    const referencias = await prisma.horarios_clases.count({
      where: { nivel_id: nivelId },
    });

    if (referencias > 0) {
      throw new ApiError('No se puede eliminar el nivel porque tiene horarios asociados', 409);
    }

    return await prisma.niveles_entrenamiento.delete({
      where: { id: nivelId },
    });
  },
};
