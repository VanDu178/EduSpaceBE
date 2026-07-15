import type { Role } from '@prisma/client';
import jwt, { SignOptions } from 'jsonwebtoken';
import jwtConfig from '../config/jwt';

interface UserPayload {
  id: number;
  role?: Role;
}

/**
 * Sinh Access Token cho người dùng.
 * Payload chứa id và role (mặc định là 'client').
 */
export const generateAccessToken = (user: UserPayload): string => {
  return jwt.sign(
    { userId: user.id, role: user.role || 'client' },
    jwtConfig.accessTokenSecret,
    { expiresIn: jwtConfig.accessTokenExpire } as SignOptions
  );
};

/**
 * Sinh Refresh Token cho người dùng.
 * Payload chỉ chứa userId để tối ưu bảo mật.
 */
export const generateRefreshToken = (user: UserPayload): string => {
  return jwt.sign(
    { userId: user.id },
    jwtConfig.refreshTokenSecret,
    { expiresIn: jwtConfig.refreshTokenExpire } as SignOptions
  );
};

/**
 * Xác thực Access Token.
 */
export const verifyAccessToken = (token: string): any => {
  try {
    return jwt.verify(token, jwtConfig.accessTokenSecret);
  } catch (error) {
    return null;
  }
};

/**
 * Xác thực Refresh Token.
 */
export const verifyRefreshToken = (token: string): any => {
  try {
    return jwt.verify(token, jwtConfig.refreshTokenSecret);
  } catch (error) {
    return null;
  }
};
