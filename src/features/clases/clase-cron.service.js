import { prisma } from '../../../config/database.config.js';
import { logger } from '../../../shared/utils/logger.util.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export const claseCronService = {
  /**
   * TAREA: EL BARRENDERO DE EFÍMEROS (Clean-up de Reprogramaciones Masivas)
   * Busca todos los horarios temporales creados exclusivamente para reposiciones (reconocibles por
   * no tener 'minutos_reserva_especifico' y estar aún activos) cuya fecha_origen/destino referenciada
   * en recuperaciones ya pasó respecto al día actual.
   * Ejecuta un Soft-Delete (activo: false) para sacarlos de las interfaces de frontend
   * sin romper el histórico académico.
   */
  apagarHorariosEfimeros: async () => {
    try {
      // Obtenemos inicio del día actual (Ayer a la medianoche)
      const hoyStart = dayjs().tz('America/Lima').startOf('day').toDate();

      // Buscamos a través de la tabla de recuperaciones los horarios destino que ya pasaron
      const recuperacionesVencidas = await prisma.recuperaciones.findMany({
        where: {
          fecha_programada: { lt: hoyStart }, // Tuvieron lugar ayer o antes
          horarios_clases: {
            activo: true,
            minutos_reserva_especifico: null, // Huella digital de horario efímero (creado_en_transaccion)
          },
        },
        select: {
          horario_destino_id: true,
        },
        distinct: ['horario_destino_id'], // No nos importa cuántos alumnos fueron, solo el ID del salón
      });

      const horariosAEliminar = recuperacionesVencidas
        .filter((r) => r.horario_destino_id !== null)
        .map((r) => r.horario_destino_id);

      if (horariosAEliminar.length === 0) {
        return; // No hay trabajo que hacer
      }

      const resultado = await prisma.horarios_clases.updateMany({
        where: { id: { in: horariosAEliminar } },
        data: { activo: false },
      });

      logger.info(
        `[CRON CLASES] Barrendero Efímero apagó ${resultado.count} horarios temporales vencidos.`
      );
    } catch (error) {
      logger.error('[CRON CLASES ERROR] Falló el Barrendero Efímero:', error);
    }
  },
};
