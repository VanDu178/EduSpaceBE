import type { CookieOptions } from 'express';
const jwtConfig = {
  get accessTokenSecret(): string {
    return process.env.ACCESS_TOKEN_SECRET || '';
  },
  get refreshTokenSecret(): string {
    return process.env.REFRESH_TOKEN_SECRET || '';
  },
  get accessTokenExpire(): string {
    return process.env.ACCESS_TOKEN_EXPIRE || '15m';
  },
  get refreshTokenExpire(): string {
    return process.env.REFRESH_TOKEN_EXPIRE || '30d';
  }
};

// Cấu hình cookie cho Refresh Token
export const REFRESH_TOKEN_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 30 * 24 * 60 * 60 * 1000 // 30 ngày (đồng bộ với refreshTokenExpire)
};

export default jwtConfig;
