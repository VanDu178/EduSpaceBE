import { z } from 'zod';

/**
 * TẦNG 1: ZOD SCHEMAS KIỂM TRA CÚ PHÁP VÀ ĐỊNH DẠNG ĐẦU VÀO MODULE AUTH
 */

export const registerSchema = z.object({
  email: z
    .string({ message: 'Email là bắt buộc.' })
    .min(1, 'Email là bắt buộc.')
    .email('Email không đúng định dạng.'),
  password: z
    .string({ message: 'Mật khẩu là bắt buộc.' })
    .min(8, 'Mật khẩu phải chứa ít nhất 8 ký tự.'),
  name: z.string().optional(),
  role: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z
    .string({ message: 'Email là bắt buộc.' })
    .min(1, 'Email là bắt buộc.'),
  password: z
    .string({ message: 'Mật khẩu là bắt buộc.' })
    .min(1, 'Mật khẩu là bắt buộc.'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const googleLoginSchema = z
  .object({
    idToken: z.string().optional(),
    accessToken: z.string().optional(),
  })
  .refine((data) => data.idToken || data.accessToken, {
    message: 'Google Token là bắt buộc.',
  });

export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .string({ message: 'Email là bắt buộc.' })
    .min(1, 'Email là bắt buộc.')
    .email('Email không đúng định dạng.'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  email: z
    .string({ message: 'Email là bắt buộc.' })
    .min(1, 'Email là bắt buộc.'),
  otp: z
    .string({ message: 'Mã OTP là bắt buộc.' })
    .min(1, 'Mã OTP là bắt buộc.'),
  newPassword: z
    .string({ message: 'Mật khẩu mới là bắt buộc.' })
    .min(8, 'Mật khẩu mới phải chứa ít nhất 8 ký tự.'),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  oldPassword: z
    .string({ message: 'Mật khẩu hiện tại là bắt buộc.' })
    .min(1, 'Mật khẩu hiện tại là bắt buộc.'),
  newPassword: z
    .string({ message: 'Mật khẩu mới là bắt buộc.' })
    .min(8, 'Mật khẩu mới phải chứa ít nhất 8 ký tự.'),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
