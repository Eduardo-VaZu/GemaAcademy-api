import { prisma } from '../../config/database.config.js';
import { ApiError } from '../../shared/utils/error.util.js';

const crearSolicitud = async (alumnoId, { descripcion, urlEvidencia }) => {
    // 1. Validar que no tenga ya una solicitud pendiente
    const existePendiente = await prisma.solicitudes_lesion.findFirst({
        where: {
            alumno_id: parseInt(alumnoId),
            estado: 'PENDIENTE'
        }
    });

    if (existePendiente) {
        throw new ApiError('Ya tienes una solicitud de lesión en proceso de revisión.', 400);
    }

    // 2. Crear la solicitud
    return await prisma.solicitudes_lesion.create({
        data: {
            alumno_id: parseInt(alumnoId),
            descripcion_lesion: descripcion,
            url_evidencia_medica: urlEvidencia,
            estado: 'PENDIENTE',
            fecha_solicitud: new Date()
        }
    });
};

const obtenerMisSolicitudes = async (alumnoId) => {
    return await prisma.solicitudes_lesion.findMany({
        where: { alumno_id: parseInt(alumnoId) },
        orderBy: { fecha_solicitud: 'desc' }
    });
};

const obtenerPendientes = async () => {
    return await prisma.solicitudes_lesion.findMany({
        where: { estado: 'PENDIENTE' },
        include: {
            alumnos: {
                include: {
                    usuarios: {
                        select: {
                            nombres: true,
                            apellidos: true,
                            numero_documento: true
                        }
                    }
                }
            }
        },
        orderBy: { fecha_solicitud: 'asc' }
    });
};

/**
 * LÓGICA CORE: Aprobar/Rechazar y Generar Efectos
 */
