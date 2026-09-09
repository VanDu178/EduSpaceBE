import { z } from 'zod';
import { UPLOAD_CONFIG } from './constants';

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

/**
 * Zod Schema cho Bunny Stream Upload
 */
export const initBunnyStreamSchema = z.object({
  title: z.string().min(1, 'Tiêu đề tệp không được để trống'),
});

export type InitBunnyStreamInput = z.infer<typeof initBunnyStreamSchema>;
