import crypto from 'crypto';

/**
 * Genera un refresh token único usando crypto
 * @returns {string} Token único de 64 caracteres hexadecimales
 */
export const generateRefreshToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Calcula la fecha de expiración del refresh token
 * @param {number} days - Número de días hasta la expiración
 * @returns {Date} Fecha de expiración
 */
export const getRefreshTokenExpiration = (days = 7) => {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + days);
  return expirationDate;
};

/**
 * Verifica si un token ha expirado
 * @param {Date} expiresAt - Fecha de expiración del token
 * @returns {boolean} true si el token ha expirado
 */
export const isTokenExpired = (expiresAt) => {
  return new Date() > new Date(expiresAt);
};
