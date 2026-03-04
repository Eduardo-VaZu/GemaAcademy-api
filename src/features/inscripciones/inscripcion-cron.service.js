import { prisma } from '../../config/database.config.js';
import { logger } from '../../shared/utils/logger.util.js';

class InscripcionCronService {
  async limpiarReservasZombies() {
    const param = await prisma.parametros_sistema.findUnique({
      where: { clave: 'TIEMPO_LIMITE_RESERVA_MIN' },
    });
    const minutosLimite = param ? Number.parseInt(param.valor) : 20;
    const horaCorte = new Date(Date.now() - minutosLimite * 60 * 1000);

    const zombies = await prisma.inscripciones.findMany({
      where: {
        estado: 'PENDIENTE_PAGO',
        fecha_inscripcion: { lt: horaCorte },
      },
    });

    if (zombies.length === 0) return;

    for (const zombie of zombies) {
      try {
        await prisma.$transaction(async (tx) => {
          const deuda = await tx.cuentas_por_cobrar.findFirst({
            where: {
              alumno_id: zombie.alumno_id,
              estado: 'PENDIENTE',
              creado_en: {
                gte: new Date(zombie.fecha_inscripcion.getTime() - 30000),
                lte: new Date(zombie.fecha_inscripcion.getTime() + 30000),
              },
            },
            include: { descuentos_aplicados: true },
          });

          if (deuda) {
            await tx.descuentos_aplicados.deleteMany({
              where: { cuenta_id: deuda.id },
            });
            if (deuda.descuentos_aplicados.length > 0) {
              for (const desc of deuda.descuentos_aplicados) {
                await tx.beneficios_pendientes.updateMany({
                  where: {
                    alumno_id: zombie.alumno_id,
                    tipo_beneficio_id: desc.tipo_beneficio_id,
                    usado: true,
                  },
                  data: { usado: false },
                });
              }
            }

            await tx.pagos.deleteMany({
              where: { cuenta_id: deuda.id },
            });
            await tx.cuentas_por_cobrar.delete({
              where: { id: deuda.id },
            });
          }

          await tx.inscripciones.delete({
            where: { id: zombie.id },
          });
        });
        logger.info(`[FRANCOTIRADOR] Zombie ${zombie.id} y su deuda eliminados correctamente.`);
      } catch (error) {
        logger.error(`[ERROR] Falló limpieza de zombie ${zombie.id}:`, error.message);
      }
    }
  }

  async gestionarVencimientos() {
    const hoy = new Date();

    // 1. Obtenemos los días de gracia del sistema
    const paramTolerancia = await prisma.parametros_sistema.findUnique({
      where: { clave: 'DIAS_TOLERANCIA_VENCIMIENTO' },
    });
    const diasGracia = paramTolerancia ? Number.parseInt(paramTolerancia.valor) : 5;

    // 2. Obtenemos TODOS los alumnos que tienen al menos una inscripción ACTIVA
    const alumnosActivos = await prisma.inscripciones.findMany({
      where: { estado: 'ACTIVO' },
      distinct: ['alumno_id'],
      select: { alumno_id: true }
    });

    if (alumnosActivos.length === 0) return;

    let totalFinalizados = 0;
    let totalPenRecu = 0;

    // 3. Iteramos por cada alumno para analizar su ciclo completo
    for (const { alumno_id } of alumnosActivos) {
      
      // 4. Buscamos su FECHA MADRE (la inscripción activa más antigua)
      const inscripcionMadre = await prisma.inscripciones.findFirst({
        where: { alumno_id: alumno_id, estado: 'ACTIVO' },
        orderBy: { fecha_inscripcion: 'asc' },
      });

      if (!inscripcionMadre) continue;

      // 5. Calculamos la fecha de muerte (Madre + 30 días + Tolerancia)
      const fechaLimiteMuerte = new Date(inscripcionMadre.fecha_inscripcion);
      fechaLimiteMuerte.setDate(fechaLimiteMuerte.getDate() + 30 + diasGracia);

      // 6. Si la fecha límite aún no ha pasado, pasa al siguiente alumno
      if (fechaLimiteMuerte > hoy) {
        continue; 
      }

      // 7. El alumno ya venció. Revisamos la tabla de recuperaciones.
      const tieneRecuperacionesPendientes = await prisma.recuperaciones.findFirst({
        where: {
          alumno_id: alumno_id,
          estado: { in: ['PENDIENTE', 'PROGRAMADA'] }
        }
      });

      let nuevoEstado = '';

      if (tieneRecuperacionesPendientes) {
        nuevoEstado = 'PEN-RECU';
        totalPenRecu++;
      } else {
        nuevoEstado = 'FINALIZADO';
        totalFinalizados++;
      }

      // 8. Aplicamos la sentencia: Cambiamos TODAS sus inscripciones activas al nuevo estado.
      await prisma.inscripciones.updateMany({
        where: {
          alumno_id: alumno_id,
          estado: 'ACTIVO'
        },
        data: {
          estado: nuevoEstado,
          actualizado_en: new Date()
        }
      });
    }

    // Reporte en consola
    if (totalFinalizados > 0 || totalPenRecu > 0) {
      logger.info(`[VERDUGO] Cierre de ciclos procesado. Alumnos a FINALIZADO: ${totalFinalizados} | Alumnos a PEN-RECU: ${totalPenRecu}.`);
    }
  }

  async cambiarEstado() {
    const dia0 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const inscFinalizadas = await prisma.inscripciones.updateMany({
      where: {
        estado: 'PEN-RECU',
        fecha_inscripcion: {
          lte: dia0,
        },
        alumnos: {
          recuperaciones: {
            none: {
              es_por_lesion: true,
              estado: { in: ['PENDIENTE', 'PROGRAMADA'] },
            },
          },
        },
      },
      data: {
        estado: 'FINALIZADO',
      }
    })

    if (inscFinalizadas.count > 0) {
      logger.info(`Se cambiaron ${inscFinalizadas.count} inscripciones pendientes por recuperación a finalizados.`);
    }
  }
}

export const inscripcionCronService = new InscripcionCronService();
