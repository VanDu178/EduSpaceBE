import { z } from 'zod';

/**
 * Zod schema kiểm tra param ID của thể loại blog.
 */
export const blogTypeIdParamSchema = z.object({
  id: z.coerce
    .number({ message: 'Thể loại không hợp lệ' })
    .int('Thể loại không hợp lệ')
});

export type BlogTypeIdParamInput = z.infer<typeof blogTypeIdParamSchema>;

/**
 * Zod schema kiểm tra body khi tạo mới thể loại blog.
 */
export const createBlogTypeBodySchema = z.object({
  name: z.string({ message: 'Tên thể loại là bắt buộc.' }).trim().min(1, 'Tên thể loại là bắt buộc.'),
  code: z.string({ message: 'Mã thể loại là bắt buộc.' }).trim().min(1, 'Mã thể loại là bắt buộc.'),
  description: z.string().nullable().optional()
});

export type CreateBlogTypeBodyInput = z.infer<typeof createBlogTypeBodySchema>;

/**
 * Zod schema kiểm tra body khi cập nhật thể loại blog.
 */
export const updateBlogTypeBodySchema = z.object({
  name: z.string().trim().optional(),
  code: z.string().trim().optional(),
  description: z.string().nullable().optional()
});

export type UpdateBlogTypeBodyInput = z.infer<typeof updateBlogTypeBodySchema>;
