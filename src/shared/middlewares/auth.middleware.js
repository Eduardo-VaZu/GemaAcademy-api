import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/secret.config.js';
import { prisma } from '../../config/database.config.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken;

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'No se proporcionó token de autenticación',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const usuario = await prisma.usuarios.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        activo: true,
        credenciales_usuario: {
          select: { bloqueado: true },
        },
        roles: {
          select: { id: true, nombre: true },
        },
      },
    });

    if (!usuario) {
      return res.status(401).json({
        status: 'error',
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND',
      });
    }

    if (!usuario.activo) {
      return res.status(401).json({
        status: 'error',
        message: 'Usuario inactivo',
        code: 'USER_INACTIVE',
      });
    }

    if (usuario.credenciales_usuario?.bloqueado) {
      return res.status(403).json({
        status: 'error',
        message: 'Cuenta bloqueada. Contacta al administrador.',
        code: 'ACCOUNT_BLOCKED',
      });
    }

    req.user = {
      id: usuario.id,
      email: usuario.email,
      rol_id: usuario.roles.id,
      rol_nombre: usuario.roles.nombre,
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'Token inválido',
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'Token expirado',
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Error al verificar token',
      detail: error.message,
    });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken;

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const usuario = await prisma.usuarios.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        activo: true,
        credenciales_usuario: {
          select: { bloqueado: true },
        },
        roles: {
          select: { id: true, nombre: true },
        },
      },
    });

    if (usuario && usuario.activo && !usuario.credenciales_usuario?.bloqueado) {
      req.user = {
        id: decoded.id,
        email: decoded.email,
        rol_id: decoded.rol_id,
        rol_nombre: usuario.roles.nombre,
      };
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    req.user = error || null;
    next();
  }
};
