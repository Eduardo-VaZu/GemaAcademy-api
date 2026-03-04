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
          estado: { in: ['PENDIENTE', 'PROGRAMADA'] }
        }
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
          data: { estado: nuevoEstado, actualizado_en: new Date() }
        }),
        // Marcamos las deudas pendientes de este alumno como VENCIDA
        prisma.cuentas_por_cobrar.updateMany({
          where: { alumno_id: alumno_id, estado: 'PENDIENTE' },
          data: { estado: 'VENCIDA', actualizado_en: new Date() }
        })
      ]);
    }

    // Reporte en consola
    if (totalFinalizados > 0 || totalPenRecu > 0) {
      logger.info(`[VERDUGO] Ejecución completada. Alumnos a FINALIZADO: ${totalFinalizados} | Alumnos al Purgatorio (PEN-RECU): ${totalPenRecu}.`);
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
  // =================================================================
  // 🗡️ EL LIQUIDADOR DE PAGOS PARCIALES
  // =================================================================
  async liquidarMorososParciales() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // Limpiamos la hora para comparar solo "Días puros"

    // 1. Obtenemos los días de anticipación con los que trabaja El Profeta (Ej: 5)
    const paramAnti = await prisma.parametros_sistema.findUnique({
      where: { clave: 'DIAS_ANTICIPACION_RENOVACION' },
    });
    const diasAnticipacionProfeta = paramAnti ? Number.parseInt(paramAnti.valor) : 5;

    // 🔥 LA REGLA DE ORO: El Liquidador siempre ataca exactamente 1 día antes
    const diasAnticipacionLiquidador = diasAnticipacionProfeta + 1;

    // 2. Buscamos a TODOS los alumnos que tienen una deuda a medias (Literalmente 'PARCIAL')
    const morososParciales = await prisma.cuentas_por_cobrar.findMany({
      where: { estado: 'PARCIAL' },
      select: { alumno_id: true },
      distinct: ['alumno_id'],
    });

    if (morososParciales.length === 0) return; // Si no hay morosos a medias, vuelve a dormir

    let totalFinalizados = 0;
    let totalPenRecu = 0;

    for (const { alumno_id } of morososParciales) {
      // 3. Buscamos su Fecha Madre para calcular su ciclo personal
      const inscripcionMadre = await prisma.inscripciones.findFirst({
        where: { alumno_id: alumno_id, estado: 'ACTIVO' },
        orderBy: { fecha_inscripcion: 'asc' },
      });

      if (!inscripcionMadre) continue;

      // 4. Calculamos cuándo termina su mes (Fecha Madre + 30 días)
      const finCiclo = new Date(inscripcionMadre.fecha_inscripcion);
      finCiclo.setDate(finCiclo.getDate() + 30);
      finCiclo.setHours(0, 0, 0, 0); // Limpiamos la hora

      // 5. Calculamos el "Día del Juicio" restando los días exactos
      // Si el Profeta avisa 5 días antes, el Liquidador ataca 6 días antes.
      const diaDelJuicioParcial = new Date(finCiclo);
      diaDelJuicioParcial.setDate(diaDelJuicioParcial.getDate() - diasAnticipacionLiquidador);

      // 6. Si hoy ya llegamos (o pasamos) el día de liquidación... ¡Zaz!
      if (hoy >= diaDelJuicioParcial) {
        
        // Buscamos si tiene derecho a Purgatorio (Recuperaciones pendientes)
        const tieneRecuperacionesPendientes = await prisma.recuperaciones.findFirst({
          where: {
            alumno_id: alumno_id,
            estado: { in: ['PENDIENTE', 'PROGRAMADA'] }
          }
        });

        const nuevoEstado = tieneRecuperacionesPendientes ? 'PEN-RECU' : 'FINALIZADO';

        if (nuevoEstado === 'PEN-RECU') {
          totalPenRecu++;
        } else {
          totalFinalizados++;
        }

        // 7. La Ejecución Letal
        // Solo afectamos las inscripciones. La deuda se queda intacta (PARCIAL) para cobrarla.
        await prisma.$transaction([
          prisma.inscripciones.updateMany({
            where: { alumno_id: alumno_id, estado: 'ACTIVO' },
            data: { estado: nuevoEstado, actualizado_en: new Date() }
          })
        ]);
      }
    }

    if (totalFinalizados > 0 || totalPenRecu > 0) {
      logger.info(`[LIQUIDADOR PARCIAL] Ejecución exitosa. Alumnos a FINALIZADO: ${totalFinalizados} | Alumnos a PEN-RECU: ${totalPenRecu}. Las deudas se mantuvieron en PARCIAL.`);
    }
  }
}

export const inscripcionCronService = new InscripcionCronService();
