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

export const getUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(10),
  keyword: z.string().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
});

export const createUserSchema = z.object({
  email: z.string().optional(),
  password: z.string().optional(),
  name: z.string().optional().nullable(),
  role: z.string().optional(),
});

export const updateUserSchema = z.object({
  id: z.coerce
    .number(err('ID tài khoản không hợp lệ', 'BAD_REQUEST', 400))
    .int(err('ID tài khoản không hợp lệ', 'BAD_REQUEST', 400))
    .positive(err('ID tài khoản không hợp lệ', 'BAD_REQUEST', 400)),
  email: z.string().optional(),
  name: z.string().optional().nullable(),
  role: z.string().optional(),
});

export const resetPasswordSchema = z.object({
  id: z.coerce
    .number(err('ID tài khoản không hợp lệ', 'BAD_REQUEST', 400))
    .int(err('ID tài khoản không hợp lệ', 'BAD_REQUEST', 400))
    .positive(err('ID tài khoản không hợp lệ', 'BAD_REQUEST', 400)),
});

export const toggleUserStatusSchema = z.object({
  id: z.coerce
    .number(err('ID tài khoản không hợp lệ', 'BAD_REQUEST', 400))
    .int(err('ID tài khoản không hợp lệ', 'BAD_REQUEST', 400))
    .positive(err('ID tài khoản không hợp lệ', 'BAD_REQUEST', 400)),
  status: z.string().optional(),
});

export type GetUsersQueryInput = z.infer<typeof getUsersQuerySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ToggleUserStatusInput = z.infer<typeof toggleUserStatusSchema>;
