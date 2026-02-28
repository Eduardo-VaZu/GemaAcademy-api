import dotenv from 'dotenv';

dotenv.config();

export const PORT = process.env.PORT || 5000;
export const NODE_ENV = process.env.NODE_ENV || 'development';

export const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-change-in-production';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
export const REFRESH_TOKEN_EXPIRATION_DAYS =
  parseInt(process.env.REFRESH_TOKEN_EXPIRATION_DAYS) || 7;

const rawCorsOrigins = process.env.CORS_ORIGIN || 'http://localhost:3000';
const normalizeCorsOrigin = (origin) => origin.trim().replace(/\/$/, '');

export const CORS_ORIGIN = rawCorsOrigins.split(',').map(normalizeCorsOrigin).filter(Boolean);
export const CORS_CREDENTIALS =
  process.env.CORS_CREDENTIALS === 'true' || process.env.CORS_CREDENTIALS === true;

export const BREVO_API_KEY = process.env.BREVO_API_KEY;
export const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'no-reply@academiagema.com';

export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

export const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
export const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
export const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
