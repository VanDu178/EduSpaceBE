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
 * TẦNG 1: Zod Schemas kiểm tra cú pháp & tham số truyền vào
 */

export const getRefundsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(10),
});

export const createRefundSchema = z.object({
  paymentTxId: z.coerce
    .number(err('Mã giao dịch không hợp lệ', 'VALIDATION_ERROR', 400))
    .int(err('Mã giao dịch không hợp lệ', 'VALIDATION_ERROR', 400))
    .positive(err('Mã giao dịch không hợp lệ', 'VALIDATION_ERROR', 400)),
  amount: z.coerce
    .number(err('Số tiền hoàn phải lớn hơn 0', 'VALIDATION_ERROR', 400))
    .positive(err('Số tiền hoàn phải lớn hơn 0', 'VALIDATION_ERROR', 400)),
  refundRef: z.string().optional().nullable(),
  proofUrls: z.array(z.string()).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateRefundSchema = z.object({
  id: z.coerce
    .number(err('ID phiếu hoàn tiền không hợp lệ', 'VALIDATION_ERROR', 400))
    .int(err('ID phiếu hoàn tiền không hợp lệ', 'VALIDATION_ERROR', 400))
    .positive(err('ID phiếu hoàn tiền không hợp lệ', 'VALIDATION_ERROR', 400)),
  amount: z.coerce
    .number(err('Số tiền hoàn phải lớn hơn 0', 'VALIDATION_ERROR', 400))
    .positive(err('Số tiền hoàn phải lớn hơn 0', 'VALIDATION_ERROR', 400))
    .optional(),
  refundRef: z.string().optional().nullable(),
  proofUrls: z.array(z.string()).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type GetRefundsQueryInput = z.infer<typeof getRefundsQuerySchema>;
export type CreateRefundInput = z.infer<typeof createRefundSchema>;
export type UpdateRefundInput = z.infer<typeof updateRefundSchema>;
