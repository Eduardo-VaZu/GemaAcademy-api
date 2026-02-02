import { recuperacionService } from './recuperacion.service.js';
import { catchAsync } from '../../shared/utils/catchAsync.util.js';
import { successResponse } from '../../shared/utils/response.util.js';
import { AppError } from '../../shared/utils/error.util.js';

const validarElegibilidad = catchAsync(async (req, res) => {
    const { id: usuarioId } = req.user;
    const { fechaFalta, fechaProgramada } = req.body;

    if (!fechaFalta || !fechaProgramada) {
        throw new AppError('Faltan datos requeridos: fechaFalta y fechaProgramada.', 400);
    }

    await recuperacionService.validarElegibilidad(
        usuarioId,
        fechaFalta,
        fechaProgramada
    );

    //elegible en true para poder permitir al front mostrar algun button que permita le recuperacion de una falta.
    return successResponse(res, { elegible: true }, 'El alumno cumple los requisitos para recuperar.');
});

const crearRecuperacion = catchAsync(async (req, res) => {
    const { id: usuarioId } = req.user;
    const { fechaFalta, horarioDestinoId, fechaProgramada } = req.body;

    if (!fechaFalta || !horarioDestinoId || !fechaProgramada) {
        throw new AppError('Faltan datos obligatorios (fechaFalta, horarioDestinoId, fechaProgramada)', 400);
    }

    const nuevaRecuperacion = await recuperacionService.crearRecuperacion({
        alumnoId: usuarioId,
        fechaFalta,
        horarioDestinoId,
        fechaProgramada
    });

    return successResponse(res, nuevaRecuperacion, 'Recuperación agendada con éxito.', 201);
});

export const recuperacionController = {
    validarElegibilidad,
    crearRecuperacion
};