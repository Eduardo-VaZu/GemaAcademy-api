import { recuperacionService } from './recuperacion.service.js';
import { catchAsync } from '../../shared/utils/catchAsync.util.js';
import { apiResponse } from '../../shared/utils/response.util.js';
import { ApiError } from '../../shared/utils/error.util.js';

const obtenerPendientes = catchAsync(async (req, res) => {
    const { id: alumnoId } = req.user; // Asumiendo que el ID viene del token JWT
    const pendientes = await recuperacionService.obtenerPendientes(alumnoId);
    return apiResponse.success(res, { data: pendientes, message: 'Recuperaciones pendientes obtenidas.' });
});

const validarElegibilidad = catchAsync(async (req, res) => {
    const { id: usuarioId } = req.user;
    const { fechaFalta, fechaProgramada } = req.body;

    if (!fechaFalta || !fechaProgramada) {
        throw new ApiError('Faltan datos requeridos: fechaFalta y fechaProgramada.', 400);
    }

    await recuperacionService.validarElegibilidad(
        usuarioId,
        fechaFalta,
        fechaProgramada
    );

    //elegible en true para poder permitir al front mostrar algun button que permita le recuperacion de una falta.
    return apiResponse.success(res, { data: { elegible: true }, message: 'El alumno cumple los requisitos para recuperar.' });
});

const agendarRecuperacion = catchAsync(async (req, res) => {
    const { id: usuarioId } = req.user;
    const { fechaFalta, horarioDestinoId, fechaProgramada } = req.body;

    if (!fechaFalta || !horarioDestinoId || !fechaProgramada) {
        throw new ApiError('Faltan datos obligatorios (fechaFalta, horarioDestinoId, fechaProgramada)', 400);
    }

    const recuperacionActualizada = await recuperacionService.agendarRecuperacion({
        alumnoId: usuarioId,
        fechaFalta,
        horarioDestinoId,
        fechaProgramada
    });

    return apiResponse.created(res, { data: recuperacionActualizada, message: 'Recuperación agendada con éxito.' });
});

const cancelarRecuperacion = catchAsync(async (req, res) => {
    const { id: usuarioId } = req.user;
    const { recuperacionId } = req.params;
    if (!recuperacionId) {
        throw new ApiError('Falta el ID de la recuperación a cancelar.', 400);
    }

    await recuperacionService.cancelarRecuperacion(usuarioId, recuperacionId);
    return apiResponse.success(res, { message: 'Recuperación cancelada exitosamente.' });
});

const obtenerHistorial = catchAsync(async (req, res) => {
    const { id: usuarioId } = req.user;
    const historial = await recuperacionService.obtenerHistorial(usuarioId);
    return apiResponse.success(res, { data: historial, message: 'Historial de recuperaciones obtenido.' });
});

export const recuperacionController = {
    obtenerPendientes,
    validarElegibilidad,
    agendarRecuperacion,
    cancelarRecuperacion,
    obtenerHistorial,
};