import type { Request, Response } from 'express';
import prisma from '../config/db';
import { AppError } from '../utils/appError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/responseHelper';

/**
 * Lấy danh sách tất cả các bài viết (Public).
 */
export const getPosts = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const keyword = req.query.keyword as string;
  const postType = req.query.postType as string;

  const where: any = {};

  if (keyword) {
    where.title = {
      contains: keyword
    };
  }

  if (postType && postType !== 'ALL') {
    where.postType = {
      code: postType
    };
  }

  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      include: {
        postType: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    }),
    prisma.post.count({ where })
  ]);

  const totalPages = Math.ceil(total / limit);

  return sendSuccess(
    res,
    {
      posts,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    },
    'Lấy danh sách bài viết thành công'
  );
});

/**
 * Tạo bài viết mới (Protected).
 */
export const createPost = asyncHandler(async (req: Request, res: Response) => {
  const { title, content, published, postTypeId, summary, thumbnail } = req.body;

  if (!title) {
    throw new AppError(
      'Tiêu đề bài viết là bắt buộc.',
      400,
      'VALIDATION_ERROR',
      { title: ['Tiêu đề bài viết là bắt buộc.'] }
    );
  }

  if (!postTypeId) {
    throw new AppError(
      'Thể loại bài viết là bắt buộc.',
      400,
      'VALIDATION_ERROR',
      { postTypeId: ['Thể loại bài viết là bắt buộc.'] }
    );
  }

  // Kiểm tra xem postType có tồn tại hay không
  const postType = await prisma.postType.findUnique({
    where: { id: Number(postTypeId) }
  });

  if (!postType) {
    throw new AppError(
      'Thể loại bài viết không tồn tại.',
      400,
      'VALIDATION_ERROR',
      { postTypeId: ['Thể loại bài viết không tồn tại.'] }
    );
  }

  // Tạo bài viết mới
  const post = await prisma.post.create({
    data: {
      title,
      content,
      published: published || false,
      postTypeId: postType.id,
      summary,
      thumbnail
    },
    include: {
      postType: true
    }
  });

  return sendSuccess(res, { post }, 'Tạo bài viết mới thành công', 201);
});

/**
 * Cập nhật bài viết (Protected).
 */
export const updatePost = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const postId = parseInt(id as string, 10);
  const { title, content, published, postTypeId, summary, thumbnail } = req.body;

  if (isNaN(postId)) {
    throw new AppError('Bài viết không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  // Kiểm tra xem bài viết có tồn tại không
  const existingPost = await prisma.post.findUnique({
    where: { id: postId }
  });

  if (!existingPost) {
    throw new AppError('Bài viết không tồn tại', 404, 'NOT_FOUND');
  }

  const updateData: any = {};

  if (title !== undefined) {
    if (!title) {
      throw new AppError(
        'Tiêu đề bài viết là bắt buộc.',
        400,
        'VALIDATION_ERROR',
        { title: ['Tiêu đề bài viết là bắt buộc.'] }
      );
    }
    updateData.title = title;
  }

  if (content !== undefined) {
    updateData.content = content;
  }

  if (published !== undefined) {
    updateData.published = published;
  }

  if (postTypeId !== undefined) {
    if (!postTypeId) {
      throw new AppError(
        'Thể loại bài viết là bắt buộc.',
        400,
        'VALIDATION_ERROR',
        { postTypeId: ['Thể loại bài viết là bắt buộc.'] }
      );
    }
    const postType = await prisma.postType.findUnique({
      where: { id: Number(postTypeId) }
    });
    if (!postType) {
      throw new AppError(
        'Thể loại bài viết không tồn tại.',
        400,
        'VALIDATION_ERROR',
        { postTypeId: ['Thể loại bài viết không tồn tại.'] }
      );
    }
    updateData.postTypeId = postType.id;
  }

  if (summary !== undefined) {
    updateData.summary = summary;
  }

  if (thumbnail !== undefined) {
    updateData.thumbnail = thumbnail;
  }

  // Cập nhật bài viết
  const post = await prisma.post.update({
    where: { id: postId },
    data: updateData,
    include: {
      postType: true
    }
  });

  return sendSuccess(res, { post }, 'Cập nhật bài viết thành công');
});

/**
 * Xóa bài viết (Protected).
 */
export const deletePost = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const postId = parseInt(id as string, 10);

  if (isNaN(postId)) {
    throw new AppError('Bài viết không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  // Kiểm tra xem bài viết có tồn tại không
  const existingPost = await prisma.post.findUnique({
    where: { id: postId }
  });

  if (!existingPost) {
    throw new AppError('Bài viết không tồn tại', 404, 'NOT_FOUND');
  }

  // Thực hiện xóa
  await prisma.post.delete({
    where: { id: postId }
  });

  return sendSuccess(res, null, 'Bài viết đã được xóa thành công');
});

/**
 * Cập nhật trạng thái (published) của bài viết (Protected).
 */
export const updatePostStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const postId = parseInt(id as string, 10);
  const { published } = req.body;

  if (isNaN(postId)) {
    throw new AppError('Bài viết không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  if (published === undefined || typeof published !== 'boolean') {
    throw new AppError(
      'Trạng thái bài viết là bắt buộc và phải là kiểu boolean.',
      400,
      'VALIDATION_ERROR',
      { published: ['Trạng thái bài viết là bắt buộc và phải là kiểu boolean.'] }
    );
  }

  // Kiểm tra xem bài viết có tồn tại không
  const existingPost = await prisma.post.findUnique({
    where: { id: postId }
  });

  if (!existingPost) {
    throw new AppError('Bài viết không tồn tại', 404, 'NOT_FOUND');
  }

  // Cập nhật trạng thái
  const post = await prisma.post.update({
    where: { id: postId },
    data: { published },
    include: {
      postType: true
    }
  });

  return sendSuccess(res, { post }, 'Cập nhật trạng thái bài viết thành công');
});

/**
 * Lấy chi tiết một bài viết theo ID.
 */
export const getPostById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const postId = parseInt(id as string, 10);

  if (isNaN(postId)) {
    throw new AppError('Bài viết không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      postType: true
    }
  });

  if (!post) {
    throw new AppError('Bài viết không tồn tại', 404, 'NOT_FOUND');
  }

  return sendSuccess(res, { post }, 'Lấy chi tiết bài viết thành công');
});


