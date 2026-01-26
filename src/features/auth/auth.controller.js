import { NODE_ENV } from '../../config/secret.config.js';
import { authService } from './auth.service.js';

export const authController = {
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          status: 'error',
          message: 'Email y contraseña son requeridos',
        });
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

      res.json({
        status: 'success',
        message: 'Login exitoso',
        data: result.user,
      });
    } catch (error) {
      const errorMessage = ['Credenciales inválidas', 'Usuario inactivo', 'sin credenciales'];
      if (errorMessage.some((message) => error.message.includes(message))) {
        return res.status(401).json({
          status: 'error',
          message: 'Credenciales inválidas',
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Error al iniciar sesión',
        detail: error.message,
      });
    }
  },

  getProfile: async (req, res) => {
    try {
      const profile = await authService.getProfile(req.user.id);

      res.json({
        status: 'success',
        data: profile,
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Error al obtener perfil',
        detail: error.message,
      });
    }
  },

  refresh: async (req, res) => {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          status: 'error',
          message: 'Refresh token es requerido',
          code: 'REFRESH_TOKEN_REQUIRED',
        });
      }

      if (typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
        return res.status(401).json({
          status: 'error',
          message: 'Refresh token inválido',
          code: 'REFRESH_TOKEN_INVALID',
        });
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

      res.json({
        status: 'success',
        message: 'Access token renovado',
        data: result.user,
      });
    } catch (error) {
      const errorMessages = [
        'inválido',
        'revocado',
        'expirado',
        'comprometido',
        'inactivo',
        'bloqueada',
      ];
      if (errorMessages.some((message) => error.message.includes(message))) {
        return res.status(401).json({
          status: 'error',
          message: error.message,
          code: 'REFRESH_TOKEN_INVALID',
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Error al renovar token',
        detail: error.message,
      });
    }
  },

  logout: async (req, res) => {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          status: 'error',
          message: 'Refresh token es requerido',
          code: 'REFRESH_TOKEN_REQUIRED',
        });
      }

      if (typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
        return res.status(401).json({
          status: 'error',
          message: 'Refresh token inválido',
          code: 'REFRESH_TOKEN_INVALID',
        });
      }

      await authService.logout(refreshToken);

      res.clearCookie('accessToken', {
        path: '/',
      });
      res.clearCookie('refreshToken', {
        path: '/',
      });

      res.json({
        status: 'success',
        message: 'Sesión cerrada exitosamente',
      });
    } catch (error) {
      if (error.message.includes('no encontrado')) {
        return res.status(404).json({
          status: 'error',
          message: error.message,
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Error al cerrar sesión',
        detail: error.message,
      });
    }
  },

  revokeAllSessions: async (req, res) => {
    try {
      await authService.revokeAllSessions(req.user.id);

      res.clearCookie('accessToken', {
        path: '/',
      });
      res.clearCookie('refreshToken', {
        path: '/',
      });

      res.json({
        status: 'success',
        message: 'Todas las sesiones cerradas exitosamente',
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Error al cerrar todas las sesiones',
        detail: error.message,
      });
    }
  },
};
