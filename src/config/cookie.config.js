import { NODE_ENV, REFRESH_TOKEN_EXPIRATION_DAYS, JWT_EXPIRES_IN } from './secret.config.js';
import ms from 'ms';

const ONE_MINUTE = 60 * 1000;
const ONE_HOUR = 60 * ONE_MINUTE;
const ONE_DAY = 24 * ONE_HOUR;

const getJwtExpiresInMs = () => {
  const expires = JWT_EXPIRES_IN || '15m';
  return ms(expires) || 15 * ONE_MINUTE;
};

export const ACCESS_TOKEN_MAX_AGE = getJwtExpiresInMs();
export const REFRESH_TOKEN_MAX_AGE = REFRESH_TOKEN_EXPIRATION_DAYS * ONE_DAY;

/**
 * Valida al iniciar el servidor que la configuración de cookies es correcta.
 * En producción, sameSite:'none' requiere secure:true para que Chrome acepte las cookies cross-origin.
 * Si NODE_ENV no es 'production', las cookies usarán lax+no-secure y Chrome las bloqueará.
 */
export const validateCookieConfig = () => {
  const isProd = NODE_ENV === 'production';
  if (!isProd) {
    console.warn(
      '[cookie.config] ⚠️  NODE_ENV no es "production". ' +
      'Las cookies usarán sameSite:lax y secure:false. ' +
      'En producción con dominios distintos (cross-origin), Chrome BLOQUEARÁ las cookies. ' +
      'Asegúrate de setear NODE_ENV=production en Railway.'
    );
  }
};

export const getCookieOptions = () => {
  const isProd = NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    // sameSite:'none' es obligatorio para cookies cross-origin en producción.
    // Requiere secure:true, por eso solo se activa cuando NODE_ENV=production.
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  };
};

export const getAccessTokenCookieOptions = () => ({
  ...getCookieOptions(),
  maxAge: ACCESS_TOKEN_MAX_AGE,
});

export const getRefreshTokenCookieOptions = () => ({
  ...getCookieOptions(),
  maxAge: REFRESH_TOKEN_MAX_AGE,
});

export const setAuthCookies = (res, { accessToken, refreshToken }) => {
  res.cookie('accessToken', accessToken, getAccessTokenCookieOptions());
  res.cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions());
};

export const clearAuthCookies = (res) => {
  const options = getCookieOptions();
  res.clearCookie('accessToken', { ...options });
  res.clearCookie('refreshToken', { ...options });
};
