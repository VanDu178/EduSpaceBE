/**
 * HẰNG SỐ CHUẨN DUY NHẤT DÙNG CHO CÁC MÃ THỂ LOẠI BÀI VIẾT
 * Tất cả các mã đều viết dưới dạng IN HOA (UPPERCASE)
 */
export interface DefaultBlogType {
  code: string;
  name: string;
  description?: string | null;
}

export const BLOG_TYPE_CODES = {
  MINDSET: 'MINDSET',
  METHODOLOGY: 'METHODOLOGY',
  QUANT: 'QUANT',
} as const;

export type BlogTypeCode = (typeof BLOG_TYPE_CODES)[keyof typeof BLOG_TYPE_CODES];

export const DEFAULT_BLOG_TYPES: DefaultBlogType[] = [
  {
    code: BLOG_TYPE_CODES.MINDSET,
    name: 'Tư duy',
    description: 'Các bài viết về tư duy phát triển, mindset lập trình và định hướng.',
  },
  {
    code: BLOG_TYPE_CODES.METHODOLOGY,
    name: 'Phương pháp',
    description: 'Các bài viết chia sẻ về phương pháp học tập, làm việc hiệu quả.',
  },
  {
    code: BLOG_TYPE_CODES.QUANT,
    name: 'Quant',
    description: 'Các bài viết chuyên sâu về phân tích định lượng, thuật toán.',
  },
];
