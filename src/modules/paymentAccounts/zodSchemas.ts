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
  params: { errorCode, statusCode }
});

/**
 * Schema kiểm tra Query Params khi lấy danh sách tài khoản thanh toán
 */
export const getPaymentAccountsQuerySchema = z.object({
  keyword: z.string().trim().optional()
});

/**
 * Schema kiểm tra Params ID tài khoản thanh toán trên URL
 */
export const paymentAccountIdParamSchema = z.object({
  id: z.coerce
    .number(err('ID tài khoản thanh toán không hợp lệ'))
    .int(err('ID tài khoản thanh toán không hợp lệ'))
    .positive(err('ID tài khoản thanh toán không hợp lệ'))
});

/**
 * Schema kiểm tra dữ liệu Body khi tạo tài khoản thanh toán
 */
export const createPaymentAccountSchema = z.object({
  bankCode: z.string().trim().min(1, 'Mã ngân hàng là bắt buộc.'),
  accountNo: z.string().trim().min(1, 'Số tài khoản là bắt buộc.'),
  accountHolder: z.string().trim().min(1, 'Tên chủ tài khoản là bắt buộc.'),
  qrCodeUrl: z.string().trim().nullable().optional(),
  isDefault: z.boolean().optional(),
  note: z.string().trim().nullable().optional()
});

/**
 * Schema kiểm tra dữ liệu Body khi cập nhật tài khoản thanh toán
 */
export const updatePaymentAccountSchema = z.object({
  bankCode: z.string().trim().min(1, 'Mã ngân hàng là bắt buộc.').optional(),
  accountNo: z.string().trim().min(1, 'Số tài khoản là bắt buộc.').optional(),
  accountHolder: z.string().trim().min(1, 'Tên chủ tài khoản là bắt buộc.').optional(),
  qrCodeUrl: z.string().trim().nullable().optional(),
  isDefault: z.boolean().optional(),
  note: z.string().trim().nullable().optional()
});

export type GetPaymentAccountsQueryInput = z.infer<typeof getPaymentAccountsQuerySchema>;
export type PaymentAccountIdParamInput = z.infer<typeof paymentAccountIdParamSchema>;
export type CreatePaymentAccountInput = z.infer<typeof createPaymentAccountSchema>;
export type UpdatePaymentAccountInput = z.infer<typeof updatePaymentAccountSchema>;
