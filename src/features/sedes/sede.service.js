import { email } from 'zod/v4';
import { prisma } from '../../config/database.config.js';

export const sedeService = {
  createSede: async (sedeData) => {
    const { direccion } = sedeData;
    try {
      const sede = await prisma.$transaction(
        async (tx) => {
          const nuevaDireccion = await prisma.direcciones.create({
            data: {
              direccion_completa: direccion.direccion_completa,
              distrito: direccion.distrito,
              ciudad: direccion.ciudad || 'Lima',
              referencia: direccion.referencia || null,
            },
          });

          const nuevaSede = await tx.sedes.create({
            data: {
              nombre: sedeData.nombre,
              telefono_contacto: sedeData.telefono_contacto || null,
              tipo_instalacion: sedeData.tipo_instalacion || null,
              activo: true,
              direccion_id: nuevaDireccion.id,
            },
            include: {
              direccion: true,
            },
          });

          return nuevaSede;
        },
        {
          maxWait: 2000,
          timeout: 5000,
        }
      );

      return {
        id: sede.id,
        nombre: sede.nombre,
        telefono_contacto: sede.telefono_contacto,
        tipo_instalacion: sede.tipo_instalacion,
        activo: sede.activo,
        direccion: {
          id: sede.direcciones.id,
          direccion_completa: sede.direcciones.direccion_completa,
          distrito: sede.direcciones.distrito,
          ciudad: sede.direcciones.ciudad,
          referencia: sede.direcciones.referencia,
        },
      };
    } catch (error) {
      console.error('Error al crear la sede:', error);
      throw error;
    }
  },

  getAllSeded: async () => {
    return await prisma.sedes.findMany({
      include: {
        direcciones: true,
        canchas: true,
        administradores: {
          include: {
            usuario: {
              select: {
                nombres: true,
                apellidos: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        nombre: 'asc',
      },
    });
  },

  getSedeById: async (id) => {
    return await prisma.sedes.findUnique({
      where: {
        id,
      },
      include: {
        direcciones: true,
        canchas: {
          include: {
            profesores: {
              include: {
                usuario: {
                  select: {
                    nombres: true,
                    apellidos: true,
                  },
                },
              },
            },
          },
        },
      },
      administradores: {
        include: {
          usuario: {
            select: {
              nombres: true,
              apellidos: true,
              email: true,
              telefono_contacto: true,
            },
          },
        },
      },
    });
  },

  updateSede: async (id, sedeData) => {
    return await prisma.sedes.update({
      where: { id },
      data: {
        nombre: sedeData.nombre,
        telefono_contacto: sedeData.telefono_contacto,
        tipo_instalacion: sedeData.tipo_instalacion,
        activo: sedeData.activo,
      },
      include: {
        direcciones: true,
      },
    });
  },

  updateDefuseSede: async (id) => {
    return await prisma.sedes.update({
      where: { id },
      data: {
        activo: false,
      },
    });
  },
};
