import { prisma } from '../../config/database.config.js';
import { ApiError } from '../../shared/utils/error.util.js';

export const rolesService = {
  createRole: async (rolesData) => {
    const { nombre, descripcion } = rolesData;
    const nombreNormalizado = nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase();

    const existingRole = await prisma.roles.findUnique({
      where: { nombre: nombreNormalizado },
    });
    if (existingRole) {
      throw new ApiError('El rol ya existe', 400);
    }

    const data = {
      nombre: nombreNormalizado,
      descripcion,
    };
    const role = await prisma.roles.create({
      data,
    });
    return role;
  },

  getAllRoles: async () => {
    return await prisma.roles.findMany();
  },

  getRoleById: async (id) => {
    const rol = await prisma.roles.findUnique({
      where: {
        id,
      },
    });
    if (!rol) {
      throw new ApiError('El rol no existe', 404);
    }
    return rol;
  },

  updateRole: async (id, data) => {
    return await prisma.roles.update({
      where: {
        id,
      },
      data: {
        descripcion: data.descripcion,
      },
    });
  },

  deleteRole: async (id) => {
    const usersWithRole = await prisma.usuarios.count({
      where: { rol_id: id },
    });

    if (usersWithRole > 0) {
      throw new ApiError('No se puede eliminar el rol porque hay usuarios asignados a él', 400);
    }

    return await prisma.roles.delete({
      where: {
        id,
      },
    });
  },
};
