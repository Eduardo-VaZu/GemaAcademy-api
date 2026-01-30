import { NODE_ENV } from '../../config/secret.config.js';
import { authService } from './auth.service.js';
import { catchAsync } from '../../shared/utils/catchAsync.util.js';
import { apiResponse } from '../../shared/utils/response.util.js';
import { ApiError } from '../../shared/utils/error.util.js';

export const authController = {
  login: catchAsync(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ApiError('Email y contraseña son requeridos', 400);
    }

    const result = await authService.login(email, password);

    const cookiesOption = {
      httpOnly: true,
      secure: NODE_ENV === 'production',
      sameSite: NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/',
    };

    res.cookie('accessToken', result.accessToken, {
      ...cookiesOption,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', result.refreshToken, {
      ...cookiesOption,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return apiResponse.success(res, {
      message: 'Login exitoso',
      data: result.user,
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

    const cookieOptions = {
      httpOnly: true,
      secure: NODE_ENV === 'production',
      sameSite: NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/',
    };

    res.cookie('accessToken', result.accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', result.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

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

    res.clearCookie('accessToken', {
      path: '/',
    });
    res.clearCookie('refreshToken', {
      path: '/',
    });

    return apiResponse.success(res, {
      message: 'Sesión cerrada exitosamente',
    });
  }),

  revokeAllSessions: catchAsync(async (req, res) => {
    await authService.revokeAllSessions(req.user.id);

    res.clearCookie('accessToken', {
      path: '/',
    });
    res.clearCookie('refreshToken', {
      path: '/',
    });

    return apiResponse.success(res, {
      message: 'Todas las sesiones cerradas exitosamente',
    });
  }),
};
