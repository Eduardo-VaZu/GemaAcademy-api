import { prisma } from '../../../config/database.config.js';
import { logger } from '../../../shared/utils/logger.util.js';

export const reporteService = {
  /**
   * Recopila un mega-reporte tridimensional (alumnos, pagos y deudas) con relaciones de profundidad.
   * @returns {Promise<{alumnos: Array, pagos: Array, deudas: Array}>} Datos aplanados para exportación matricial/Excel.
   */
  async getDetailedExcelReport() {
    try {
      const [alumnos, pagos, deudas] = await Promise.all([
        // 1. Alumnos
        prisma.alumnos.findMany({
          select: {
            usuario_id: true,
            seguro_medico: true,
            usuarios: {
              select: {
                nombres: true,
                apellidos: true,
                email: true,
                telefono_personal: true,
              },
            },
            alumnos_contactos: {
              where: { es_principal: true },
              select: { nombre_completo: true },
            },
          },
        }),
        // 2. Pagos
        prisma.pagos.findMany({
          select: {
            fecha_pago: true,
            monto_pagado: true,
            estado_validacion: true,
            cuentas_por_cobrar: {
              select: {
                alumnos: {
                  select: {
                    usuarios: {
                      select: { nombres: true, apellidos: true },
                    },
                  },
                },
              },
            },
            metodos_pago: {
              select: { nombre: true },
            },
          },
        }),
        // 3. Deudas
        prisma.cuentas_por_cobrar.findMany({
          where: { estado: 'PENDIENTE' },
          select: {
            monto_final: true,
            fecha_vencimiento: true,
            detalle_adicional: true,
            catalogo_conceptos: {
              select: { nombre: true },
            },
            alumnos: {
              select: {
                usuarios: {
                  select: { nombres: true, apellidos: true },
                },
              },
            },
          },
        }),
      ]);

      return {
        alumnos: alumnos.map((a) => ({
          ID: a.usuario_id,
          Nombre: `${a.usuarios?.nombres || ''} ${a.usuarios?.apellidos || ''}`,
          Email: a.usuarios?.email || 'N/A',
          Celular: a.usuarios?.telefono_personal || 'N/A',
          Seguro: a.seguro_medico || 'No registrado',
          Contacto_Emergencia: a.alumnos_contactos[0]?.nombre_completo || 'N/A',
        })),
        pagos: pagos.map((p) => ({
          Fecha: p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString() : 'N/A',
          Alumno: p.cuentas_por_cobrar?.alumnos?.usuarios
            ? `${p.cuentas_por_cobrar.alumnos.usuarios.nombres} ${p.cuentas_por_cobrar.alumnos.usuarios.apellidos}`
            : 'Desconocido',
          Monto: Number.parseFloat(p.monto_pagado || 0),
          Metodo: p.metodos_pago?.nombre || 'N/A',
          Estado: p.estado_validacion,
        })),
        deudas: deudas.map((d) => ({
          Alumno: `${d.alumnos?.usuarios?.nombres || ''} ${d.alumnos?.usuarios?.apellidos || ''}`,
          Concepto: d.catalogo_conceptos?.nombre || d.detalle_adicional || 'Varios',
          Monto_Pendiente: Number.parseFloat(d.monto_final || 0),
          Vencimiento: d.fecha_vencimiento
            ? new Date(d.fecha_vencimiento).toLocaleDateString()
            : 'N/A',
        })),
      };
    } catch (error) {
      logger.error('Error detallado en Prisma al generar reporte detallado:', error);
      throw error;
    }
  },
};
