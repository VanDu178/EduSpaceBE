/**
 * Danh sách tất cả các System Feature Codes chính thức của hệ thống.
 * Sử dụng chuẩn định dạng Namespace (resource:action).
 */
export const SYSTEM_FEATURE_CODES = [
  'blog:read_premium',
  'blog:read_free',
  'video:watch_free',
  'video:watch_premium',
  'signal:daily_bias',
  'tool:stock_screener',
  'event:weekend_webinar',
] as const;

export type FeatureCode = (typeof SYSTEM_FEATURE_CODES)[number];

export interface SystemFeatureMetadata {
  code: FeatureCode;
  name: string;
  description: string;
}

/**
 * Danh sách metadata mẫu gợi ý cho các System Feature Codes.
 */
export const SYSTEM_FEATURE_METADATA: Record<FeatureCode, SystemFeatureMetadata> = {
  'blog:read_premium': {
    code: 'blog:read_premium',
    name: 'Đọc các bài viết trả phí',
    description: 'Quyền truy cập và đọc toàn bộ nội dung các bài viết trả phí'
  },
  'blog:read_free': {
    code: 'blog:read_free',
    name: 'Đọc các bài viết miễn phí',
    description: 'Quyền truy cập và đọc toàn bộ các bài viết, tin tức miễn phí'
  },
  'video:watch_free': {
    code: 'video:watch_free',
    name: 'Xem các video chia sẻ kiến thức miễn phí',
    description: 'Quyền truy cập và theo dõi các video bài giảng, chia sẻ kiến thức miễn phí'
  },
  'video:watch_premium': {
    code: 'video:watch_premium',
    name: 'Xem các video chia sẻ kiến thức nâng cao',
    description: 'Mở khóa toàn bộ thư viện video chuyên sâu, phân tích nâng cao'
  },
  'signal:daily_bias': {
    code: 'signal:daily_bias',
    name: 'Tiếp cận nhóm bias & tín hiệu hàng ngày',
    description: 'Quyền tham gia nhóm kín nhận nhận định xu hướng'
  },
  'tool:stock_screener': {
    code: 'tool:stock_screener',
    name: 'Sử dụng công cụ truy vết cổ phiếu tiềm năng',
    description: 'Mở khóa toàn bộ quyền sử dụng bộ lọc và công cụ phân tích cổ phiếu'
  },
  'event:weekend_webinar': {
    code: 'event:weekend_webinar',
    name: 'Tham gia buổi nhận định thị trường cuối tuần',
    description: 'Quyền tham gia các buổi chia sẻ, phân tích xu hướng thị trường'
  }
};

/**
 * Hằng số trạng thái & lọc trạng thái cho tính năng.
 */
export const FEATURE_STATUS = {
  ALL: 'ALL',
  ACTIVE: 'active',
  INACTIVE: 'inactive'
} as const;

export type FeatureStatus = (typeof FEATURE_STATUS)[keyof typeof FEATURE_STATUS];

