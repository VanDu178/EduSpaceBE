import prisma from '../../config/db';
import { AppError } from '../../utils/appError';
import {
  getPaymentAccountsQuerySchema,
  paymentAccountIdParamSchema,
} from './zodSchemas';

/**
 * 1. Validate cho API Lấy danh sách tài khoản thanh toán
 */
export const validateGetPaymentAccounts = (query: unknown) => {
  const parsed = getPaymentAccountsQuerySchema.safeParse(query);
  return {
    keyword: parsed.success ? parsed.data.keyword : (query as any)?.keyword
  };
};

/**
 * 2. Validate cho API Lấy tài khoản thanh toán mặc định
 */
export const validateGetDefaultPaymentAccount = () => {
  return true;
};

/**
 * 3. Validate cho API Lấy chi tiết tài khoản thanh toán theo ID
 */
export const validateGetPaymentAccountById = async (params: unknown) => {
  const paramParsed = paymentAccountIdParamSchema.safeParse(params);
  if (!paramParsed.success) {
    throw new AppError('ID tài khoản thanh toán không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const numericId = paramParsed.data.id;
  const paymentAccount = await prisma.paymentAccount.findUnique({
    where: { id: numericId },
    include: {
      bank: true
    }
  });

  if (!paymentAccount) {
    throw new AppError('Tài khoản thanh toán không tồn tại', 404, 'NOT_FOUND');
  }

  return { numericId, paymentAccount };
};

/**
 * 4. Validate cho API Tạo mới tài khoản thanh toán
 */
export const validateCreatePaymentAccount = async (body: any) => {
  const { bankCode, accountNo, accountHolder, qrCodeUrl, isDefault, note } = body || {};

  if (!bankCode || !accountNo || !accountHolder) {
    throw new AppError(
      'Vui lòng nhập đầy đủ Mã ngân hàng, Số tài khoản và Tên chủ tài khoản.',
      400,
      'VALIDATION_ERROR',
      {
        bankCode: !bankCode ? ['Mã ngân hàng là bắt buộc.'] : [],
        accountNo: !accountNo ? ['Số tài khoản là bắt buộc.'] : [],
        accountHolder: !accountHolder ? ['Tên chủ tài khoản là bắt buộc.'] : []
      }
    );
  }

  const cleanBankCode = bankCode.trim().toUpperCase();
  const cleanAccountNo = accountNo.trim();
  const cleanAccountHolder = accountHolder.trim().toUpperCase();

  // Kiểm tra trùng lặp cặp (bankCode + accountNo)
  const existingDuplicate = await prisma.paymentAccount.findFirst({
    where: {
      bankCode: cleanBankCode,
      accountNo: cleanAccountNo
    }
  });

  if (existingDuplicate) {
    throw new AppError('Tài khoản ngân hàng với Số tài khoản này đã tồn tại trong hệ thống.', 400, 'VALIDATION_ERROR');
  }

  // Tự động gán mặc định nếu đây là tài khoản đầu tiên của hệ thống
  const totalCount = await prisma.paymentAccount.count();
  const shouldBeDefault = totalCount === 0 ? true : Boolean(isDefault);

  return {
    createData: {
      bankCode: cleanBankCode,
      accountNo: cleanAccountNo,
      accountHolder: cleanAccountHolder,
      qrCodeUrl: qrCodeUrl ? qrCodeUrl.trim() : null,
      isDefault: shouldBeDefault,
      note: note ? note.trim() : null
    },
    shouldBeDefault
  };
};

/**
 * 5. Validate cho API Cập nhật tài khoản thanh toán
 */
export const validateUpdatePaymentAccount = async (params: unknown, body: any) => {
  const paramParsed = paymentAccountIdParamSchema.safeParse(params);
  if (!paramParsed.success) {
    throw new AppError('ID tài khoản thanh toán không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const numericId = paramParsed.data.id;
  const existingAccount = await prisma.paymentAccount.findUnique({
    where: { id: numericId }
  });

  if (!existingAccount) {
    throw new AppError('Tài khoản thanh toán không tồn tại', 404, 'NOT_FOUND');
  }

  const { bankCode, accountNo, accountHolder, qrCodeUrl, isDefault, note } = body || {};

  const checkBankCode = bankCode !== undefined ? bankCode.trim().toUpperCase() : existingAccount.bankCode;
  const checkAccountNo = accountNo !== undefined ? accountNo.trim() : existingAccount.accountNo;

  // Kiểm tra trùng lặp cặp (bankCode + accountNo) với bản ghi khác
  const existingDuplicate = await prisma.paymentAccount.findFirst({
    where: {
      bankCode: checkBankCode,
      accountNo: checkAccountNo,
      id: { not: numericId }
    }
  });

  if (existingDuplicate) {
    throw new AppError('Tài khoản ngân hàng với Số tài khoản này đã tồn tại trong hệ thống.', 400, 'VALIDATION_ERROR');
  }

  // Không cho phép bỏ mặc định nếu đây đang là tài khoản mặc định
  if (isDefault === false && existingAccount.isDefault) {
    throw new AppError('Cần đảm bảo hệ thống có một tài khoản mặc định đang nhận tiền', 400, 'VALIDATION_ERROR');
  }

  const shouldBeDefault = isDefault !== undefined ? Boolean(isDefault) : existingAccount.isDefault;

  const updateData: any = {
    bankCode: checkBankCode,
    accountNo: checkAccountNo,
    isDefault: shouldBeDefault
  };

  if (accountHolder !== undefined) updateData.accountHolder = accountHolder.trim().toUpperCase();
  if (qrCodeUrl !== undefined) updateData.qrCodeUrl = qrCodeUrl ? qrCodeUrl.trim() : null;
  if (note !== undefined) updateData.note = note ? note.trim() : null;

  return {
    numericId,
    existingAccount,
    updateData,
    shouldBeDefault
  };
};

/**
 * 6. Validate cho API Bật/Tắt trạng thái mặc định (Ủy quyền cho validateSetDefaultPaymentAccount)
 */
export const validateTogglePaymentAccountStatus = async (params: unknown) => {
  return validateSetDefaultPaymentAccount(params);
};

/**
 * 7. Validate cho API Thiết lập tài khoản thanh toán mặc định
 */
export const validateSetDefaultPaymentAccount = async (params: unknown) => {
  const paramParsed = paymentAccountIdParamSchema.safeParse(params);
  if (!paramParsed.success) {
    throw new AppError('ID tài khoản thanh toán không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const numericId = paramParsed.data.id;
  const existingAccount = await prisma.paymentAccount.findUnique({
    where: { id: numericId }
  });

  if (!existingAccount) {
    throw new AppError('Tài khoản thanh toán không tồn tại', 404, 'NOT_FOUND');
  }

  // Nếu tài khoản đang làm mặc định và Admin bấm tắt -> Chặn lại
  if (existingAccount.isDefault) {
    throw new AppError('Cần đảm bảo hệ thống có một tài khoản mặc định đang nhận tiền', 400, 'VALIDATION_ERROR');
  }

  return { numericId, existingAccount };
};

/**
 * 8. Validate cho API Xóa tài khoản thanh toán
 */
export const validateDeletePaymentAccount = async (params: unknown) => {
  const paramParsed = paymentAccountIdParamSchema.safeParse(params);
  if (!paramParsed.success) {
    throw new AppError('ID tài khoản thanh toán không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const numericId = paramParsed.data.id;
  const existingAccount = await prisma.paymentAccount.findUnique({
    where: { id: numericId }
  });

  if (!existingAccount) {
    throw new AppError('Tài khoản thanh toán không tồn tại', 404, 'NOT_FOUND');
  }

  // 1. Kiểm tra xem tài khoản này đã có giao dịch phát sinh chưa
  const existingTransaction = await prisma.paymentTransaction.findFirst({
    where: { paymentAccountId: numericId },
    select: { id: true }
  });

  if (existingTransaction) {
    throw new AppError('Tài khoản thanh toán này đã có lịch sử giao dịch, không thể xóa.', 400, 'VALIDATION_ERROR');
  }

  // 2. Chặn xóa nếu tài khoản đang làm mặc định nhận tiền
  if (existingAccount.isDefault) {
    throw new AppError('Không thể xóa tài khoản đang nhận tiền mặc định. Vui lòng chuyển trạng thái nhận tiền sang một tài khoản khác trước khi xóa.', 400, 'VALIDATION_ERROR');
  }

  return { numericId, existingAccount };
};
