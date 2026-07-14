import type { Response } from 'express';

/**
 * Gửi phản hồi API thành công chuẩn hóa.
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message: string = 'Success',
  statusCode: number = 200
) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
    errorCode: null,
    errors: null
  });
};
