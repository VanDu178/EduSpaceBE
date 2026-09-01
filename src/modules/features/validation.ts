import type { Request } from 'express';
import prisma from '../../config/db';
import { AppError } from '../../utils/appError';

/**
 * 1. Validate dữ liệu đầu vào khi lấy danh sách tất cả tính năng.
 */
export const validateGetFeatures = async (req: Request) => {
  const keyword = req.query.keyword as string | undefined;
  const status = req.query.status as string | undefined;

  return { keyword, status };
};

/**
 * 2. Validate dữ liệu khi lấy danh sách mã tính năng hệ thống chuẩn.
 */
export const validateGetSystemFeatureCodes = async (_req: Request) => {
  return {};
};

/**
 * 3. Validate và kiểm tra tính năng tồn tại khi lấy chi tiết tính năng theo ID.
 */
export const validateGetFeatureById = async (req: Request) => {
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

  return { id: numericId, feature };
};

/**
 * 4. Validate và kiểm tra dữ liệu trùng lặp khi tạo mới tính năng.
 */
export const validateCreateFeature = async (req: Request) => {
  const { code, name, description, sortOrder, isActive } = req.body;

  if (!code || !name) {
    throw new AppError('Mã tính năng và tên tính năng là bắt buộc.', 400, 'VALIDATION_ERROR', {
      code: !code ? ['Mã tính năng là bắt buộc.'] : [],
      name: !name ? ['Tên tính năng là bắt buộc.'] : []
    });
  }

  const formattedCode = code.trim();

  const existingFeature = await prisma.feature.findUnique({
    where: { code: formattedCode }
  });

  if (existingFeature) {
    throw new AppError('Mã tính năng đã tồn tại trong hệ thống.', 400, 'VALIDATION_ERROR', {
      code: ['Mã tính năng đã tồn tại.']
    });
  }

  return {
    code: formattedCode,
    name,
    description: description || null,
    sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
    isActive: isActive !== undefined ? Boolean(isActive) : true
  };
};

/**
 * 5. Validate dữ liệu khi cập nhật tính năng.
 */
export const validateUpdateFeature = async (req: Request) => {
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

  return { id: numericId, existingFeature, updateData };
};

/**
 * 6. Validate khi xóa tính năng.
 */
export const validateDeleteFeature = async (req: Request) => {
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

  return { id: numericId, existingFeature };
};

/**
 * 7. Validate khi bật/tắt trạng thái tính năng.
 */
export const validateToggleFeatureStatus = async (req: Request) => {
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

  return { id: numericId, existingFeature };
};

/**
 * 8. Validate khi cập nhật thứ tự sắp xếp của tính năng.
 */
export const validateUpdateFeatureSortOrder = async (req: Request) => {
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

  return { id: numericId, sortOrder: Number(sortOrder) };
};
