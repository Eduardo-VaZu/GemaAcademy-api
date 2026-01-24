import { authService } from './auth.service.js';

export const authController = {

  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          status: 'error',
          message: 'Email y contraseña son requeridos'
        });
      }

      const result = await authService.login(email, password);

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
      });

      res.json({
        status: 'success',
        message: 'Login exitoso',
        data: {
          accessToken: result.accessToken,
          user: result.user.id
        }
      });

    } catch (error) {
      if (error.message.includes('Credenciales inválidas') ||
        error.message.includes('Usuario inactivo')) {
        return res.status(401).json({
          status: 'error',
          message: error.message
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Error al iniciar sesión',
        detail: error.message
      });
    }
  },

  getProfile: async (req, res) => {
    try {
      const profile = await authService.getProfile(req.user.id);

      const { nombre, apellido, email, rol, fecha_nacimiento } = profile;

      res.json({
        status: 'success',
        data: {
          nombre,
          apellido,
          email,
          rol,
          fecha_nacimiento
        }
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Error al obtener perfil',
        detail: error.message
      });
    }
  },

  refresh: async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          status: 'error',
          message: 'Refresh token es requerido'
        });
      }

      const result = await authService.refreshAccessToken(refreshToken);

      res.json({
        status: 'success',
        message: 'Access token renovado',
        data: result
      });
    } catch (error) {
      if (error.message.includes('inválido') ||
        error.message.includes('revocado') ||
        error.message.includes('expirado')) {
        return res.status(401).json({
          status: 'error',
          message: error.message
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Error al renovar token',
        detail: error.message
      });
    }
  },

  logout: async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          status: 'error',
          message: 'Refresh token es requerido'
        });
      }

      await authService.logout(refreshToken);

      res.clearCookie('accessToken', {
        path: '/'
      });
      res.clearCookie('refreshToken', {
        path: '/'
      });

      res.json({
        status: 'success',
        message: 'Sesión cerrada exitosamente'
      });
    } catch (error) {
      if (error.message.includes('no encontrado')) {
        return res.status(404).json({
          status: 'error',
          message: error.message
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Error al cerrar sesión',
        detail: error.message
      });
    }
  }
};
