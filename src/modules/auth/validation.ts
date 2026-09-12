import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../../config/db';
import { verifyRefreshToken, getRecentlyRotatedToken } from './utils';
import { AppError } from '../../utils/appError';
import { USER_STATUS } from './constants';
import {
  registerSchema,
  loginSchema,
  googleLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from './zodSchemas';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * TẦNG 2: KIỂM TRA DỮ LIỆU DATABASE & QUYỀN SỞ HỮU TÀI NGUYÊN MODULE AUTH
 */

/**
 * Validate dữ liệu đăng ký tài khoản.
 */
export const validateRegisterData = async (body: any) => {
  const parseResult = registerSchema.safeParse(body);
  if (!parseResult.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parseResult.error.issues) {
      const field = issue.path[0] as string;
      if (!fieldErrors[field]) {
        fieldErrors[field] = [];
      }
      fieldErrors[field].push(issue.message);
    }

    const { email, password } = body || {};
    if (!email || !password) {
      throw new AppError(
        'Email và mật khẩu là bắt buộc.',
        400,
        'VALIDATION_ERROR',
        fieldErrors
      );
    }

    if (password && password.length < 8) {
      throw new AppError(
        'Mật khẩu phải chứa ít nhất 8 ký tự.',
        400,
        'VALIDATION_ERROR',
        fieldErrors
      );
    }

    throw new AppError(
      'Dữ liệu đăng ký không hợp lệ.',
      400,
      'VALIDATION_ERROR',
      fieldErrors
    );
  }

  const { email, password, name, role } = parseResult.data;

  // Kiểm tra email đã tồn tại trong DB chưa
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new AppError(
      'Email đã được đăng ký sử dụng trong hệ thống.',
      400,
      'DUPLICATE_RESOURCE',
      { email: ['Email đã được đăng ký sử dụng trong hệ thống.'] }
    );
  }

  return { email, password, name, role };
};

/**
 * Validate dữ liệu đăng nhập.
 */
export const validateLoginData = async (body: any) => {
  const parseResult = loginSchema.safeParse(body);
  if (!parseResult.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parseResult.error.issues) {
      const field = issue.path[0] as string;
      if (!fieldErrors[field]) {
        fieldErrors[field] = [];
      }
      fieldErrors[field].push(issue.message);
    }

    throw new AppError(
      'Email và mật khẩu là bắt buộc.',
      400,
      'VALIDATION_ERROR',
      fieldErrors
    );
  }

  const { email, password } = parseResult.data;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AppError(
      'Email hoặc mật khẩu không chính xác.',
      401,
      'INVALID_CREDENTIALS'
    );
  }

  if (user.status === USER_STATUS.LOCKED) {
    throw new AppError(
      'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
      401,
      'UNAUTHORIZED'
    );
  }

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

  return user;
};

/**
 * Validate dữ liệu đăng nhập Google.
 */
export const validateGoogleLoginData = async (body: any) => {
  const parseResult = googleLoginSchema.safeParse(body);
  if (!parseResult.success) {
    throw new AppError(
      'Google Token là bắt buộc.',
      400,
      'VALIDATION_ERROR'
    );
  }

  const { idToken, accessToken: googleAccessToken } = parseResult.data;

  let email: string | undefined;
  let name: string | undefined;
  let picture: string | undefined;
  let googleId: string | undefined;

  if (googleAccessToken) {
    try {
      const userInfoRes = await fetch(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: { Authorization: `Bearer ${googleAccessToken}` },
        }
      );
      if (userInfoRes.ok) {
        const payload: any = await userInfoRes.json();
        email = payload?.email;
        name = payload?.name;
        picture = payload?.picture;
        googleId = payload?.sub;
      }
    } catch (error) {
      throw new AppError(
        'Google Access Token không hợp lệ hoặc đã hết hạn.',
        401,
        'INVALID_CREDENTIALS'
      );
    }
  } else if (idToken) {
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
      throw new AppError(
        'Google ID Token không hợp lệ hoặc đã hết hạn.',
        401,
        'INVALID_CREDENTIALS'
      );
    }
  }

  if (!email || !googleId) {
    throw new AppError(
      'Không thể xác thực thông tin tài khoản Google.',
      400,
      'INVALID_CREDENTIALS'
    );
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ googleId }, { email }],
    },
  });

  if (existingUser && existingUser.status === USER_STATUS.LOCKED) {
    throw new AppError(
      'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
      401,
      'UNAUTHORIZED'
    );
  }

  return { email, name, picture, googleId, existingUser };
};

/**
 * Validate dữ liệu yêu cầu quên mật khẩu.
 */
export const validateForgotPasswordData = async (body: any) => {
  const parseResult = forgotPasswordSchema.safeParse(body);
  if (!parseResult.success) {
    throw new AppError(
      'Email là bắt buộc.',
      400,
      'VALIDATION_ERROR',
      { email: ['Email là bắt buộc.'] }
    );
  }

  const { email } = parseResult.data;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AppError(
      'Email không tồn tại trong hệ thống.',
      404,
      'NOT_FOUND',
      { email: ['Email không tồn tại trong hệ thống.'] }
    );
  }

  if (user.status === USER_STATUS.LOCKED) {
    throw new AppError(
      'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
      401,
      'UNAUTHORIZED'
    );
  }

  return user;
};

/**
 * Validate dữ liệu đặt lại mật khẩu bằng mã OTP.
 */
