import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';
import type { AuthenticatedRequest } from '../../middlewares/authMiddleware';
import { REFRESH_TOKEN_COOKIE_OPTIONS } from '../../config/jwt';
import {
  validateRegisterData,
  validateLoginData,
  validateGoogleLoginData,
  validateForgotPasswordData,
  validateResetPasswordData,
  validateChangePasswordData,
  validateTokenRefreshData,
  validateLogoutData,
  validateGetMeData,
} from './validation';
import {
  registerService,
  loginService,
  googleLoginService,
  forgotPasswordService,
  resetPasswordService,
  changePasswordService,
  tokenRefreshService,
  logoutService,
  getMeService,
  otpStore,
} from './services';

/**
 * TẦNG THIN CONTROLLER MODULE AUTH
 */

/**
 * Đăng ký tài khoản người dùng / Admin mới.
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const validData = await validateRegisterData(req.body);
  const result = await registerService(validData);
  return sendSuccess(
    res,
    result,
    'Đăng ký tài khoản thành công',
    201
  );
});

/**
 * Đăng nhập tài khoản.
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const user = await validateLoginData(req.body);
  const result = await loginService(user);
  res.cookie('refreshToken', result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
  return sendSuccess(
    res,
    {
      accessToken: result.accessToken,
      user: result.user,
    },
    'Đăng nhập thành công!'
  );
});

/**
 * Đăng nhập / Đăng ký bằng Google OAuth.
 */
export const googleLogin = asyncHandler(async (req: Request, res: Response) => {
  const googleData = await validateGoogleLoginData(req.body);
  const result = await googleLoginService(googleData);
  res.cookie('refreshToken', result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
  return sendSuccess(
    res,
    { accessToken: result.accessToken, user: result.user },
    'Đăng nhập bằng Google thành công'
  );
});

/**
 * Yêu cầu mã khôi phục mật khẩu (Forgot Password).
 */
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const user = await validateForgotPasswordData(req.body);
  const result = await forgotPasswordService(user);
  return sendSuccess(
    res,
    result,
    'Mã xác nhận khôi phục mật khẩu đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư!'
  );
});

/**
 * Đặt lại mật khẩu bằng mã OTP (Reset Password).
 */
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { user, newPassword } = await validateResetPasswordData(
    req.body,
    otpStore
  );
  await resetPasswordService(user, newPassword);
  return sendSuccess(
    res,
    null,
    'Đặt lại mật khẩu thành công! Vui lòng đăng nhập với mật khẩu mới.'
  );
});

/**
 * Đổi mật khẩu tài khoản (Change Password).
 */
export const changePassword = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const { user, newPassword } = await validateChangePasswordData(
      userId,
      req.body
    );
    await changePasswordService(user, newPassword);
    return sendSuccess(res, null, 'Đổi mật khẩu thành công!');
  }
);

/**
 * Xoay vòng Refresh Token (Token Refresh / Rotation).
 */
export const tokenRefresh = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { savedToken, user } = await validateTokenRefreshData(req.cookies);
    const result = await tokenRefreshService(savedToken, user);
    res.cookie('refreshToken', result.newRefreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
    return sendSuccess(
      res,
      { accessToken: result.newAccessToken },
      'Token refresh thành công'
    );
  } catch (error) {
    res.clearCookie('refreshToken', REFRESH_TOKEN_COOKIE_OPTIONS);
    throw error;
  }
});

/**
 * Đăng xuất tài khoản.
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = validateLogoutData(req.cookies);
  await logoutService(refreshToken);
  res.clearCookie('refreshToken', REFRESH_TOKEN_COOKIE_OPTIONS);
  return sendSuccess(res, null, 'Đăng xuất thành công');
});

/**
 * Lấy thông tin người dùng hiện tại (Get Me).
 */
export const getMe = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const reqUser = validateGetMeData(req.user);
    const result = await getMeService(reqUser);
    return sendSuccess(res, result, 'Lấy thông tin user thành công');
  }
);
