import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';
import {
  validateGetBlogTypes,
  validateCreateBlogType,
  validateUpdateBlogType,
  validateDeleteBlogType
} from './validation';
import {
  getBlogTypesService,
  createBlogTypeService,
  updateBlogTypeService,
  deleteBlogTypeService
} from './services';

/**
 * Lấy danh sách tất cả các thể loại blog (Protected).
 */
export const getBlogTypes = asyncHandler(async (req: Request, res: Response) => {
  await validateGetBlogTypes(req);
  const types = await getBlogTypesService();
  return sendSuccess(res, types, 'Lấy danh sách thể loại blog thành công');
});

/**
 * Tạo mới thể loại blog (Protected).
 */
export const createBlogType = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = await validateCreateBlogType(req);
  const blogType = await createBlogTypeService(validatedData);
  return sendSuccess(res, blogType, 'Tạo thể loại mới thành công', 201);
});

/**
 * Cập nhật thể loại blog (Protected).
 */
export const updateBlogType = asyncHandler(async (req: Request, res: Response) => {
  const { typeId, updateData } = await validateUpdateBlogType(req);
  const updated = await updateBlogTypeService(typeId, updateData);
  return sendSuccess(res, updated, 'Cập nhật thể loại thành công');
});

/**
 * Xóa thể loại blog (Protected).
 */
export const deleteBlogType = asyncHandler(async (req: Request, res: Response) => {
  const { typeId } = await validateDeleteBlogType(req);
  await deleteBlogTypeService(typeId);
  return sendSuccess(res, null, 'Xóa thể loại thành công');
});
