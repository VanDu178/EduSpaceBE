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
  const { title, content, published } = req.body;

  if (!title) {
    throw new AppError(
      'Tiêu đề bài viết là bắt buộc.',
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

  return sendSuccess(res, { post }, 'Tạo bài viết mới thành công', 201);
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
