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

  getAllSedes: async (filters = {}) => {
    const { activo, distrito, tipo_instalacion, page = 1, limit = 10 } = filters;

    // Construir el objeto where dinámicamente
    const where = {};

    if (activo !== undefined) {
      where.activo = activo;
    }

    if (distrito) {
      where.direcciones = {
        distrito: {
          contains: distrito,
          mode: 'insensitive', // Case insensitive
        },
      };
    }

    if (tipo_instalacion) {
      where.tipo_instalacion = {
        contains: tipo_instalacion,
        mode: 'insensitive',
      };
    }

    // Calcular skip para paginación
    const skip = (page - 1) * limit;

    // Ejecutar queries en paralelo
    const [sedes, total] = await Promise.all([
      prisma.sedes.findMany({
        where,
        include: {
          direcciones: true,
          canchas: {
            include: {
              horarios_clases: {
                where: { activo: true },
                include: {
                  profesores: {
                    include: {
                      usuarios: {
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
          },
          administrador: {
            include: {
              usuarios: {
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
        skip,
        take: limit,
      }),
      prisma.sedes.count({ where }),
    ]);

    return {
      sedes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },
  getSedeById: async (id) => {
    return await prisma.sedes.findUnique({
      where: {
        id: parseInt(id),
      },
      include: {
        direcciones: true,
        canchas: {
          include: {
            horarios_clases: {
              include: {
                niveles_entrenamiento: true,
                profesores: {
                  include: {
                    usuarios: {
                      select: {
                        nombres: true,
                        apellidos: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        administrador: {
          include: {
            usuarios: {
              select: {
                nombres: true,
                apellidos: true,
                email: true,
                telefono_personal: true,
              },
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

  updateActiveSede: async (id) => {
    return await prisma.sedes.update({
      where: { id },
      data: {
        activo: true,
      },
    });
  },
};
