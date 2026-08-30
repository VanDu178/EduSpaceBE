import { z } from 'zod';
import { BILLING_CYCLES } from '../userSubscriptions/constants';

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
 * TẦNG 1: Schema kiểm tra cú pháp & thiếu dữ liệu từ Client (Custom error code & message)
 */
export const createTransactionSchema = z.object({
  planId: z.coerce
    .number(
      err(
        'Gói dịch vụ không tồn tại hoặc đã ngưng mở bán. Vui lòng chọn gói dịch vụ khác.',
        'PLAN_INACTIVE',
        404
      )
    )
    .int(
      err(
        'Gói dịch vụ không tồn tại hoặc đã ngưng mở bán. Vui lòng chọn gói dịch vụ khác.',
        'PLAN_INACTIVE',
        404
      )
    )
    .positive(
      err(
        'Gói dịch vụ không tồn tại hoặc đã ngưng mở bán. Vui lòng chọn gói dịch vụ khác.',
        'PLAN_INACTIVE',
        404
      )
    ),

  paymentMethod: z
    .string(
      err(
        'Phương thức thanh toán bạn chọn chưa được hổ trợ. Vui lòng chọn phương thức khác.',
        'PAYMENT_METHOD_UNAVAILABLE',
        400
      )
    )
    .trim()
    .min(
      1,
      err(
        'Phương thức thanh toán bạn chọn chưa được hổ trợ. Vui lòng chọn phương thức khác.',
        'PAYMENT_METHOD_UNAVAILABLE',
        400
      )
    ),

  billingCycle: z
    .enum(
      ['monthly', 'yearly'],
      err(
        'Chu kỳ thanh toán không hợp lệ. Vui lòng chọn thanh toán theo tháng hoặc theo năm.',
        'VALIDATION_ERROR',
        400
      )
    )
    .optional()
    .default(BILLING_CYCLES.MONTHLY),

  expectedPrice: z.coerce
    .number(
      err(
        'Thông tin giá của gói dịch vụ đã thay đổi. Vui lòng kiểm tra lại đơn hàng.',
        'VALIDATION_ERROR',
        400
      )
    )
    .positive(
      err(
        'Thông tin giá của gói dịch vụ không hợp lệ. Vui lòng kiểm tra lại đơn hàng.',
        'VALIDATION_ERROR',
        400
      )
    )
    .optional(),
});


export const getTransactionStatusSchema = z.object({
  code: z
    .string(
      err('Mã giao dịch không hợp lệ', 'VALIDATION_ERROR', 400)
    )
    .trim()
    .min(1, err('Mã giao dịch không hợp lệ', 'VALIDATION_ERROR', 400)),
});

export const cancelTransactionSchema = z.object({
  code: z
    .string(err('Mã giao dịch không hợp lệ', 'VALIDATION_ERROR', 400))
    .trim()
    .min(1, err('Mã giao dịch không hợp lệ', 'VALIDATION_ERROR', 400)),
});

export const approveTransactionSchema = z.object({
  id: z.coerce
    .number(err('Mã giao dịch không hợp lệ', 'VALIDATION_ERROR', 400))
    .int(err('Mã giao dịch không hợp lệ', 'VALIDATION_ERROR', 400))
    .positive(err('Mã giao dịch không hợp lệ', 'VALIDATION_ERROR', 400)),
  paymentRef: z.string().trim().optional(),
});

export const downloadInvoicePdfSchema = z.object({
  code: z
    .string(err('Mã giao dịch không hợp lệ', 'VALIDATION_ERROR', 400))
    .trim()
    .min(1, err('Mã giao dịch không hợp lệ', 'VALIDATION_ERROR', 400)),
});

export const getTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(10),
  status: z.string().trim().optional(),
  refundStatus: z.string().trim().optional(),
  search: z.string().trim().optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type GetTransactionStatusInput = z.infer<typeof getTransactionStatusSchema>;
export type CancelTransactionInput = z.infer<typeof cancelTransactionSchema>;
export type ApproveTransactionInput = z.infer<typeof approveTransactionSchema>;
export type DownloadInvoicePdfInput = z.infer<typeof downloadInvoicePdfSchema>;
export type GetTransactionsQueryInput = z.infer<typeof getTransactionsQuerySchema>;


