import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/db';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken
} from '../utils/authHelper';
import { AppError } from '../utils/appError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/responseHelper';
import type { AuthenticatedRequest } from '../middlewares/authMiddleware';

// Cấu hình cookie cho Refresh Token
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000 // 30 ngày
};

/**
 * Đăng ký tài khoản Admin mới.
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name, role } = req.body;

  // Validation đơn giản
  if (!email || !password) {
    const fieldErrors: Record<string, string[]> = {};
    if (!email) fieldErrors.email = ['Email là bắt buộc.'];
    if (!password) fieldErrors.password = ['Mật khẩu là bắt buộc.'];

    throw new AppError(
      'Email và mật khẩu là bắt buộc.',
      400,
      'VALIDATION_ERROR',
      fieldErrors
    );
  }

  // Kiểm tra xem email đã được sử dụng chưa
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    throw new AppError(
      'Email đã được đăng ký sử dụng trong hệ thống.',
      400,
      'DUPLICATE_RESOURCE',
      { email: ['Email đã được đăng ký sử dụng trong hệ thống.'] }
    );
  }

  // Băm mật khẩu bằng bcrypt
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Lưu User vào database
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role: role || undefined
    }
  });

  // Trả về kết quả (không kèm mật khẩu)
  const { password: _, ...userWithoutPassword } = user;

  return sendSuccess(
    res,
    { user: userWithoutPassword },
    'Đăng ký tài khoản thành công',
    201
  );
});

/**
 * Đăng nhập tài khoản.
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    const fieldErrors: Record<string, string[]> = {};
    if (!email) fieldErrors.email = ['Email là bắt buộc.'];
    if (!password) fieldErrors.password = ['Mật khẩu là bắt buộc.'];

    throw new AppError(
      'Email and password are required',
      400,
      'VALIDATION_ERROR',
      fieldErrors
    );
  }

  // Tìm kiếm user
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    throw new AppError(
      'Email hoặc mật khẩu không chính xác.',
      401,
      'INVALID_CREDENTIALS'
    );
  }

  // So khớp mật khẩu
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new AppError(
      'Email hoặc mật khẩu không chính xác.',
      401,
      'INVALID_CREDENTIALS'
    );
  }

  // Sinh Access Token và Refresh Token
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Tính toán thời gian hết hạn của Refresh Token trong DB (30 ngày)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  // Lưu Refresh Token vào Database
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt
    }
  });

  // Gửi Refresh Token về qua HttpOnly Cookie
  res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

  // Trả Access Token về qua JSON body
  const { password: _, ...userWithoutPassword } = user;

  return sendSuccess(
    res,
    {
      accessToken,
      user: userWithoutPassword
    },
    'Login successful'
  );
});

/**
 * Xoay vòng Refresh Token (Token Rotation).
 */
export const tokenRefresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    throw new AppError(
      'Unauthorized: Refresh token is missing',
      401,
      'REFRESH_TOKEN_MISSING'
    );
  }

  // Xác thực token bằng jwt
  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded) {
    // Refresh token hết hạn hoặc không hợp lệ -> Xóa token khỏi DB nếu có
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken }
    });
    res.clearCookie('refreshToken', COOKIE_OPTIONS);

    throw new AppError(
      'Unauthorized: Invalid or expired refresh token',
      401,
      'INVALID_REFRESH_TOKEN'
    );
  }

  // Kiểm tra xem Refresh Token có tồn tại trong database không
  const savedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true }
  });

  if (!savedToken) {
    // Replay Attack detected -> Thu hồi toàn bộ token của User đó
    await prisma.refreshToken.deleteMany({
      where: { userId: decoded.userId }
    });
    res.clearCookie('refreshToken', COOKIE_OPTIONS);

    throw new AppError(
      'Forbidden: Security alert. Refresh token reuse detected',
      403,
      'REFRESH_TOKEN_REUSE'
    );
  }

  // Kiểm tra xem Refresh Token trong DB đã hết hạn chưa
  if (new Date() > savedToken.expiresAt) {
    await prisma.refreshToken.delete({
      where: { id: savedToken.id }
    });
    res.clearCookie('refreshToken', COOKIE_OPTIONS);

    throw new AppError(
      'Unauthorized: Refresh token has expired',
      401,
      'EXPIRED_REFRESH_TOKEN'
    );
  }

  // Thực hiện xoay vòng token (Token Rotation):
  const user = savedToken.user;
  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  await prisma.$transaction([
    prisma.refreshToken.delete({
      where: { id: savedToken.id }
    }),
    prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    })
  ]);

  // Gửi cookie mới chứa Refresh Token mới
  res.cookie('refreshToken', newRefreshToken, COOKIE_OPTIONS);

  return sendSuccess(
    res,
    { accessToken: newAccessToken },
    'Token refreshed successfully'
  );
});

/**
 * Đăng logout.
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies;

  if (refreshToken) {
    // Xóa Refresh Token trong database
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken }
    });
  }

  // Xóa cookie ở trình duyệt
  res.clearCookie('refreshToken', COOKIE_OPTIONS);

  return sendSuccess(res, null, 'Logged out successfully');
});

/**
 * Lấy thông tin user hiện tại.
 */
export const getMe = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  return sendSuccess(res, { user: req.user }, 'Get user profile successfully');
});
