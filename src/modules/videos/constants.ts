/**
 * HẰNG SỐ & MAPPING CHO MODULE VIDEOS
 */

// Phân loại nguồn Video (source_type)
export const SOURCE_TYPES = {
  DIRECT_UPLOAD: 'direct_upload',
  YOUTUBE: 'youtube',
} as const;

export type SourceType = (typeof SOURCE_TYPES)[keyof typeof SOURCE_TYPES];

// Loại Video cố định hệ thống (VideoType)
export const VIDEO_TYPES = {
  ACADEMY: {
    CODE: 'ACADEMY',
    NAME: 'Học thuật',
  },
  MARKET_ANALYSIS: {
    CODE: 'MARKET_ANALYSIS',
    NAME: 'Nhận định thị trường',
  },
} as const;

export type VideoTypeCode = keyof typeof VIDEO_TYPES;

// Trạng thái Video (status)
export const VIDEO_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;

export type VideoStatus = (typeof VIDEO_STATUS)[keyof typeof VIDEO_STATUS];

// Mã lỗi Module Video
export const VIDEO_ERROR_CODES = {
  NOT_FOUND: 'VIDEO_NOT_FOUND',
  CODE_EXISTS: 'VIDEO_CODE_EXISTS',
  SLUG_EXISTS: 'VIDEO_SLUG_EXISTS',
  INVALID_TYPE: 'INVALID_VIDEO_TYPE',
  INVALID_SOURCE: 'INVALID_SOURCE_TYPE',
  CREATE_FAILED: 'VIDEO_CREATE_FAILED',
  UPDATE_FAILED: 'VIDEO_UPDATE_FAILED',
  DELETE_FAILED: 'VIDEO_DELETE_FAILED',
  VALIDATION_ERROR: 'VIDEO_VALIDATION_ERROR',
} as const;
