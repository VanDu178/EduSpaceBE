import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';
import type { AuthenticatedRequest } from '../../middlewares/authMiddleware';
import {
  validateGetUsersData,
  validateCreateUserData,
  validateUpdateUserData,
  validateResetPasswordData,
  validateToggleUserStatusData,
} from './validation';
import {
  getUsersService,
  createUserService,
  updateUserService,
  resetPasswordService,
  toggleUserStatusService,
} from './services';

/**
 * Lấy danh sách người dùng (Admin only).
 */
export const getUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const queryData = await validateGetUsersData(req.query);
  const result = await getUsersService(queryData);
  return sendSuccess(res, result, 'Lấy danh sách người dùng thành công');
});

/**
 * Tạo tài khoản mới (Admin only).
 */
export const createUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const validData = await validateCreateUserData(req.body);
  const result = await createUserService(validData);
  return sendSuccess(res, result, 'Tạo tài khoản thành công', 201);
});

/**
 * Cập nhật tài khoản (Admin only).
 */
export const updateUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const validData = await validateUpdateUserData(req.params, req.body);
  const result = await updateUserService(validData.userId, validData);
  return sendSuccess(res, result, 'Cập nhật tài khoản thành công');
});

/**
 * Đặt lại mật khẩu (Admin only).
 */
export const resetPassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { user } = await validateResetPasswordData(req.params);
  const result = await resetPasswordService(user);
  return sendSuccess(
    res,
    result,
    'Đặt lại mật khẩu thành công và thông tin đã được gửi về email đăng ký.'
  );
});

/**
 * Khóa hoặc mở khóa tài khoản người dùng (Admin only).
 */
export const toggleUserStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const currentUserId = req.user?.id;
  const { userId, status } = await validateToggleUserStatusData(currentUserId, req.params, req.body);
  const result = await toggleUserStatusService(userId, status);
  return sendSuccess(res, { user: result.user }, result.message);
});
