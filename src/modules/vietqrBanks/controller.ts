import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';
import {
  validateGetVietqrBanksData,
  validateGetVietqrBankByIdData,
  validateSyncVietqrBanksData,
  validateToggleVietqrBankStatusData,
} from './validation';
import {
  getVietqrBanksService,
  getVietqrBankByIdService,
  syncVietqrBanksService,
  toggleVietqrBankStatusService,
} from './services';

/**
 * Lấy danh sách ngân hàng hỗ trợ VietQR (Admin only).
 */
export const getVietqrBanks = asyncHandler(async (req: Request, res: Response) => {
  const queryData = await validateGetVietqrBanksData(req.query);
  const result = await getVietqrBanksService(queryData);
  return sendSuccess(res, result, 'Lấy danh sách ngân hàng thành công');
});

/**
 * Lấy chi tiết thông tin 1 ngân hàng theo ID (Admin only).
 */
export const getVietqrBankById = asyncHandler(async (req: Request, res: Response) => {
  const { bank } = await validateGetVietqrBankByIdData(req.params);
  const result = await getVietqrBankByIdService(bank);
  return sendSuccess(res, result, 'Lấy chi tiết ngân hàng thành công');
});

/**
 * Đồng bộ danh sách ngân hàng trực tiếp từ API chính thức VietQR (Admin only).
 */
export const syncVietqrBanks = asyncHandler(async (_req: Request, res: Response) => {
  await validateSyncVietqrBanksData();
  const { result, message } = await syncVietqrBanksService();
  return sendSuccess(res, result, message);
});

/**
 * Bật/Tắt trạng thái kích hoạt của ngân hàng (Admin only).
 */
export const toggleVietqrBankStatus = asyncHandler(async (req: Request, res: Response) => {
  const { bankId, existingBank } = await validateToggleVietqrBankStatusData(req.params);
  const { bank, message } = await toggleVietqrBankStatusService(bankId, existingBank);
  return sendSuccess(res, { bank }, message);
});
