import type { Request, Response } from 'express';
import prisma from '../../config/db';
import { AppError } from '../../utils/appError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';

/**
 * Lấy danh sách ngân hàng hỗ trợ VietQR (Có tìm kiếm theo từ khóa và lọc trạng thái).
 */
export const getVietqrBanks = asyncHandler(async (req: Request, res: Response) => {
  const keyword = req.query.keyword as string;
  const status = req.query.status as string; // 'ALL', 'active', 'inactive'

  const where: any = {};

  if (keyword) {
    where.OR = [
      { name: { contains: keyword } },
      { shortName: { contains: keyword } },
      { code: { contains: keyword } },
      { bin: { contains: keyword } },
    ];
  }

  if (status && status !== 'ALL') {
    where.isActive = status === 'active';
  }

  const banks = await prisma.vietqrBank.findMany({
    where,
    orderBy: [
      { shortName: 'asc' },
      { id: 'asc' },
    ],
  });

  return sendSuccess(res, { banks }, 'Lấy danh sách ngân hàng thành công');
});

/**
 * Lấy chi tiết thông tin 1 ngân hàng theo ID.
 */
export const getVietqrBankById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const numericId = parseInt(id as string, 10);

  if (isNaN(numericId)) {
    throw new AppError('ID ngân hàng không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const bank = await prisma.vietqrBank.findUnique({
    where: { id: numericId },
  });

  if (!bank) {
    throw new AppError('Ngân hàng không tồn tại trong hệ thống', 404, 'NOT_FOUND');
  }

  return sendSuccess(res, { bank }, 'Lấy chi tiết ngân hàng thành công');
});

/**
 * Đồng bộ danh sách ngân hàng trực tiếp từ API chính thức VietQR (https://api.vietqr.io/v2/banks).
 * Chỉ lọc các ngân hàng có transferSupported === 1.
 */
export const syncVietqrBanks = asyncHandler(async (_req: Request, res: Response) => {
  try {
    const response = await fetch('https://api.vietqr.io/v2/banks');
    if (!response.ok) {
      throw new AppError(`Không thể kết nối tới VietQR API. Mã lỗi: ${response.status}`, 502, 'EXTERNAL_API_ERROR');
    }

    const json: any = await response.json();
    if (json.code !== '00' || !Array.isArray(json.data)) {
      throw new AppError(json.desc || 'Dữ liệu VietQR API trả về không hợp lệ', 400, 'VIETQR_RESPONSE_ERROR');
    }

    const totalFetched = json.data.length;
    // Chỉ lấy ngân hàng hỗ trợ chuyển tiền QR (transferSupported === 1)
    const supportedBanks = json.data.filter((bank: any) => Number(bank.transferSupported) === 1);

    let createdCount = 0;
    let updatedCount = 0;

    for (const bank of supportedBanks) {
      const existingBank = await prisma.vietqrBank.findUnique({
        where: { code: bank.code },
      });

      if (existingBank) {
        await prisma.vietqrBank.update({
          where: { code: bank.code },
          data: {
            name: bank.name,
            shortName: bank.shortName || bank.short_name || bank.code,
            bin: bank.bin,
            logo: bank.logo,
            transferSupported: Number(bank.transferSupported) || 1,
            lookupSupported: Number(bank.lookupSupported) || 0,
          },
        });
        updatedCount++;
      } else {
        await prisma.vietqrBank.create({
          data: {
            id: bank.id,
            code: bank.code,
            name: bank.name,
            shortName: bank.shortName || bank.short_name || bank.code,
            bin: bank.bin,
            logo: bank.logo,
            transferSupported: Number(bank.transferSupported) || 1,
            lookupSupported: Number(bank.lookupSupported) || 0,
            isActive: true,
          },
        });
        createdCount++;
      }
    }

    const result = {
      totalFetched,
      totalSupported: supportedBanks.length,
      createdCount,
      updatedCount,
    };

    return sendSuccess(res, result, `Đã đồng bộ thành công ${supportedBanks.length} ngân hàng hỗ trợ VietQR (${createdCount} mới, ${updatedCount} cập nhật)`);
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Lỗi xảy ra trong quá trình đồng bộ: ${error?.message || 'Lỗi không xác định'}`, 500, 'SYNC_FAILED');
  }
});

/**
 * Bật/Tắt trạng thái kích hoạt (isActive) của ngân hàng trong hệ thống EduSpace.
 */
export const toggleVietqrBankStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const numericId = parseInt(id as string, 10);

  if (isNaN(numericId)) {
    throw new AppError('ID ngân hàng không hợp lệ', 400, 'VALIDATION_ERROR');
  }

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
        isActive: true,
      },
      select: {
        id: true,
        accountNo: true,
        accountHolder: true,
        isDefault: true,
      },
    });

    if (activePaymentAccounts.length > 0) {
      const defaultAccount = activePaymentAccounts.find((acc: { isDefault: boolean; accountNo: string; accountHolder: string }) => acc.isDefault);
      let errorMessage = `Không thể vô hiệu hóa ngân hàng "${existingBank.shortName}" vì đang có ${activePaymentAccounts.length} tài khoản thanh toán đang hoạt động liên kết với ngân hàng này.`;
      throw new AppError(errorMessage, 400, 'BANK_IN_USE');
    }
  }

  const updatedBank = await prisma.vietqrBank.update({
    where: { id: numericId },
    data: { isActive: !existingBank.isActive },
  });

  const message = updatedBank.isActive
    ? `Đã kích hoạt ngân hàng ${updatedBank.shortName}`
    : `Đã vô hiệu hóa ngân hàng ${updatedBank.shortName}`;

  return sendSuccess(res, { bank: updatedBank }, message);
});
