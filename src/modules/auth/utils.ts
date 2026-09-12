import crypto from 'crypto';
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
 * Payload chứa userId và mã UUID ngẫu nhiên (jti) để đảm bảo token sinh ra luôn duy nhất 100%.
 */
export const generateRefreshToken = (user: UserPayload): string => {
  return jwt.sign(
    { userId: user.id, jti: crypto.randomUUID() },   // Mã UUID giúp tránh trùng chuỗi JWT khi gọi song song
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

/**
 * Bộ đệm RAM (In-Memory Cache) lưu các Refresh Token cũ vừa mới được xoay vòng.
 * Thời gian sống (TTL): 15 giây.
 */
interface RotatedTokenData {
  newAccessToken: string;
  newRefreshToken: string;
  user: any;
  expiresAt: number;
}

const rotatedTokensCache = new Map<string, RotatedTokenData>();

/**
 * Đăng ký Refresh Token cũ vừa xoay vòng vào Grace Window (15 giây).
 */
export const registerRotatedToken = (
  oldRefreshToken: string,
  data: { newAccessToken: string; newRefreshToken: string; user: any }
): void => {
  const expiresAt = Date.now() + 15 * 1000;
  rotatedTokensCache.set(oldRefreshToken, {
    ...data,
    expiresAt,
  });

  // Tự động dọn dẹp khỏi RAM sau 15 giây
  setTimeout(() => {
    rotatedTokensCache.delete(oldRefreshToken);
  }, 15 * 1000);
};

/**
 * Kiểm tra xem Refresh Token cũ có vừa được xoay vòng trong Grace Window (15s gần nhất) không.
 */
export const getRecentlyRotatedToken = (
  oldRefreshToken: string
): RotatedTokenData | null => {
  const data = rotatedTokensCache.get(oldRefreshToken);
  if (!data) return null;

  if (Date.now() > data.expiresAt) {
    rotatedTokensCache.delete(oldRefreshToken);
    return null;
  }

  return data;
};

