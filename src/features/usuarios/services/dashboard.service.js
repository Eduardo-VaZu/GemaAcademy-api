import { prisma } from '../../../config/database.config.js';

export const dashboardService = {
  /**
   * Obtiene las estadísticas generales agrupadas por rol, número de sedes, ingresos consolidados y deuda pendiente general.
   * @returns {Promise<Object>} Agrupamiento de kpis del dashboard admin.
   */
  async getDashboardStats() {
    const [counts, roles, sedesCount, ingresosSum, deudaSum] = await Promise.all([
      prisma.usuarios.groupBy({
        by: ['rol_id'],
        where: { activo: true },
        _count: { id: true },
      }),
      prisma.roles.findMany({
        select: { id: true, nombre: true },
      }),
      prisma.sedes.count({
        where: { activo: true },
      }),
      prisma.pagos.aggregate({
        _sum: { monto_pagado: true },
        where: { estado_validacion: 'APROBADO' },
      }),
      prisma.cuentas_por_cobrar.aggregate({
        _sum: { monto_final: true },
        where: { estado: 'PENDIENTE' },
      }),
    ]);

    const roleStats = roles.reduce((acc, rol) => {
      const group = counts.find((c) => c.rol_id === rol.id);
      acc[rol.nombre.toLowerCase()] = group ? group._count.id : 0;
      return acc;
    }, {});

    return {
      ...roleStats,
      sedes: sedesCount,
      ingresosTotales: Number(ingresosSum._sum.monto_pagado || 0).toFixed(2),
      deudaPendiente: Number(deudaSum._sum.monto_final || 0).toFixed(2),
    };
  },
};
