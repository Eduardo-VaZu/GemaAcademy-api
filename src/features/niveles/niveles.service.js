import { prisma } from '../../config/database.config.js';
import { ApiError } from '../../shared/utils/error.util.js';

export const nivelService = {
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
};
