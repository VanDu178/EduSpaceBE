import prisma from '../../config/db';
import { REFUND_CODE_PREFIX, REFUND_STATUS } from './constants';
import type { GetRefundsQueryInput } from './zodSchemas';
import type { validateCreateRefundData, validateUpdateRefundData } from './validation';

/**
 * 1. Lấy danh sách tất cả các phiếu hoàn tiền CSKH (Admin đối soát)
 */
export const getRefundsService = async (queryData: GetRefundsQueryInput) => {
  const page = queryData.page || 1;
  const limit = queryData.limit || 10;
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

  return {
    items,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: limit
    }
  };
};

/**
 * 2. CSKH / Admin tạo phiếu hoàn tiền cho đơn nạp dư (lưu vào bảng PaymentRefund)
 */
export const createRefundService = async (
  validatedData: Awaited<ReturnType<typeof validateCreateRefundData>>
) => {
  const {
    transaction,
    overpaidAmount,
    totalAlreadyRefunded,
    amount,
    refundRef,
    proofUrls,
    notes,
    refundedBy
  } = validatedData;

  const refundCode = `${REFUND_CODE_PREFIX}${transaction.code}-${Date.now().toString().slice(-4)}`;

  const refund = await prisma.paymentRefund.create({
    data: {
      code: refundCode,
      paymentTxId: transaction.id,
      amount,
      refundRef: refundRef ? String(refundRef).trim() : null,
      proofUrls: proofUrls && proofUrls.length > 0 ? (proofUrls as any) : undefined,
      notes: notes ? String(notes).trim() : null,
      refundedBy: refundedBy || null
    },
    include: {
      refundedByUser: {
        select: { id: true, code: true, email: true, name: true }
      }
    }
  });

  // Tự động tính toán và cập nhật refundStatus cho PaymentTransaction
  const newTotalRefunded = totalAlreadyRefunded + amount;
  const newRefundStatus = newTotalRefunded >= overpaidAmount ? REFUND_STATUS.FULLY_REFUNDED : REFUND_STATUS.PARTIALLY_REFUNDED;

  await prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: { refundStatus: newRefundStatus }
  });

  // Re-fetch updated transaction with refunds
  const updatedTransaction = await prisma.paymentTransaction.findUnique({
    where: { id: transaction.id },
    include: {
      plan: true,
      user: {
        select: { id: true, code: true, email: true, name: true, avatarUrl: true }
      },
      refunds: {
        include: {
          refundedByUser: {
            select: { id: true, code: true, email: true, name: true }
          }
        }
      }
    }
  });

  return {
    refund,
    transaction: updatedTransaction
  };
};

/**
 * 3. CSKH / Admin cập nhật phiếu hoàn tiền (sửa mã GD, ảnh minh chứng, ghi chú...)
 */
export const updateRefundService = async (
  validatedData: Awaited<ReturnType<typeof validateUpdateRefundData>>
) => {
  const {
    refundId,
    existingRefund,
    transaction,
    targetAmount,
    otherRefundsTotal,
    overpaidAmount,
    refundRef,
    proofUrls,
    notes,
    refundedBy
  } = validatedData;

  // Dọn dẹp các ảnh cũ không còn trong proofUrls mới
  await cleanupOrphanedProofImages(
    (existingRefund.proofUrls as string[]) || [],
    proofUrls || []
  );

  // Cập nhật phiếu hoàn tiền
  const updatedRefund = await prisma.paymentRefund.update({
    where: { id: refundId },
    data: {
      amount: targetAmount,
      refundRef: refundRef !== undefined ? (refundRef ? String(refundRef).trim() : null) : undefined,
      proofUrls: proofUrls ? (proofUrls as any) : undefined,
      notes: notes !== undefined ? (notes ? String(notes).trim() : null) : undefined,
      refundedBy: refundedBy || undefined
    },
    include: {
      refundedByUser: {
        select: { id: true, code: true, email: true, name: true }
      }
    }
  });

  // Tự động tính toán lại refundStatus cho PaymentTransaction
  const newTotalRefunded = otherRefundsTotal + targetAmount;
  const newRefundStatus = newTotalRefunded >= overpaidAmount ? REFUND_STATUS.FULLY_REFUNDED : REFUND_STATUS.PARTIALLY_REFUNDED;

  await prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: { refundStatus: newRefundStatus }
  });

  const updatedTransaction = await prisma.paymentTransaction.findUnique({
    where: { id: transaction.id },
    include: {
      plan: true,
      user: {
        select: { id: true, code: true, email: true, name: true, avatarUrl: true }
      },
      refunds: {
        include: {
          refundedByUser: {
            select: { id: true, code: true, email: true, name: true }
          }
        }
      }
    }
  });

  return {
    refund: updatedRefund,
    transaction: updatedTransaction
  };
};

/* ========================================== */
/* HELPER SERVICES                            */
/* ========================================== */

/**
 * Tự động tìm và xóa các ảnh cũ không còn nằm trong danh sách proofUrls mới khỏi Supabase Storage
 */
const cleanupOrphanedProofImages = async (oldProofUrls: string[], newProofUrls: string[]) => {
  const removedUrls = oldProofUrls.filter(url => !newProofUrls.includes(url));
  if (removedUrls.length > 0) {
    const { extractStoragePath, deleteFromSupabase } = await import('../../services/supabaseStorageService');
    for (const url of removedUrls) {
      const storagePath = extractStoragePath(url);
      if (storagePath) {
        await deleteFromSupabase(storagePath).catch(err => {
          console.error(`Lỗi khi dọn dẹp ảnh rác trên Supabase (${url}):`, err);
        });
      }
    }
  }
};
