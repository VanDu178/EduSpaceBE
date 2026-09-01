import prisma from '../../config/db';
import { AppError } from '../../utils/appError';
import {
  getUsersQuerySchema,
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  toggleUserStatusSchema,
} from './zodSchemas';
import { USER_STATUS } from '../auth/constants';

/**
 * 1. Validate cho getUsers (Admin only)
 */
export async function validateGetUsersData(query: unknown) {
  const parseResult = getUsersQuerySchema.safeParse(query);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'Tham số truy vấn không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  return parseResult.data;
}

/**
 * 2. Validate cho createUser (Admin only)
 */
export async function validateCreateUserData(body: any) {
  createUserSchema.safeParse(body);

  const { email, password, name, role } = body || {};

  // Validation email và password bắt buộc
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

  // Kiểm tra email hợp lệ
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new AppError(
      'Email không hợp lệ.',
      400,
      'VALIDATION_ERROR',
      { email: ['Email không hợp lệ.'] }
    );
  }

  // Kiểm tra trùng email trong DB
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    throw new AppError(
      'Email đã được sử dụng trong hệ thống.',
      400,
      'DUPLICATE_RESOURCE',
      { email: ['Email đã được sử dụng trong hệ thống.'] }
    );
  }

  return { email, password, name, role };
}

/**
 * 3. Validate cho updateUser (Admin only)
 */
export async function validateUpdateUserData(params: any, body: any) {
  const parseResult = updateUserSchema.safeParse({ ...params, ...body });
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'Dữ liệu không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'BAD_REQUEST';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  const userId = parseResult.data.id;
  const { email, name, role } = body || {};

  if (!email) {
    throw new AppError('Email là bắt buộc', 400, 'VALIDATION_ERROR', {
      email: ['Email là bắt buộc']
    });
  }

  // Kiểm tra user tồn tại
  const targetUser = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!targetUser) {
    throw new AppError('Không tìm thấy tài khoản người dùng', 404, 'NOT_FOUND');
  }

  // Kiểm tra trùng email với tài khoản khác
  const existingUser = await prisma.user.findFirst({
    where: {
      email,
      id: { not: userId }
    }
  });

  if (existingUser) {
    throw new AppError(
      'Email đã được sử dụng bởi tài khoản khác.',
      400,
      'DUPLICATE_RESOURCE',
      { email: ['Email đã được sử dụng bởi tài khoản khác.'] }
    );
  }

  return { userId, email, name, role };
}

/**
 * 4. Validate cho resetPassword (Admin only)
 */
export async function validateResetPasswordData(params: any) {
  const parseResult = resetPasswordSchema.safeParse(params);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'ID tài khoản không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'BAD_REQUEST';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  const userId = parseResult.data.id;

  // Kiểm tra user tồn tại
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new AppError('Không tìm thấy tài khoản người dùng', 404, 'NOT_FOUND');
  }

  return { userId, user };
}

/**
 * 5. Validate cho toggleUserStatus (Admin only)
 */
export async function validateToggleUserStatusData(currentUserId: number | undefined, params: any, body: any) {
  const parseResult = toggleUserStatusSchema.safeParse({ ...params, ...body });
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'Dữ liệu không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'BAD_REQUEST';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  const userId = parseResult.data.id;
  const { status } = body || {};

  if (!status || (status !== USER_STATUS.ACTIVE && status !== USER_STATUS.LOCKED)) {
    throw new AppError('Trạng thái không hợp lệ. Chỉ chấp nhận "active" hoặc "locked".', 400, 'BAD_REQUEST');
  }

  // Không cho phép tự khóa chính bản thân
  if (currentUserId === userId && status === USER_STATUS.LOCKED) {
    throw new AppError('Không được phép tự khóa tài khoản của chính mình.', 400, 'BAD_REQUEST');
  }

  // Kiểm tra user tồn tại
  const targetUser = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!targetUser) {
    throw new AppError('Không tìm thấy tài khoản người dùng', 404, 'NOT_FOUND');
  }

  return { userId, status };
}
