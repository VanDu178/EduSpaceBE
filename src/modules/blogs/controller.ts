import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';
import {
  validateGetBlogs,
  validateCreateBlog,
  validateUpdateBlog,
  validateDeleteBlog,
  validateUpdateBlogStatus,
  validateGetBlogById,
  validateGetBlogBySlug,
  validateUpdateBlogAccess
} from './validation';
import {
  getBlogsService,
  createBlogService,
  updateBlogService,
  deleteBlogService,
  updateBlogStatusService,
  getBlogByIdService,
  getBlogBySlugService,
  updateBlogAccessService
} from './services';

/**
 * Lấy danh sách tất cả các bài viết (Public).
 */
export const getBlogs = asyncHandler(async (req: Request, res: Response) => {
  const validatedQuery = await validateGetBlogs(req);
  const result = await getBlogsService(validatedQuery);
  return sendSuccess(
    res,
    result,
    'Lấy danh sách bài viết thành công'
  );
});

/**
 * Tạo bài viết mới (Protected).
 */
export const createBlog = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = await validateCreateBlog(req);
  const blog = await createBlogService(validatedData);
  return sendSuccess(res, { blog }, 'Tạo bài viết mới thành công', 201);
});

/**
 * Cập nhật bài viết (Protected).
 */
export const updateBlog = asyncHandler(async (req: Request, res: Response) => {
  const validatedParams = await validateUpdateBlog(req);
  const blog = await updateBlogService(validatedParams);
  return sendSuccess(res, { blog }, 'Cập nhật bài viết thành công');
});

/**
 * Xóa bài viết (Protected).
 */
export const deleteBlog = asyncHandler(async (req: Request, res: Response) => {
  const validatedParams = await validateDeleteBlog(req);
  await deleteBlogService(validatedParams);
  return sendSuccess(res, null, 'Bài viết đã được xóa thành công');
});

/**
 * Cập nhật trạng thái (status) của bài viết (Protected).
 */
export const updateBlogStatus = asyncHandler(async (req: Request, res: Response) => {
  const validatedParams = await validateUpdateBlogStatus(req);
  const blog = await updateBlogStatusService(validatedParams);
  return sendSuccess(res, { blog }, 'Cập nhật trạng thái bài viết thành công');
});

/**
 * Lấy chi tiết một bài viết theo ID.
 */
export const getBlogById = asyncHandler(async (req: Request, res: Response) => {
  const { blogId } = await validateGetBlogById(req);
  const blog = await getBlogByIdService(blogId);
  return sendSuccess(res, { blog }, 'Lấy chi tiết bài viết theo ID thành công');
});

/**
 * Lấy chi tiết một bài viết theo Slug (Dành cho Client).
 */
export const getBlogBySlug = asyncHandler(async (req: Request, res: Response) => {
  const validatedParams = await validateGetBlogBySlug(req);
  const blogResponse = await getBlogBySlugService(validatedParams);
  return sendSuccess(res, { blog: blogResponse }, 'Lấy chi tiết bài viết theo Slug thành công');
});

/**
 * Cập nhật quyền truy cập (isPremium) của bài viết (Protected).
 */
export const updateBlogAccess = asyncHandler(async (req: Request, res: Response) => {
  const validatedParams = await validateUpdateBlogAccess(req);
  const blog = await updateBlogAccessService(validatedParams);
  return sendSuccess(res, { blog }, 'Cập nhật quyền truy cập bài viết thành công');
});
