import type { CookieOptions } from 'express';

const jwtConfig = {
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET || '',
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || '',
  accessTokenExpire: process.env.ACCESS_TOKEN_EXPIRE || '15m',
  refreshTokenExpire: process.env.REFRESH_TOKEN_EXPIRE || '30d'
};

if (!jwtConfig.accessTokenSecret || !jwtConfig.refreshTokenSecret) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT Secret keys must be configured in environment variables for production!');
  } else {
    jwtConfig.accessTokenSecret = jwtConfig.accessTokenSecret || '';
    jwtConfig.refreshTokenSecret = jwtConfig.refreshTokenSecret || '';
  }
}

// Cấu hình cookie cho Refresh Token
export const REFRESH_TOKEN_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 30 * 24 * 60 * 60 * 1000 // 30 ngày (đồng bộ với refreshTokenExpire)
};

export default jwtConfig;
