import type { Role } from '@prisma/client';
import jwt, { SignOptions } from 'jsonwebtoken';
import jwtConfig from '../../config/jwt';

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
    { userId: user.id, role: user.role || 'client' }, // Dữ liệu đính kèm bên trong token
    jwtConfig.accessTokenSecret,                      // Dùng khóa bí mật Access Token để ký
    { expiresIn: jwtConfig.accessTokenExpire } as SignOptions // Thời gian hết hạn (15 phút)
  );
};


/**
 * Sinh Refresh Token cho người dùng.
 * Payload chỉ chứa userId để tối ưu bảo mật.
 */
export const generateRefreshToken = (user: UserPayload): string => {
  return jwt.sign(
    { userId: user.id },                             // Chỉ đính kèm userId để tối ưu bảo mật
    jwtConfig.refreshTokenSecret,                     // Dùng khóa bí mật Refresh Token để ký
    { expiresIn: jwtConfig.refreshTokenExpire } as SignOptions // Thời gian hết hạn (30 ngày)
  );
};


/**
 * Xác thực Access Token.
 */
export const verifyAccessToken = (token: string): any => {
  try {
    return jwt.verify(token, jwtConfig.accessTokenSecret);
  } catch (error) {
    return null; // Nếu token bị chỉnh sửa, hết hạn, hoặc sai chữ ký, trả về null
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
