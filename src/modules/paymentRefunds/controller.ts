import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';
import type { AuthenticatedRequest } from '../../middlewares/authMiddleware';
import {
  validateGetRefundsData,
  validateCreateRefundData,
  validateUpdateRefundData,
} from './validation';
import {
  getRefundsService,
  createRefundService,
  updateRefundService,
} from './services';

/**
 * Lấy danh sách tất cả các phiếu hoàn tiền CSKH (Admin đối soát)
 * Route: GET /api/v1/payment-refunds
 */
export const getRefunds = asyncHandler(async (req: Request, res: Response) => {
  const queryData = await validateGetRefundsData(req.query);
  const result = await getRefundsService(queryData);
  return sendSuccess(res, result, 'Lấy danh sách phiếu hoàn tiền thành công');
});

/**
 * CSKH / Admin xác nhận tạo phiếu hoàn tiền cho giao dịch nạp dư
 * Route: POST /api/v1/payment-refunds
 */
export const createRefund = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const validatedData = await validateCreateRefundData(req.body, req.user?.id);
  const result = await createRefundService(validatedData);
  return sendSuccess(res, result, 'Tạo phiếu hoàn tiền CSKH thành công', 201);
});

/**
 * CSKH / Admin cập nhật thông tin phiếu hoàn tiền
 * Route: PUT /api/v1/payment-refunds/:id
 */
export const updateRefund = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const validatedData = await validateUpdateRefundData(req.params, req.body, req.user?.id);
  const result = await updateRefundService(validatedData);
  return sendSuccess(res, result, 'Cập nhật phiếu hoàn tiền CSKH thành công');
});
