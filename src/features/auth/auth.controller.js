import { setAuthCookies } from '../../config/cookie.config.js';
import { authService } from './auth.service.js';
import { catchAsync } from '../../shared/utils/catchAsync.util.js';
import { apiResponse } from '../../shared/utils/response.util.js';
import { ApiError } from '../../shared/utils/error.util.js';
import { logger } from '../../shared/utils/logger.util.js';

export const authController = {
  /**
   * Inicia sesión validando credenciales y estableciendo cookies.
   */
  login: catchAsync(async (req, res) => {
    const { username, password } = req.body;

    const result = await authService.login({ username, password });

    setAuthCookies(res, result);

    logger.info(`Usuario '${username}' inició sesión desde la IP: ${req.ip}`);

    return apiResponse.success(res, {
      message: 'Login exitoso',
      data: result,
    });
  }),
  /**
   * Obtiene el perfil completo del usuario autenticado.
   */
  getProfile: catchAsync(async (req, res) => {
    const profile = await authService.getProfile(req.user.id);

    return apiResponse.success(res, {
      message: 'Perfil obtenido exitosamente',
      data: profile,
    });
  }),
  /**
   * Renueva el Access Token utilizando el Refresh Token almacenado en cookies.
   */
  refresh: catchAsync(async (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      logger.warn(`Intento de refresh sin token desde la IP: ${req.ip}`);
      throw new ApiError('Refresh token es requerido', 401);
    }

    if (typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
      logger.warn(`Intento de refresh con token malformado IP: ${req.ip}`);
      throw new ApiError('Refresh token inválido', 401);
    }

    const result = await authService.refreshAccessToken(refreshToken);

    setAuthCookies(res, result);

    return apiResponse.success(res, {
      message: 'Access token renovado',
      data: result.user,
    });
  }),
  /**
   * Cierra la sesión activa del dispositivo actual e invalida el token.
   */
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

    // Auditoría (Si queremos saber si el ID está en el payload o solo es general)
    logger.info(`Sesión cerrada desde IP: ${req.ip}`);

    return apiResponse.success(res, {
      message: 'Sesión cerrada exitosamente',
    });
  }),
  /**
   * Revoca todas las sesiones activas del usuario en todos los dispositivos.
   */
  revokeAllSessions: catchAsync(async (req, res) => {
    await authService.revokeAllTokens(req.user.id);

    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });

    logger.info(`Usuario ID '${req.user.id}' ha revocado globalmente todas sus sesiones.`);

    return apiResponse.success(res, {
      message: 'Todas las sesiones cerradas exitosamente',
    });
  }),
  /**
   * Permite actualizar el email de un usuario tras su primer inicio de sesión.
   */
  completarEmail: catchAsync(async (req, res) => {
    const { email } = req.body;
    const usuarioId = req.user.id;

    const usuarioActualizado = await authService.actualizarEmailPrimerLogin(usuarioId, email);

    return apiResponse.success(res, 'Email actualizado correctamente', {
      user: usuarioActualizado,
    });
  }),
  /**
   * Solicita el envío de un correo de recuperación de contraseña.
   */
  forgotPassword: catchAsync(async (req, res) => {
    const { username } = req.body;

    await authService.forgotPassword(username);

    logger.info(`Solicitud temporal de reseteo de clave generada para username: '${username}'`);

    return apiResponse.success(res, {
      message: 'Enlace enviado al correo registrado del usuario',
    });
  }),
  /**
   * Restablece la contraseña utilizando el token temporal enviado por correo.
   */
  resetPassword: catchAsync(async (req, res) => {
    const { token, newPassword } = req.body;

    await authService.resetPassword(token, newPassword);

    logger.info(`Contraseña actualizada exitosamente vía token de recuperación.`);

    return apiResponse.success(res, { message: 'Contraseña actualizada con éxito' });
  }),
};
