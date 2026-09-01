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

export const getVietqrBanksQuerySchema = z.object({
  keyword: z.string().optional(),
  status: z.string().optional(),
});

export const getVietqrBankByIdParamsSchema = z.object({
  id: z.coerce
    .number(err('ID ngân hàng không hợp lệ', 'VALIDATION_ERROR', 400))
    .int(err('ID ngân hàng không hợp lệ', 'VALIDATION_ERROR', 400))
    .positive(err('ID ngân hàng không hợp lệ', 'VALIDATION_ERROR', 400)),
});

export const toggleVietqrBankStatusParamsSchema = z.object({
  id: z.coerce
    .number(err('ID ngân hàng không hợp lệ', 'VALIDATION_ERROR', 400))
    .int(err('ID ngân hàng không hợp lệ', 'VALIDATION_ERROR', 400))
    .positive(err('ID ngân hàng không hợp lệ', 'VALIDATION_ERROR', 400)),
});

export type GetVietqrBanksQueryInput = z.infer<typeof getVietqrBanksQuerySchema>;
export type GetVietqrBankByIdParamsInput = z.infer<typeof getVietqrBankByIdParamsSchema>;
export type ToggleVietqrBankStatusParamsInput = z.infer<typeof toggleVietqrBankStatusParamsSchema>;
