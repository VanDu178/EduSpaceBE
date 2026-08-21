import type { Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/db';
import { AppError } from '../utils/appError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/responseHelper';
import { sendResetPasswordEmail } from '../utils/emailService';
import type { AuthenticatedRequest } from '../middlewares/authMiddleware';

/**
 * Lấy danh sách người dùng (Admin only).
 */
export const getUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const keyword = req.query.keyword as string;
  const role = req.query.role as string;
  const status = req.query.status as string;

  const where: any = {};

  if (keyword) {
    where.OR = [
      { name: { contains: keyword } },
      { email: { contains: keyword } }
    ];
  }

  if (role && role !== 'ALL') {
    where.role = role;
  }

  if (status && status !== 'ALL') {
    where.status = status;
  }

  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    }),
    prisma.user.count({ where })
  ]);

  const totalPages = Math.ceil(total / limit);

  return sendSuccess(
    res,
    {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    },
    'Lấy danh sách người dùng thành công'
  );
});

/**
 * Tạo tài khoản mới (Admin only).
 */
export const createUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { email, password, name, role } = req.body;

  // Validation
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

  // Kiểm tra trùng email
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

  // Hash mật khẩu
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Tạo user
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role: role || 'client'
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return sendSuccess(res, { user }, 'Tạo tài khoản thành công', 201);
});

/**
 * Cập nhật tài khoản (Admin only).
 */
export const updateUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = parseInt(req.params.id as string, 10);
  const { email, name, role } = req.body;

  if (isNaN(userId)) {
    throw new AppError('ID tài khoản không hợp lệ', 400, 'BAD_REQUEST');
  }

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

  // Kiểm tra trùng email
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

  // Cập nhật user
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      email,
      name,
      role: role || 'client'
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return sendSuccess(res, { user: updatedUser }, 'Cập nhật tài khoản thành công');
});

/**
 * Đặt lại mật khẩu (Admin only).
 */
export const resetPassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = parseInt(req.params.id as string, 10);

  if (isNaN(userId)) {
    throw new AppError('ID tài khoản không hợp lệ', 400, 'BAD_REQUEST');
  }

  // Kiểm tra user tồn tại
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new AppError('Không tìm thấy tài khoản người dùng', 404, 'NOT_FOUND');
  }

  // Sinh mật khẩu mới ngẫu nhiên (8 ký tự)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let newPassword = '';
  for (let i = 0; i < 8; i++) {
    newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  // Hash mật khẩu mới
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

  // Lưu vào database
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword }
  });

  // Đường dẫn đăng nhập
  const clientUrl = process.env.CLIENT_FE_URL || process.env.CLIENT_URL || 'http://localhost:3000';
  const loginUrl = `${clientUrl}/login`;

  // Gửi email thông tin mật khẩu mới cho người dùng
  await sendResetPasswordEmail({
    to: user.email,
    name: user.name,
    newPassword,
    loginUrl
  });

  return sendSuccess(
    res,
    {
      email: user.email,
      newPassword,
      loginUrl
    },
    'Đặt lại mật khẩu thành công và thông tin đã được gửi về email đăng ký.'
  );
});

/**
 * Khóa hoặc mở khóa tài khoản người dùng (Admin only).
 */
export const toggleUserStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = parseInt(req.params.id as string, 10);
  const { status } = req.body;

  if (isNaN(userId)) {
    throw new AppError('ID tài khoản không hợp lệ', 400, 'BAD_REQUEST');
  }

  if (!status || (status !== 'active' && status !== 'locked')) {
    throw new AppError('Trạng thái không hợp lệ. Chỉ chấp nhận "active" hoặc "locked".', 400, 'BAD_REQUEST');
  }

  // Không cho phép tự khóa chính bản thân
  if (req.user?.id === userId && status === 'locked') {
    throw new AppError('Không được phép tự khóa tài khoản của chính mình.', 400, 'BAD_REQUEST');
  }

  // Kiểm tra user tồn tại
  const targetUser = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!targetUser) {
    throw new AppError('Không tìm thấy tài khoản người dùng', 404, 'NOT_FOUND');
  }

  // Cập nhật trạng thái
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { status },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });

  // Nếu tài khoản bị khóa, thu hồi (xóa) toàn bộ refresh token để buộc logout ngay lập tức
  if (status === 'locked') {
    await prisma.refreshToken.deleteMany({
      where: { userId }
    });
  }

  const statusMsg = status === 'locked' ? 'Khóa tài khoản thành công' : 'Mở khóa tài khoản thành công';
  return sendSuccess(res, { user: updatedUser }, statusMsg);
});
