import { asistenciaService } from './asistencia.service.js';
import { catchAsync } from '../../shared/utils/catchAsync.util.js';
import { apiResponse } from '../../shared/utils/response.util.js';
import { ApiError } from '../../shared/utils/error.util.js';

// 1. Marcar o actualizar una asistencia específica
const marcarAsistencia = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { estado, comentario } = req.body;

    if (!id) {
        throw new ApiError('El ID de la asistencia es requerido.', 400);
    }

    const estadosValidos = ['PRESENTE', 'FALTA', 'PROGRAMADA'];
    if (estado && !estadosValidos.includes(estado)) {
        throw new ApiError(`Estado inválido. Valores permitidos: ${estadosValidos.join(', ')}`, 400);
    }

    const asistenciaActualizada = await asistenciaService.marcarAsistencia(
        id,
        estado,
        comentario
    );

    return apiResponse(
        res,
        asistenciaActualizada,
        `Asistencia marcada como ${estado} correctamente.`,
        200
    );
});

// ======================================================
// 🆕 TUS FUNCIONES CORREGIDAS (Usando apiResponse.success)
// ======================================================

const listarPorAlumno = catchAsync(async (req, res) => {
    const { alumnoId } = req.params;
    
    if (!alumnoId) throw new ApiError('El ID del alumno es requerido.', 400);

    const asistencias = await asistenciaService.obtenerPorAlumno(alumnoId);

    // ✅ Llamada correcta a tu clase estática
    return apiResponse.success(res, { 
        data: asistencias, 
        message: 'Asistencias del alumno recuperadas.' 
    });
});

const listarTodas = catchAsync(async (req, res) => {
    const asistencias = await asistenciaService.obtenerTodas();

    // ✅ Llamada correcta a tu clase estática
    return apiResponse.success(res, { 
        data: asistencias, 
        message: 'Listado general de asistencias.' 
    });
});

export const asistenciaController = {
    marcarAsistencia,
    listarPorAlumno,
    listarTodas
};