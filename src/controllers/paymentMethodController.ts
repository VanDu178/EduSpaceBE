import type { Request, Response } from 'express';
import prisma from '../config/db';
import { AppError } from '../utils/appError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/responseHelper';

/**
 * Lấy danh sách tất cả các Phương thức thanh toán (Dành cho Admin).
 */
export const getPaymentMethods = asyncHandler(async (req: Request, res: Response) => {
  const keyword = req.query.keyword as string;
  const status = req.query.status as string; // 'ALL', 'active', 'inactive'

  const where: any = {};

  if (keyword) {
    where.OR = [
      { name: { contains: keyword } },
      { code: { contains: keyword } },
      { description: { contains: keyword } }
    ];
  }

  if (status && status !== 'ALL') {
    where.isActive = status === 'active';
  }

  const paymentMethods = await prisma.paymentMethod.findMany({
    where,
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'asc' }
    ]
  });

  return sendSuccess(res, { paymentMethods }, 'Lấy danh sách phương thức thanh toán thành công');
});

/**
 * Lấy danh sách Phương thức thanh toán đang hoạt động (Dành cho Client Checkout).
 */
export const getActivePaymentMethods = asyncHandler(async (_req: Request, res: Response) => {
  const paymentMethods = await prisma.paymentMethod.findMany({
    where: { isActive: true },
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'asc' }
    ]
  });

  return sendSuccess(res, { paymentMethods }, 'Lấy danh sách phương thức thanh toán khả dụng thành công');
});

/**
 * Lấy chi tiết phương thức thanh toán theo ID.
 */
export const getPaymentMethodById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const numericId = parseInt(id as string, 10);

  if (isNaN(numericId)) {
    throw new AppError('ID phương thức thanh toán không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const paymentMethod = await prisma.paymentMethod.findUnique({
    where: { id: numericId }
  });

  if (!paymentMethod) {
    throw new AppError('Phương thức thanh toán không tồn tại', 404, 'NOT_FOUND');
  }

  return sendSuccess(res, { paymentMethod }, 'Lấy chi tiết phương thức thanh toán thành công');
});

/**
 * Tạo mới phương thức thanh toán.
 */
export const createPaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  const { code, name, description, icon, sortOrder, isActive } = req.body;

  if (!code || !name || !icon || !icon.trim()) {
    throw new AppError('Mã, tên và icon phương thức thanh toán là bắt buộc.', 400, 'VALIDATION_ERROR', {
      code: !code ? ['Mã phương thức thanh toán là bắt buộc.'] : [],
      name: !name ? ['Tên phương thức thanh toán là bắt buộc.'] : [],
      icon: (!icon || !icon.trim()) ? ['Icon phương thức thanh toán là bắt buộc.'] : []
    });
  }

  const formattedCode = code.trim().toLowerCase();

  const existingMethod = await prisma.paymentMethod.findUnique({
    where: { code: formattedCode }
  });

  if (existingMethod) {
    throw new AppError('Mã phương thức thanh toán đã tồn tại trong hệ thống.', 400, 'VALIDATION_ERROR', {
      code: ['Mã phương thức thanh toán đã tồn tại.']
    });
  }

  const paymentMethod = await prisma.paymentMethod.create({
    data: {
      code: formattedCode,
      name: name.trim(),
      description: description ? description.trim() : null,
      icon: icon ? icon.trim() : null,
      sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
      isActive: isActive !== undefined ? Boolean(isActive) : true
    }
  });

  return sendSuccess(res, { paymentMethod }, 'Tạo phương thức thanh toán mới thành công', 201);
});

/**
 * Cập nhật phương thức thanh toán.
 */
