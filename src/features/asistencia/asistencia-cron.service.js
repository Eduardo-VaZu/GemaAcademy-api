import { prisma } from '../../config/database.config.js';
import { logger } from '../../shared/utils/logger.util.js';

class AsistenciaCronService {
    async sinRegistroAsistencias() {
        const dia0 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

        const registrosActualizados = await prisma.registros_asistencia.updateMany({
            where: {
                estado: 'PROGRAMADA',
                fecha_clase: {
                    lte: new Date(),
                },
                inscripciones: {
                    fecha_inscripcion: {
                        lte: dia0,
                    }
                }
            },
            data: {
                estado: 'SIN_REGISTRO',
            }
        });

        if (registrosActualizados.count > 0) {
            logger.info(`Se actualizaron ${registrosActualizados.count} registros como SIN REGISTRO.`);
        }
    };
}

export const asistenciaCronService = new AsistenciaCronService();