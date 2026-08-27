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
import { AuthenticatedRequest, getUserWithSubscription } from '../middlewares/authMiddleware';
import { REFRESH_TOKEN_COOKIE_OPTIONS } from '../config/jwt';
import { sendResetPasswordEmail, sendForgotPasswordOtpEmail } from '../utils/emailService';
import { generateUserCode } from '../utils/codeGenerator';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Bộ nhớ tạm thời lưu mã OTP reset password (Hết hạn sau 10 phút)
const otpStore = new Map<string, { otp: string; expiresAt: number }>();



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

  if (password?.length < 8) {
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

  const code = generateUserCode(user.id);
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { code }
  });

  // Trả về kết quả (không kèm mật khẩu)
  const { password: _, ...userWithoutPassword } = updatedUser;

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

  // Trả Access Token về qua JSON body (kèm gói active)
  const { password: _, ...userWithoutPassword } = user;
  const userWithSub = await getUserWithSubscription(user.id);

  return sendSuccess(
    res,
    {
      accessToken,
      user: userWithSub || userWithoutPassword
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

  if (googleAccessToken) {
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${googleAccessToken}` }
      });
      if (userInfoRes.ok) {
        const payload: any = await userInfoRes.json();
        email = payload?.email;
        name = payload.name;
        picture = payload?.picture;
        googleId = payload?.sub;
      }
    } catch (error) {
      throw new AppError('Google Access Token không hợp lệ hoặc đã hết hạn.', 401, 'INVALID_CREDENTIALS');
    }
  }
  else if (idToken) {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (payload) {
        email = payload?.email;
        name = payload?.name;
        picture = payload?.picture;
        googleId = payload?.sub;
      }
    } catch (error) {
      throw new AppError('Google ID Token không hợp lệ hoặc đã hết hạn.', 401, 'INVALID_CREDENTIALS');
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

    const code = generateUserCode(user.id);
    user = await prisma.user.update({
      where: { id: user.id },
      data: { code }
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
  const userWithSub = await getUserWithSubscription(user.id);

  return sendSuccess(
    res,
    { accessToken, user: userWithSub || userWithoutPassword },
    'Đăng nhập bằng Google thành công'
  );
});

/**
 * Yêu cầu mã khôi phục mật khẩu (Forgot Password - Public).
 */
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    throw new AppError('Email là bắt buộc.', 400, 'VALIDATION_ERROR', { email: ['Email là bắt buộc.'] });
  }

  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    throw new AppError('Email không tồn tại trong hệ thống.', 404, 'NOT_FOUND', { email: ['Email không tồn tại trong hệ thống.'] });
  }

  if (user.status === 'locked') {
    throw new AppError('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.', 401, 'UNAUTHORIZED');
  }

  // Tạo mã OTP 6 chữ số ngẫu nhiên
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 phút

  otpStore.set(email, { otp, expiresAt });

  console.log(`[FORGOT PASSWORD OTP] Mã OTP đặt lại mật khẩu cho ${email} là: ${otp}`);

  await sendForgotPasswordOtpEmail({
    to: user.email,
    name: user.name,
    otp
  });

  return sendSuccess(
    res,
    { email, devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined },
    'Mã xác nhận khôi phục mật khẩu đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư!'
  );
});

/**
 * Đặt lại mật khẩu bằng mã OTP (Reset Password - Public).
 */
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp, newPassword } = req.body;

  console.log("das")

  if (!email || !otp || !newPassword) {
    const fieldErrors: Record<string, string[]> = {};
    if (!email) fieldErrors.email = ['Email là bắt buộc.'];
    if (!otp) fieldErrors.otp = ['Mã OTP là bắt buộc.'];
    if (!newPassword) fieldErrors.newPassword = ['Mật khẩu mới là bắt buộc.'];
    throw new AppError('Vui lòng điền đầy đủ thông tin yêu cầu.', 400, 'VALIDATION_ERROR', fieldErrors);
  }

  if (newPassword.length < 8) {
    throw new AppError('Mật khẩu mới phải chứa ít nhất 8 ký tự.', 400, 'VALIDATION_ERROR', {
      newPassword: ['Mật khẩu mới phải chứa ít nhất 8 ký tự.']
    });
  }

  const storedData = otpStore.get(email);
  if (!storedData) {
    throw new AppError('Yêu cầu OTP không tồn tại hoặc đã hết hạn. Vui lòng gửi lại yêu cầu.', 400, 'INVALID_OTP');
  }

  if (Date.now() > storedData.expiresAt) {
    otpStore.delete(email);
    throw new AppError('Mã OTP đã hết hạn. Vui lòng lấy mã mới.', 400, 'EXPIRED_OTP');
  }

  if (storedData.otp !== otp.trim()) {
    throw new AppError('Mã OTP xác thực không chính xác. Vui lòng kiểm tra lại!', 400, 'INVALID_OTP');
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError('Không tìm thấy tài khoản người dùng.', 404, 'NOT_FOUND');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword }
  });

  // Xóa OTP khỏi store sau khi dùng thành công
  otpStore.delete(email);

  return sendSuccess(res, null, 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập với mật khẩu mới.');
});

/**
 * Đổi mật khẩu tài khoản (Change Password - Protected).
 */
export const changePassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError('Yêu cầu xác thực tài khoản.', 401, 'UNAUTHORIZED');
  }

  if (!oldPassword || !newPassword) {
    const fieldErrors: Record<string, string[]> = {};
    if (!oldPassword) fieldErrors.oldPassword = ['Mật khẩu hiện tại là bắt buộc.'];
    if (!newPassword) fieldErrors.newPassword = ['Mật khẩu mới là bắt buộc.'];
    throw new AppError('Vui lòng nhập đầy đủ mật khẩu.', 400, 'VALIDATION_ERROR', fieldErrors);
  }

  if (newPassword.length < 8) {
    throw new AppError('Mật khẩu mới phải chứa ít nhất 8 ký tự.', 400, 'VALIDATION_ERROR', {
      newPassword: ['Mật khẩu mới phải chứa ít nhất 8 ký tự.']
    });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('Không tìm thấy tài khoản người dùng.', 404, 'NOT_FOUND');
  }

  if (!user.password) {
    throw new AppError('Tài khoản này được đăng ký bằng Google, không có mật khẩu ban đầu để thay đổi.', 400, 'BAD_REQUEST');
  }

  const isPasswordMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isPasswordMatch) {
    throw new AppError('Mật khẩu hiện tại không chính xác.', 400, 'INVALID_CREDENTIALS', {
      oldPassword: ['Mật khẩu hiện tại không chính xác.']
    });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword }
  });

  return sendSuccess(res, null, 'Đổi mật khẩu thành công!');
});


