import type { Request } from 'express';
import prisma from '../../config/db';
import { AppError } from '../../utils/appError';
import {
  getMembershipPlansQuerySchema,
  getMembershipPlanByIdParamsSchema,
  createMembershipPlanBodySchema,
  updateMembershipPlanSchema
} from './zodSchemas';

/**
 * 1. Validate dữ liệu đầu vào cho API lấy danh sách gói hội viên
 */
export const validateGetMembershipPlans = (req: Request) => {
  const parsed = getMembershipPlansQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      parsed.error.issues[0]?.message || 'Tham số truy vấn không hợp lệ',
      400,
      'VALIDATION_ERROR'
    );
  }
  return parsed.data;
};

/**
 * 2. Validate dữ liệu đầu vào cho API lấy chi tiết gói hội viên theo ID / Code
 */
export const validateGetMembershipPlanById = (req: Request) => {
  const parsed = getMembershipPlanByIdParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    throw new AppError(
      parsed.error.issues[0]?.message || 'Mã gói hội viên không hợp lệ',
      400,
      'VALIDATION_ERROR'
    );
  }
  return parsed.data;
};

/**
 * 3. Validate dữ liệu và logic ràng buộc khi tạo gói hội viên mới
 */
export const validateCreateMembershipPlan = (req: Request) => {
  const { name } = req.body;

  if (!name || (typeof name === 'string' && name.trim() === '')) {
    throw new AppError(
      'Tên gói hội viên là bắt buộc.',
      400,
      'VALIDATION_ERROR',
      { name: ['Tên gói hội viên là bắt buộc.'] }
    );
  }

  const parsed = createMembershipPlanBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      parsed.error.issues[0]?.message || 'Dữ liệu gói hội viên không hợp lệ',
      400,
      'VALIDATION_ERROR'
    );
  }
  return parsed.data;
};

/**
 * 4. Validate dữ liệu và kiểm tra sự tồn tại DB / ràng buộc gói khi cập nhật
 */
export const validateUpdateMembershipPlan = async (req: Request) => {
  const { id } = req.params;
  const planId = parseInt(id as string, 10);

  if (isNaN(planId)) {
    throw new AppError('Mã gói hội viên không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const parsed = updateMembershipPlanSchema.safeParse({
    params: req.params,
    body: req.body
  });

  if (!parsed.success) {
    throw new AppError(
      parsed.error.issues[0]?.message || 'Dữ liệu cập nhật gói không hợp lệ',
      400,
      'VALIDATION_ERROR'
    );
  }

  const existing = await prisma.membershipPlan.findUnique({
    where: { id: planId },
    include: {
      planFeatures: true
    }
  });

  if (!existing) {
    throw new AppError('Gói hội viên không tồn tại', 404, 'NOT_FOUND');
  }

  const { name, isActive, planFeatures } = req.body;

  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    throw new AppError('Tên gói hội viên không được để trống', 400, 'VALIDATION_ERROR');
  }

  if (isActive !== undefined && Boolean(isActive) !== existing.isActive) {
    const subCount = await prisma.userSubscription.count({ where: { planId } });
    const txCount = await prisma.paymentTransaction.count({ where: { planId } });
    if (subCount > 0 || txCount > 0) {
      throw new AppError('Gói hội viên đã có người đăng ký hoặc có lịch sử giao dịch. Không thể chuyển đổi trạng thái gói này.', 400, 'VALIDATION_ERROR');
    }
  }

  if (Array.isArray(planFeatures)) {
    const subCount = await prisma.userSubscription.count({ where: { planId } });
    const txCount = await prisma.paymentTransaction.count({ where: { planId } });
    const isPlanUsed = subCount > 0 || txCount > 0;

    const oldPlanFeatures = existing.planFeatures || [];

    if (isPlanUsed) {
      const hasDisabledExistingFeature = planFeatures.some((pf: { featureId: number; isAvailable: boolean }) => {
        const oldPf = oldPlanFeatures.find((item) => item.featureId === Number(pf.featureId));
        const oldAvailable = oldPf ? oldPf.isAvailable : false;
        const newAvailable = Boolean(pf.isAvailable);
        return oldAvailable && !newAvailable;
      });

      if (hasDisabledExistingFeature) {
        throw new AppError(
          'Gói hội viên đã có người đăng ký hoặc có lịch sử giao dịch. Không thể tắt tính năng đang khả dụng của gói này.',
          400,
          'VALIDATION_ERROR'
        );
      }
    }
  }

  return {
    planId,
    existing,
    body: req.body
  };
};

/**
 * 5. Validate dữ liệu và kiểm tra sự tồn tại DB / ràng buộc khi chuyển đổi trạng thái gói
 */
export const validateToggleMembershipPlanStatus = async (req: Request) => {
  const { id } = req.params;
  const planId = parseInt(id as string, 10);

  if (isNaN(planId)) {
    throw new AppError('Mã gói hội viên không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const existing = await prisma.membershipPlan.findUnique({
    where: { id: planId }
  });

  if (!existing) {
    throw new AppError('Gói hội viên không tồn tại', 404, 'NOT_FOUND');
  }

  const subCount = await prisma.userSubscription.count({ where: { planId } });
  const txCount = await prisma.paymentTransaction.count({ where: { planId } });

  if (subCount > 0 || txCount > 0) {
    throw new AppError('Gói hội viên đã có người đăng ký hoặc có lịch sử giao dịch. Không thể chuyển đổi trạng thái gói này.', 400, 'VALIDATION_ERROR');
  }

  return {
    planId,
    existing
  };
};

/**
 * 6. Validate dữ liệu và kiểm tra ràng buộc trước khi xóa gói hội viên
 */
export const validateDeleteMembershipPlan = async (req: Request) => {
  const { id } = req.params;
  const planId = parseInt(id as string, 10);

  if (isNaN(planId)) {
    throw new AppError('Mã gói hội viên không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const existing = await prisma.membershipPlan.findUnique({
    where: { id: planId }
  });

  if (!existing) {
    throw new AppError('Gói hội viên không tồn tại', 404, 'NOT_FOUND');
  }

  const subCount = await prisma.userSubscription.count({ where: { planId } });
  const txCount = await prisma.paymentTransaction.count({ where: { planId } });

  if (subCount > 0 || txCount > 0) {
    throw new AppError(
      `Không thể xóa gói "${existing.name}" vì đã có lịch sử đăng ký hoặc giao dịch sử dụng.`,
      400,
      'VALIDATION_ERROR'
    );
  }

  return {
    planId,
    existing
  };
};
