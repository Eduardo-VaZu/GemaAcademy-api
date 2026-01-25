import dotenv from 'dotenv';

dotenv.config();

export const secret = {
  port: process.env.PORT || 5000,
  node_env: process.env.NODE_ENV || 'development',

  jwt: process.env.JWT_SECRET || 'default-secret-key-change-in-production',
  jwt_expires_in: process.env.JWT_EXPIRES_IN || '15m',
  refresh_token_expiration_days: process.env.REFRESH_TOKEN_EXPIRATION_DAYS || '7d',

  cors_origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  cors_credentials: process.env.CORS_CREDENTIALS || true,
};
