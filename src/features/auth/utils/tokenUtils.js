import crypto from 'crypto';

export const tokenUtils = {
  generateRefreshToken: () => {
    return crypto.randomBytes(32).toString('hex');
  },

  getRefreshTokenExpiration: (days) => {
    const daysNum = parseInt(days, 10) || 7;
    
    const expirationDate = new Date();
    
    if (isNaN(expirationDate.getTime())) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    expirationDate.setDate(expirationDate.getDate() + daysNum);
    return expirationDate;
  },

  isTokenExpired: (expiresAt) => {
    const expiry = new Date(expiresAt);
    if (isNaN(expiry.getTime())) return true; 
    
    return new Date() > expiry;
  },
};