import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { JWT_SECRET, JWT_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN } from '../config.js';
import { generateRefreshToken, getRefreshTokenExpiration, isTokenExpired } from '../utils/tokenUtils.js';

export const authService = {
  /**
   * Registrar un nuevo usuario
   * @param {Object} userData - Datos del usuario (email, password, nombres, apellidos, rol_id, etc.)
   * @returns {Object} Usuario creado (sin contraseña)
   */
  register: async (userData) => {
    const { email, password, ...otrosdatos } = userData;

    // Verificar si el email ya existe
    const existingUser = await prisma.usuarios.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new Error('El email ya está registrado');
    }

    // Hashear la contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Crear usuario y credenciales en una transacción
    const usuario = await prisma.$transaction(async (tx) => {
      // Crear el usuario
      const nuevoUsuario = await tx.usuarios.create({
        data: {
          email,
          ...otrosdatos,
          activo: true
        },
        include: {
          roles: true
        }
      });

      // Crear las credenciales
      await tx.credenciales_usuario.create({
        data: {
          usuario_id: nuevoUsuario.id,
          hash_contrasena: hashedPassword
        }
      });

      return nuevoUsuario;
    });

    // Retornar usuario sin información sensible
    return {
      id: usuario.id,
      email: usuario.email,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      rol: usuario.roles.nombre
    };
  },

  /**
   * Iniciar sesión
   * @param {string} email - Email del usuario
   * @param {string} password - Contraseña del usuario
   * @returns {Object} Access token, refresh token y datos del usuario
   */
  login: async (email, password) => {
    // Buscar usuario con sus credenciales y rol
    const usuario = await prisma.usuarios.findUnique({
      where: { email },
      include: {
        credenciales_usuario: true,
        roles: true
      }
    });

    if (!usuario) {
      throw new Error('Credenciales inválidas');
    }

    if (!usuario.activo) {
      throw new Error('Usuario inactivo');
    }

    if (!usuario.credenciales_usuario) {
      throw new Error('Usuario sin credenciales configuradas');
    }

    // Verificar la contraseña
    const passwordValida = await bcrypt.compare(
      password,
      usuario.credenciales_usuario.hash_contrasena
    );

    if (!passwordValida) {
      throw new Error('Credenciales inválidas');
    }

    // Actualizar último login
    await prisma.credenciales_usuario.update({
      where: { usuario_id: usuario.id },
      data: { ultimo_login: new Date() }
    });

    // Generar access token JWT (15 minutos)
    const accessToken = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        rol_id: usuario.rol_id,
        rol_nombre: usuario.roles.nombre
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Generar refresh token (7 días)
    const refreshToken = generateRefreshToken();
    const expiresAt = getRefreshTokenExpiration(7);

    // Guardar refresh token en la base de datos
    await prisma.refresh_tokens.create({
      data: {
        usuario_id: usuario.id,
        token: refreshToken,
        expires_at: expiresAt
      }
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: usuario.id,
        email: usuario.email,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        rol: usuario.roles.nombre
      }
    };
  },

  /**
   * Obtener perfil del usuario autenticado
   * @param {number} userId - ID del usuario
   * @returns {Object} Datos del usuario
   */
  getProfile: async (userId) => {
    const usuario = await prisma.usuarios.findUnique({
      where: { id: userId },
      include: {
        roles: true,
        alumnos: true,
        profesores: true,
        administrador: {
          include: {
            sedes: true
          }
        }
      }
    });

    if (!usuario) {
      throw new Error('Usuario no encontrado');
    }

    // Retornar datos según el rol
    const baseData = {
      id: usuario.id,
      email: usuario.email,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      telefono_personal: usuario.telefono_personal,
      fecha_nacimiento: usuario.fecha_nacimiento,
      genero: usuario.genero,
      rol: usuario.roles.nombre
    };

    // Agregar datos específicos según el rol
    if (usuario.alumnos) {
      baseData.alumno = {
        condiciones_medicas: usuario.alumnos.condiciones_medicas,
        seguro_medico: usuario.alumnos.seguro_medico,
        grupo_sanguineo: usuario.alumnos.grupo_sanguineo
      };
    }

    if (usuario.profesores) {
      baseData.profesor = {
        especializacion: usuario.profesores.especializacion,
        tarifa_hora: usuario.profesores.tarifa_hora
      };
    }

    if (usuario.administrador) {
      baseData.administrador = {
        cargo: usuario.administrador.cargo,
        area: usuario.administrador.area,
        sede: usuario.administrador.sedes?.nombre
      };
    }

    return baseData;
  },

  /**
   * Renovar access token usando refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Object} Nuevo access token
   */
  refreshAccessToken: async (refreshToken) => {
    // Buscar el refresh token en la base de datos
    const tokenRecord = await prisma.refresh_tokens.findUnique({
      where: { token: refreshToken },
      include: {
        usuarios: {
          include: {
            roles: true
          }
        }
      }
    });

    if (!tokenRecord) {
      throw new Error('Refresh token inválido');
    }

    // Verificar si el token ha sido revocado
    if (tokenRecord.revoked) {
      throw new Error('Refresh token revocado');
    }

    // Verificar si el token ha expirado
    if (isTokenExpired(tokenRecord.expires_at)) {
      throw new Error('Refresh token expirado');
    }

    // Verificar que el usuario esté activo
    if (!tokenRecord.usuarios.activo) {
      throw new Error('Usuario inactivo');
    }

    // Generar nuevo access token
    const accessToken = jwt.sign(
      {
        id: tokenRecord.usuarios.id,
        email: tokenRecord.usuarios.email,
        rol_id: tokenRecord.usuarios.rol_id,
        rol_nombre: tokenRecord.usuarios.roles.nombre
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return { accessToken };
  },

  /**
   * Cerrar sesión (logout real)
   * @param {string} refreshToken - Refresh token a revocar
   * @returns {Object} Confirmación
   */
  logout: async (refreshToken) => {
    // Buscar y revocar el refresh token
    const tokenRecord = await prisma.refresh_tokens.findUnique({
      where: { token: refreshToken }
    });

    if (!tokenRecord) {
      throw new Error('Refresh token no encontrado');
    }

    // Marcar como revocado
    await prisma.refresh_tokens.update({
      where: { token: refreshToken },
      data: { revoked: true }
    });

    return { message: 'Sesión cerrada exitosamente' };
  },

  /**
   * Revocar todos los refresh tokens de un usuario
   * @param {number} userId - ID del usuario
   * @returns {Object} Confirmación
   */
  revokeAllTokens: async (userId) => {
    await prisma.refresh_tokens.updateMany({
      where: {
        usuario_id: userId,
        revoked: false
      },
      data: { revoked: true }
    });

    return { message: 'Todas las sesiones han sido cerradas' };
  }
};
