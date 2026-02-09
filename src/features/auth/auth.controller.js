import { setAuthCookies } from '../../config/cookie.config.js';
import { authService } from './auth.service.js';
import { catchAsync } from '../../shared/utils/catchAsync.util.js';
import { apiResponse } from '../../shared/utils/response.util.js';
import { ApiError } from '../../shared/utils/error.util.js';

export const authController = {
  login: catchAsync(async (req, res) => {
    const { email, numero_documento, password } = req.body;

    const result = await authService.login({ email, numero_documento, password });

    setAuthCookies(res, result);

    return apiResponse.success(res, {
      message: 'Login exitoso',
      data: {
        user: result.user
      }
    });
  }),

  getProfile: catchAsync(async (req, res) => {
    const profile = await authService.getProfile(req.user.id);

    return apiResponse.success(res, {
      message: 'Perfil obtenido exitosamente',
      data: profile,
    });
  }),

  refresh: catchAsync(async (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      throw new ApiError('Refresh token es requerido', 401);
    }

    if (typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
      throw new ApiError('Refresh token inválido', 401);
    }

    const result = await authService.refreshAccessToken(refreshToken);

    setAuthCookies(res, result);

    return apiResponse.success(res, {
      message: 'Access token renovado',
      data: result.user,
    });
  }),

  logout: catchAsync(async (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      throw new ApiError('Refresh token es requerido', 401);
    }

    if (typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
      throw new ApiError('Refresh token inválido', 401);
    }

    await authService.logout(refreshToken);

    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });

    return apiResponse.success(res, {
      message: 'Sesión cerrada exitosamente',
    });
  }),

  revokeAllSessions: catchAsync(async (req, res) => {
    await authService.revokeAllTokens(req.user.id);

    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });

    return apiResponse.success(res, {
      message: 'Todas las sesiones cerradas exitosamente',
    });
  }),

  completarEmail: catchAsync(async (req, res) => {
    const { email } = req.body;
    const usuarioId = req.user.id;

    const usuarioActualizado = await authService.actualizarEmailPrimerLogin(usuarioId, email);

    return apiResponse.success(res, 'Email actualizado correctamente', {
      user: usuarioActualizado
    });
  }),
};
