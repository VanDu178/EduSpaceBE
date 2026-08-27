import type { Request, Response } from 'express';
import prisma from '../config/db';
import { AppError } from '../utils/appError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/responseHelper';
import { generatePaymentTransactionCode, generateSubscriptionCode } from '../utils/codeGenerator';
import type { AuthenticatedRequest } from '../middlewares/authMiddleware';

/**
 * Khởi tạo đơn thanh toán VietQR cho gói dịch vụ
 */
export const createTransaction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError('Bạn chưa đăng nhập', 401, 'UNAUTHORIZED');
  }

  const { planId, billingCycle = 'monthly' } = req.body;

  const parsedPlanId = parseInt(planId, 10);
  if (isNaN(parsedPlanId)) {
    throw new AppError('Gói hội viên không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  // 1. Kiểm tra thông tin gói
  const plan = await prisma.membershipPlan.findUnique({
    where: { id: parsedPlanId }
  });

  if (!plan) {
    throw new AppError('Gói hội viên không tồn tại', 404, 'NOT_FOUND');
  }

  if (!plan.isActive) {
    throw new AppError('Gói hội viên này hiện đang tạm ẩn, không thể đăng ký', 400, 'VALIDATION_ERROR');
  }

  // 2. Tìm tài khoản ngân hàng nhận tiền mặc định của hệ thống
  let paymentAccount = await prisma.paymentAccount.findFirst({
    where: { isDefault: true, isActive: true },
    include: { bank: true }
  });

  if (!paymentAccount) {
    paymentAccount = await prisma.paymentAccount.findFirst({
      where: { isActive: true },
      include: { bank: true }
    });
  }

  if (!paymentAccount) {
    throw new AppError('Hệ thống chưa cấu hình tài khoản nhận tiền. Vui lòng liên hệ quản trị viên.', 500, 'INTERNAL_SERVER_ERROR');
  }

  // 3. Tính số tiền thanh toán (tháng hoặc năm)
  const amount = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;

  // 4. Sinh mã đơn ngẫu nhiên duy nhất
  let code = generatePaymentTransactionCode();
  let isCodeExist = await prisma.paymentTransaction.findUnique({ where: { code } });
  while (isCodeExist) {
    code = generatePaymentTransactionCode();
    isCodeExist = await prisma.paymentTransaction.findUnique({ where: { code } });
  }

  const transferContent = code; // Ví dụ: TRV8K92A5

  // 5. Sinh URL ảnh VietQR QuickLink (dạng compact2)
  const qrCodeUrl = `https://img.vietqr.io/image/${paymentAccount.bankCode}-${paymentAccount.accountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(paymentAccount.accountHolder)}`;

  // 6. Thời gian đếm ngược hết hạn (15 phút)
  const expiredAt = new Date(Date.now() + 15 * 60 * 1000);

  // 7. Lưu đơn hàng vào DB
  const transaction = await prisma.paymentTransaction.create({
    data: {
      code,
      userId,
      planId: parsedPlanId,
      paymentAccountId: paymentAccount.id,
      billingCycle: billingCycle === 'yearly' ? 'yearly' : 'monthly',
      amount,
      paymentMethod: 'vietqr',
      transferContent,
      status: 'pending',
      bankCode: paymentAccount.bankCode,
      accountNo: paymentAccount.accountNo,
      accountHolder: paymentAccount.accountHolder,
      qrCodeUrl,
      expiredAt
    },
    include: {
      plan: {
        select: {
          id: true,
          code: true,
          name: true
        }
      },
      paymentAccount: {
        include: {
          bank: true
        }
      }
    }
  });

  return sendSuccess(res, transaction, 'Khởi tạo đơn thanh toán VietQR thành công', 201);
});

/**
 * Lấy trạng thái thanh toán của đơn hàng theo Mã code (Phục vụ Polling trên Client)
 */
export const getTransactionStatus = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.params;

  if (!code) {
    throw new AppError('Mã đơn hàng không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const transaction = await prisma.paymentTransaction.findUnique({
    where: { code: String(code).trim() },
    include: {
      plan: true,
      paymentAccount: {
        include: { bank: true }
      }
    }
  });

  if (!transaction) {
    throw new AppError('Giao dịch không tồn tại', 404, 'NOT_FOUND');
  }

  // Tự động cập nhật hết hạn nếu quá 15 phút mà vẫn pending
  if (transaction.status === 'pending' && new Date() > new Date(transaction.expiredAt)) {
    const updated = await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: { status: 'expired' }
    });
    return sendSuccess(res, { status: updated.status, expiredAt: updated.expiredAt }, 'Đơn thanh toán đã hết hạn');
  }

  return sendSuccess(res, {
    id: transaction.id,
    code: transaction.code,
    status: transaction.status,
    amount: transaction.amount,
    transferContent: transaction.transferContent,
    qrCodeUrl: transaction.qrCodeUrl,
    expiredAt: transaction.expiredAt,
    paidAt: transaction.paidAt,
    paymentAccount: transaction.paymentAccount,
    plan: transaction.plan
  }, 'Lấy trạng thái thanh toán thành công');
});

