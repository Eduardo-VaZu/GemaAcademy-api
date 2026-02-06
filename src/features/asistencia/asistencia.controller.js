import { asistenciaService } from './asistencia.service.js';
import { catchAsync } from '../../shared/utils/catchAsync.util.js';
import { apiResponse } from '../../shared/utils/response.util.js';
import { ApiError } from '../../shared/utils/error.util.js';

const marcarAsistencia = catchAsync(async (req, res) => {
    // 1. Obtener datos de la petición
    const { id } = req.params;
    const { estado, comentario } = req.body;

    // 2. Validación básica
    if (!id) {
        throw new ApiError('El ID de la asistencia es requerido.', 400);
    }

    // Validamos que el estado sea uno de los permitidos)
    const estadosValidos = ['PRESENTE', 'FALTA', 'PROGRAMADA'];
    if (estado && !estadosValidos.includes(estado)) {
        throw new ApiError(`Estado inválido. Valores permitidos: ${estadosValidos.join(', ')}`, 400);
    }

    // 3. Llamar al servicio
    const asistenciaActualizada = await asistenciaService.marcarAsistencia(
        id,
        estado,
        comentario
    );

    // 4. Responder
    return apiResponse(
        res,
        asistenciaActualizada,
        `Asistencia marcada como ${estado} correctamente.`,
        200
    );
});

export const asistenciaController = {
    marcarAsistencia
};