export const updatePaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const numericId = parseInt(id as string, 10);
  const { code, name, description, icon, sortOrder, isActive } = req.body;

  if (isNaN(numericId)) {
    throw new AppError('ID phương thức thanh toán không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const existingMethod = await prisma.paymentMethod.findUnique({
    where: { id: numericId }
  });

  if (!existingMethod) {
    throw new AppError('Phương thức thanh toán không tồn tại', 404, 'NOT_FOUND');
  }

  if (code !== undefined) {
    const formattedCode = code.trim().toLowerCase();
    if (formattedCode !== existingMethod.code) {
      throw new AppError('Không được phép sửa mã hệ thống (code) của phương thức thanh toán.', 400, 'VALIDATION_ERROR');
    }
  }

  const updateData: any = {};
  if (name !== undefined) {
    if (!name || !name.trim()) {
      throw new AppError('Tên phương thức thanh toán không được để trống.', 400, 'VALIDATION_ERROR', {
        name: ['Tên phương thức thanh toán không được để trống.']
      });
    }
    updateData.name = name.trim();
  }
  if (description !== undefined) updateData.description = description ? description.trim() : null;
  if (icon !== undefined) {
    if (!icon || !icon.trim()) {
      throw new AppError('Icon phương thức thanh toán không được để trống.', 400, 'VALIDATION_ERROR', {
        icon: ['Icon phương thức thanh toán không được để trống.']
      });
    }
    updateData.icon = icon.trim();
  }
  if (sortOrder !== undefined) updateData.sortOrder = Number(sortOrder);
  if (isActive !== undefined) updateData.isActive = Boolean(isActive);

  const paymentMethod = await prisma.paymentMethod.update({
    where: { id: numericId },
    data: updateData
  });

  return sendSuccess(res, { paymentMethod }, 'Cập nhật phương thức thanh toán thành công');
});

/**
 * Bật/Tắt nhanh trạng thái phương thức thanh toán.
 */
export const togglePaymentMethodStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const numericId = parseInt(id as string, 10);

  if (isNaN(numericId)) {
    throw new AppError('ID phương thức thanh toán không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const existingMethod = await prisma.paymentMethod.findUnique({
    where: { id: numericId }
  });

  if (!existingMethod) {
    throw new AppError('Phương thức thanh toán không tồn tại', 404, 'NOT_FOUND');
  }

  const paymentMethod = await prisma.paymentMethod.update({
    where: { id: numericId },
    data: { isActive: !existingMethod.isActive }
  });

  const message = paymentMethod.isActive
    ? 'Đã kích hoạt phương thức thanh toán'
    : 'Đã vô hiệu hóa phương thức thanh toán';

  return sendSuccess(res, { paymentMethod }, message);
});

/**
 * Xóa phương thức thanh toán.
 */
export const deletePaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const numericId = parseInt(id as string, 10);

  if (isNaN(numericId)) {
    throw new AppError('ID phương thức thanh toán không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const existingMethod = await prisma.paymentMethod.findUnique({
    where: { id: numericId }
  });

  if (!existingMethod) {
    throw new AppError('Phương thức thanh toán không tồn tại', 404, 'NOT_FOUND');
  }

  await prisma.paymentMethod.delete({
    where: { id: numericId }
  });

  return sendSuccess(res, null, 'Phương thức thanh toán đã được xóa thành công');
});

/**
 * Cập nhật thứ tự sắp xếp phương thức thanh toán.
 */
export const updatePaymentMethodSortOrder = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const numericId = parseInt(id as string, 10);
  const { sortOrder } = req.body;

  if (isNaN(numericId)) {
    throw new AppError('ID phương thức thanh toán không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  if (sortOrder === undefined || isNaN(Number(sortOrder))) {
    throw new AppError('Thứ tự sắp xếp không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const existingMethod = await prisma.paymentMethod.findUnique({
    where: { id: numericId }
  });

  if (!existingMethod) {
    throw new AppError('Phương thức thanh toán không tồn tại', 404, 'NOT_FOUND');
  }

  const paymentMethod = await prisma.paymentMethod.update({
    where: { id: numericId },
    data: { sortOrder: Number(sortOrder) }
  });

  return sendSuccess(res, { paymentMethod }, 'Cập nhật thứ tự sắp xếp thành công');
});
