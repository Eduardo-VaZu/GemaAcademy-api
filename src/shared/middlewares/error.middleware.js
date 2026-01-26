import { ApiResponse } from '../utils/response.util.js';

export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Error personalizado
  if (err.statusCode) {
    return ApiResponse.error(res, {
      statusCode: err.statusCode,
      message: err.message,
      details: err.details,
    });
  }

  // Errores de Prisma
  if (err.code) {
    if (err.code === 'P2002') {
      return ApiResponse.error(res, {
        statusCode: 400,
        message: 'El registro ya existe',
        details: err.meta,
      });
    }
    if (err.code === 'P2025') {
      return ApiResponse.error(res, {
        statusCode: 404,
        message: 'Registro no encontrado',
      });
    }
    if (err.code === 'P2003') {
      return ApiResponse.error(res, {
        statusCode: 400,
        message: 'Operación inválida: referencia a datos no existentes',
      });
    }
  }

  if (err.name === 'JsonWebTokenError') {
    return ApiResponse.error(res, {
      statusCode: 401,
      message: 'Token inválido',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return ApiResponse.error(res, {
      statusCode: 401,
      message: 'Token expirado',
    });
  }

  // Error genérico
  return ApiResponse.error(res, {
    statusCode: 500,
    message: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message,
  });
};
