import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const TiposBeneficioService = {
  // Crear el tipo de beneficio
  async create(data) {
    return await prisma.tipos_beneficio.create({
      data: {
        nombre: data.nombre,
        es_porcentaje: data.es_porcentaje,
        valor_por_defecto: data.valor_por_defecto,
        activo: true
      }
    });
  },

  // Listar todos
  async getAll() {
    return await prisma.tipos_beneficio.findMany({
      where: { activo: true }
    });
  }
};