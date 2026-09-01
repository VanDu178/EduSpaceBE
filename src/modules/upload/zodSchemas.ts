import { z } from 'zod';
import { UPLOAD_CONFIG } from './constants';

/**
 * Helper định nghĩa thông điệp lỗi kèm Mã lỗi đặc thù (errorCode) và Status Code
 */
export const err = (
  message: string,
  errorCode: string = 'VALIDATION_ERROR',
  statusCode: number = 400
) => ({
  message,
  params: { errorCode, statusCode },
});

/**
 * TẦNG 1: Zod Schemas kiểm tra cú pháp & tham số truyền vào
 */

export const uploadSingleBodySchema = z.object({
  folder: z.string().optional().default(UPLOAD_CONFIG.DEFAULT_FOLDER),
});

export const uploadMultipleBodySchema = z.object({
  folder: z.string().optional().default(UPLOAD_CONFIG.DEFAULT_FOLDER),
});

export const deleteFileQueryOrBodySchema = z.object({
  url: z.string().optional().nullable(),
  path: z.string().optional().nullable(),
});

export type UploadSingleBodyInput = z.infer<typeof uploadSingleBodySchema>;
export type UploadMultipleBodyInput = z.infer<typeof uploadMultipleBodySchema>;
export type DeleteFileQueryOrBodyInput = z.infer<typeof deleteFileQueryOrBodySchema>;
