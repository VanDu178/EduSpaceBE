import prisma from '../../config/db';
import { AppError } from '../../utils/appError';
import type { GetVietqrBanksQueryInput } from './zodSchemas';
import { VIETQR_BANK_STATUS } from './constants';

/**
 * 1. Service lấy danh sách ngân hàng hỗ trợ VietQR
 */
export async function getVietqrBanksService(queryData: GetVietqrBanksQueryInput) {
  const { keyword, status } = queryData;

  const where: any = {};

  if (keyword) {
    where.OR = [
      { name: { contains: keyword } },
      { shortName: { contains: keyword } },
      { code: { contains: keyword } },
      { bin: { contains: keyword } },
    ];
  }

  if (status && status !== VIETQR_BANK_STATUS.ALL) {
    where.isActive = status === VIETQR_BANK_STATUS.ACTIVE;
  }

  const banks = await prisma.vietqrBank.findMany({
    where,
    orderBy: [
      { shortName: 'asc' },
      { id: 'asc' },
    ],
  });

  return { banks };
}

/**
 * 2. Service lấy chi tiết thông tin 1 ngân hàng theo ID
 */
export async function getVietqrBankByIdService(bank: any) {
  return { bank };
}

/**
 * 3. Service đồng bộ danh sách ngân hàng từ VietQR API
 */
export async function syncVietqrBanksService() {
  try {
    const response = await fetch('https://api.vietqr.io/v2/banks');
    if (!response.ok) {
      throw new AppError(
        `Không thể kết nối tới VietQR API. Mã lỗi: ${response.status}`,
        502,
        'EXTERNAL_API_ERROR'
      );
    }

    const json: any = await response.json();
    if (json.code !== '00' || !Array.isArray(json.data)) {
      throw new AppError(
        json.desc || 'Dữ liệu VietQR API trả về không hợp lệ',
        400,
        'VIETQR_RESPONSE_ERROR'
      );
    }

    const totalFetched = json.data.length;
    // Chỉ lấy ngân hàng hỗ trợ chuyển tiền QR (transferSupported === 1)
    const supportedBanks = json.data.filter(
      (bank: any) => Number(bank.transferSupported) === 1
    );

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

    const message = `Đã đồng bộ thành công ${supportedBanks.length} ngân hàng hỗ trợ VietQR (${createdCount} mới, ${updatedCount} cập nhật)`;

    return { result, message };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      `Lỗi xảy ra trong quá trình đồng bộ: ${error?.message || 'Lỗi không xác định'}`,
      500,
      'SYNC_FAILED'
    );
  }
}

/**
 * 4. Service bật/tắt trạng thái kích hoạt của ngân hàng
 */
export async function toggleVietqrBankStatusService(bankId: number, existingBank: any) {
  const updatedBank = await prisma.vietqrBank.update({
    where: { id: bankId },
    data: { isActive: !existingBank.isActive },
  });

  const message = updatedBank.isActive
    ? `Đã kích hoạt ngân hàng ${updatedBank.shortName}`
    : `Đã vô hiệu hóa ngân hàng ${updatedBank.shortName}`;

  return { bank: updatedBank, message };
}
