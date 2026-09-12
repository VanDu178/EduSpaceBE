import bcrypt from 'bcrypt';
import prisma from '../../config/db';
import { AppError } from '../../utils/appError';
import {
  generateAccessToken,
  generateRefreshToken,
  registerRotatedToken,
} from './utils';
import { getUserWithSubscription } from '../../middlewares/authMiddleware';
import { sendForgotPasswordOtpEmail } from '../../services/emailService';
import { generateUserCode } from '../users/utils';
import {
  AUTH_PROVIDERS,
  USER_ROLES,
  USER_STATUS,
} from './constants';

/* HELPER SERVICES */
export const otpStore = new Map<string, { otp: string; expiresAt: number }>();

/**
 * TẦNG 3: XỬ LÝ NGHIỆP VỤ & GIAO TIẾP DATABASE MODULE AUTH
 */

/**
 * Service xử lý đăng ký tài khoản.
 */
export const registerService = async (data: {
  email: string;
  password: string;
  name?: string;
  role?: string;
}) => {
  const { email, password, name, role } = data;
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role: (role as any) || USER_ROLES.CLIENT,
    },
  });

  const code = generateUserCode(user.id);
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { code },
  });

  const { password: _, ...userWithoutPassword } = updatedUser;
  return { user: userWithoutPassword };
};

/**
 * Service xử lý đăng nhập tài khoản.
 */
export const loginService = async (user: any) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  const expiresAt = new Date();
  expiresAt.setDate(
    expiresAt.getDate() + 30
  );

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt,
    },
  });

  const { password: _, ...userWithoutPassword } = user;
  const userWithSub = await getUserWithSubscription(user.id);

  return {
    accessToken,
    refreshToken,
    user: userWithSub || userWithoutPassword,
  };
};

/**
 * Service xử lý đăng nhập / đăng ký bằng Google.
 */
export const googleLoginService = async (googleData: {
  email: string;
  name?: string;
  picture?: string;
  googleId: string;
  existingUser?: any;
}) => {
  const { email, name, picture, googleId, existingUser } = googleData;
  let user = existingUser;

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        avatarUrl: picture || null,
        googleId,
        provider: AUTH_PROVIDERS.GOOGLE,
        role: USER_ROLES.CLIENT as any,
        status: USER_STATUS.ACTIVE as any,
      },
    });

    const code = generateUserCode(user.id);
    user = await prisma.user.update({
      where: { id: user.id },
      data: { code },
    });
  } else {
    const updateData: any = {};
    if (!user.googleId) updateData.googleId = googleId;
    if (!user.avatarUrl && picture) updateData.avatarUrl = picture;

    if (Object.keys(updateData).length > 0) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });
    }
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  const expiresAt = new Date();
  expiresAt.setDate(
    expiresAt.getDate() + 30
  );

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt,
    },
  });

  const { password: _, ...userWithoutPassword } = user;
  const userWithSub = await getUserWithSubscription(user.id);

  return {
    accessToken,
    refreshToken,
    user: userWithSub || userWithoutPassword,
  };
};

/**
 * Service xử lý yêu cầu quên mật khẩu (Gửi mã OTP qua Email).
 */
export const forgotPasswordService = async (user: any) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  otpStore.set(user.email, { otp, expiresAt });

  console.log(
    `[FORGOT PASSWORD OTP] Mã OTP đặt lại mật khẩu cho ${user.email} là: ${otp}`
  );

  await sendForgotPasswordOtpEmail({
    to: user.email,
    name: user.name,
    otp,
  });

  return {
    email: user.email,
    devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
  };
};

/**
 * Service xử lý đặt lại mật khẩu bằng mã OTP.
 */
export const resetPasswordService = async (
  user: any,
  newPassword: string
) => {
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  otpStore.delete(user.email);
  return null;
};

/**
 * Service xử lý đổi mật khẩu.
 */
export const changePasswordService = async (
  user: any,
  newPassword: string
) => {
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  return null;
};

/**
 * Service xử lý token refresh (Token Rotation).
 */
export const tokenRefreshService = async (savedToken: any, user: any) => {
  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  try {
    await prisma.$transaction([
      prisma.refreshToken.delete({
        where: { id: savedToken.id },
      }),
      prisma.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    // Đăng ký Refresh Token cũ vừa mới xoay vòng vào Grace Window (15 giây)
    registerRotatedToken(savedToken.token, {
      newAccessToken,
      newRefreshToken,
      user,
    });

    return {
      newAccessToken,
      newRefreshToken,
    };
  } catch (error: any) {
    console.error('Lỗi khi thực hiện refresh token transaction:', error);
    throw new AppError(
      'Refresh token không hợp lệ hoặc phiên làm việc đã bị thay đổi.',
      401,
      'INVALID_REFRESH_TOKEN'
    );
  }
};

/**
 * Service xử lý đăng xuất.
 */
export const logoutService = async (refreshToken?: string) => {
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }
  return null;
};

/**
 * Service lấy thông tin cá nhân.
 */
export const getMeService = async (reqUser: any) => {
  return { user: reqUser };
};