/**
 * Hủy giao dịch thanh toán (Client hoặc Admin)
 */
export const cancelTransaction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { code } = req.params;
  const userId = req.user?.id;

  const transaction = await prisma.paymentTransaction.findUnique({
    where: { code: String(code).trim() }
  });

  if (!transaction) {
    throw new AppError('Giao dịch không tồn tại', 404, 'NOT_FOUND');
  }

  if (req.user?.role !== 'admin' && transaction.userId !== userId) {
    throw new AppError('Bạn không có quyền hủy giao dịch này', 403, 'FORBIDDEN');
  }

  if (transaction.status !== 'pending') {
    throw new AppError('Chỉ có thể hủy giao dịch đang chờ thanh toán', 400, 'VALIDATION_ERROR');
  }

  const updated = await prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: { status: 'cancelled' }
  });

  return sendSuccess(res, updated, 'Hủy giao dịch thanh toán thành công');
});

/**
 * Duyệt thanh toán thành công (Admin bấm duyệt hoặc Webhook gọi)
 */
export const approveTransaction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const txId = parseInt(id as string, 10);
  const { paymentRef } = req.body;

  const transaction = await prisma.paymentTransaction.findUnique({
    where: { id: txId },
    include: { plan: true }
  });

  if (!transaction) {
    throw new AppError('Giao dịch không tồn tại', 404, 'NOT_FOUND');
  }

  if (transaction.status === 'completed') {
    return sendSuccess(res, transaction, 'Giao dịch đã được duyệt trước đó');
  }

  // 1. Chuyển trạng thái PaymentTransaction sang completed
  const adminId = req.user?.id;
  const updatedTransaction = await prisma.paymentTransaction.update({
    where: { id: txId },
    data: {
      status: 'completed',
      approvalType: 'manual',
      approvedBy: adminId || null,
      paidAt: new Date(),
      paymentRef: paymentRef ? String(paymentRef).trim() : null
    },
    include: {
      plan: {
        select: { id: true, code: true, name: true }
      },
      user: {
        select: { id: true, code: true, email: true, name: true, avatarUrl: true }
      },
      approvedByUser: {
        select: { id: true, code: true, email: true, name: true, avatarUrl: true }
      }
    }
  });

  // 2. Tự động kích hoạt / gia hạn UserSubscription
  const startDate = new Date();
  const endDate = new Date(startDate);
  if (transaction.billingCycle === 'yearly') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }

  // Hủy các gói active cũ của User
  await prisma.userSubscription.updateMany({
    where: {
      userId: transaction.userId,
      status: 'active'
    },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelReason: 'Nâng cấp gói mới qua VietQR'
    }
  });

  // Tạo mới UserSubscription active
  const tempSub = await prisma.userSubscription.create({
    data: {
      code: `SUB-TEMP-${Date.now()}`,
      userId: transaction.userId,
      planId: transaction.planId,
      billingCycle: transaction.billingCycle,
      startDate,
      endDate,
      status: 'active',
      pricePaid: transaction.amount,
      paymentMethod: 'vietqr',
      paymentRef: updatedTransaction.paymentRef
    }
  });

  const subCode = generateSubscriptionCode(tempSub.id);
  await prisma.userSubscription.update({
    where: { id: tempSub.id },
    data: { code: subCode }
  });

  return sendSuccess(res, updatedTransaction, 'Duyệt thanh toán và kích hoạt gói thành công');
});

/**
 * Lấy danh sách tất cả các giao dịch thanh toán (Admin)
 */
export const getTransactions = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const skip = (page - 1) * limit;

  const { status, search } = req.query;
  const whereClause: any = {};

  if (status && status !== 'all') {
    whereClause.status = status as string;
  }

  if (search && (search as string).trim() !== '') {
    const keyword = (search as string).trim();
    whereClause.OR = [
      { code: { contains: keyword } },
      { transferContent: { contains: keyword } },
      { user: { email: { contains: keyword } } },
      { user: { name: { contains: keyword } } }
    ];
  }

  const totalItems = await prisma.paymentTransaction.count({ where: whereClause });

  const items = await prisma.paymentTransaction.findMany({
    where: whereClause,
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { id: true, code: true, email: true, name: true, avatarUrl: true }
      },
      approvedByUser: {
        select: { id: true, code: true, email: true, name: true, avatarUrl: true }
      },
      plan: {
        select: { id: true, code: true, name: true }
      },
      paymentAccount: {
        include: { bank: true }
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
  }, 'Lấy danh sách giao dịch thanh toán thành công');
});
