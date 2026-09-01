/**
 * HẰNG SỐ VÀ MAPPING CHO MODULE BLOGS (BLOG CONSTANTS)
 */

export const BLOG_STATUS = {
  ALL: 'ALL',
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;

export type BlogStatus = typeof BLOG_STATUS[keyof typeof BLOG_STATUS];

export const VALID_BLOG_STATUSES: BlogStatus[] = Object.values(BLOG_STATUS);
