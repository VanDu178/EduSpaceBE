import prisma from '../../config/db';
import { AppError } from '../../utils/appError';
import {
  getVietqrBanksQuerySchema,
  getVietqrBankByIdParamsSchema,
  toggleVietqrBankStatusParamsSchema,
} from './zodSchemas';

/**
 * 1. Validate cho getVietqrBanks (Admin only)
 */
export async function validateGetVietqrBanksData(query: unknown) {
  const parseResult = getVietqrBanksQuerySchema.safeParse(query);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'Tham số tìm kiếm không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  return parseResult.data;
}

/**
 * 2. Validate cho getVietqrBankById (Admin only)
 */
export async function validateGetVietqrBankByIdData(params: unknown) {
  const parseResult = getVietqrBankByIdParamsSchema.safeParse(params);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'ID ngân hàng không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  const numericId = parseResult.data.id;

  const bank = await prisma.vietqrBank.findUnique({
    where: { id: numericId },
  });

  if (!bank) {
    throw new AppError('Ngân hàng không tồn tại trong hệ thống', 404, 'NOT_FOUND');
  }

  return { bankId: numericId, bank };
}

/**
 * 3. Validate cho syncVietqrBanks (Admin only)
 */
export async function validateSyncVietqrBanksData() {
  return {};
}

/**
 * 4. Validate cho toggleVietqrBankStatus (Admin only)
 */
export async function validateToggleVietqrBankStatusData(params: unknown) {
  const parseResult = toggleVietqrBankStatusParamsSchema.safeParse(params);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'ID ngân hàng không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  const numericId = parseResult.data.id;

  const existingBank = await prisma.vietqrBank.findUnique({
    where: { id: numericId },
  });

  if (!existingBank) {
    throw new AppError('Ngân hàng không tồn tại trong hệ thống', 404, 'NOT_FOUND');
  }

  // Nếu đang muốn vô hiệu hóa ngân hàng (từ active -> inactive), kiểm tra xem có tài khoản thanh toán nào đang hoạt động liên kết không
  if (existingBank.isActive) {
    const activePaymentAccounts = await prisma.paymentAccount.findMany({
      where: {
        bankCode: existingBank.code,
        isDefault: true,
      },
      select: {
        id: true,
        accountNo: true,
        accountHolder: true,
        isDefault: true,
      },
    });

    if (activePaymentAccounts.length > 0) {
      const errorMessage = `Không thể vô hiệu hóa ngân hàng "${existingBank.shortName}" vì đang có ${activePaymentAccounts.length} tài khoản thanh toán đang hoạt động liên kết với ngân hàng này.`;
      throw new AppError(errorMessage, 400, 'BANK_IN_USE');
    }
  }

  return { bankId: numericId, existingBank };
}
