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
    const { direccion, administrador_id, canchas } = sedeData;

    // 1. Validar administrador
    const adminId = parseInt(administrador_id);
    const adminRelacion = await prisma.administrador.findUnique({
      where: { usuario_id: adminId },
    });

    if (!adminRelacion) throw new ApiError('Administrador no válido', 404);

    // 2. Ejecutar transacción secuencial
    return await prisma.$transaction(async (tx) => {

      // A. Crear la dirección primero
      const nuevaDireccion = await tx.direcciones.create({
        data: {
          direccion_completa: direccion.direccion_completa,
          distrito: direccion.distrito,
          ciudad: direccion.ciudad || 'Lima',
          referencia: direccion.referencia || null,
        },
      });

      // B. Crear la sede (vinculada a la dirección y al admin)
      const sedeCreada = await tx.sedes.create({
        data: {
          nombre: sedeData.nombre,
          telefono_contacto: sedeData.telefono_contacto || null,
          tipo_instalacion: sedeData.tipo_instalacion || null,
          activo: true,
          direccion_id: nuevaDireccion.id,
          administrador: {
            connect: { usuario_id: adminRelacion.usuario_id }
          }
        }
      });

      // C. CREACIÓN MANUAL DE CANCHAS (Aquí aseguramos que se guarden)
      if (canchas && canchas.length > 0) {
        // Usamos createMany para eficiencia
        await tx.canchas.createMany({
          data: canchas.map(c => ({
            nombre: c.nombre,
            descripcion: c.descripcion || '',
            sede_id: sedeCreada.id // Vinculación manual por ID
          }))
        });
      }

      // D. Retornar todo el objeto completo
      return await tx.sedes.findUnique({
        where: { id: sedeCreada.id },
        include: {
          direcciones: true,
          canchas: true
        }
      });
    }, {
      timeout: 10000 // 10 segundos para asegurar que termine todo
    });
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

  getCanchaForSedeCount: async (filters = {}) => {
    let { activo, distrito, tipo_instalacion, page = 1, limit = 10 } = filters;

    page = Number.parseInt(page, 10);
    limit = Number.parseInt(limit, 10);

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
        select: {
          id: true,
          nombre: true,
          tipo_instalacion: true,
          activo: true,
          direcciones: true,
          _count: {
            select: {
              canchas: true,
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

    const sedesConConteo = sedes.map((sede) => {
      const { _count, ...rest } = sede;
      return {
        ...rest,
        canchas_count: _count?.canchas ?? 0,
      };
    });

    return {
      sedes: sedesConConteo,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  updateSede: async (id, sedeData) => {
    const sedeId = parseInt(id);

    return await prisma.$transaction(async (tx) => {
      await tx.sedes.update({
        where: { id: sedeId },
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
                ...(sedeData.direccion.referencia !== undefined && {
                  referencia: sedeData.direccion.referencia,
                }),
              },
            },
          }),
        }
      });

      if (sedeData.canchas && Array.isArray(sedeData.canchas)) {
        await tx.canchas.deleteMany({
          where: { sede_id: sedeId }
        });

        if (sedeData.canchas.length > 0) {
          await tx.canchas.createMany({
            data: sedeData.canchas.map(cancha => ({
              nombre: cancha.nombre,
              descripcion: cancha.descripcion || '',
              sede_id: sedeId
            }))
          });
        }
      }

      return await tx.sedes.findUnique({
        where: { id: sedeId },
        include: {
          direcciones: true,
          canchas: true
        }
      });
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
  deleteSede: async (id) => {
    const sedeId = parseInt(id);

    return await prisma.$transaction(async (tx) => {
      const sede = await tx.sedes.findUnique({
        where: { id: sedeId },
        select: { direccion_id: true }
      });

      if (!sede) throw new ApiError('Sede no encontrada', 404);

      await tx.sedes.delete({
        where: { id: sedeId }
      });

      if (sede.direccion_id) {
        await tx.direcciones.delete({
          where: { id: sede.direccion_id }
        });
      }

      return { success: true, message: 'Sede, canchas y dirección eliminadas correctamente' };
    });
  }
};
