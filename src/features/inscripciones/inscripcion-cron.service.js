import { prisma } from '../../config/database.config.js';
import { logger } from '../../shared/utils/logger.util.js';
import { notificacionesService } from '../notificaciones/notificaciones.service.js';

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

          // 2. 🔥 AQUÍ METEMOS EL LOG PARA EL FRONTEND
          await notificacionesService.crear({
            alumnoId: zombie.alumno_id,
            titulo: '🎯 Reserva Zombie Eliminada',
            mensaje: `El sistema eliminó una inscripción pendiente de pago por exceder los ${minutosLimite} minutos.`,
            tipo: 'WARNING',
            categoria: 'SISTEMA'
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

    // 2. 🔥 EL FILTRO MAESTRO: Tráeme a CUALQUIERA que deba plata (estado: PENDIENTE)
    // Sin importar de cuándo es la deuda. Si tiene deuda, El Verdugo lo investiga.
    const rebeldes = await prisma.cuentas_por_cobrar.findMany({
      where: { estado: 'PENDIENTE' },
      select: { alumno_id: true },
      distinct: ['alumno_id'], // No queremos ejecutar al mismo alumno dos veces
    });

    if (rebeldes.length === 0) return; // Si nadie debe plata, El Verdugo sigue durmiendo

    let totalFinalizados = 0;
    let totalPenRecu = 0;

    // 3. Iteramos SOLO sobre los alumnos que tienen cuentas pendientes
    for (const { alumno_id } of rebeldes) {
      // Buscamos su FECHA MADRE (la inscripción activa más antigua)
      const inscripcionMadre = await prisma.inscripciones.findFirst({
        where: { alumno_id: alumno_id, estado: 'ACTIVO' },
        orderBy: { fecha_inscripcion: 'asc' },
      });

      // Si no tiene inscripciones activas, lo ignoramos
      if (!inscripcionMadre) continue;

      // 4. LA REGLA DE ORO: Fecha Madre + 30 días del ciclo normal + Días de Tolerancia
      const fechaLimiteMuerte = new Date(inscripcionMadre.fecha_inscripcion);
      fechaLimiteMuerte.setDate(fechaLimiteMuerte.getDate() + 30 + diasGracia);

      // Si la fecha límite aún no llega (está en el futuro), se salva por hoy
      if (fechaLimiteMuerte > hoy) {
        continue;
      }

      // 5. SI LLEGÓ HASTA AQUÍ: Ya pasó su fecha límite y no ha pagado.
      // Buscamos el perdón (Recuperaciones pendientes o programadas por lesión, etc.)
      const tieneRecuperacionesPendientes = await prisma.recuperaciones.findFirst({
        where: {
          alumno_id: alumno_id,
          estado: { in: ['PENDIENTE', 'PROGRAMADA'] },
        },
      });

      const nuevoEstado = tieneRecuperacionesPendientes ? 'PEN-RECU' : 'FINALIZADO';

      if (nuevoEstado === 'PEN-RECU') {
        totalPenRecu++;
      } else {
        totalFinalizados++;
      }

      // 6. La Ejecución: Cambiamos estados en una transacción segura
      await prisma.$transaction([
        // Matamos TODAS sus inscripciones activas mandándolas al estado que le tocó
        prisma.inscripciones.updateMany({
          where: { alumno_id: alumno_id, estado: 'ACTIVO' },
          data: { estado: nuevoEstado, actualizado_en: new Date() },
        }),
        // Marcamos las deudas pendientes de este alumno como VENCIDA
        prisma.cuentas_por_cobrar.updateMany({
          where: { alumno_id: alumno_id, estado: 'PENDIENTE' },
          data: { estado: 'VENCIDA', actualizado_en: new Date() },
        }),
        // 🔔 Notificación específica para la alumna
        prisma.notificaciones.create({
          data: {
            alumno_id: alumno_id,
            titulo: '⚠️ Ciclo Finalizado',
            mensaje: `Tu inscripción pasó a ${nuevoEstado} por falta de pago tras vencer los días de gracia.`,
            tipo: 'DANGER',
            categoria: 'SISTEMA'
          }
        })
      ]);
    }

    // Reporte en consola
    if (totalFinalizados > 0 || totalPenRecu > 0) {
      logger.info(
        `[VERDUGO] Ejecución completada. Alumnos a FINALIZADO: ${totalFinalizados} | Alumnos al Purgatorio (PEN-RECU): ${totalPenRecu}.`
      );
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
      },
    });

    if (inscFinalizadas.count > 0) {
      logger.info(
        `Se cambiaron ${inscFinalizadas.count} inscripciones pendientes por recuperación a finalizados.`
      );
    }
  }
  // =================================================================
  // 🗡️ EL LIQUIDADOR DE PAGOS PARCIALES (Motor Completo)
  // =================================================================
  async liquidarMorososParciales() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // Limpiamos la hora para comparar solo "Días puros"

    // 1. Obtenemos los días de anticipación del Profeta
    const paramAnti = await prisma.parametros_sistema.findUnique({
      where: { clave: 'DIAS_ANTICIPACION_RENOVACION' },
    });
    const diasAnticipacionProfeta = paramAnti ? Number.parseInt(paramAnti.valor) : 5;

    // 🔥 REGLA DE ORO: El Liquidador ataca exactamente 1 día antes que el Profeta genere deuda nueva
    const diasAnticipacionLiquidador = diasAnticipacionProfeta + 1;

    // 2. Buscamos a TODOS los alumnos con deuda a medias ('PARCIAL')
    const morososParciales = await prisma.cuentas_por_cobrar.findMany({
      where: { estado: 'PARCIAL' },
      select: { alumno_id: true },
      distinct: ['alumno_id'],
    });

    if (morososParciales.length === 0) return;

    let totalFinalizados = 0;
    let totalPenRecu = 0;

    for (const { alumno_id } of morososParciales) {
      // 3. Buscamos su Fecha Madre para calcular el ciclo
      const inscripcionMadre = await prisma.inscripciones.findFirst({
        where: { alumno_id: alumno_id, estado: 'ACTIVO' },
        orderBy: { fecha_inscripcion: 'asc' },
      });

      if (!inscripcionMadre) continue;

      // 4. Calculamos fin de mes (Fecha Madre + 30 días)
      const finCiclo = new Date(inscripcionMadre.fecha_inscripcion);
      finCiclo.setDate(finCiclo.getDate() + 30);
      finCiclo.setHours(0, 0, 0, 0);

      // 5. Calculamos el "Día del Juicio"
      const diaDelJuicioParcial = new Date(finCiclo);
      diaDelJuicioParcial.setDate(diaDelJuicioParcial.getDate() - diasAnticipacionLiquidador);

      // 6. ¿Llegó el momento de liquidar?
      if (hoy >= diaDelJuicioParcial) {
        // Buscamos si tiene derecho a Purgatorio (Recuperaciones)
        const tieneRecuperacionesPendientes = await prisma.recuperaciones.findFirst({
          where: {
            alumno_id: alumno_id,
            estado: { in: ['PENDIENTE', 'PROGRAMADA'] },
          },
        });

        const nuevoEstado = tieneRecuperacionesPendientes ? 'PEN-RECU' : 'FINALIZADO';

        // 7. La Ejecución Letal con Notificación vinculada
        await prisma.$transaction([
          // Matamos inscripciones activas
          prisma.inscripciones.updateMany({
            where: { alumno_id: alumno_id, estado: 'ACTIVO' },
            data: { estado: nuevoEstado, actualizado_en: new Date() },
          }),
          // 🔔 Notificación para la alumna
          prisma.notificaciones.create({
            data: {
              alumno_id: alumno_id,
              titulo: '🗡️ Inscripción Liquidada',
              mensaje: `Tu acceso ha sido marcado como ${nuevoEstado} por saldo pendiente (Pago Parcial) al cierre de ciclo.`,
              tipo: 'DANGER',
              categoria: 'SISTEMA'
            }
          })
        ]);

        nuevoEstado === 'PEN-RECU' ? totalPenRecu++ : totalFinalizados++;
      }
    }

    // 8. Notificación de Resumen para el Admin
    if (totalFinalizados > 0 || totalPenRecu > 0) {
      await notificacionesService.crear({
        titulo: '🛡️ Resumen Liquidador Parcial',
        mensaje: `Se liquidaron ${totalFinalizados + totalPenRecu} alumnos con pagos incompletos.`,
        tipo: 'INFO',
        categoria: 'SISTEMA'
      });

      logger.info(
        `[LIQUIDADOR PARCIAL] Ejecución exitosa. Alumnos a FINALIZADO: ${totalFinalizados} | Alumnos a PEN-RECU: ${totalPenRecu}.`
      );
    }
  }
}

export const inscripcionCronService = new InscripcionCronService();
