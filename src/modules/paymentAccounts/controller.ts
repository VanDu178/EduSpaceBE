import type { Request, Response } from 'express';
import prisma from '../../config/db';
import { AppError } from '../../utils/appError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';

/**
 * Lấy danh sách tài khoản thanh toán (Hỗ trợ lọc tìm kiếm).
 */
export const getPaymentAccounts = asyncHandler(async (req: Request, res: Response) => {
  const keyword = req.query.keyword as string;

  const where: any = {};

  if (keyword) {
    where.OR = [
      { bankCode: { contains: keyword } },
      { accountNo: { contains: keyword } },
      { accountHolder: { contains: keyword } },
      {
        bank: {
          OR: [
            { name: { contains: keyword } },
            { shortName: { contains: keyword } }
          ]
        }
      }
    ];
  }

  const paymentAccounts = await prisma.paymentAccount.findMany({
    where,
    include: {
      bank: true
    },
    orderBy: [
      { isDefault: 'desc' },
      { createdAt: 'desc' }
    ]
  });

  return sendSuccess(res, { paymentAccounts }, 'Lấy danh sách tài khoản thanh toán thành công');
});

/**
 * Lấy tài khoản thanh toán mặc định đang nhận tiền (Dành cho Checkout Client).
 */
export const getDefaultPaymentAccount = asyncHandler(async (_req: Request, res: Response) => {
  const defaultAccount = await prisma.paymentAccount.findFirst({
    where: {
      isDefault: true,
      bank: { isActive: true }
    },
    include: {
      bank: true
    }
  });

  return sendSuccess(res, { paymentAccount: defaultAccount }, 'Lấy tài khoản thanh toán mặc định thành công');
});

/**
 * Lấy chi tiết tài khoản thanh toán theo ID.
 */
export const getPaymentAccountById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const numericId = parseInt(id as string, 10);

  if (isNaN(numericId)) {
    throw new AppError('ID tài khoản thanh toán không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const paymentAccount = await prisma.paymentAccount.findUnique({
    where: { id: numericId },
    include: {
      bank: true
    }
  });

  if (!paymentAccount) {
    throw new AppError('Tài khoản thanh toán không tồn tại', 404, 'NOT_FOUND');
  }

  return sendSuccess(res, { paymentAccount }, 'Lấy chi tiết tài khoản thanh toán thành công');
});

/**
 * Tạo mới tài khoản thanh toán (Admin).
 */
export const createPaymentAccount = asyncHandler(async (req: Request, res: Response) => {
  const { bankCode, accountNo, accountHolder, qrCodeUrl, isDefault, note } = req.body;

  if (!bankCode || !accountNo || !accountHolder) {
    throw new AppError('Vui lòng nhập đầy đủ Mã ngân hàng, Số tài khoản và Tên chủ tài khoản.', 400, 'VALIDATION_ERROR', {
      bankCode: !bankCode ? ['Mã ngân hàng là bắt buộc.'] : [],
      accountNo: !accountNo ? ['Số tài khoản là bắt buộc.'] : [],
      accountHolder: !accountHolder ? ['Tên chủ tài khoản là bắt buộc.'] : []
    });
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

  const paymentAccount = await prisma.$transaction(async (tx) => {
    if (shouldBeDefault) {
      await tx.paymentAccount.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      });
    }

    return await tx.paymentAccount.create({
      data: {
        bankCode: cleanBankCode,
        accountNo: cleanAccountNo,
        accountHolder: cleanAccountHolder,
        qrCodeUrl: qrCodeUrl ? qrCodeUrl.trim() : null,
        isDefault: shouldBeDefault,
        note: note ? note.trim() : null
      },
      include: {
        bank: true
      }
    });
  });

  return sendSuccess(res, { paymentAccount }, 'Tạo tài khoản thanh toán thành công', 201);
});

/**
 * Cập nhật thông tin tài khoản thanh toán (Admin).
 */
export const updatePaymentAccount = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const numericId = parseInt(id as string, 10);
  const { bankCode, accountNo, accountHolder, qrCodeUrl, isDefault, note } = req.body;

  if (isNaN(numericId)) {
    throw new AppError('ID tài khoản thanh toán không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const existingAccount = await prisma.paymentAccount.findUnique({
    where: { id: numericId }
  });

  if (!existingAccount) {
    throw new AppError('Tài khoản thanh toán không tồn tại', 404, 'NOT_FOUND');
  }

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

  const paymentAccount = await prisma.$transaction(async (tx) => {
    if (shouldBeDefault && !existingAccount.isDefault) {
      await tx.paymentAccount.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      });
    }

    return await tx.paymentAccount.update({
      where: { id: numericId },
      data: updateData,
      include: {
        bank: true
      }
    });
  });

  return sendSuccess(res, { paymentAccount }, 'Cập nhật tài khoản thanh toán thành công');
});

/**
 * Bật/Tắt trạng thái mặc định của tài khoản thanh toán (Admin).
 */
export const togglePaymentAccountStatus = asyncHandler(async (req: Request, res: Response, next: any) => {
  return (setDefaultPaymentAccount as any)(req, res, next);
});

/**
 * Thiết lập tài khoản thanh toán làm mặc định đang nhận tiền (Admin).
 */
export const setDefaultPaymentAccount = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const numericId = parseInt(id as string, 10);

  if (isNaN(numericId)) {
    throw new AppError('ID tài khoản thanh toán không hợp lệ', 400, 'VALIDATION_ERROR');
  }

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

  const paymentAccount = await prisma.$transaction(async (tx) => {
    await tx.paymentAccount.updateMany({
      where: { isDefault: true },
      data: { isDefault: false }
    });

    return await tx.paymentAccount.update({
      where: { id: numericId },
      data: { isDefault: true }
    });
  });

  return sendSuccess(res, { paymentAccount }, 'Đã thiết lập làm tài khoản nhận tiền mặc định');
});

/**
 * Xóa tài khoản thanh toán (Admin).
 */
export const deletePaymentAccount = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const numericId = parseInt(id as string, 10);

  if (isNaN(numericId)) {
    throw new AppError('ID tài khoản thanh toán không hợp lệ', 400, 'VALIDATION_ERROR');
  }

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
    throw new AppError(
      'Tài khoản thanh toán này đã có lịch sử giao dịch, không thể xóa.',
      400,
      'VALIDATION_ERROR'
    );
  }

  // 2. Chặn xóa nếu tài khoản đang làm mặc định nhận tiền
  if (existingAccount.isDefault) {
    throw new AppError(
      'Không thể xóa tài khoản đang nhận tiền mặc định. Vui lòng chuyển trạng thái nhận tiền sang một tài khoản khác trước khi xóa.',
      400,
      'VALIDATION_ERROR'
    );
  }

  await prisma.paymentAccount.delete({
    where: { id: numericId }
  });

  return sendSuccess(res, null, 'Đã xóa tài khoản thanh toán thành công');
});
