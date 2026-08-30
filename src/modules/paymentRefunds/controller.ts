import type { Request, Response } from 'express';
import prisma from '../../config/db';
import { AppError } from '../../utils/appError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';
import type { AuthenticatedRequest } from '../../middlewares/authMiddleware';
import { createPaymentRefund, updatePaymentRefund } from './utils';

/**
 * CSKH / Admin xác nhận tạo phiếu hoàn tiền cho giao dịch nạp dư
 * Route: POST /api/v1/payment-refunds
 */
export const createRefund = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { paymentTxId, amount, refundRef, proofUrls, notes } = req.body;

  const parsedTxId = parseInt(paymentTxId, 10);
  if (isNaN(parsedTxId)) {
    throw new AppError('Mã giao dịch không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const result = await createPaymentRefund({
    paymentTxId: parsedTxId,
    amount: Number(amount),
    refundRef,
    proofUrls,
    notes,
    refundedBy: req.user?.id
  });

  return sendSuccess(res, result, 'Tạo phiếu hoàn tiền CSKH thành công', 201);
});

/**
 * CSKH / Admin cập nhật thông tin phiếu hoàn tiền
 * Route: PUT /api/v1/payment-refunds/:id
 */
export const updateRefund = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { amount, refundRef, proofUrls, notes } = req.body;

  const parsedId = parseInt(id as string, 10);
  if (isNaN(parsedId)) {
    throw new AppError('ID phiếu hoàn tiền không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const result = await updatePaymentRefund({
    refundId: parsedId,
    amount: amount !== undefined ? Number(amount) : undefined,
    refundRef,
    proofUrls,
    notes,
    refundedBy: req.user?.id
  });

  return sendSuccess(res, result, 'Cập nhật phiếu hoàn tiền CSKH thành công');
});

/**
 * Lấy danh sách tất cả các phiếu hoàn tiền CSKH (Admin đối soát)
 * Route: GET /api/v1/payment-refunds
 */
export const getRefunds = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const skip = (page - 1) * limit;

  const totalItems = await prisma.paymentRefund.count();

  const items = await prisma.paymentRefund.findMany({
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      paymentTransaction: {
        select: {
          id: true,
          code: true,
          amount: true,
          paidAmount: true,
          transferContent: true,
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      },
      refundedByUser: {
        select: { id: true, code: true, name: true, email: true }
      }
    }
  });

  const totalPages = Math.ceil(totalItems / limit);

  return sendSuccess(res, {
    items,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: limit
    }
  }, 'Lấy danh sách phiếu hoàn tiền thành công');
});

