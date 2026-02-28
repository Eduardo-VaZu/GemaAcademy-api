import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { whatsappService } from '../../../shared/services/whatsapp.service.js';
import { logger } from '../../../shared/utils/logger.util.js';

const prisma = new PrismaClient();
const BIRTHDAY_WHATSAPP_TEMPLATE_ID = parseInt(
  process.env.BREVO_WHATSAPP_BIRTHDAY_TEMPLATE_ID || '1',
  10
);

export const iniciarCronCumpleanos = () => {
  cron.schedule(
    '0 8 * * *',
    async () => {
      logger.info('Iniciando tarea programada: Verificación de Cumpleaños a las 08:00 AM');

      try {
        // Usamos EXTRACT para obtener mes y día velozmente en PostgreSQL
        // El rol_id 3 es por lo general 'Alumno'. Valida esto si tienes la tabla roles cerca.
        // O si todos en 'usuarios' cumplen años, quitas el filtro.
        const hoy = new Date();
        const mesActual = hoy.getMonth() + 1; // getMonth() es 0-indexed en JS
        const diaActual = hoy.getDate();

        const cumpleaneros = await prisma.$queryRaw`
        SELECT id, nombres, apellidos, telefono_personal, email
        FROM usuarios
        WHERE EXTRACT(MONTH FROM fecha_nacimiento) = ${mesActual}
          AND EXTRACT(DAY FROM fecha_nacimiento) = ${diaActual}
          AND activo = true
          AND rol_id IN (SELECT id FROM roles WHERE nombre = 'Alumno')
      `;

        if (!cumpleaneros || cumpleaneros.length === 0) {
          logger.info('Hoy no hay alumnos de cumpleaños. Tarea finalizada.');
          return;
        }

        logger.info(`Se encontraron ${cumpleaneros.length} cumpleañer@(s) para hoy.`);

        const promesasEnvio = cumpleaneros.map((alumno) => {
          if (!alumno.telefono_personal) {
            logger.warn(
              `El alumno ${alumno.nombres} (ID: ${alumno.id}) no tiene número de teléfono registrado. Omitiendo.`
            );
            return Promise.resolve(false);
          }

          return whatsappService.sendTemplate({
            to: alumno.telefono_personal,
            templateId: BIRTHDAY_WHATSAPP_TEMPLATE_ID,
            params: {
              nombre: alumno.nombres,
            },
          });
        });

        const resultados = await Promise.allSettled(promesasEnvio);

        const exitosos = resultados.filter(
          (r) => r.status === 'fulfilled' && r.value === true
        ).length;
        logger.info(
          `Envío masivo finalizado. Éxitos: ${exitosos} / Totales: ${cumpleaneros.length}`
        );
      } catch (error) {
        logger.error('Error crítico en el Cron Job de Cumpleaños: ' + error.message);
      }
    },
    {
      timezone: 'America/Lima',
    }
  );

  logger.info('Cron Job de Cumpleaños registrado: 08:00 AM diariamente.');
};
