import type { Request } from 'express';
import prisma from '../../config/db';
import { AppError } from '../../utils/appError';

/**
 * 1. Validate dữ liệu khi lấy danh sách thể loại blog.
 */
export const validateGetBlogTypes = async (_req: Request) => {
  return {};
};

/**
 * 2. Validate và kiểm tra tính hợp lệ khi tạo mới thể loại blog.
 */
export const validateCreateBlogType = async (req: Request) => {
  const { name, code, description } = req.body;

  if (!name || !code) {
    throw new AppError(
      'Tên và mã thể loại là bắt buộc.',
      400,
      'VALIDATION_ERROR',
      {
        name: !name ? ['Tên thể loại là bắt buộc.'] : [],
        code: !code ? ['Mã thể loại là bắt buộc.'] : []
      }
    );
  }

  const normalizedCode = code.trim().toUpperCase();

  // Kiểm tra xem mã thể loại đã tồn tại chưa
  const existing = await prisma.blogType.findUnique({
    where: { code: normalizedCode }
  });

  if (existing) {
    throw new AppError(
      'Mã thể loại đã tồn tại.',
      400,
      'VALIDATION_ERROR',
      { code: ['Mã thể loại đã tồn tại.'] }
    );
  }

  return {
    name: name.trim(),
    code: normalizedCode,
    description: description ? description.trim() : null
  };
};

/**
 * 3. Validate và kiểm tra tồn tại/trùng lặp mã khi cập nhật thể loại blog.
 */
export const validateUpdateBlogType = async (req: Request) => {
  const { id } = req.params;
  const typeId = parseInt(id as string, 10);
  const { name, code, description } = req.body;

  if (isNaN(typeId)) {
    throw new AppError('Thể loại không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  // Kiểm tra thể loại có tồn tại không
  const existing = await prisma.blogType.findUnique({
    where: { id: typeId }
  });

  if (!existing) {
    throw new AppError('Thể loại không tồn tại', 404, 'NOT_FOUND');
  }

  const updateData: { name?: string; code?: string; description?: string | null } = {};

  if (name !== undefined) {
    updateData.name = name.trim();
  }

  if (code !== undefined) {
    const normalizedCode = code.trim().toUpperCase();
    if (normalizedCode !== existing.code) {
      // Kiểm tra xem mã code mới đã bị trùng với loại khác chưa
      const codeExists = await prisma.blogType.findUnique({
        where: { code: normalizedCode }
      });
      if (codeExists) {
        throw new AppError(
          'Mã thể loại đã tồn tại.',
          400,
          'VALIDATION_ERROR',
          { code: ['Mã thể loại đã tồn tại.'] }
        );
      }
    }
    updateData.code = normalizedCode;
  }

  if (description !== undefined) {
    updateData.description = description ? description.trim() : null;
  }

  return { typeId, updateData };
};

/**
 * 4. Validate và kiểm tra ràng buộc bài viết trước khi xóa thể loại blog.
 */
export const validateDeleteBlogType = async (req: Request) => {
  const { id } = req.params;
  const typeId = parseInt(id as string, 10);

  if (isNaN(typeId)) {
    throw new AppError('Thể loại không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const existing = await prisma.blogType.findUnique({
    where: { id: typeId }
  });

  if (!existing) {
    throw new AppError('Thể loại không tồn tại', 404, 'NOT_FOUND');
  }

  // KIỂM TRA RÀNG BUỘC: Đếm số lượng bài viết đang sử dụng thể loại này
  const blogCount = await prisma.blog.count({
    where: { blogTypeId: typeId }
  });

  if (blogCount > 0) {
    throw new AppError(
      `Không thể xóa thể loại này vì đang có ${blogCount} bài viết sử dụng.`,
      400,
      'VALIDATION_ERROR'
    );
  }

  return { typeId };
};
