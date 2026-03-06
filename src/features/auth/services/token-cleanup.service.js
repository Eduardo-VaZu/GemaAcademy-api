import { prisma } from '../../../config/database.config.js';
import { logger } from '../../../shared/utils/logger.util.js';

export const tokenCleanupService = {
  /**
   * Limpia los tokens permanentemente expirados o revocados hace más de 7 días.
   */
  cleanupExpiredTokens: async () => {
    try {
      const expiredTokens = await prisma.refresh_tokens.deleteMany({
        where: {
          OR: [
            {
              expires_at: {
                lt: new Date(),
              },
            },
            {
              revoked: true,
              created_at: {
                lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 días retroactivos
              },
            },
          ],
        },
      });
      logger.info(`Tokens expirados eliminados: ${expiredTokens.count}`);
    } catch (error) {
      logger.error('Error al limpiar tokens expirados:', error);
    }
  },

  /**
   * Inicia el proceso planificado de limpieza. Se ejecuta una vez de inmediato y luego cada 24 horas asíncronamente.
   */
  scheduleTokenCleanup: () => {
    logger.info('Cron interno de limpieza de tokens activado...');

    tokenCleanupService.cleanupExpiredTokens();

    const intervaloDiaMs = 24 * 60 * 60 * 1000; // 24 horas

    const runSchedule = () => {
      setTimeout(async () => {
        await tokenCleanupService.cleanupExpiredTokens();
        runSchedule();
      }, intervaloDiaMs);
    };

    runSchedule();
  },
};
