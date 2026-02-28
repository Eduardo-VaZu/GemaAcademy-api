import { PrismaClient } from '@prisma/client';
import { whatsappService } from './src/shared/services/whatsapp.service.js';
import { logger } from './src/shared/utils/logger.util.js';

const prisma = new PrismaClient();
const BIRTHDAY_WHATSAPP_TEMPLATE_ID = parseInt(
  process.env.BREVO_WHATSAPP_BIRTHDAY_TEMPLATE_ID || '1',
  10
);

async function probarEnvioCumpleanos() {
  logger.info('--- PRUEBA MANUAL DE CRON DE CUMPLEAÑOS ---');

  try {
    const hoy = new Date();
    const mesActual = hoy.getMonth() + 1;
    const diaActual = hoy.getDate();

    logger.info(`Buscando alumnos nacidos el día ${diaActual} del mes ${mesActual}`);

    // Query optimizada
    const cumpleaneros = await prisma.$queryRaw`
      SELECT id, nombres, apellidos, telefono_personal, email
      FROM usuarios
      WHERE EXTRACT(MONTH FROM fecha_nacimiento) = ${mesActual}
        AND EXTRACT(DAY FROM fecha_nacimiento) = ${diaActual}
        AND activo = true
        AND rol_id IN (SELECT id FROM roles WHERE nombre = 'ALUMNO')
    `;

    if (!cumpleaneros || cumpleaneros.length === 0) {
      logger.info('Hoy no hay alumnos de cumpleaños en la base de datos de pruebas.');
      return;
    }

    logger.info(
      `Se encontraron ${cumpleaneros.length} cumpleañer@(s). Enviando mensajes de prueba a la consola (sin llamar a Brevo para evitar spam accidental).`
    );

    // Prueba en seco (Dry-run) - Para no gastar saldo de Whatsapp en la prueba
    // Mapeamos a promesas
    const promesasEnvio = cumpleaneros.map((alumno) => {
      logger.info(
        `[SIMULACIÓN] 🚀 Preparando WhatsApp para: ${alumno.nombres} - Tel: ${alumno.telefono_personal}`
      );
      if (!alumno.telefono_personal) return Promise.resolve(false);

      // En producción esto enviaría el template, ahora solo simulamos success (return true)
      return new Promise((resolve) => {
        setTimeout(() => {
          // Si quisiéramos probar de verdad, descomentaríamos:
          // resolve(whatsappService.sendTemplate({to: alumno.telefono_personal, templateId: BIRTHDAY_WHATSAPP_TEMPLATE_ID}))
          resolve(true);
        }, 500);
      });
    });

    const resultados = await Promise.allSettled(promesasEnvio);
    const exitosos = resultados.filter((r) => r.status === 'fulfilled' && r.value === true).length;
    logger.info(
      `Simulación concurrente terminada. Éxitos simulados: ${exitosos} / Totales: ${cumpleaneros.length}`
    );
  } catch (error) {
    logger.error('Error probando cumpleaños: ' + error.message);
  } finally {
    await prisma.$disconnect();
    logger.info('--- FIN DE LA PRUEBA ---');
  }
}

probarEnvioCumpleanos();
