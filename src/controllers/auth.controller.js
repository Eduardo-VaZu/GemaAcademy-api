import { authService } from '../services/auth.service.js';

export const authController = {
  /**
   * POST /api/auth/register
   * Registrar un nuevo usuario
   */
  register: async (req, res) => {
    try {
      const usuario = await authService.register(req.body);
      
      res.status(201).json({
        status: 'success',
        message: 'Usuario registrado exitosamente',
        data: usuario
      });
    } catch (error) {
      // Errores de validación o duplicados
      if (error.message.includes('ya está registrado')) {
        return res.status(400).json({
          status: 'error',
          message: error.message
        });
      }

      // Error de Prisma por violación de constraint
      if (error.code === 'P2002') {
        return res.status(400).json({
          status: 'error',
          message: 'El email ya está registrado'
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Error al registrar usuario',
        detail: error.message
      });
    }
  },

  /**
   * POST /api/auth/login
   * Iniciar sesión
   */
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

      res.json({
        status: 'success',
        message: 'Login exitoso',
        data: result
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

  /**
   * GET /api/auth/profile
   * Obtener perfil del usuario autenticado
   * Requiere autenticación (middleware authenticate)
   */
  getProfile: async (req, res) => {
    try {
      const profile = await authService.getProfile(req.user.id);

      res.json({
        status: 'success',
        data: profile
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Error al obtener perfil',
        detail: error.message
      });
    }
  },

  /**
   * POST /api/auth/refresh
   * Renovar access token usando refresh token
   */
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

  /**
   * POST /api/auth/logout
   * Cerrar sesión (logout real con revocación de refresh token)
   */
  logout: async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          status: 'error',
          message: 'Refresh token es requerido'
        });
      }

      const result = await authService.logout(refreshToken);

      res.json({
        status: 'success',
        message: result.message
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
