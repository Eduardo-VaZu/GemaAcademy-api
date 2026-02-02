import { prisma } from '../../config/database.config.js';
import { ApiError } from '../../shared/utils/error.util.js';

/**
 * Valida TODAS las reglas de negocio antes de permitir una recuperación.
 */
const validarElegibilidad = async (alumnoId, fechaFalta, fechaProgramada) => {
    const fechaFaltaDate = new Date(fechaFalta);
    const fechaProgramadaDate = new Date(fechaProgramada);

    const inscripcion = await prisma.inscripciones.findFirst({
        where: {
            alumno_id: parseInt(alumnoId),
            estado: 'ACTIVO',
        },
        orderBy: {
            fecha_inscripcion: 'asc',
        },
    });

    if (!inscripcion) {
        throw new ApiError('No tienes una inscripción activa.', 403);
    }

    const inicioInscripcion = new Date(inscripcion.fecha_inscripcion);

    // ---------------------------------------------------------
    // 1. VALIDACIÓN DE PLAN (Mínimo 2 veces por semana)
    // ---------------------------------------------------------
    const cantidadClasesInscritas = await prisma.inscripciones.count({
        where: {
            alumno_id: parseInt(alumnoId),
            estado: 'ACTIVO',
        },
    });

    if (cantidadClasesInscritas < 2) {
        throw new ApiError(
            'Tu plan actual no incluye el beneficio de recuperaciones.',
            403
        );
    }

    // ---------------------------------------------------------
    // 2. CÁLCULO DEL CICLO DE LA FALTA
    // ---------------------------------------------------------

    // Calculamos a qué ciclo pertenece la falta
    const diffFalta = fechaFaltaDate - inicioInscripcion;
    const diasTranscurridosFalta = Math.floor(diffFalta / (1000 * 60 * 60 * 24));

    if (diasTranscurridosFalta < 0) {
        throw new ApiError('La fecha de la falta es anterior a tu inscripción.', 400);
    }

    const numeroBloqueFalta = Math.floor(diasTranscurridosFalta / 30);

    // Inicio y Fin del ciclo donde ocurrió la falta
    const inicioCicloFalta = new Date(inicioInscripcion);
    inicioCicloFalta.setUTCDate(inicioInscripcion.getUTCDate() + (numeroBloqueFalta * 30));

    const finCicloFalta = new Date(inicioInscripcion);
    finCicloFalta.setUTCDate(inicioInscripcion.getUTCDate() + ((numeroBloqueFalta + 1) * 30));

    // ---------------------------------------------------------
    // 3. VALIDACIÓN DE VIGENCIA (Fin del ciclo de falta + 30 días)
    // ---------------------------------------------------------

    const fechaLimiteValida = new Date(finCicloFalta);
    fechaLimiteValida.setUTCDate(finCicloFalta.getUTCDate() + 30);

    if (fechaProgramadaDate > fechaLimiteValida) {
        throw new ApiError(
            'La vigencia para recuperar esta falta ha expirado.',
            400
        );
    }

    // ---------------------------------------------------------
    // 4. VALIDACIÓN DE DUPLICIDAD
    // ---------------------------------------------------------

    const faltaYaUsada = await prisma.recuperaciones.findFirst({
        where: {
            alumno_id: parseInt(alumnoId),
            fecha_falta: fechaFaltaDate,
            estado: { not: 'CANCELADO' }
        }
    });

    if (faltaYaUsada) {
        throw new ApiError(
            'Ya has programado una recuperación para esta falta anteriormente.',
            409
        );
    }

    // ---------------------------------------------------------
    // 5. VALIDACIÓN DE TOPE DE CUPOS
    // ---------------------------------------------------------
    const recuperacionesEnCiclo = await prisma.recuperaciones.count({
        where: {
            alumno_id: parseInt(alumnoId),
            es_por_lesion: false,
            fecha_falta: {
                gte: inicioCicloFalta,
                lt: finCicloFalta,
            },
            estado: { not: 'CANCELADO' },
        },
    });

    let limitePermitido = 2;
    if (cantidadClasesInscritas >= 4) {
        limitePermitido = 4;
    }

    if (recuperacionesEnCiclo >= limitePermitido) {
        throw new ApiError(
            `Has alcanzado tu límite de ${limitePermitido} recuperaciones.`,
            400
        );
    }

    return true;
};

/**
 * Crea el registro de recuperación tras pasar validaciones y chequear aforo.
 */
const crearRecuperacion = async ({
    alumnoId,
    fechaFalta,
    horarioDestinoId,
    fechaProgramada,
}) => {
    // 1. Re-validar reglas de negocio (Doble check de seguridad)
    await validarElegibilidad(alumnoId, fechaFalta, fechaProgramada);

    // 2. VALIDACIÓN DE AFORO
    // Necesitamos saber si cabe un alumno más en esa clase específica
    const horarioDestino = await prisma.horarios_clases.findUnique({
        where: { id: parseInt(horarioDestinoId) },
    });

    if (!horarioDestino) {
        throw new ApiError('El horario seleccionado no existe.', 404);
    }

    // A. Contar inscritos fijos en ese horario
    const inscritosFijos = await prisma.inscripciones.count({
        where: {
            horario_id: parseInt(horarioDestinoId),
            estado: 'ACTIVO',
        },
    });

    // B. Contar recuperaciones agendadas para ESA fecha específica
    const recuperacionesEseDia = await prisma.recuperaciones.count({
        where: {
            horario_destino_id: parseInt(horarioDestinoId),
            fecha_programada: new Date(fechaProgramada),
            estado: { not: 'CANCELADO' },
        },
    });

    const ocupacionTotal = inscritosFijos + recuperacionesEseDia;

    if (ocupacionTotal >= horarioDestino.capacidad_max) {
        throw new ApiError(
            'Lo sentimos, este horario ya no tiene cupos disponibles para la fecha seleccionada.',
            409
        );
    }

    // 3. Crear el registro
    const nuevaRecuperacion = await prisma.recuperaciones.create({
        data: {
            alumno_id: parseInt(alumnoId),
            fecha_falta: new Date(fechaFalta),
            motivo_falta: 'PERSONAL', // Valor por defecto flujo normal
            horario_destino_id: parseInt(horarioDestinoId),
            fecha_programada: new Date(fechaProgramada),
            es_por_lesion: false,
            estado: 'PROGRAMADA',
        },
    });

    return nuevaRecuperacion;
};

// Exportamos el objeto con las funciones
export const recuperacionService = {
    validarElegibilidad,
    crearRecuperacion
};