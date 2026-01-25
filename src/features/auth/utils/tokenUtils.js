import crypto from 'crypto';

export const tokenUtils = {
  generateRefreshToken: () => {
    return crypto.randomBytes(32).toString('hex');
  },

  getRefreshTokenExpiration: (days = 7) => {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + days);
    return expirationDate;
  },

  isTokenExpired: (expiresAt) => {
    return new Date() > new Date(expiresAt);
  },
};
