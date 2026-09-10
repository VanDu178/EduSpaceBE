import type { Request } from 'express';
import prisma from '../../config/db';
import { AppError } from '../../utils/appError';
import {
  blogTypeIdParamSchema,
  createBlogTypeBodySchema,
  updateBlogTypeBodySchema
} from './zodSchemas';

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
  // Tầng 1: Validate cú pháp bằng Zod Schema
  const parsed = createBlogTypeBodySchema.safeParse(req.body);

  if (!parsed.success) {
    const formattedErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] ? String(issue.path[0]) : 'general';
      if (!formattedErrors[field]) {
        formattedErrors[field] = [];
      }
      formattedErrors[field].push(issue.message);
    }
    throw new AppError(
      'Dữ liệu tạo thể loại blog không hợp lệ.',
      400,
      'VALIDATION_ERROR',
      formattedErrors
    );
  }

  const { name, code, description } = parsed.data;
  const normalizedCode = code.toUpperCase();

  // Tầng 2: Kiểm tra trùng lặp trong DB
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
    name,
    code: normalizedCode,
    description: description ? description.trim() : null
  };
};

/**
 * 3. Validate và kiểm tra tồn tại/trùng lặp mã khi cập nhật thể loại blog.
 */
export const validateUpdateBlogType = async (req: Request) => {
  // Tầng 1: Validate Param ID & Body bằng Zod Schemas
  const paramParsed = blogTypeIdParamSchema.safeParse(req.params);
  if (!paramParsed.success) {
    throw new AppError('Thể loại không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const bodyParsed = updateBlogTypeBodySchema.safeParse(req.body);
  if (!bodyParsed.success) {
    const formattedErrors: Record<string, string[]> = {};
    for (const issue of bodyParsed.error.issues) {
      const field = issue.path[0] ? String(issue.path[0]) : 'general';
      if (!formattedErrors[field]) {
        formattedErrors[field] = [];
      }
      formattedErrors[field].push(issue.message);
    }
    throw new AppError(
      'Dữ liệu cập nhật thể loại blog không hợp lệ.',
      400,
      'VALIDATION_ERROR',
      formattedErrors
    );
  }

  const typeId = paramParsed.data.id;
  const { name, code, description } = bodyParsed.data;

  // Tầng 2: Kiểm tra thể loại có tồn tại không
  const existing = await prisma.blogType.findUnique({
    where: { id: typeId }
  });

  if (!existing) {
    throw new AppError('Thể loại không tồn tại', 404, 'NOT_FOUND');
  }

  const updateData: { name?: string; code?: string; description?: string | null } = {};

  if (name !== undefined) {
    updateData.name = name;
  }

  if (code !== undefined) {
    const normalizedCode = code.toUpperCase();
    if (normalizedCode !== existing.code) {
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
  // Tầng 1: Validate Param ID bằng Zod Schema
  const paramParsed = blogTypeIdParamSchema.safeParse(req.params);
  if (!paramParsed.success) {
    throw new AppError('Thể loại không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const typeId = paramParsed.data.id;

  // Tầng 2: Kiểm tra DB
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
