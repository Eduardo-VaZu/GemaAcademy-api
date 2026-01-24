import crypto from 'crypto';

export const generateRefreshToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

export const getRefreshTokenExpiration = (days = 7) => {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + days);
  return expirationDate;
};

export const isTokenExpired = (expiresAt) => {
  return new Date() > new Date(expiresAt);
};
