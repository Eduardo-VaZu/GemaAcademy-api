import { prisma } from '../../config/database.config.js';

export const sedeService = {
  createSede: async (sedeData) => {
    const { direccion } = sedeData;
    try {
      const existDireccion = await prisma.direcciones.findFirst({
        where: {
          direccion_completa: direccion.direccion_completa,
          distrito: direccion.distrito,
          ciudad: direccion.ciudad,
        },
      });
      if (existDireccion) {
        throw new Error('La dirección ya existe');
      }

      const sede = await prisma.$transaction(
        async (tx) => {
          const nuevaDireccion = await tx.direcciones.create({
            data: {
              direccion_completa: direccion.direccion_completa,
              distrito: direccion.distrito,
              ciudad: direccion.ciudad,
              referencia: direccion.referencia,
            },
          });

          const nuevaSede = await tx.sedes.create({
            data: {
              nombre: sedeData.nombre,
              telefono_contacto: sedeData.telefono_contacto,
              tipo_instalacion: sedeData.tipo_instalacion,
              activo: sedeData.activo,
              direccion_id: nuevaDireccion.id,
            },
          });

          return nuevaSede;
        },
        {
          maxWait: 5000,
          timeout: 10000,
        }
      );

      return {
        id: sede.id,
        nombre: sede.nombre,
        telefono_contacto: sede.telefono_contacto,
        tipo_instalacion: sede.tipo_instalacion,
        activo: sede.activo,
        direccion: sede.direccion_id,
      };
    } catch (error) {
      console.error('Error al crear la sede:', error);
      throw error;
    }
  },
};
