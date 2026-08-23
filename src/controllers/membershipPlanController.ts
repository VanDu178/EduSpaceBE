import type { Request, Response } from 'express';
import prisma from '../config/db';
import { AppError } from '../utils/appError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/responseHelper';
import { generatePlanCode } from '../utils/codeGenerator';

/**
 * Lấy danh sách gói hội viên.
 * - Client xem (Public): CHỈ lấy các gói isActive = true
 * - Admin xem: Lấy tất cả hoặc lọc theo query parameter isActive
 */
export const getMembershipPlans = asyncHandler(async (req: Request, res: Response) => {
  const { isActive } = req.query;

  const whereClause: any = {};
  if (isActive === 'true') {
    whereClause.isActive = true;
  } else if (isActive === 'false') {
    whereClause.isActive = false;
  }

  const plans = await prisma.membershipPlan.findMany({
    where: whereClause,
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'asc' }
    ]
  });

  return sendSuccess(res, plans, 'Lấy danh sách gói hội viên thành công');
});

/**
 * Lấy chi tiết gói hội viên theo ID hoặc mã Code.
 */
export const getMembershipPlanById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const planId = parseInt(id as string, 10);

  let plan;
  if (!isNaN(planId)) {
    plan = await prisma.membershipPlan.findUnique({
      where: { id: planId }
    });
  } else {
    plan = await prisma.membershipPlan.findUnique({
      where: { code: (id as string).toUpperCase() }
    });
  }

  if (!plan) {
    throw new AppError('Gói hội viên không tồn tại', 404, 'NOT_FOUND');
  }

  return sendSuccess(res, plan, 'Lấy thông tin gói hội viên thành công');
});

/**
 * Tạo mới gói hội viên (Chỉ Admin).
 * - Mã code được tự động sinh theo format PLN-XXXXXX
 */
export const createMembershipPlan = asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    tagLine,
    monthlyPrice,
    yearlyPrice,
    popularBadge,
    buttonText,
    features,
    unavailableFeatures,
    sortOrder,
    isActive
  } = req.body;

  if (!name || name.trim() === '') {
    throw new AppError(
      'Tên gói hội viên là bắt buộc.',
      400,
      'VALIDATION_ERROR',
      { name: ['Tên gói hội viên là bắt buộc.'] }
    );
  }

  // Bước 1: Tạo gói với mã tạm thời
  const tempPlan = await prisma.membershipPlan.create({
    data: {
      code: `PLN-TEMP-${Date.now()}`,
      name: name.trim(),
      tagLine: tagLine ? tagLine.trim() : null,
      monthlyPrice: monthlyPrice !== undefined ? Number(monthlyPrice) : 0,
      yearlyPrice: yearlyPrice !== undefined ? Number(yearlyPrice) : 0,
      popularBadge: popularBadge ? popularBadge.trim() : null,
      buttonText: buttonText ? buttonText.trim() : null,
      features: features !== undefined ? features : null,
      unavailableFeatures: unavailableFeatures !== undefined ? unavailableFeatures : null,
      sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
      isActive: isActive !== undefined ? Boolean(isActive) : true
    }
  });

  // Bước 2: Sinh mã định danh chuẩn PLN-XXXXXX và cập nhật
  const code = generatePlanCode(tempPlan.id);
  const plan = await prisma.membershipPlan.update({
    where: { id: tempPlan.id },
    data: { code }
  });

  return sendSuccess(res, plan, 'Tạo gói hội viên mới thành công', 201);
});

/**
 * Cập nhật gói hội viên (Chỉ Admin).
 */
export const updateMembershipPlan = asyncHandler(async (req: Request, res: Response) => {
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

  const {
    name,
    tagLine,
    monthlyPrice,
    yearlyPrice,
    popularBadge,
    buttonText,
    features,
    unavailableFeatures,
    sortOrder,
    isActive
  } = req.body;

  const updateData: any = {};

  if (name !== undefined) {
    if (!name.trim()) {
      throw new AppError('Tên gói hội viên không được để trống', 400, 'VALIDATION_ERROR');
    }
    updateData.name = name.trim();
  }
  if (tagLine !== undefined) updateData.tagLine = tagLine ? tagLine.trim() : null;
  if (monthlyPrice !== undefined) updateData.monthlyPrice = Number(monthlyPrice);
  if (yearlyPrice !== undefined) updateData.yearlyPrice = Number(yearlyPrice);
  if (popularBadge !== undefined) updateData.popularBadge = popularBadge ? popularBadge.trim() : null;
  if (buttonText !== undefined) updateData.buttonText = buttonText ? buttonText.trim() : null;
  if (features !== undefined) updateData.features = features;
  if (unavailableFeatures !== undefined) updateData.unavailableFeatures = unavailableFeatures;
  if (sortOrder !== undefined) updateData.sortOrder = Number(sortOrder);
  if (isActive !== undefined) updateData.isActive = Boolean(isActive);

  const updatedPlan = await prisma.membershipPlan.update({
    where: { id: planId },
    data: updateData
  });

  return sendSuccess(res, updatedPlan, 'Cập nhật gói hội viên thành công');
});

/**
 * Cập nhật thứ tự hiển thị gói hội viên (sortOrder) (Chỉ Admin).
 */
export const updateMembershipPlanSortOrder = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const planId = parseInt(id as string, 10);
  const { sortOrder } = req.body;

  if (isNaN(planId) || sortOrder === undefined) {
    throw new AppError('Dữ liệu thứ tự không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const existing = await prisma.membershipPlan.findUnique({
    where: { id: planId }
  });

  if (!existing) {
    throw new AppError('Gói hội viên không tồn tại', 404, 'NOT_FOUND');
  }

  const updated = await prisma.membershipPlan.update({
    where: { id: planId },
    data: { sortOrder: Number(sortOrder) }
  });

  return sendSuccess(res, updated, 'Cập nhật thứ tự gói thành công');
});

/**
 * Bật/Tắt nhanh trạng thái hoạt động của gói (isActive) (Chỉ Admin).
 */
export const toggleMembershipPlanStatus = asyncHandler(async (req: Request, res: Response) => {
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

  const updated = await prisma.membershipPlan.update({
    where: { id: planId },
    data: { isActive: !existing.isActive }
  });

  const message = updated.isActive
    ? 'Đã kích hoạt gói hội viên'
    : 'Đã ẩn gói hội viên';

  return sendSuccess(res, updated, message);
});

/**
 * Xóa gói hội viên (Chỉ Admin).
 * - Nếu gói đang có lịch sử đăng ký thì chặn xóa để đảm bảo toàn vẹn dữ liệu.
 */
export const deleteMembershipPlan = asyncHandler(async (req: Request, res: Response) => {
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

  // Kiểm tra xem đã có lượt đăng ký nào liên quan tới gói này chưa
  const subCount = await prisma.userSubscription.count({
    where: { planId }
  });

  if (subCount > 0) {
    throw new AppError(
      `Không thể xóa gói "${existing.name}" vì đang có ${subCount} lịch sử đăng ký sử dụng. Bạn có thể chọn Ẩn gói này.`,
      400,
      'VALIDATION_ERROR'
    );
  }

  await prisma.membershipPlan.delete({
    where: { id: planId }
  });

  return sendSuccess(res, null, 'Xóa gói hội viên thành công');
});
