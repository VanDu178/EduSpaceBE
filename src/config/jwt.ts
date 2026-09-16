import type { Request, CookieOptions } from 'express';
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

/**
 * Lấy tên cookie tương ứng dựa trên ngữ cảnh ứng dụng (X-App-Context header)
 */
export const getCookieName = (req: Request): string => {
  const appContext = req.headers['x-app-context'];
  if (appContext === 'admin') return 'admin_refreshToken';
  if (appContext === 'client') return 'client_refreshToken';
  if (req.cookies?.admin_refreshToken) return 'admin_refreshToken';
  if (req.cookies?.client_refreshToken) return 'client_refreshToken';
  return 'refreshToken';
};

export default jwtConfig;

