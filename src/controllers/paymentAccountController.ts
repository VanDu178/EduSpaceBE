import type { Request, Response } from 'express';
import prisma from '../config/db';
import { AppError } from '../utils/appError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/responseHelper';

/**
 * Lấy danh sách tài khoản thanh toán (Hỗ trợ lọc tìm kiếm và trạng thái).
 */
export const getPaymentAccounts = asyncHandler(async (req: Request, res: Response) => {
  const keyword = req.query.keyword as string;
  const status = req.query.status as string; // 'ALL', 'active', 'inactive'

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

  if (status && status !== 'ALL') {
    where.isActive = status === 'active';
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
 * Lấy tài khoản thanh toán mặc định đang kích hoạt (Dành cho Checkout Client).
 */
export const getDefaultPaymentAccount = asyncHandler(async (_req: Request, res: Response) => {
  let defaultAccount = await prisma.paymentAccount.findFirst({
    where: {
      isDefault: true,
      isActive: true
    },
    include: {
      bank: true
    }
  });

  // Nếu chưa chọn tài khoản mặc định, tự động lấy tài khoản đang kích hoạt mới nhất
  if (!defaultAccount) {
    defaultAccount = await prisma.paymentAccount.findFirst({
      where: {
        isActive: true
      },
      include: {
        bank: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

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
  const { bankCode, accountNo, accountHolder, qrCodeUrl, isDefault, isActive, note } = req.body;

  if (!bankCode || !accountNo || !accountHolder) {
    throw new AppError('Vui lòng nhập đầy đủ Mã ngân hàng, Số tài khoản và Tên chủ tài khoản.', 400, 'VALIDATION_ERROR', {
      bankCode: !bankCode ? ['Mã ngân hàng là bắt buộc.'] : [],
      accountNo: !accountNo ? ['Số tài khoản là bắt buộc.'] : [],
      accountHolder: !accountHolder ? ['Tên chủ tài khoản là bắt buộc.'] : []
    });
  }

  const shouldBeDefault = Boolean(isDefault);

  const paymentAccount = await prisma.$transaction(async (tx) => {
    if (shouldBeDefault) {
      await tx.paymentAccount.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      });
    }

    return await tx.paymentAccount.create({
      data: {
        bankCode: bankCode.trim().toUpperCase(),
        accountNo: accountNo.trim(),
        accountHolder: accountHolder.trim().toUpperCase(),
        qrCodeUrl: qrCodeUrl ? qrCodeUrl.trim() : null,
        isDefault: shouldBeDefault,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
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
  const { bankCode, accountNo, accountHolder, qrCodeUrl, isDefault, isActive, note } = req.body;

  if (isNaN(numericId)) {
    throw new AppError('ID tài khoản thanh toán không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const existingAccount = await prisma.paymentAccount.findUnique({
    where: { id: numericId }
  });

  if (!existingAccount) {
    throw new AppError('Tài khoản thanh toán không tồn tại', 404, 'NOT_FOUND');
  }

  const updateData: any = {};

  if (bankCode !== undefined) updateData.bankCode = bankCode.trim().toUpperCase();
  if (accountNo !== undefined) updateData.accountNo = accountNo.trim();
  if (accountHolder !== undefined) updateData.accountHolder = accountHolder.trim().toUpperCase();
  if (qrCodeUrl !== undefined) updateData.qrCodeUrl = qrCodeUrl ? qrCodeUrl.trim() : null;
  if (isActive !== undefined) updateData.isActive = Boolean(isActive);
  if (note !== undefined) updateData.note = note ? note.trim() : null;

  const shouldBeDefault = isDefault !== undefined ? Boolean(isDefault) : existingAccount.isDefault;
  updateData.isDefault = shouldBeDefault;

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
 * Bật/Tắt trạng thái kích hoạt tài khoản thanh toán (Admin).
 */
export const togglePaymentAccountStatus = asyncHandler(async (req: Request, res: Response) => {
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

  const updatedAccount = await prisma.paymentAccount.update({
    where: { id: numericId },
    data: { isActive: !existingAccount.isActive }
  });

  const message = updatedAccount.isActive
    ? 'Đã kích hoạt tài khoản thanh toán'
    : 'Đã vô hiệu hóa tài khoản thanh toán';

  return sendSuccess(res, { paymentAccount: updatedAccount }, message);
});

/**
 * Thiết lập tài khoản thanh toán mặc định (Admin).
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

  const nextIsDefault = !existingAccount.isDefault;

  const paymentAccount = await prisma.$transaction(async (tx) => {
    if (nextIsDefault) {
      await tx.paymentAccount.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      });
    }

    return await tx.paymentAccount.update({
      where: { id: numericId },
      data: nextIsDefault
        ? { isDefault: true, isActive: true }
        : { isDefault: false }
    });
  });

  const message = paymentAccount.isDefault
    ? 'Đã thiết lập tài khoản làm mặc định'
    : 'Đã bỏ trạng thái mặc định của tài khoản';

  return sendSuccess(res, { paymentAccount }, message);
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

  await prisma.paymentAccount.delete({
    where: { id: numericId }
  });

  return sendSuccess(res, null, 'Đã xóa tài khoản thanh toán thành công');
});
