import { prisma } from '../../config/database.config.js';

export const rolesService = {
  createRole: async (rolesData) => {
    const { nombre, descripcion } = rolesData;
    const existingRole = await prisma.roles.findUnique({
      where: { nombre },
    });
    if (existingRole) {
      throw new Error('El rol ya existe');
    }
    const nuevoRol = nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase();

    const data = {
      nombre: nuevoRol,
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
    return await prisma.roles.findUnique({
      where: {
        id,
      },
    });
  },
  updateRole: async (id, data) => {
    return await prisma.roles.update({
      where: {
        id,
      },
      data,
    });
  },
  deleteRole: async (id) => {
    return await prisma.roles.delete({
      where: {
        id,
      },
    });
  },
};
