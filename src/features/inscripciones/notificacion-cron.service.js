import { prisma } from '../../config/database.config.js';
import { logger } from '../../shared/utils/logger.util.js';
import { twilioWhatsappService } from '../../shared/services/twilio.whatsapp.service.js';

class NotificacionCronService {
  /**
   * Envía un mensaje de WhatsApp a los morosos parciales
   * exactamente 2 días ANTES de que el Liquidador actúe.
   */
  async avisarMorososParciales() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // "Días puros"

    // 1. Obtenemos los días de anticipación de El Profeta (Ej: 5)
    const paramAnti = await prisma.parametros_sistema.findUnique({
      where: { clave: 'DIAS_ANTICIPACION_RENOVACION' },
    });
    const diasAnticipacionProfeta = paramAnti ? Number.parseInt(paramAnti.valor) : 5;

    // El Liquidador ataca 6 días antes (5 + 1)
    // El WhatsApp debe atacar 2 días ANTES del liquidador = 8 días antes (5 + 1 + 2)
    const diasAnticipacionWhatsApp = diasAnticipacionProfeta + 3;

    // 2. Buscamos a TODOS los alumnos que tienen una deuda a medias (PARCIAL)
    // Y QUE AÚN NO HAN SIDO NOTIFICADOS (Anti-Spam)
    const morososParciales = await prisma.cuentas_por_cobrar.findMany({
      where: {
        estado: 'PARCIAL',
        notificacion_parcial_enviada: false, // Solo los no notificados
      },
      select: {
        id: true, // ID de la cuenta para actualizarla luego
        alumno_id: true,
        monto_final: true,
        alumnos: {
          select: {
            alumnos_contactos: {
              where: { es_principal: true },
              take: 1,
            },
            usuarios: {
              select: { nombres: true },
            },
          },
        },
      },
    });

    if (morososParciales.length === 0) return; // Nadie a quien notificar hoy

    let mensajesEnviados = 0;

    for (const cuenta of morososParciales) {
      // 3. Buscamos su Fecha Madre para calcular su ciclo personal
      const inscripcionMadre = await prisma.inscripciones.findFirst({
        where: { alumno_id: cuenta.alumno_id, estado: 'ACTIVO' },
        orderBy: { fecha_inscripcion: 'asc' },
      });

      if (!inscripcionMadre) continue;

      // 4. Calculamos cuándo termina su mes
      const finCiclo = new Date(inscripcionMadre.fecha_inscripcion);
      finCiclo.setDate(finCiclo.getDate() + 30);
      finCiclo.setHours(0, 0, 0, 0);

      // 5. Calculamos el "Día de Advertencia"
      const diaAdvertencia = new Date(finCiclo);
      diaAdvertencia.setDate(diaAdvertencia.getDate() - diasAnticipacionWhatsApp);

      // 6. Si hoy ya llegamos (o pasamos) el día de Advertencia... ¡Enviamos!
      if (hoy >= diaAdvertencia) {
        // Determinar número de teléfono (Contacto principal)
        const contactos = cuenta.alumnos?.alumnos_contactos || [];
        if (contactos.length === 0 || !contactos[0].telefono) {
          logger.warn(
            `[NOTIFICADOR] Omitiendo WhatsApp para alumno ${cuenta.alumno_id}. No hay contacto principal.`
          );
          continue;
        }

        const telefonoDestino = contactos[0].telefono;
        const nombreAlumno = cuenta.alumnos.usuarios.nombres;
        const monto = Number(cuenta.monto_final).toFixed(2);

        const mensajeWS = `¡Hola ${nombreAlumno}! Te saludamos de GemaAcademy 🥋. Te recordamos que tienes un saldo pendiente de S/ ${monto} en tu mensualidad. Para evitar la suspensión automática de tus clases en 48 horas, por favor regularízalo pronto. ¡Te esperamos en el tatami! 🥊`;

        try {
          // TRANSACTION: Enviar WP y Marcar la base de datos
          // Si falla el WP, tira error y Prisma NO marca la deuda como enviada.
          // Si triunfa, Prisma impide que se vuelva a enviar al día siguiente.
          await twilioWhatsappService.sendWhatsApp(telefonoDestino, mensajeWS);

          await prisma.cuentas_por_cobrar.update({
            where: { id: cuenta.id },
            data: { notificacion_parcial_enviada: true },
          });

          mensajesEnviados++;
        } catch (error) {
          logger.error(`[NOTIFICADOR] Falló envío WP a ${telefonoDestino}: ${error.message}`);
        }
      }
    }

    if (mensajesEnviados > 0) {
      logger.info(
        `[NOTIFICADOR PARCIAL] WhatsApps enviados exitosamente a ${mensajesEnviados} alumnos morosos parciales.`
      );
    }
  }
}

export const notificacionCronService = new NotificacionCronService();
