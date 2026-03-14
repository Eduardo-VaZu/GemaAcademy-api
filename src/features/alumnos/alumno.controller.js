import { alumnoService } from './alumno.service.js';
import { apiResponse } from '../../shared/utils/response.util.js';
import { catchAsync } from '../../shared/utils/catchAsync.util.js';

export const alumnoController = {
  actualizarMiPerfil: catchAsync(async (req, res) => {
    const resultado = await alumnoService.actualizarMiPerfil(req.user.id, req.body);
    return apiResponse.success(res, {
      message: '¡Perfil actualizado correctamente!',
      data: resultado,
    });
  }),
  obtenerMiPerfil: catchAsync(async (req, res) => {
  const perfil = await alumnoService.obtenerMiPerfil(req.user.id);
  return apiResponse.success(res, {
    message: 'Perfil cargado',
    data: perfil,
  });
}),

listarAlumnosResumen: catchAsync(async (req, res) => {
    const data = await alumnoService.listarAlumnosResumen();
    return apiResponse.success(res, {
      message: 'Lista de alumnos para gestión de cortes cargada',
      data: data,
    });
  }),
};
