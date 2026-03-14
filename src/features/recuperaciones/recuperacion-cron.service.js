import { prisma } from '../../config/database.config.js';
import { logger } from '../../shared/utils/logger.util.js';

class RecuperacionCronService {
  async ejecutarLimpiezaTickets() {
    const pendientes = await prisma.recuperaciones.findMany({
      where: {
        estado: { in: ['PENDIENTE', 'PROGRAMADA'] },
        es_por_lesion: false,
      },
    });

    if (pendientes.length === 0) return;

    const hoy = new Date();
    let expiradosCount = 0;

    for (const ticket of pendientes) {
      const inscripcion = await prisma.inscripciones.findFirst({
        where: {
          alumno_id: ticket.alumno_id,
          estado: { in: ['ACTIVO', 'PEN-RECU'] },
        },
        orderBy: { fecha_inscripcion_original: 'asc' },
      });

      if (!inscripcion) continue;

      const inicioInscripcion = new Date(inscripcion.fecha_inscripcion_original);
      const fechaFaltaDate = new Date(ticket.fecha_falta);

      const diffFalta = fechaFaltaDate - inicioInscripcion;
      const diasTranscurridosFalta = Math.floor(diffFalta / (1000 * 60 * 60 * 24));

      if (diasTranscurridosFalta < 0) continue;

      const numeroBloqueFalta = Math.floor(diasTranscurridosFalta / 30);
      const finCicloFalta = new Date(inicioInscripcion);
      finCicloFalta.setUTCDate(inicioInscripcion.getUTCDate() + (numeroBloqueFalta + 1) * 30);

      const fechaLimiteValida = new Date(finCicloFalta);
      fechaLimiteValida.setUTCDate(finCicloFalta.getUTCDate() + 30);

      if (hoy >= fechaLimiteValida) {
        await prisma.recuperaciones.update({
          where: { id: ticket.id },
          data: { estado: 'VENCIDA' },
        });
        expiradosCount++;
      }
    }

    if (expiradosCount > 0) {
      logger.info(`Se marcaron ${expiradosCount} tickets como VENCIDOS.`);
    }
  }

  async ejecutarLimpiezaTicketsPorLesion() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0)
    const ticketsActualizados = await prisma.recuperaciones.updateMany({
      where: {
        es_por_lesion: true,
        estado: 'PROGRAMADA',
        fecha_programada: {
          lt: hoy,
        }
      },
      data: {
        estado: 'COMPLETADA_FALTA',
      }
    })
    if (ticketsActualizados.count > 0) {
      logger.info(`Se actualizaron ${ticketsActualizados.count} recuperaciones por lesión como COMPLETADA_FALTA.`);
    }
  }
}

export const recuperacionCronService = new RecuperacionCronService();
