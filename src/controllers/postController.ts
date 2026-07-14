import type { Request, Response } from 'express';
import prisma from '../config/db';
import { AppError } from '../utils/appError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/responseHelper';

/**
 * Lấy danh sách tất cả các bài viết (Public).
 */
export const getPosts = asyncHandler(async (req: Request, res: Response) => {
  const posts = await prisma.post.findMany({
    include: {
      postType: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
  return sendSuccess(res, { posts }, 'Get posts list successfully');
});

/**
 * Tạo bài viết mới (Protected).
 */
export const createPost = asyncHandler(async (req: Request, res: Response) => {
  const { title, content, published } = req.body;

  if (!title) {
    throw new AppError(
      'Title is required',
      400,
      'VALIDATION_ERROR',
      { title: ['Tiêu đề bài viết là bắt buộc.'] }
    );
  }

  // Đảm bảo có ít nhất một PostType mặc định
  let postType = await prisma.postType.findUnique({
    where: { code: 'GENERAL' }
  });

  if (!postType) {
    postType = await prisma.postType.create({
      data: {
        name: 'Chung',
        code: 'GENERAL',
        description: 'Danh mục bài viết chung'
      }
    });
  }

  // Tạo bài viết mới
  const post = await prisma.post.create({
    data: {
      title,
      content,
      published: published || false,
      postTypeId: postType.id
    },
    include: {
      postType: true
    }
  });

  return sendSuccess(res, { post }, 'Post created successfully', 201);
});

/**
 * Xóa bài viết (Protected).
 */
export const deletePost = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const postId = parseInt(id as string, 10);

  if (isNaN(postId)) {
    throw new AppError('Invalid post ID', 400, 'VALIDATION_ERROR');
  }

  // Kiểm tra xem bài viết có tồn tại không
  const existingPost = await prisma.post.findUnique({
    where: { id: postId }
  });

  if (!existingPost) {
    throw new AppError('Post not found', 404, 'NOT_FOUND');
  }

  // Thực hiện xóa
  await prisma.post.delete({
    where: { id: postId }
  });

  return sendSuccess(res, null, 'Post deleted successfully');
});
