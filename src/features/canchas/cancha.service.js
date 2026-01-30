import prisma from '../../config/database.config.js';
import { ApiError } from '../../shared/utils/error.util.js';

const canchaService = {
  create: async (canchaData) => {
    const { sede_id, ...data } = canchaData;
    const sede = await prisma.sedes.findUnique({
      where: { id: sede_id },
    });
    if (!sede) {
      throw new ApiError('Sede no encontrada', 404);
    }
    return await prisma.canchas.create({
      data: { ...data, sede_id },
    });
  },

  getAll: async () => {
    return await prisma.canchas.findMany();
  },

  getById: async (id) => {
    return await prisma.canchas.findUnique({
      where: { id },
    });
  },

  update: async (id, canchaData) => {
    const { sede_id, ...data } = canchaData;

    if (sede_id) {
      const sede = await prisma.sedes.findUnique({
        where: { id: sede_id },
      });
      if (!sede) {
        throw new ApiError('Sede no encontrada', 404);
      }
      data.sede_id = sede_id;
    }

    return await prisma.canchas.update({
      where: { id },
      data: data,
    });
  },

  delete: async (id) => {
    return await prisma.canchas.delete({
      where: { id },
    });
  },
};

export default canchaService;
