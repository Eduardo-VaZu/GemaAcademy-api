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

    const paramTolerancia = await prisma.parametros_sistema.findUnique({
      where: { clave: 'DIAS_TOLERANCIA_VENCIMIENTO' },
    });
    const diasGracia = paramTolerancia ? Number.parseInt(paramTolerancia.valor) : 5;

    const limiteCiclo = new Date();
    limiteCiclo.setDate(hoy.getDate() - 30);

    const congelados = await prisma.inscripciones.updateMany({
      where: {
        estado: 'ACTIVO',
        fecha_inscripcion: { lt: limiteCiclo },
      },
      data: {
        estado: 'VENCIDO',
        actualizado_en: new Date(),
      },
    });

    if (congelados.count > 0) {
      logger.info(`[VERDUGO] Se congelaron ${congelados.count} inscripciones (Fin de mes).`);
    }

    const limiteTotal = new Date();
    limiteTotal.setDate(hoy.getDate() - (30 + diasGracia));

    const finalizados = await prisma.inscripciones.updateMany({
      where: {
        estado: 'VENCIDO',
        fecha_inscripcion: { lt: limiteTotal },
      },
      data: {
        estado: 'FINALIZADO',
        actualizado_en: new Date(),
      },
    });

    if (finalizados.count > 0) {
      logger.info(`[VERDUGO] Se liberaron ${finalizados.count} cupos tras vencer su tolerancia.`);
    }
  }
}

export const inscripcionCronService = new InscripcionCronService();
