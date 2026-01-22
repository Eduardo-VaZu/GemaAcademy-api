import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../../config.js';

/**
 * Middleware de autenticación JWT
 * Verifica que el token sea válido y adjunta la información del usuario a req.user
 */
export const authenticate = async (req, res, next) => {
  try {
    // Obtener el token del header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'No se proporcionó token de autenticación'
      });
    }

    // Extraer el token (formato: "Bearer <token>")
    const token = authHeader.substring(7);

    // Verificar y decodificar el token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Adjuntar información del usuario al request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      rol_id: decoded.rol_id,
      rol_nombre: decoded.rol_nombre
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'Token inválido'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'Token expirado'
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Error al verificar token',
      detail: error.message
    });
  }
};
