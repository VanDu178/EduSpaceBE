import { z } from 'zod';

/**
 * Zod schema cho query lấy danh sách tính năng.
 */
export const getFeaturesQuerySchema = z.object({
  keyword: z.string().optional(),
  status: z.string().optional()
});

export type GetFeaturesQueryInput = z.infer<typeof getFeaturesQuerySchema>;

/**
 * Zod schema cho param ID tính năng.
 */
export const featureIdParamSchema = z.object({
  id: z.coerce.number({ message: 'ID tính năng không hợp lệ' }).int('ID tính năng không hợp lệ')
});

export type FeatureIdParamInput = z.infer<typeof featureIdParamSchema>;

/**
 * Zod schema cho body tạo tính năng.
 */
export const createFeatureBodySchema = z.object({
  code: z.string({ message: 'Mã tính năng là bắt buộc.' }).trim().min(1, 'Mã tính năng là bắt buộc.'),
  name: z.string({ message: 'Tên tính năng là bắt buộc.' }).trim().min(1, 'Tên tính năng là bắt buộc.'),
  description: z.string().nullable().optional(),
  sortOrder: z.coerce.number().optional().default(0),
  isActive: z.boolean().optional().default(true)
});

export type CreateFeatureBodyInput = z.infer<typeof createFeatureBodySchema>;

/**
 * Zod schema cho body cập nhật tính năng.
 */
export const updateFeatureBodySchema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  sortOrder: z.coerce.number().optional(),
  isActive: z.boolean().optional()
});

export type UpdateFeatureBodyInput = z.infer<typeof updateFeatureBodySchema>;

/**
 * Zod schema cho body cập nhật thứ tự tính năng.
 */
export const updateFeatureSortOrderBodySchema = z.object({
  sortOrder: z.coerce.number({ message: 'Giá trị thứ tự sắp xếp không hợp lệ' })
});

export type UpdateFeatureSortOrderBodyInput = z.infer<typeof updateFeatureSortOrderBodySchema>;
