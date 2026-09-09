import { z } from 'zod';
import { SOURCE_TYPES, VIDEO_STATUS, VIDEO_PROCESS_STATUS } from './constants';

/**
 * TẦNG 1: Zod Schemas Kiểm Tra Cú Pháp & Định Dạng Đầu Vào (Videos)
 */

const sourceTypesTuple = [SOURCE_TYPES.DIRECT_UPLOAD, SOURCE_TYPES.YOUTUBE] as [string, ...string[]];
const videoStatusTuple = [VIDEO_STATUS.DRAFT, VIDEO_STATUS.PUBLISHED, VIDEO_STATUS.ARCHIVED] as [string, ...string[]];
const videoProcessStatusTuple = [VIDEO_PROCESS_STATUS.PROCESSING, VIDEO_PROCESS_STATUS.READY, VIDEO_PROCESS_STATUS.FAILED] as [string, ...string[]];

// Schema tạo mới Video
export const createVideoSchema = z.object({
  title: z
    .string({ message: 'Tiêu đề video là bắt buộc' })
    .min(2, { message: 'Tiêu đề video phải có ít nhất 2 ký tự' })
    .max(255, { message: 'Tiêu đề video tối đa 255 ký tự' }),
  code: z
    .string()
    .optional()
    .transform((val) => (val ? val.trim().toUpperCase() : undefined)),
  slug: z.string().optional(),
  description: z.string().optional().nullable(),
  sourceType: z
    .enum(sourceTypesTuple, {
      message: 'Phân loại nguồn video không hợp lệ (direct_upload hoặc youtube)',
    })
    .default(SOURCE_TYPES.YOUTUBE),
  youtubeVideoId: z.string().optional().nullable(),
  storagePath: z.string().optional().nullable(),
  duration: z.coerce.number({ message: 'Thời lượng video không hợp lệ' }).min(0, { message: 'Thời lượng video phải lớn hơn hoặc bằng 0' }).default(0),
  teaserDuration: z.coerce.number({ message: 'Thời gian Teaser không hợp lệ' }).min(0, { message: 'Thời gian xem thử Teaser phải lớn hơn hoặc bằng 0' }).default(0),
  thumbnailUrl: z.string().optional().nullable(),
  isPremium: z.coerce.boolean().default(false),
  status: z
    .enum(videoStatusTuple, {
      message: 'Trạng thái video không hợp lệ',
    })
    .default(VIDEO_STATUS.DRAFT),
  videoTypeId: z.coerce.number({ message: 'Loại video là bắt buộc' }).int().positive(),
}).refine(
  (data) => {
    if (data.duration && data.duration > 0 && data.teaserDuration && data.teaserDuration > 0) {
      return data.teaserDuration <= data.duration;
    }
    return true;
  },
  {
    message: 'Thời gian xem thử không được lớn hơn tổng thời lượng video',
    path: ['teaserDuration'],
  }
);

// Schema cập nhật Video
export const updateVideoSchema = z.object({
  title: z
    .string()
    .min(2, { message: 'Tiêu đề video phải có ít nhất 2 ký tự' })
    .max(255, { message: 'Tiêu đề video tối đa 255 ký tự' })
    .optional(),
  code: z
    .string()
    .optional()
    .transform((val) => (val ? val.trim().toUpperCase() : undefined)),
  slug: z.string().optional(),
  description: z.string().optional().nullable(),
  sourceType: z
    .enum(sourceTypesTuple, {
      message: 'Phân loại nguồn video không hợp lệ (direct_upload hoặc youtube)',
    })
    .optional(),
  youtubeVideoId: z.string().optional().nullable(),
  storagePath: z.string().optional().nullable(),
  duration: z.coerce.number().min(0).optional(),
  teaserDuration: z.coerce.number().min(0).optional(),
  thumbnailUrl: z.string().optional().nullable(),
  isPremium: z.coerce.boolean().optional(),
  status: z
    .enum(videoStatusTuple, {
      message: 'Trạng thái video không hợp lệ',
    })
    .optional(),
  processStatus: z
    .enum(videoProcessStatusTuple, {
      message: 'Trạng thái xử lý video không hợp lệ',
    })
    .optional(),
  videoTypeId: z.coerce.number().int().positive().optional(),
}).refine(
  (data) => {
    if (data.duration && data.duration > 0 && data.teaserDuration && data.teaserDuration > 0) {
      return data.teaserDuration <= data.duration;
    }
    return true;
  },
  {
    message: 'Thời gian xem thử không được lớn hơn tổng thời lượng video',
    path: ['teaserDuration'],
  }
);

// Schema cập nhật nhanh trạng thái (status)
export const updateVideoStatusSchema = z.object({
  status: z.enum(videoStatusTuple, {
    message: 'Trạng thái video phải là draft, published hoặc archived',
  }),
});

// Schema cập nhật nhanh quyền truy cập Premium (isPremium)
export const updateVideoAccessSchema = z.object({
  isPremium: z.coerce.boolean({ message: 'Trạng thái Premium là bắt buộc' }),
  teaserDuration: z.coerce.number({ message: 'Thời gian xem thử không hợp lệ' }).min(0).optional(),
});

// Schema truy vấn danh sách Video (Query parameters)
export const queryVideoSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(10),
  search: z.string().optional(),
  videoTypeId: z.coerce.number().int().positive().optional(),
  sourceType: z.enum(sourceTypesTuple).optional(),
  status: z.enum(videoStatusTuple).optional(),
  processStatus: z.enum(videoProcessStatusTuple).optional(),
  isPremium: z
    .string()
    .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined))
    .optional(),
  sortBy: z.enum(['createdAt', 'title', 'duration', 'code'] as [string, ...string[]]).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc'] as [string, ...string[]]).default('desc'),
});

// Schema yêu cầu Dynamic HLS Playlist
export const getHlsPlaylistSchema = z.object({
  identifier: z.string({ message: 'Mã định danh hoặc slug video là bắt buộc' }),
  variant: z.string().optional(),
});

export type CreateVideoInput = z.infer<typeof createVideoSchema>;
export type UpdateVideoInput = z.infer<typeof updateVideoSchema>;
export type QueryVideoInput = z.infer<typeof queryVideoSchema>;

