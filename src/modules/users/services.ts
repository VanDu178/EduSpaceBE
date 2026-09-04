import bcrypt from 'bcrypt';
import prisma from '../../config/db';
import { generateUserCode } from './utils';
import { sendResetPasswordEmail } from '../../services/emailService';
import { USER_STATUS } from '../auth/constants';
import type { GetUsersQueryInput } from './zodSchemas';

/**
 * 1. Service lấy danh sách người dùng phân trang
 */
export async function getUsersService(queryData: GetUsersQueryInput) {
  const page = queryData.page || 1;
  const limit = queryData.limit || 10;
  const { keyword, role, status } = queryData;

  const where: any = {};

  if (keyword) {
    where.OR = [
      { name: { contains: keyword } },
      { email: { contains: keyword } },
      { code: { contains: keyword } }
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
        code: true,
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

  return {
    users,
    pagination: {
      total,
      page,
      limit,
      totalPages
    }
  };
}

/**
 * 2. Service tạo tài khoản mới (Admin)
 */
export async function createUserService(validData: {
  email: string;
  password: string;
  name?: string | null;
  role?: string;
}) {
  const { email, password, name, role } = validData;

  // Hash mật khẩu
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Tạo user
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role: (role as any) || 'client'
    }
  });

  const code = generateUserCode(user.id);
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { code },
    select: {
      id: true,
      code: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return { user: updatedUser };
}

/**
 * 3. Service cập nhật tài khoản (Admin)
 */
export async function updateUserService(
  userId: number,
  validData: { email: string; name?: string | null; role?: string }
) {
  const { email, name, role } = validData;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      email,
      name,
      role: (role as any) || 'client'
    },
    select: {
      id: true,
      code: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return { user: updatedUser };
}

/**
 * 4. Service đặt lại mật khẩu và gửi email
 */
export async function resetPasswordService(user: { id: number; email: string; name?: string | null }) {
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
    where: { id: user.id },
    data: { password: hashedPassword }
  });

  // Đường dẫn đăng nhập
  const clientUrl = process.env.CLIENT_FE_URL;
  const loginUrl = `${clientUrl}/login`;

  // Gửi email thông tin mật khẩu mới cho người dùng
  await sendResetPasswordEmail({
    to: user.email,
    name: user.name,
    newPassword,
    loginUrl
  });

  return {
    email: user.email,
    newPassword,
    loginUrl
  };
}

/**
 * 5. Service khóa/mở khóa tài khoản người dùng
 */
export async function toggleUserStatusService(userId: number, status: string) {
  // Cập nhật trạng thái
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { status: status as any },
    select: {
      id: true,
      code: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });

  // Nếu tài khoản bị khóa, thu hồi (xóa) toàn bộ refresh token để buộc logout ngay lập tức
  if (status === USER_STATUS.LOCKED) {
    await prisma.refreshToken.deleteMany({
      where: { userId }
    });
  }

  const message = status === USER_STATUS.LOCKED ? 'Khóa tài khoản thành công' : 'Mở khóa tài khoản thành công';

  return {
    user: updatedUser,
    message
  };
}