export const validateResetPasswordData = async (
  body: any,
  otpStore: Map<string, { otp: string; expiresAt: number }>
) => {
  console.log('das');

  const parseResult = resetPasswordSchema.safeParse(body);
  if (!parseResult.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parseResult.error.issues) {
      const field = issue.path[0] as string;
      if (!fieldErrors[field]) {
        fieldErrors[field] = [];
      }
      fieldErrors[field].push(issue.message);
    }

    const { newPassword } = body || {};
    if (newPassword && newPassword.length < 8) {
      throw new AppError(
        'Mật khẩu mới phải chứa ít nhất 8 ký tự.',
        400,
        'VALIDATION_ERROR',
        { newPassword: ['Mật khẩu mới phải chứa ít nhất 8 ký tự.'] }
      );
    }

    throw new AppError(
      'Vui lòng điền đầy đủ thông tin yêu cầu.',
      400,
      'VALIDATION_ERROR',
      fieldErrors
    );
  }

  const { email, otp, newPassword } = parseResult.data;

  const storedData = otpStore.get(email);
  if (!storedData) {
    throw new AppError(
      'Yêu cầu OTP không tồn tại hoặc đã hết hạn. Vui lòng gửi lại yêu cầu.',
      400,
      'INVALID_OTP'
    );
  }

  if (Date.now() > storedData.expiresAt) {
    otpStore.delete(email);
    throw new AppError(
      'Mã OTP đã hết hạn. Vui lòng lấy mã mới.',
      400,
      'EXPIRED_OTP'
    );
  }

  if (storedData.otp !== otp.trim()) {
    throw new AppError(
      'Mã OTP xác thực không chính xác. Vui lòng kiểm tra lại!',
      400,
      'INVALID_OTP'
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError(
      'Không tìm thấy tài khoản người dùng.',
      404,
      'NOT_FOUND'
    );
  }

  return { user, newPassword };
};

/**
 * Validate dữ liệu đổi mật khẩu.
 */
export const validateChangePasswordData = async (
  userId: number | undefined,
  body: any
) => {
  if (userId === undefined) {
    throw new AppError(
      'Yêu cầu xác thực tài khoản.',
      401,
      'UNAUTHORIZED'
    );
  }

  const parseResult = changePasswordSchema.safeParse(body);
  if (!parseResult.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parseResult.error.issues) {
      const field = issue.path[0] as string;
      if (!fieldErrors[field]) {
        fieldErrors[field] = [];
      }
      fieldErrors[field].push(issue.message);
    }

    const { newPassword } = body || {};
    if (newPassword && newPassword.length < 8) {
      throw new AppError(
        'Mật khẩu mới phải chứa ít nhất 8 ký tự.',
        400,
        'VALIDATION_ERROR',
        { newPassword: ['Mật khẩu mới phải chứa ít nhất 8 ký tự.'] }
      );
    }

    throw new AppError(
      'Vui lòng nhập đầy đủ mật khẩu.',
      400,
      'VALIDATION_ERROR',
      fieldErrors
    );
  }

  const { oldPassword, newPassword } = parseResult.data;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(
      'Không tìm thấy tài khoản người dùng.',
      404,
      'NOT_FOUND'
    );
  }

  if (!user.password) {
    throw new AppError(
      'Tài khoản này được đăng ký bằng Google, không có mật khẩu ban đầu để thay đổi.',
      400,
      'BAD_REQUEST'
    );
  }

  const isPasswordMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isPasswordMatch) {
    throw new AppError(
      'Mật khẩu hiện tại không chính xác.',
      400,
      'INVALID_CREDENTIALS',
      { oldPassword: ['Mật khẩu hiện tại không chính xác.'] }
    );
  }

  return { user, newPassword };
};

/**
 * Validate dữ liệu refresh token.
 */
export const validateTokenRefreshData = async (cookies: any) => {
  const { refreshToken } = cookies || {};

  if (!refreshToken) {
    throw new AppError(
      'Refresh token không tồn tại.',
      401,
      'REFRESH_TOKEN_MISSING'
    );
  }

  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded) {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
    throw new AppError(
      'Refresh token hết hạn hoặc không hợp lệ.',
      401,
      'INVALID_REFRESH_TOKEN'
    );
  }

  const savedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!savedToken) {
    // Kiểm tra xem token này có vừa mới được xoay vòng gần đây (Grace Period 15 giây) hay không
    const recentlyRotated = getRecentlyRotatedToken(refreshToken);
    if (recentlyRotated) {
      return {
        isGracePeriod: true,
        newAccessToken: recentlyRotated.newAccessToken,
        newRefreshToken: recentlyRotated.newRefreshToken,
        user: recentlyRotated.user,
      };
    }

    await prisma.refreshToken.deleteMany({
      where: { userId: decoded.userId },
    });
    throw new AppError(
      'Phát hiện tấn công Replay Attack. Refresh token không hợp lệ.',
      403,
      'REFRESH_TOKEN_REUSE'
    );
  }

  if (new Date() > savedToken.expiresAt) {
    await prisma.refreshToken.delete({
      where: { id: savedToken.id },
    });
    throw new AppError(
      'Refresh token hết hạn.',
      401,
      'EXPIRED_REFRESH_TOKEN'
    );
  }

  const user = savedToken.user;
  if (user.status === USER_STATUS.LOCKED) {
    throw new AppError(
      'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
      401,
      'UNAUTHORIZED'
    );
  }

  return { savedToken, user };
};

/**
 * Validate dữ liệu logout.
 */
export const validateLogoutData = (cookies: any) => {
  const { refreshToken } = cookies || {};
  return { refreshToken };
};

/**
 * Validate dữ liệu lấy thông tin người dùng hiện tại (getMe).
 */
export const validateGetMeData = (reqUser: any) => {
  if (!reqUser) {
    throw new AppError(
      'Yêu cầu xác thực tài khoản.',
      401,
      'UNAUTHORIZED'
    );
  }
  return reqUser;
};
