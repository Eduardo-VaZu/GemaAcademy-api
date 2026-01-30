import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { tokenUtils } from './utils/tokenUtils.js';
import { prisma } from '../../config/database.config.js';
import { usuarioService } from '../usuarios/usuario.service.js';
import { ApiError } from '../../shared/utils/error.util.js';
import {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRATION_DAYS,
} from '../../config/secret.config.js';

export const authService = {
  login: async (email, password) => {
    const usuario = await prisma.usuarios.findUnique({
      where: { email },
      include: {
        credenciales_usuario: true,
        roles: true,
      },
    });

    if (!usuario) {
      throw new ApiError('Credenciales inválidas', 401);
    }

    if (!usuario.activo) {
      throw new ApiError('Usuario inactivo', 403);
    }

    if (!usuario.credenciales_usuario) {
      throw new ApiError('Usuario sin credenciales configuradas', 403);
    }

    if (usuario.credenciales_usuario.bloqueado) {
      throw new ApiError('Usuario bloqueado. Contacte al administrador', 403);
    }

    const passwordValida = await bcrypt.compare(
      password,
      usuario.credenciales_usuario.hash_contrasena
    );

    if (!passwordValida) {
      throw new ApiError('Credenciales inválidas', 401);
    }

    await prisma.credenciales_usuario.update({
      where: { usuario_id: usuario.id },
      data: { ultimo_login: new Date() },
    });

    const accessToken = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        rol_id: usuario.rol_id,
        rol_nombre: usuario.roles.nombre,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const refreshToken = tokenUtils.generateRefreshToken();
    const expiresAt = tokenUtils.getRefreshTokenExpiration(REFRESH_TOKEN_EXPIRATION_DAYS);

    await prisma.refresh_tokens.create({
      data: {
        usuario_id: usuario.id,
        token: refreshToken,
        expires_at: expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: usuario.id,
        email: usuario.email,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        rol: usuario.roles.nombre,
      },
    };
  },

  getProfile: async (userId) => {
    const usuario = await usuarioService.getUserById(userId);
    if (!usuario) {
      throw new ApiError('Usuario no encontrado', 404);
    }

    const baseData = {
      id: usuario.id,
      email: usuario.email,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      telefono_personal: usuario.telefono_personal,
      fecha_nacimiento: usuario.fecha_nacimiento,
      genero: usuario.genero,
      rol: usuario.roles.nombre,
    };

    if (usuario.alumnos) {
      baseData.alumno = {
        condiciones_medicas: usuario.alumnos.condiciones_medicas,
        seguro_medico: usuario.alumnos.seguro_medico,
        grupo_sanguineo: usuario.alumnos.grupo_sanguineo,
      };
    }

    if (usuario.profesores) {
      baseData.profesor = {
        especializacion: usuario.profesores.especializacion,
        tarifa_hora: usuario.profesores.tarifa_hora,
      };
    }

    if (usuario.administrador) {
      baseData.administrador = {
        cargo: usuario.administrador.cargo,
        area: usuario.administrador.area,
        sede: usuario.administrador.sedes?.nombre,
      };
    }

    return baseData;
  },

  refreshAccessToken: async (refreshToken) => {
    const tokenRecord = await prisma.refresh_tokens.findUnique({
      where: { token: refreshToken },
      include: {
        usuarios: {
          include: {
            roles: true,
            credenciales_usuario: true,
          },
        },
      },
    });

    if (!tokenRecord) {
      throw new ApiError('Refresh token inválido', 401);
    }

    if (tokenRecord.revoked) {
      await prisma.refresh_tokens.updateMany({
        where: { usuario_id: tokenRecord.usuario_id },
        data: { revoked: true },
      });
      throw new ApiError('Refresh token revocado detected - Reuse Attempt', 403);
    }
    if (tokenUtils.isTokenExpired(tokenRecord.expires_at)) {
      throw new ApiError('Refresh token expirado', 401);
    }

    if (!tokenRecord.usuarios.activo) {
      throw new ApiError('Usuario inactivo', 403);
    }

    if (tokenRecord.usuarios.credenciales_usuario?.bloqueado) {
      throw new ApiError('Cuenta bloqueada. Contacte al administrador', 403);
    }

    await prisma.refresh_tokens.update({
      where: { token: refreshToken },
      data: { revoked: true },
    });

    const newRefreshToken = tokenUtils.generateRefreshToken();
    const expiresAt = tokenUtils.getRefreshTokenExpiration(REFRESH_TOKEN_EXPIRATION_DAYS);

    await prisma.refresh_tokens.create({
      data: {
        usuario_id: tokenRecord.usuarios.id,
        token: newRefreshToken,
        expires_at: expiresAt,
      },
    });

    const accessToken = jwt.sign(
      {
        id: tokenRecord.usuarios.id,
        email: tokenRecord.usuarios.email,
        rol_id: tokenRecord.usuarios.rol_id,
        rol_nombre: tokenRecord.usuarios.roles.nombre,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: tokenRecord.usuarios.id,
        email: tokenRecord.usuarios.email,
        nombres: tokenRecord.usuarios.nombres,
        apellidos: tokenRecord.usuarios.apellidos,
        rol: tokenRecord.usuarios.roles.nombre,
      },
    };
  },

  logout: async (refreshToken) => {
    const tokenRecord = await prisma.refresh_tokens.findUnique({
      where: { token: refreshToken },
    });

    if (!tokenRecord) {
      throw new ApiError('Refresh token no encontrado', 404);
    }

    await prisma.refresh_tokens.update({
      where: { token: refreshToken },
      data: { revoked: true },
    });

    return { message: 'Sesión cerrada exitosamente' };
  },

  revokeAllTokens: async (userId) => {
    await prisma.refresh_tokens.updateMany({
      where: {
        usuario_id: userId,
        revoked: false,
      },
      data: { revoked: true },
    });

    return { message: 'Todas las sesiones han sido cerradas' };
  },
};
