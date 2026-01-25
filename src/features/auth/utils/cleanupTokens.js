import { prisma } from '../../../config/database.config.js';

export const cleanupExpiredTokens = async () => {
  try {
    const expiredTokens = await prisma.refreshToken.deleteMany({
      where: {
        or: [
          {
            expiresAt: {
              lt: new Date(),
            },
          },
          {
            revoked: true,
            createdAt: {
              lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 días en milisegundos
            },
          },
        ],
      },
    });
    console.log(`Tokens expirados eliminados: ${expiredTokens.count}`);
  } catch (error) {
    console.error('Error al limpiar tokens expirados:', error);
  }
};

export const scheduleTokenCleanup = () => {
  setInterval(
    async () => {
      await cleanupExpiredTokens();
    },
    24 * 60 * 60 * 1000
  );

  cleanupExpiredTokens();
};
