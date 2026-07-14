import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError';

/**
 * Middleware xử lý lỗi tập trung cho toàn bộ ứng dụng Express.
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Đã xảy ra lỗi hệ thống!';
  let errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';
  let errors = err.errors || null;

  // Log chi tiết lỗi hệ thống (không phải lỗi nghiệp vụ do người dùng nhập liệu)
  if (!err.isOperational) {
    console.error('--- UNHANDLED ERROR ---');
    console.error(err);
    console.error('-----------------------');
    message = 'Đã xảy ra lỗi hệ thống, vui lòng thử lại sau!';
  } else {
    console.warn(`[AppError] ${statusCode} - ${message}`);
  }

  // Xử lý các mã lỗi đặc thù từ Prisma Client
  // P2002: Unique constraint failed (ví dụ: đăng ký trùng email)
  if (err.code === 'P2002') {
    statusCode = 400;
    errorCode = 'DUPLICATE_RESOURCE';
    
    const target = err.meta?.target;
    if (typeof target === 'string') {
      const field = target.split('_')[1] || target;
      message = `Dữ liệu ${field} đã tồn tại trong hệ thống.`;
      errors = {
        [field]: [`${field} đã được sử dụng.`]
      };
    } else if (Array.isArray(target)) {
      message = `Dữ liệu trường ${target.join(', ')} đã tồn tại trong hệ thống.`;
      errors = {};
      target.forEach((field: string) => {
        errors[field] = [`Trường này đã được sử dụng.`];
      });
    } else {
      message = 'Dữ liệu đã tồn tại trong hệ thống.';
    }
  }

  // Trả về response JSON định dạng chuẩn hóa
  res.status(statusCode).json({
    success: false,
    message,
    data: null,
    errorCode,
    errors
  });
};
