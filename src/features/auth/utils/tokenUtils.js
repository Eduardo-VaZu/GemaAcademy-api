import crypto from 'crypto';

export const tokenUtils = {
  /**
   * Genera de forma segura un nuevo token opaco de refresco en formato hexadecimal.
   * Utiliza la librería nativa `crypto` para una ejecución síncrona hiperveloz (Antigravity).
   * @returns {string} Token criptográficamente seguro de 64 caracteres.
   */
  generateRefreshToken: () => {
    return crypto.randomBytes(32).toString('hex');
  },

  /**
   * Calcula de manera defensiva la fecha de expiración sumando una cantidad de días.
   * @param {number|string} days - Número de días de validez del token (por defecto 7).
   * @returns {Date} Fecha de expiración calculada.
   */
  getRefreshTokenExpiration: (days) => {
    const daysNum = parseInt(days, 10) || 7;

    const expirationDate = new Date();

    if (isNaN(expirationDate.getTime())) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    expirationDate.setDate(expirationDate.getDate() + daysNum);
    return expirationDate;
  },

  /**
   * Comprueba si un token ha expirado. Actúa en fail-fast retornando true si la fecha es inválida.
   * @param {Date|string|number} expiresAt - Fecha de expiración a verificar.
   * @returns {boolean} `true` si el token expiró o la fecha es maliciosa.
   */
  isTokenExpired: (expiresAt) => {
    const expiry = new Date(expiresAt);
    if (isNaN(expiry.getTime())) return true;

    return new Date() > expiry;
  },
};
