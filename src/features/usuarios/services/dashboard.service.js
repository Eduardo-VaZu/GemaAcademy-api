import { prisma } from '../../../config/database.config.js';

export const dashboardService = {
  /**
   * Obtiene las estadísticas generales agrupadas por rol, número de sedes, ingresos consolidados y deuda pendiente general.
   * @returns {Promise<Object>} Agrupamiento de kpis del dashboard admin.
   */
  async getDashboardStats() {
    const [counts, roles, sedesCount, ingresosSum, deudaSum, ultimosPagos, ultimosAlumnos] = await Promise.all([
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
      prisma.pagos.findMany({
        take: 3,
        orderBy: { fecha_pago: 'desc' },
        where: { estado_validacion: 'APROBADO' }
      }),
      prisma.usuarios.findMany({
        take: 3,
        where: { roles: { nombre: { equals: 'Alumno', mode: 'insensitive' } }, activo: true },
        orderBy: { creado_en: 'desc' }
      })
    ]);

    const roleStats = roles.reduce((acc, rol) => {
      const group = counts.find((c) => c.rol_id === rol.id);
      acc[rol.nombre.toLowerCase()] = group ? group._count.id : 0;
      return acc;
    }, {});

    // Procesar actividad reciente
    const actividades = [];
    
    ultimosPagos.forEach(pago => {
      actividades.push({
        id: `pago_${pago.id}`,
        text: `Pago validado por S/ ${Number(pago.monto_pagado).toFixed(2)}`,
        date: pago.fecha_pago,
        type: 'pago'
      });
    });

    ultimosAlumnos.forEach(alumno => {
      actividades.push({
        id: `alumno_${alumno.id}`,
        text: `Nuevo alumno: ${alumno.nombres} ${alumno.apellidos}`,
        date: alumno.creado_en,
        type: 'alumno'
      });
    });

    // Ordenar mixto y tomar los 5 más recientes
    actividades.sort((a, b) => new Date(b.date) - new Date(a.date));
    const actividadReciente = actividades.slice(0, 5).map((act, index) => {
      const dateObj = new Date(act.date);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let dateString = dateObj.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
      if (dateObj.toDateString() === today.toDateString()) dateString = 'Hoy';
      else if (dateObj.toDateString() === yesterday.toDateString()) dateString = 'Ayer';

      return {
        id: act.id,
        text: act.text,
        date: dateString,
        type: act.type
      };
    });

    return {
      ...roleStats,
      sedes: sedesCount,
      ingresosTotales: Number(ingresosSum._sum.monto_pagado || 0).toFixed(2),
      deudaPendiente: Number(deudaSum._sum.monto_final || 0).toFixed(2),
      actividadReciente
    };
  },
};