const evaluarSolicitud = async ({
    solicitudId,
    estado, // 'APROBADA' | 'RECHAZADA'
    adminId,
    notas,
    tipo, // 'RANGO' | 'INDEFINIDO'
    fechaInicio,
    fechaFin
}) => {
    return await prisma.$transaction(async (tx) => {
        // 1. Buscar la solicitud
        const solicitud = await tx.solicitudes_lesion.findUnique({
            where: { id: parseInt(solicitudId) }
        });

        if (!solicitud || solicitud.estado !== 'PENDIENTE') {
            throw new ApiError('La solicitud no existe o ya fue procesada.', 404);
        }

        // 2. Si es RECHAZADA, solo actualizamos estado y notas
        if (estado === 'RECHAZADA') {
            return await tx.solicitudes_lesion.update({
                where: { id: solicitud.id },
                data: {
                    estado: 'RECHAZADA',
                    revisado_por: parseInt(adminId),
                    notas_admin: notas
                }
            });
        }

        // 3. Lógica APROBADA
        // Necesitamos las inscripciones activas del alumno para saber qué clases justificar
        const inscripcionesActivas = await tx.inscripciones.findMany({
            where: {
                alumno_id: solicitud.alumno_id,
                estado: 'ACTIVO'
            }
        });

        if (!inscripcionesActivas || inscripcionesActivas.length === 0) {
            throw new ApiError('El alumno no tiene ninguna inscripción activa para aplicar la justificación por lesión.', 400);
        }

        // Definir el rango de fechas a afectar
        const inicioRango = new Date(fechaInicio);
        let fechaFinBusquedaGlobal = new Date(inicioRango);

        // A. Crear registros en CONGELAMIENTOS (Uno por cada inscripción activa)
        for (const inscripcion of inscripcionesActivas) {
            let finRangoLocal;

            if (tipo === 'RANGO') {
                if (!fechaFin) throw new ApiError('Fecha fin requerida para RANGO.', 400);
                finRangoLocal = new Date(fechaFin);
            } else {
                finRangoLocal = new Date(inscripcion.fecha_inscripcion);
                finRangoLocal.setDate(finRangoLocal.getDate() + 30);
            }

            // Actualizamos la fecha global de búsqueda para asegurarnos de cubrir el rango más lejano
            if (finRangoLocal > fechaFinBusquedaGlobal) {
                fechaFinBusquedaGlobal = finRangoLocal;
            }

            await tx.congelamientos.create({
                data: {
                    inscripcion_id: inscripcion.id,
                    solicitud_lesion_id: solicitud.id,
                    fecha_inicio: inicioRango,
                    fecha_fin: tipo === 'RANGO' ? finRangoLocal : null, // Dejarlo en null si es INDEFINIDO, ya que no afecta la lógica de momento.
                    estado: 'ACTIVO',
                    dias_reconocidos: 0 // Se puede manejar para ver cuantos dias se estan cubriendo con el congelamiento, pero tampoco es que afecte la lógica.
                }
            });
        }

        // B. Buscar asistencias en ese rango para TODAS las inscripciones
        const idsInscripciones = inscripcionesActivas.map(i => i.id);

        const clasesAfectadas = await tx.registros_asistencia.findMany({
            where: {
                // Usamos 'in' para buscar en cualquiera de sus inscripciones
                inscripcion_id: { in: idsInscripciones },
                fecha: {
                    gte: inicioRango,
                    lte: fechaFinBusquedaGlobal
                },
                estado: { in: ['PROGRAMADA', 'FALTA'] }
            }
        });

        // C. Procesar cada clase afectada
        const recuperacionesProcesadas = [];

        for (const clase of clasesAfectadas) {
            // 1. Actualizar asistencia a JUSTIFICADO_LESION
            await tx.registros_asistencia.update({
                where: { id: clase.id },
                data: {
                    estado: 'JUSTIFICADO_LESION',
                    comentario: `Lesión Aprobada (Solicitud #${solicitud.id})`,
                }
            });

            // 2. Gestionar la Recuperación

            // PASO A: Buscamos si existe CUALQUIER ticket para esa fecha (sin filtrar estado)
            const recuperacionCualquiera = await tx.recuperaciones.findFirst({
                where: {
                    alumno_id: solicitud.alumno_id,
                    fecha_falta: clase.fecha
                }
            });

            if (recuperacionCualquiera) {

                // ESCENARIO 1: Recuperación completada
                if (recuperacionCualquiera.estado === 'COMPLETADA') {
                    console.log(`La falta del ${clase.fecha} ya fue recuperada.`);
                    continue;
                }

                // ESCENARIO 2: Recuperación pendiente o programada
                const recuActualizada = await tx.recuperaciones.update({
                    where: { id: recuperacionCualquiera.id },
                    data: {
                        motivo_falta: 'LESION_JUSTIFICADA',
                        es_por_lesion: true,
                        solicitud_lesion_id: solicitud.id
                    }
                });
                recuperacionesProcesadas.push(recuActualizada);

            } else {
                // ESCENARIO 3: No existe recuperacion en la bd, entonces, se crea
                const nuevaRecu = await tx.recuperaciones.create({
                    data: {
                        alumno_id: solicitud.alumno_id,
                        fecha_falta: clase.fecha,
                        motivo_falta: 'LESION_JUSTIFICADA',
                        es_por_lesion: true,
                        estado: 'PENDIENTE',
                        solicitud_lesion_id: solicitud.id
                    }
                });
                recuperacionesProcesadas.push(nuevaRecu);
            }
        }

        // D. Finalmente, actualizar la solicitud a APROBADA
        const solicitudActualizada = await tx.solicitudes_lesion.update({
            where: { id: solicitud.id },
            data: {
                estado: 'APROBADA',
                revisado_por: parseInt(adminId),
                notas_admin: notas
            }
        });

        return {
            solicitud: solicitudActualizada,
            inscripciones_afectadas: idsInscripciones.length,
            clases_justificadas: clasesAfectadas.length,
            recuperaciones_generadas: recuperacionesProcesadas
        };
    });
};

export const lesionService = {
    crearSolicitud,
    obtenerMisSolicitudes,
    obtenerPendientes,
    evaluarSolicitud
};