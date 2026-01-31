import { prisma } from '../../config/database.config.js';
import { ApiError } from '../../shared/utils/error.util.js';

const SEDE_SELECT_FIELDS = {
  id: true,
  nombre: true,
  telefono_contacto: true,
  tipo_instalacion: true,
  activo: true,
  direcciones: true,
  canchas: {
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      horarios_clases: {
        where: { activo: true },
        select: {
          id: true,
          dia_semana: true,
          hora_inicio: true,
          hora_fin: true,
          niveles_entrenamiento: true,
          profesores: {
            select: {
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
    select: {
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
};

export const sedeService = {
  createSede: async (sedeData) => {
    const { direccion } = sedeData;

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
            direcciones: true,
          },
        });

        return nuevaSede;
      },
      {
        maxWait: 2000,
        timeout: 5000,
      }
    );

    return sede;
  },

  getAllSedes: async (filters = {}) => {
    let { activo, distrito, tipo_instalacion, page = 1, limit = 10 } = filters;

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    const where = {};

    if (activo !== undefined) {
      where.activo = String(activo) === 'true';
    }

    if (distrito) {
      where.direcciones = {
        distrito: {
          contains: distrito,
          mode: 'insensitive',
        },
      };
    }

    if (tipo_instalacion) {
      where.tipo_instalacion = {
        contains: tipo_instalacion,
        mode: 'insensitive',
      };
    }

    const skip = (page - 1) * limit;

    const [sedes, total] = await Promise.all([
      prisma.sedes.findMany({
        where,
        select: SEDE_SELECT_FIELDS,
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
    const sede = await prisma.sedes.findUnique({
      where: {
        id: parseInt(id),
      },
      select: SEDE_SELECT_FIELDS,
    });

    if (!sede) {
      throw new ApiError('Sede no encontrada', 404);
    }

    return sede;
  },

  updateSede: async (id, sedeData) => {
    return await prisma.sedes.update({
      where: { id: parseInt(id) },
      data: {
        ...(sedeData.nombre && { nombre: sedeData.nombre }),
        ...(sedeData.telefono_contacto !== undefined && {
          telefono_contacto: sedeData.telefono_contacto,
        }),
        ...(sedeData.tipo_instalacion !== undefined && {
          tipo_instalacion: sedeData.tipo_instalacion,
        }),
        ...(sedeData.activo !== undefined && { activo: sedeData.activo }),
        ...(sedeData.direccion && {
          direcciones: {
            update: {
              ...(sedeData.direccion.direccion_completa && {
                direccion_completa: sedeData.direccion.direccion_completa,
              }),
              ...(sedeData.direccion.distrito && {
                distrito: sedeData.direccion.distrito,
              }),
              ...(sedeData.direccion.ciudad && {
                ciudad: sedeData.direccion.ciudad,
              }),
              ...(sedeData.direccion.referencia && {
                referencia: sedeData.direccion.referencia,
              }),
              // Ensure we don't accidentally wipe unmatched fields if partial update is intended
            },
          },
        }),
      },
      include: {
        direcciones: true,
      },
    });
  },

  updateDefuseSede: async (id) => {
    return await prisma.sedes.update({
      where: { id: parseInt(id) },
      data: {
        activo: false,
      },
      include: {
        direcciones: true,
      },
    });
  },

  updateActiveSede: async (id) => {
    return await prisma.sedes.update({
      where: { id: parseInt(id) },
      data: {
        activo: true,
      },
      include: {
        direcciones: true,
      },
    });
  },
};
