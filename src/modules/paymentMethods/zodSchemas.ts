import { z } from 'zod';

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
 * TẦNG 1: Zod Schemas kiểm tra cú pháp & tham số đầu vào
 */

export const paymentMethodIdParamSchema = z.object({
  id: z.coerce
    .number(err('ID phương thức thanh toán không hợp lệ', 'VALIDATION_ERROR', 400))
    .int(err('ID phương thức thanh toán không hợp lệ', 'VALIDATION_ERROR', 400))
    .positive(err('ID phương thức thanh toán không hợp lệ', 'VALIDATION_ERROR', 400)),
});

export const getPaymentMethodsQuerySchema = z.object({
  keyword: z.string().optional(),
  status: z.string().optional(),
});

export const createPaymentMethodSchema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  sortOrder: z.union([z.number(), z.string()]).optional(),
  isActive: z.union([z.boolean(), z.string()]).optional(),
});

export const updatePaymentMethodSchema = z.object({
  id: z.coerce
    .number(err('ID phương thức thanh toán không hợp lệ', 'VALIDATION_ERROR', 400))
    .int(err('ID phương thức thanh toán không hợp lệ', 'VALIDATION_ERROR', 400))
    .positive(err('ID phương thức thanh toán không hợp lệ', 'VALIDATION_ERROR', 400)),
  code: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  sortOrder: z.union([z.number(), z.string()]).optional(),
  isActive: z.union([z.boolean(), z.string()]).optional(),
});

export const updatePaymentMethodSortOrderSchema = z.object({
  id: z.coerce
    .number(err('ID phương thức thanh toán không hợp lệ', 'VALIDATION_ERROR', 400))
    .int(err('ID phương thức thanh toán không hợp lệ', 'VALIDATION_ERROR', 400))
    .positive(err('ID phương thức thanh toán không hợp lệ', 'VALIDATION_ERROR', 400)),
  sortOrder: z.unknown(),
});

export type GetPaymentMethodsQueryInput = z.infer<typeof getPaymentMethodsQuerySchema>;
export type CreatePaymentMethodInput = z.infer<typeof createPaymentMethodSchema>;
export type UpdatePaymentMethodInput = z.infer<typeof updatePaymentMethodSchema>;
