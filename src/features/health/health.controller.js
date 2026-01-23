
import { prisma } from '../../config/database.js';

export const healthController = {
    healthCheck: async (req, res) => {
        try {
            await prisma.$queryRaw`SELECT 1`;

            res.json({
                status: 'ok',
                database: 'connected',
                message: 'Gema Academy API is running',
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            console.error('❌ Database connection error:', error);
            res.status(500).json({
                status: 'error',
                database: 'disconnected',
                message: error.message,
                timestamp: new Date().toISOString(),
            });
        }
    }
}
