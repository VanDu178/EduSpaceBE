import type { Request, Response } from 'express';
import prisma from '../../config/db';
import { AppError } from '../../utils/appError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';

/**
 * Lấy danh sách tất cả các thể loại blog (Protected).
 */
export const getBlogTypes = asyncHandler(async (req: Request, res: Response) => {
  const types = await prisma.blogType.findMany({
    orderBy: {
      name: 'asc'
    }
  });

  return sendSuccess(res, types, 'Lấy danh sách thể loại blog thành công');
});

/**
 * Tạo mới thể loại blog (Protected).
 */
export const createBlogType = asyncHandler(async (req: Request, res: Response) => {
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

  const blogType = await prisma.blogType.create({
    data: {
      name: name.trim(),
      code: normalizedCode,
      description: description ? description.trim() : null
    }
  });

  return sendSuccess(res, blogType, 'Tạo thể loại mới thành công', 201);
});

/**
 * Cập nhật thể loại blog (Protected).
 */
export const updateBlogType = asyncHandler(async (req: Request, res: Response) => {
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

  const updateData: any = {};

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

  const updated = await prisma.blogType.update({
    where: { id: typeId },
    data: updateData
  });

  return sendSuccess(res, updated, 'Cập nhật thể loại thành công');
});

/**
 * Xóa thể loại blog (Protected).
 */
export const deleteBlogType = asyncHandler(async (req: Request, res: Response) => {
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

  await prisma.blogType.delete({
    where: { id: typeId }
  });

  return sendSuccess(res, null, 'Xóa thể loại thành công');
});
