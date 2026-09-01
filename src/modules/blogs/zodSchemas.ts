import { z } from 'zod';
import { VALID_BLOG_STATUSES } from './constants';

/**
 * Zod schema kiểm tra param ID bài viết.
 */
export const blogIdParamSchema = z.object({
  id: z.coerce
    .number({ message: 'Bài viết không hợp lệ' })
    .int('Bài viết không hợp lệ')
});

export type BlogIdParamInput = z.infer<typeof blogIdParamSchema>;

/**
 * Zod schema kiểm tra param slug bài viết.
 */
export const blogSlugParamSchema = z.object({
  slug: z
    .string({ message: 'Slug bài viết không hợp lệ' })
    .trim()
    .min(1, 'Slug bài viết không hợp lệ')
});

export type BlogSlugParamInput = z.infer<typeof blogSlugParamSchema>;

/**
 * Zod schema kiểm tra query lấy danh sách bài viết.
 */
export const getBlogsQuerySchema = z.object({
  page: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().optional(),
  keyword: z.string().optional(),
  blogType: z.string().optional(),
  status: z.string().optional(),
  isPremium: z.string().optional()
});

export type GetBlogsQueryInput = z.infer<typeof getBlogsQuerySchema>;

/**
 * Zod schema kiểm tra body tạo mới bài viết.
 */
export const createBlogBodySchema = z.object({
  title: z
    .string({ message: 'Tiêu đề bài viết là bắt buộc.' })
    .trim()
    .min(1, 'Tiêu đề bài viết là bắt buộc.'),
  slug: z.string().optional(),
  blogTypeId: z.coerce.number({ message: 'Thể loại bài viết là bắt buộc.' }),
  bannerUrl: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  isPremium: z.boolean().optional(),
  summary: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  createdBy: z.coerce.number().nullable().optional(),
  status: z.string().optional()
});

export type CreateBlogBodyInput = z.infer<typeof createBlogBodySchema>;

/**
 * Zod schema kiểm tra body cập nhật trạng thái bài viết.
 */
export const updateBlogStatusBodySchema = z.object({
  status: z.enum(VALID_BLOG_STATUSES as [string, ...string[]], {
    message: `Trạng thái bài viết phải là một trong các giá trị: ${VALID_BLOG_STATUSES.join(', ')}.`
  })
});

export type UpdateBlogStatusBodyInput = z.infer<typeof updateBlogStatusBodySchema>;

/**
 * Zod schema kiểm tra body cập nhật quyền truy cập bài viết.
 */
export const updateBlogAccessBodySchema = z.object({
  isPremium: z.boolean({
    message: 'Quyền truy cập là bắt buộc và phải là kiểu boolean.'
  })
});

export type UpdateBlogAccessBodyInput = z.infer<typeof updateBlogAccessBodySchema>;
