import { z } from 'zod';
import { BILLING_CYCLES, SUBSCRIPTION_STATUS } from './constants';

/**
 * Helper định nghĩa thông điệp lỗi kèm Mã lỗi đặc thù (errorCode) và Status Code
 */
export const err = (
  message: string,
  errorCode: string = 'VALIDATION_ERROR',
  statusCode: number = 400
) => ({
  message,
  params: { errorCode, statusCode },
});

/**
 * TẦNG 1: Zod Schemas kiểm tra cú pháp & tham số truyền vào
 */

export const getSubscriptionByIdParamsSchema = z.object({
  id: z.coerce
    .number(err('Mã đăng ký không hợp lệ', 'VALIDATION_ERROR', 400))
    .int(err('Mã đăng ký không hợp lệ', 'VALIDATION_ERROR', 400))
    .positive(err('Mã đăng ký không hợp lệ', 'VALIDATION_ERROR', 400)),
});

export const createSubscriptionSchema = z.object({
  userId: z.coerce.number().int().positive().optional().nullable(),
  planId: z.coerce
    .number(err('Gói hội viên không hợp lệ', 'VALIDATION_ERROR', 400))
    .int(err('Gói hội viên không hợp lệ', 'VALIDATION_ERROR', 400))
    .positive(err('Gói hội viên không hợp lệ', 'VALIDATION_ERROR', 400)),
  billingCycle: z
    .enum(['monthly', 'yearly'])
    .optional()
    .default(BILLING_CYCLES.MONTHLY),
  paymentMethod: z.string().optional().nullable(),
  paymentRef: z.string().optional().nullable(),
  status: z.string().optional().default(SUBSCRIPTION_STATUS.ACTIVE),
  notes: z.string().optional().nullable(),
  proofUrls: z.array(z.string()).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

export const getSubscriptionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(10),
  userId: z.coerce.number().int().positive().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
});

export const updateSubscriptionStatusSchema = z.object({
  id: z.coerce
    .number(err('Mã đăng ký không hợp lệ', 'VALIDATION_ERROR', 400))
    .int(err('Mã đăng ký không hợp lệ', 'VALIDATION_ERROR', 400))
    .positive(err('Mã đăng ký không hợp lệ', 'VALIDATION_ERROR', 400)),
  userId: z.coerce.number().int().positive().optional().nullable(),
  planId: z.coerce.number().int().positive().optional().nullable(),
  billingCycle: z.enum(['monthly', 'yearly']).optional().nullable(),
  status: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  paymentRef: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  proofUrls: z.array(z.string()).optional().nullable(),
});

export const deleteSubscriptionParamsSchema = z.object({
  id: z.coerce
    .number(err('Mã đăng ký không hợp lệ', 'VALIDATION_ERROR', 400))
    .int(err('Mã đăng ký không hợp lệ', 'VALIDATION_ERROR', 400))
    .positive(err('Mã đăng ký không hợp lệ', 'VALIDATION_ERROR', 400)),
});

export type GetSubscriptionByIdParamsInput = z.infer<typeof getSubscriptionByIdParamsSchema>;
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type GetSubscriptionsQueryInput = z.infer<typeof getSubscriptionsQuerySchema>;
export type UpdateSubscriptionStatusInput = z.infer<typeof updateSubscriptionStatusSchema>;
export type DeleteSubscriptionParamsInput = z.infer<typeof deleteSubscriptionParamsSchema>;
