import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const CuentasPorCobrarService = {
  // Obtener todas las cuentas con los nombres exactos de tu schema
  async obtenerTodas() {
    return await prisma.cuentas_por_cobrar.findMany({
      include: {
        alumnos: {
          include: {
            usuarios: true // Para traer el nombre del alumno desde la tabla usuarios
          }
        },
        catalogo_conceptos: true // Nombre exacto según tu model cuentas_por_cobrar
      },
      orderBy: { creado_en: 'desc' }
    });
  },

  async crear(data) {
    return await prisma.cuentas_por_cobrar.create({
      data: {
        alumno_id: parseInt(data.alumno_id),
        concepto_id: data.concepto_id ? parseInt(data.concepto_id) : null,
        detalle_adicional: data.detalle_adicional,
        monto_final: parseFloat(data.monto_final),
        fecha_vencimiento: new Date(data.fecha_vencimiento),
        estado: data.estado || 'PENDIENTE'
      }
    });
  },

  async obtenerPorId(id) {
    const cuenta = await prisma.cuentas_por_cobrar.findUnique({
      where: { id: parseInt(id) },
      include: { 
        alumnos: { include: { usuarios: true } },
        catalogo_conceptos: true 
      }
    });
    if (!cuenta) throw new Error("Cuenta no encontrada");
    return cuenta;
  },

  async actualizar(id, data) {
    return await prisma.cuentas_por_cobrar.update({
      where: { id: parseInt(id) },
      data: {
        alumno_id: data.alumno_id ? parseInt(data.alumno_id) : undefined,
        concepto_id: data.concepto_id ? parseInt(data.concepto_id) : undefined,
        detalle_adicional: data.detalle_adicional,
        monto_final: data.monto_final ? parseFloat(data.monto_final) : undefined,
        fecha_vencimiento: data.fecha_vencimiento ? new Date(data.fecha_vencimiento) : undefined,
        estado: data.estado,
        actualizado_en: new Date()
      }
    });
  },

  async eliminar(id) {
    return await prisma.cuentas_por_cobrar.delete({
      where: { id: parseInt(id) }
    });
  }
};