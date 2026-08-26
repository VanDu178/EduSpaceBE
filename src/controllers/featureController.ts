import type { Request, Response } from 'express';
import prisma from '../config/db';
import { AppError } from '../utils/appError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/responseHelper';
import { SYSTEM_FEATURE_CODES, SYSTEM_FEATURE_METADATA } from '../constants/featureCodes';

/**
 * Lấy danh sách tất cả các tính năng (Feature).
 */
export const getFeatures = asyncHandler(async (req: Request, res: Response) => {
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

  const features = await prisma.feature.findMany({
    where,
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'asc' }
    ]
  });

  return sendSuccess(res, { features }, 'Lấy danh sách tính năng thành công');
});

/**
 * Lấy danh sách các Mã tính năng hệ thống chuẩn (System Feature Codes) kèm metadata.
 */
export const getSystemFeatureCodes = asyncHandler(async (_req: Request, res: Response) => {
  const existingFeatures = await prisma.feature.findMany({
    select: { code: true }
  });

  const existingCodesSet = new Set(existingFeatures.map((f) => f.code));

  const systemCodes = SYSTEM_FEATURE_CODES.map((code) => {
    const metadata = SYSTEM_FEATURE_METADATA[code] || {
      code,
      name: code,
      description: ''
    };
    return {
      ...metadata,
      isCreated: existingCodesSet.has(code)
    };
  });

  return sendSuccess(res, { systemCodes }, 'Lấy danh sách mã tính năng hệ thống thành công');
});

/**
 * Lấy chi tiết tính năng theo ID.
 */
export const getFeatureById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const numericId = parseInt(id as string, 10);

  if (isNaN(numericId)) {
    throw new AppError('ID tính năng không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const feature = await prisma.feature.findUnique({
    where: { id: numericId }
  });

  if (!feature) {
    throw new AppError('Tính năng không tồn tại', 404, 'NOT_FOUND');
  }

  return sendSuccess(res, { feature }, 'Lấy chi tiết tính năng thành công');
});

/**
 * Tạo mới tính năng.
 */
export const createFeature = asyncHandler(async (req: Request, res: Response) => {
  const { code, name, description, sortOrder, isActive } = req.body;

  if (!code || !name) {
    throw new AppError('Mã tính năng và tên tính năng là bắt buộc.', 400, 'VALIDATION_ERROR', {
      code: !code ? ['Mã tính năng là bắt buộc.'] : [],
      name: !name ? ['Tên tính năng là bắt buộc.'] : []
    });
  }

  const formattedCode = code.trim();

  // Kiểm tra trùng mã code
  const existingFeature = await prisma.feature.findUnique({
    where: { code: formattedCode }
  });

  if (existingFeature) {
    throw new AppError('Mã tính năng đã tồn tại trong hệ thống.', 400, 'VALIDATION_ERROR', {
      code: ['Mã tính năng đã tồn tại.']
    });
  }

  const feature = await prisma.feature.create({
    data: {
      code: formattedCode,
      name,
      description: description || null,
      sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
      isActive: isActive !== undefined ? Boolean(isActive) : true
    }
  });

  return sendSuccess(res, { feature }, 'Tạo tính năng mới thành công', 201);
});

/**
 * Cập nhật tính năng.
 */
export const updateFeature = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const numericId = parseInt(id as string, 10);
  const { code, name, description, sortOrder, isActive } = req.body;

  if (isNaN(numericId)) {
    throw new AppError('ID tính năng không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const existingFeature = await prisma.feature.findUnique({
    where: { id: numericId }
  });

  if (!existingFeature) {
    throw new AppError('Tính năng không tồn tại', 404, 'NOT_FOUND');
  }

  const updateData: any = {};

  if (code !== undefined) {
    const formattedCode = code.trim();
    if (formattedCode !== existingFeature.code) {
      throw new AppError(
        'Không được phép thay đổi Mã hệ thống (code) của tính năng đã tạo.',
        400,
        'VALIDATION_ERROR',
        { code: ['Mã tính năng không được phép sửa đổi sau khi đã tạo.'] }
      );
    }
  }

  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (sortOrder !== undefined) updateData.sortOrder = Number(sortOrder);
  if (isActive !== undefined) updateData.isActive = Boolean(isActive);

  const feature = await prisma.feature.update({
    where: { id: numericId },
    data: updateData
  });

  return sendSuccess(res, { feature }, 'Cập nhật tính năng thành công');
});

/**
 * Xóa tính năng.
 */
export const deleteFeature = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const numericId = parseInt(id as string, 10);

  if (isNaN(numericId)) {
    throw new AppError('ID tính năng không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const existingFeature = await prisma.feature.findUnique({
    where: { id: numericId }
  });

  if (!existingFeature) {
    throw new AppError('Tính năng không tồn tại', 404, 'NOT_FOUND');
  }

  await prisma.feature.delete({
    where: { id: numericId }
  });

  return sendSuccess(res, null, 'Tính năng đã được xóa thành công');
});

/**
 * Bật/Tắt nhanh trạng thái kích hoạt của tính năng.
 */
export const toggleFeatureStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const numericId = parseInt(id as string, 10);

  if (isNaN(numericId)) {
    throw new AppError('ID tính năng không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const existingFeature = await prisma.feature.findUnique({
    where: { id: numericId }
  });

  if (!existingFeature) {
    throw new AppError('Tính năng không tồn tại', 404, 'NOT_FOUND');
  }

  const feature = await prisma.feature.update({
    where: { id: numericId },
    data: { isActive: !existingFeature.isActive }
  });

  const message = feature.isActive
    ? 'Đã kích hoạt tính năng'
    : 'Đã vô hiệu hóa tính năng';

  return sendSuccess(res, { feature }, message);
});

/**
 * Cập nhật thứ tự sắp xếp của tính năng.
 */
export const updateFeatureSortOrder = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const numericId = parseInt(id as string, 10);
  const { sortOrder } = req.body;

  if (isNaN(numericId)) {
    throw new AppError('ID tính năng không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  if (sortOrder === undefined || isNaN(Number(sortOrder))) {
    throw new AppError('Giá trị thứ tự sắp xếp không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const existingFeature = await prisma.feature.findUnique({
    where: { id: numericId }
  });

  if (!existingFeature) {
    throw new AppError('Tính năng không tồn tại', 404, 'NOT_FOUND');
  }

  const feature = await prisma.feature.update({
    where: { id: numericId },
    data: { sortOrder: Number(sortOrder) }
  });

  return sendSuccess(res, { feature }, 'Cập nhật thứ tự sắp xếp thành công');
});

