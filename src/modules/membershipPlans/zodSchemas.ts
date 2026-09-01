import { z } from 'zod';

/**
 * Schema kiểm tra query params khi lấy danh sách gói hội viên
 */
export const getMembershipPlansQuerySchema = z.object({
  isActive: z.enum(['true', 'false']).optional()
});

/**
 * Schema kiểm tra params khi lấy chi tiết gói hội viên theo ID/Code
 */
export const getMembershipPlanByIdParamsSchema = z.object({
  id: z.string().min(1, { message: 'Mã gói hội viên không hợp lệ' })
});

/**
 * Schema kiểm tra phần tử tính năng trong planFeatures
 */
export const planFeatureInputSchema = z.object({
  featureId: z.coerce.number({ message: 'Mã tính năng phải là số' }),
  isAvailable: z.boolean()
});

/**
 * Schema kiểm tra body khi tạo mới gói hội viên
 */
export const createMembershipPlanBodySchema = z.object({
  name: z.string({ message: 'Tên gói hội viên là bắt buộc.' }),
  tagLine: z.string().nullable().optional(),
  monthlyPrice: z.coerce.number().optional(),
  yearlyPrice: z.coerce.number().optional(),
  yearlyDiscountPercent: z.coerce.number().optional(),
  popularBadge: z.string().nullable().optional(),
  buttonText: z.string().nullable().optional(),
  planFeatures: z.array(planFeatureInputSchema).optional(),
  tierLevel: z.coerce.number().optional(),
  isActive: z.boolean().optional()
});

/**
 * Schema kiểm tra params & body khi cập nhật gói hội viên
 */
export const updateMembershipPlanSchema = z.object({
  params: z.object({
    id: z.string().min(1, { message: 'Mã gói hội viên không hợp lệ' })
  }),
  body: z.object({
    name: z.string().optional(),
    tagLine: z.string().nullable().optional(),
    monthlyPrice: z.coerce.number().optional(),
    yearlyPrice: z.coerce.number().optional(),
    yearlyDiscountPercent: z.coerce.number().optional(),
    popularBadge: z.string().nullable().optional(),
    buttonText: z.string().nullable().optional(),
    planFeatures: z.array(planFeatureInputSchema).optional(),
    tierLevel: z.coerce.number().optional(),
    isActive: z.boolean().optional()
  })
});

/**
 * Schema kiểm tra params khi bật/tắt nhanh trạng thái gói hội viên
 */
export const toggleMembershipPlanStatusParamsSchema = z.object({
  id: z.string().min(1, { message: 'Mã gói hội viên không hợp lệ' })
});

/**
 * Schema kiểm tra params khi xóa gói hội viên
 */
export const deleteMembershipPlanParamsSchema = z.object({
  id: z.string().min(1, { message: 'Mã gói hội viên không hợp lệ' })
});

export type GetMembershipPlansQuery = z.infer<typeof getMembershipPlansQuerySchema>;
export type CreateMembershipPlanBody = z.infer<typeof createMembershipPlanBodySchema>;
export type UpdateMembershipPlanBody = z.infer<typeof updateMembershipPlanSchema>['body'];
