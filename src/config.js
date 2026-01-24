import dotenv from 'dotenv';

dotenv.config();

export const PORT = process.env.PORT || 5000;
export const NODE_ENV = process.env.NODE_ENV || 'development';

// JWT Configuration
export const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-change-in-production';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m'; // Access token: 15 minutos
export const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'; // Refresh token: 7 días

// CORS Configuration
export const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
export const CORS_CREDENTIALS = process.env.CORS_CREDENTIALS || true;
