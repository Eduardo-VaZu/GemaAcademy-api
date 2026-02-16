import { setAuthCookies } from '../../config/cookie.config.js';
import { authService } from './auth.service.js';
import { catchAsync } from '../../shared/utils/catchAsync.util.js';
import { apiResponse } from '../../shared/utils/response.util.js';
import { ApiError } from '../../shared/utils/error.util.js';
//import { sendPasswordRecoveryEmail } from '../../shared/utils/mailer.js';
import jwt from 'jsonwebtoken'; 
import { JWT_SECRET } from '../../config/secret.config.js';

export const authController = {
  login: catchAsync(async (req, res) => {
    const { username, password } = req.body;

    const result = await authService.login({ username, password });

    setAuthCookies(res, result);

    return apiResponse.success(res, {
      message: 'Login exitoso',
      data: result,
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

  forgotPassword: catchAsync(async (req, res) => {
    const { username } = req.body;
    const user = await authService.findUserByUsername(username);

    if (!user || !user.email) {
      throw new ApiError('Usuario no encontrado o no tiene correo asociado', 404);
    }

    const resetToken = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });

    //await sendPasswordRecoveryEmail(user.email, user.nombres, resetToken);

    return apiResponse.success(res, {
      message: 'Enlace enviado al correo registrado del usuario'
    });
  }),

  resetPassword: catchAsync(async (req, res) => {
    const { token, newPassword } = req.body;

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      await authService.updatePassword(decoded.id, newPassword);

      return apiResponse.success(res, { message: 'Contraseña actualizada con éxito' });
    } catch (error) {
      console.error("DETALLE ERROR RESET:", error.message);
      throw new ApiError('El enlace es inválido o ha expirado', 400);
    }
  }),
};
