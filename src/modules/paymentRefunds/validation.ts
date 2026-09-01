import prisma from '../../config/db';
import { AppError } from '../../utils/appError';
import {
  getRefundsQuerySchema,
  createRefundSchema,
  updateRefundSchema,
} from './zodSchemas';

/**
 * 1. Validate cho getRefunds (Admin/CSKH)
 */
export async function validateGetRefundsData(query: unknown) {
  const parseResult = getRefundsQuerySchema.safeParse(query);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'Tham số truy vấn không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  return parseResult.data;
}

/**
 * 2. Validate cho createRefund (Admin/CSKH)
 */
export async function validateCreateRefundData(body: unknown, refundedBy?: number | null) {
  const parseResult = createRefundSchema.safeParse(body);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'Mã giao dịch không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  const { paymentTxId, amount, refundRef, proofUrls, notes } = parseResult.data;

  const transaction = await prisma.paymentTransaction.findUnique({
    where: { id: paymentTxId },
    include: { refunds: true, plan: true, user: true }
  });

  if (!transaction) {
    throw new AppError('Giao dịch thanh toán không tồn tại', 404, 'NOT_FOUND');
  }

  const orderAmount = Number(transaction.amount);
  const paidAmount = Number(transaction.paidAmount);
  const overpaidAmount = Math.max(0, paidAmount - orderAmount);

  if (overpaidAmount <= 0) {
    throw new AppError('Giao dịch này không nạp thừa tiền để thực hiện hoàn tiền.', 400, 'VALIDATION_ERROR');
  }

  const totalAlreadyRefunded = transaction.refunds.reduce((sum, r) => sum + Number(r.amount), 0);
  const remainingRefundable = overpaidAmount - totalAlreadyRefunded;

  if (amount <= 0) {
    throw new AppError('Số tiền hoàn phải lớn hơn 0', 400, 'VALIDATION_ERROR');
  }

  if (amount > remainingRefundable) {
    throw new AppError(
      `Số tiền hoàn (${amount.toLocaleString('vi-VN')} đ) vượt quá số tiền nạp dư còn lại có thể hoàn (${remainingRefundable.toLocaleString('vi-VN')} đ).`,
      400,
      'VALIDATION_ERROR'
    );
  }

  return {
    transaction,
    overpaidAmount,
    totalAlreadyRefunded,
    amount,
    refundRef,
    proofUrls,
    notes,
    refundedBy: refundedBy || null,
  };
}

/**
 * 3. Validate cho updateRefund (Admin/CSKH)
 */
export async function validateUpdateRefundData(params: unknown, body: unknown, refundedBy?: number | null) {
  const parseResult = updateRefundSchema.safeParse({
    ...(typeof params === 'object' && params !== null ? params : {}),
    ...(typeof body === 'object' && body !== null ? body : {}),
  });

  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0] as any;
    const message = firstIssue?.message || 'ID phiếu hoàn tiền không hợp lệ';
    const errorCode = firstIssue?.params?.errorCode || 'VALIDATION_ERROR';
    const statusCode = firstIssue?.params?.statusCode || 400;
    throw new AppError(message, statusCode, errorCode);
  }

  const { id: refundId, amount, refundRef, proofUrls, notes } = parseResult.data;

  const existingRefund = await prisma.paymentRefund.findUnique({
    where: { id: refundId },
    include: {
      paymentTransaction: {
        include: { refunds: true, plan: true, user: true }
      }
    }
  });

  if (!existingRefund) {
    throw new AppError('Phiếu hoàn tiền không tồn tại', 404, 'NOT_FOUND');
  }

  const transaction = existingRefund.paymentTransaction;
  const orderAmount = Number(transaction.amount);
  const paidAmount = Number(transaction.paidAmount);
  const overpaidAmount = Math.max(0, paidAmount - orderAmount);

  const otherRefundsTotal = transaction.refunds
    .filter(r => r.id !== refundId)
    .reduce((sum, r) => sum + Number(r.amount), 0);

  const targetAmount = amount !== undefined ? Number(amount) : Number(existingRefund.amount);
  const remainingRefundable = overpaidAmount - otherRefundsTotal;

  if (targetAmount <= 0) {
    throw new AppError('Số tiền hoàn phải lớn hơn 0', 400, 'VALIDATION_ERROR');
  }

  if (targetAmount > remainingRefundable) {
    throw new AppError(
      `Số tiền hoàn (${targetAmount.toLocaleString('vi-VN')} đ) vượt quá giới hạn nạp dư còn lại (${remainingRefundable.toLocaleString('vi-VN')} đ).`,
      400,
      'VALIDATION_ERROR'
    );
  }

  return {
    refundId,
    existingRefund,
    transaction,
    targetAmount,
    otherRefundsTotal,
    overpaidAmount,
    refundRef,
    proofUrls,
    notes,
    refundedBy: refundedBy || null,
  };
}
