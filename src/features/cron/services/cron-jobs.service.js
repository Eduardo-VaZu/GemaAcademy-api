import cron from 'node-cron';
import { logger } from '../../../shared/utils/logger.util.js';
import { prisma } from '../../../config/database.config.js';

import { inscripcionService } from '../../inscripciones/inscripcion.service.js';
import { inscripcionCronService } from '../../inscripciones/inscripcion-cron.service.js';
import { recuperacionCronService } from '../../recuperaciones/recuperacion-cron.service.js';
import { cumpleanosService } from '../../usuarios/services/cumpleanos.service.js';
import { congelamientoCronService } from '../../congelamientos/congelamiento-cron.service.js';
import { asistenciaCronService } from '../../asistencia/asistencia-cron.service.js';


// 🔥 IMPORTAMOS DAYJS Y CONFIGURAMOS LIMA PARA LOS LOGS 🔥
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
dayjs.extend(utc);
dayjs.extend(timezone);
const TZ_LIMA = 'America/Lima';

export const iniciarCronJobs = () => {
  console.log('Cron Jobs iniciados: El sistema está vigilando...');

  // ------------------------------------------------------------------
  // TAREA 1: EL FRANCOTIRADOR (Cada minuto)
  // Objetivo: Eliminar inscripciones nuevas que no se pagaron en 20 min.
  // ------------------------------------------------------------------
  cron.schedule(
    '* * * * *',
    async () => {
      try {
        await inscripcionCronService.limpiarReservasZombies();
      } catch (error) {
        logger.error('[CRON ERROR] Falló el Francotirador:', error);
      }
    },
    { timezone: 'America/Lima' }
  );

  // ------------------------------------------------------------------
  // TAREA 2: EL VERDUGO DE VENCIMIENTOS (Todos los días a las 00:00 AM)
  // Objetivo: Cambiar a FINALIZADO o PEN-RECU según el ciclo (Madre + 30 días + tolerancia).
  // ------------------------------------------------------------------
  cron.schedule(
    '0 1 * * *',
    async () => {
      logger.info(`[CRON] Iniciando revisión nocturna de ciclos: ${new Date().toISOString()}`);
      try {
        await inscripcionCronService.gestionarVencimientos();
      } catch (error) {
        logger.error('[CRON ERROR] Falló el Verdugo de Vencimientos:', error);
      }
    },
    { timezone: 'America/Lima' }
  );

  // ------------------------------------------------------------------
  // TAREA 3: EL PROFETA (Todos los días a las 00:30 AM)  30 0 * * *
  // Objetivo: Generar la deuda del próximo mes X días antes del vencimiento.
  // ------------------------------------------------------------------
  cron.schedule(
    '30 0 * * *',
    async () => {
      logger.info(`[CRON] El Profeta buscando renovaciones futuras...`);
      try {
        // 1. Obtener días de anticipación
        const param = await prisma.parametros_sistema.findUnique({
          where: { clave: 'DIAS_ANTICIPACION_RENOVACION' },
        });
        const diasAnticipacion = param ? Number.parseInt(param.valor) : 5;

        // 2. Invocar al Servicio de Inscripciones
        const renovacionesGeneradas =
          await inscripcionService.generarRenovacionesMasivas(diasAnticipacion);

        if (renovacionesGeneradas > 0) {
          logger.info(
            `[PROFETA] Se generaron ${renovacionesGeneradas} deudas de renovación anticipada.`
          );
        }
      } catch (error) {
        logger.error('[CRON ERROR] Falló el Profeta:', error);
      }
    },
    { timezone: 'America/Lima' }
  );

  // ------------------------------------------------------------------
  // TAREA 4: LA LIMPIEZA DE TICKETS (Todos los días a las 01:00 AM)
  // Objetivo: Expirar (VENCIDA) las recuperaciones que pasaron sus 30 días después del fin de inscripción.
  // ------------------------------------------------------------------
  cron.schedule(
    '0 1 * * *',
    async () => {
      logger.info(`[CRON] Limpiando tickets vencidos...`);
      try {
        await recuperacionCronService.ejecutarLimpiezaTickets();
      } catch (error) {
        logger.error('[CRON ERROR] Falló la limpieza de tickets:', error);
      }
    },
    { timezone: 'America/Lima' }
  );

  // ------------------------------------------------------------------
  // TAREA 5: EL FESTEJERO (Todos los días a las 12:00 PM)
  // Objetivo: Enviar mensajes de Feliz Cumpleaños.
  // ------------------------------------------------------------------

  cron.schedule(
    '* 8 * * *',
    async () => {
      logger.info(`[CRON] Buscando cumpleañeros de hoy: ${new Date().toISOString()}`);
      try {
        await cumpleanosService.ejecutarSaludosCumpleanos();
      } catch (error) {
        logger.error('[CRON ERROR] Falló el Festejero de Cumpleaños:', error);
      }
    },
    { timezone: 'America/Lima' }
  );

  // Cron para actualizar estado de inscripciones pendientes de recuperación a finalizados cada día a la 1 am
  cron.schedule(
    '0 1 * * *',
    async () => {
      logger.info(`[CRON] Verificando estados de inscripciones pendientes de recuperación...`);
      try {
        await inscripcionCronService.cambiarEstado();
      } catch (error) {
        logger.error('[CRON ERROR] Falló la verificación de inscripciones:', error);
      }
    },
    { timezone: 'America/Lima' }
  );

  // Cron para finalizar congelamientos por lesiones a la 1 am
  cron.schedule(
    '0 1 * * *',
    async () => {
      logger.info(`[CRON] Verificando congelamientos por finalizar...`);
      try {
        await congelamientoCronService.gestionarCongelamientos();
      } catch (error) {
        logger.error('[CRON ERROR] Falló la verificación de congelamientos: ', error);
      }
    },
    { timezone: 'America/Lima' }
  );

  // ------------------------------------------------------------------
  // TAREA NUEVA: EL LIQUIDADOR DE PARCIALES (Todos los días a las 00:15 AM)
  // Objetivo: Matar inscripciones con pagos parciales justo antes de que el Profeta les genere nueva deuda.
  // ------------------------------------------------------------------
  cron.schedule(
    '15 0 * * *',
    async () => {
      logger.info(`[CRON] El Liquidador buscando morosos parciales...`);
      try {
        await inscripcionCronService.liquidarMorososParciales();
      } catch (error) {
        logger.error('[CRON ERROR] Falló el Liquidador de Parciales:', error);
      }
    },
    { timezone: 'America/Lima' }
  );

  // Cron para actualizar registros de asistencias sin marcar a la 1 am
  cron.schedule(
    '0 1 * * *',
    async () => {
      logger.info(`[CRON] Verificando registros de asistencia sin marcar...`);
      try {
        await asistenciaCronService.sinRegistroAsistencias();
      } catch (error) {
        logger.error('[CRON ERROR] Falló la verificación de registros: ', error);
      }
    },
    { timezone: 'America/Lima' }
  );

  // Cron para cambiar de estado a las recuperaciones por lesion que no fueron marcadas como PRESENTE / FALTA
  cron.schedule(
    '0 1 * * *',
    async () => {
      logger.info(`[CRON] Verificando tickets por lesión sin marcar...`);
      try {
        await recuperacionCronService.ejecutarLimpiezaTicketsPorLesion();
      } catch (error) {
        logger.error('[CRON ERROR] Falló la verificación de tickets por lesión: ', error);
      }
    },
    { timezone: 'America/Lima' }
  );
};
