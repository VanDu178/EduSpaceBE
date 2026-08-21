import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
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
import { REFRESH_TOKEN_COOKIE_OPTIONS } from '../config/jwt';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


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

  if (password.length < 8) {
    throw new AppError(
      'Mật khẩu phải chứa ít nhất 8 ký tự.',
      400,
      'VALIDATION_ERROR',
      { password: ['Mật khẩu phải chứa ít nhất 8 ký tự.'] }
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
      role: role || "client"
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
      'Email và mật khẩu là bắt buộc.',
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

  // Kiểm tra tài khoản bị khóa
  if (user.status === 'locked') {
    throw new AppError(
      'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
      401,
      'UNAUTHORIZED'
    );
  }

  // So khớp mật khẩu
  if (!user.password) {
    throw new AppError(
      'Tài khoản này được đăng ký bằng Google. Vui lòng sử dụng đăng nhập bằng Google.',
      401,
      'INVALID_CREDENTIALS'
    );
  }

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
  res.cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

  // Trả Access Token về qua JSON body
  const { password: _, ...userWithoutPassword } = user;

  return sendSuccess(
    res,
    {
      accessToken,
      user: userWithoutPassword
    },
    'Đăng nhập thành công!'
  );
});

/**
 * Xoay vòng Refresh Token (Token Rotation).
 */
export const tokenRefresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    throw new AppError(
      'Refresh token không tồn tại.',
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
    res.clearCookie('refreshToken', REFRESH_TOKEN_COOKIE_OPTIONS);

    throw new AppError(
      'Refresh token hết hạn hoặc không hợp lệ.',
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
    res.clearCookie('refreshToken', REFRESH_TOKEN_COOKIE_OPTIONS);

    throw new AppError(
      'Phát hiện tấn công Replay Attack. Refresh token không hợp lệ.',
      403,
      'REFRESH_TOKEN_REUSE'
    );
  }

  // Kiểm tra xem Refresh Token trong DB đã hết hạn chưa
  if (new Date() > savedToken.expiresAt) {
    await prisma.refreshToken.delete({
      where: { id: savedToken.id }
    });
    res.clearCookie('refreshToken', REFRESH_TOKEN_COOKIE_OPTIONS);

    throw new AppError(
      'Refresh token hết hạn.',
      401,
      'EXPIRED_REFRESH_TOKEN'
    );
  }

  // Thực hiện xoay vòng token (Token Rotation):
  const user = savedToken.user;

  // Kiểm tra tài khoản bị khóa
  if (user.status === 'locked') {
    throw new AppError(
      'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
      401,
      'UNAUTHORIZED'
    );
  }

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
  res.cookie('refreshToken', newRefreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

  return sendSuccess(
    res,
    { accessToken: newAccessToken },
    'Token refresh thành công'
  );
});

/**
 * Đăng xuất.
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
  res.clearCookie('refreshToken', REFRESH_TOKEN_COOKIE_OPTIONS);

  return sendSuccess(res, null, 'Đăng xuất thành công');
});

/**
 * Lấy thông tin user hiện tại.
 */
export const getMe = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  return sendSuccess(res, { user: req.user }, 'Lấy thông tin user thành công');
});

/**
 * Đăng nhập / Đăng ký bằng Google OAuth Token (hỗ trợ idToken hoặc accessToken).
 */
export const googleLogin = asyncHandler(async (req: Request, res: Response) => {
  const { idToken, accessToken: googleAccessToken } = req.body;

  if (!idToken && !googleAccessToken) {
    throw new AppError('Google Token là bắt buộc.', 400, 'VALIDATION_ERROR');
  }

  let email: string | undefined;
  let name: string | undefined;
  let picture: string | undefined;
  let googleId: string | undefined;

  if (idToken) {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (payload) {
        email = payload.email;
        name = payload.name;
        picture = payload.picture;
        googleId = payload.sub;
      }
    } catch (error) {
      throw new AppError('Google ID Token không hợp lệ hoặc đã hết hạn.', 401, 'INVALID_CREDENTIALS');
    }
  } else if (googleAccessToken) {
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${googleAccessToken}` }
      });
      if (userInfoRes.ok) {
        const payload: any = await userInfoRes.json();
        email = payload.email;
        name = payload.name;
        picture = payload.picture;
        googleId = payload.sub;
      }
    } catch (error) {
      throw new AppError('Google Access Token không hợp lệ hoặc đã hết hạn.', 401, 'INVALID_CREDENTIALS');
    }
  }

  if (!email || !googleId) {
    throw new AppError('Không thể xác thực thông tin tài khoản Google.', 400, 'INVALID_CREDENTIALS');
  }

  // Tìm kiếm user theo googleId hoặc email
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { googleId },
        { email }
      ]
    }
  });


  if (!user) {
    // Tạo user mới nếu chưa tồn tại
    user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        avatarUrl: picture || null,
        googleId,
        provider: 'google',
        role: 'client',
        status: 'active'
      }
    });
  } else {
    // Nếu user đã tồn tại, liên kết googleId và avatar (nếu chưa có)
    const updateData: any = {};
    if (!user.googleId) updateData.googleId = googleId;
    if (!user.avatarUrl && picture) updateData.avatarUrl = picture;

    if (Object.keys(updateData).length > 0) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: updateData
      });
    }
  }

  // Kiểm tra nếu tài khoản bị khóa
  if (user.status === 'locked') {
    throw new AppError(
      'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
      401,
      'UNAUTHORIZED'
    );
  }

  // Sinh Access Token và Refresh Token
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt
    }
  });

  // Thiết lập cookie chứa Refresh Token
  res.cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

  const { password: _, ...userWithoutPassword } = user;

  return sendSuccess(
    res,
    { accessToken, user: userWithoutPassword },
    'Đăng nhập bằng Google thành công'
  );
});

