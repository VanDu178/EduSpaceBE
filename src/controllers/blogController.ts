import type { Request, Response } from 'express';
import prisma from '../config/db';
import { AppError } from '../utils/appError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/responseHelper';
import { generateBlogCode } from '../utils/codeGenerator';
import { verifyAccessToken } from '../utils/authHelper';
import { checkUserFeatureAccess } from '../utils/featureAccessHelper';

/**
 * Hàm helper tự động tạo slug từ tiêu đề tiếng Việt
 */
const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/([^0-9a-z-\s])/g, '')
    .replace(/(\s+)/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Lấy danh sách tất cả các bài blog (Public).
 */
export const getBlogs = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const keyword = req.query.keyword as string;
  const blogType = req.query.blogType as string;
  const status = req.query.status as string;
  const isPremium = req.query.isPremium as string;

  const where: any = {};

  if (keyword) {
    where.OR = [
      { title: { contains: keyword } },
      { summary: { contains: keyword } },
      { code: { contains: keyword } }
    ];
  }

  if (blogType && blogType !== 'ALL') {
    where.blogType = {
      code: blogType
    };
  }

  if (status && status !== 'ALL') {
    where.status = status;
  }

  if (isPremium !== undefined && isPremium !== 'ALL') {
    where.isPremium = isPremium === 'true';
  }

  const skip = (page - 1) * limit;

  const [blogs, total] = await Promise.all([
    prisma.blog.findMany({
      where,
      include: {
        blogType: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    }),
    prisma.blog.count({ where })
  ]);

  const totalPages = Math.ceil(total / limit);

  return sendSuccess(
    res,
    {
      blogs,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    },
    'Lấy danh sách bài blog thành công'
  );
});

/**
 * Tạo bài blog mới (Protected).
 */
export const createBlog = asyncHandler(async (req: Request, res: Response) => {
  const {
    title,
    slug: customSlug,
    blogTypeId,
    bannerUrl,
    thumbnailUrl,
    isPremium,
    summary,
    content,
    publishedAt,
    createdBy,
    status
  } = req.body;

  if (!title) {
    throw new AppError(
      'Tiêu đề bài blog là bắt buộc.',
      400,
      'VALIDATION_ERROR',
      { title: ['Tiêu đề bài blog là bắt buộc.'] }
    );
  }

  if (!blogTypeId) {
    throw new AppError(
      'Thể loại bài blog là bắt buộc.',
      400,
      'VALIDATION_ERROR',
      { blogTypeId: ['Thể loại bài blog là bắt buộc.'] }
    );
  }

  // Tạo slug từ customSlug hoặc tự sinh từ title
  let slug = customSlug ? generateSlug(customSlug) : generateSlug(title);
  if (!slug) {
    slug = `blog-${Date.now()}`;
  }

  // Kiểm tra trùng lặp slug
  const existingSlug = await prisma.blog.findUnique({
    where: { slug }
  });

  if (existingSlug) {
    slug = `${slug}-${Date.now()}`;
  }

  // Kiểm tra xem blogType có tồn tại hay không
  const blogType = await prisma.blogType.findUnique({
    where: { id: Number(blogTypeId) }
  });

  if (!blogType) {
    throw new AppError(
      'Thể loại bài blog không tồn tại.',
      400,
      'VALIDATION_ERROR',
      { blogTypeId: ['Thể loại bài blog không tồn tại.'] }
    );
  }

  // Lấy userId từ JWT authMiddleware nếu có req.user
  const currentUserId = (req as any).user?.id || (createdBy ? Number(createdBy) : null);

  // Tạo bài blog mới
  const blog = await prisma.blog.create({
    data: {
      title,
      slug,
      blogTypeId: blogType.id,
      bannerUrl: bannerUrl || null,
      thumbnailUrl: thumbnailUrl || null,
      isPremium: isPremium || false,
      summary: summary || null,
      content: content || null,
      publishedAt: publishedAt ? new Date(publishedAt) : (status === 'published' ? new Date() : null),
      createdBy: currentUserId,
      status: status || 'draft'
    }
  });

  const code = generateBlogCode(blog.id);
  const updatedBlog = await prisma.blog.update({
    where: { id: blog.id },
    data: { code },
    include: {
      blogType: true,
      creator: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });

  return sendSuccess(res, { blog: updatedBlog }, 'Tạo bài blog mới thành công', 201);
});

/**
 * Cập nhật bài blog (Protected).
 */
export const updateBlog = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const blogId = parseInt(id as string, 10);
  const {
    title,
    slug: customSlug,
    blogTypeId,
    bannerUrl,
    thumbnailUrl,
    isPremium,
    summary,
    content,
    publishedAt,
    createdBy,
    status
  } = req.body;

  if (isNaN(blogId)) {
    throw new AppError('Bài blog không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  // Kiểm tra xem bài blog có tồn tại không
  const existingBlog = await prisma.blog.findUnique({
    where: { id: blogId }
  });

  if (!existingBlog) {
    throw new AppError('Bài blog không tồn tại', 404, 'NOT_FOUND');
  }

  const updateData: any = {};

  if (title !== undefined) {
    if (!title) {
      throw new AppError(
        'Tiêu đề bài blog là bắt buộc.',
        400,
        'VALIDATION_ERROR',
        { title: ['Tiêu đề bài blog là bắt buộc.'] }
      );
    }
    updateData.title = title;
  }

  if (customSlug !== undefined) {
    const newSlug = generateSlug(customSlug);
    if (newSlug !== existingBlog.slug) {
      const slugExists = await prisma.blog.findUnique({
        where: { slug: newSlug }
      });
      if (slugExists) {
        throw new AppError('Slug đã tồn tại', 400, 'VALIDATION_ERROR', {
          slug: ['Slug đã được sử dụng bởi một bài blog khác.']
        });
      }
    }
    updateData.slug = newSlug;
  }

  if (blogTypeId !== undefined) {
    if (!blogTypeId) {
      throw new AppError(
        'Thể loại bài blog là bắt buộc.',
        400,
        'VALIDATION_ERROR',
        { blogTypeId: ['Thể loại bài blog là bắt buộc.'] }
      );
    }
    const blogType = await prisma.blogType.findUnique({
      where: { id: Number(blogTypeId) }
    });
    if (!blogType) {
      throw new AppError(
        'Thể loại bài blog không tồn tại.',
        400,
        'VALIDATION_ERROR',
        { blogTypeId: ['Thể loại bài blog không tồn tại.'] }
      );
    }
    updateData.blogTypeId = blogType.id;
  }

  if (bannerUrl !== undefined) updateData.bannerUrl = bannerUrl;
  if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl;
  if (isPremium !== undefined) updateData.isPremium = Boolean(isPremium);
  if (summary !== undefined) updateData.summary = summary;
  if (content !== undefined) updateData.content = content;
  if (publishedAt !== undefined) updateData.publishedAt = publishedAt ? new Date(publishedAt) : null;
  if (createdBy !== undefined) updateData.createdBy = createdBy ? Number(createdBy) : null;
  if (status !== undefined) {
    updateData.status = status;
    if (status === 'published' && !existingBlog.publishedAt && !publishedAt) {
      updateData.publishedAt = new Date();
    }
  }

  // Cập nhật bài blog
  const blog = await prisma.blog.update({
    where: { id: blogId },
    data: updateData,
    include: {
      blogType: true,
      creator: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });

  return sendSuccess(res, { blog }, 'Cập nhật bài blog thành công');
});

/**
 * Xóa bài blog (Protected).
 */
export const deleteBlog = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const blogId = parseInt(id as string, 10);

  if (isNaN(blogId)) {
    throw new AppError('Bài blog không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  // Kiểm tra xem bài blog có tồn tại không
  const existingBlog = await prisma.blog.findUnique({
    where: { id: blogId }
  });

  if (!existingBlog) {
    throw new AppError('Bài blog không tồn tại', 404, 'NOT_FOUND');
  }

  // Thực hiện xóa
  await prisma.blog.delete({
    where: { id: blogId }
  });

  return sendSuccess(res, null, 'Bài blog đã được xóa thành công');
});

/**
 * Cập nhật trạng thái (status) của bài blog (Protected).
 */
export const updateBlogStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const blogId = parseInt(id as string, 10);
  const { status } = req.body;

  if (isNaN(blogId)) {
    throw new AppError('Bài blog không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  if (!status || typeof status !== 'string') {
    throw new AppError(
      'Trạng thái bài blog là bắt buộc và phải là kiểu chuỗi string.',
      400,
      'VALIDATION_ERROR',
      { status: ['Trạng thái bài blog là bắt buộc.'] }
    );
  }

  // Kiểm tra xem bài blog có tồn tại không
  const existingBlog = await prisma.blog.findUnique({
    where: { id: blogId }
  });

  if (!existingBlog) {
    throw new AppError('Bài blog không tồn tại', 404, 'NOT_FOUND');
  }

  const updateData: any = { status };
  if (status === 'published' && !existingBlog.publishedAt) {
    updateData.publishedAt = new Date();
  }

  // Cập nhật trạng thái
  const blog = await prisma.blog.update({
    where: { id: blogId },
    data: updateData,
    include: {
      blogType: true,
      creator: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });

  return sendSuccess(res, { blog }, 'Cập nhật trạng thái bài blog thành công');
});

/**
 * Lấy chi tiết một bài blog theo ID hoặc Slug.
 */
export const getBlogByIdOrSlug = asyncHandler(async (req: Request, res: Response) => {
  const { idOrSlug } = req.params;
  const numericId = parseInt(idOrSlug as string, 10);

  let blog = null;

  if (!isNaN(numericId)) {
    blog = await prisma.blog.findUnique({
      where: { id: numericId },
      include: {
        blogType: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }

  if (!blog) {
    blog = await prisma.blog.findUnique({
      where: { slug: idOrSlug as string },
      include: {
        blogType: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }

  if (!blog) {
    blog = await prisma.blog.findUnique({
      where: { code: idOrSlug as string },
      include: {
        blogType: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }

  if (!blog) {
    throw new AppError('Bài blog không tồn tại', 404, 'NOT_FOUND');
  }

  // Kiểm tra quyền truy cập nếu là bài viết Premium
  if (blog.isPremium) {
    const authHeader = req.headers.authorization;
    let userId: number | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyAccessToken(token);
      if (decoded && decoded.userId) {
        userId = decoded.userId;
      }
    }

    if (!userId) {
      throw new AppError(
        'Bài viết này dành cho hội viên Premium. Vui lòng đăng nhập và đăng ký gói hội viên để xem toàn bộ nội dung.',
        403,
        'PREMIUM_REQUIRED'
      );
    }

    // Kiểm tra tính năng READ_PREMIUM_BLOGS trong gói hội viên của người dùng
    const { hasAccess, reason } = await checkUserFeatureAccess(userId, 'READ_PREMIUM_BLOGS');

    if (!hasAccess) {
      const message =
        reason === 'NO_ACTIVE_SUBSCRIPTION'
          ? 'Bài viết này dành cho hội viên Premium. Vui lòng đăng ký gói hội viên để truy cập.'
          : 'Gói hội viên hiện tại của bạn không bao gồm tính năng Đọc bài viết Premium. Vui lòng nâng cấp gói hội viên.';
      throw new AppError(message, 403, 'PREMIUM_REQUIRED');
    }
  }

  return sendSuccess(res, { blog }, 'Lấy chi tiết bài blog thành công');
});


/**
 * Cập nhật quyền truy cập (isPremium) của bài blog (Protected).
 */
export const updateBlogAccess = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const blogId = parseInt(id as string, 10);
  const { isPremium } = req.body;

  if (isNaN(blogId)) {
    throw new AppError('Bài viết không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  if (typeof isPremium !== 'boolean') {
    throw new AppError(
      'Quyền truy cập là bắt buộc và phải là kiểu boolean.',
      400,
      'VALIDATION_ERROR',
      { isPremium: ['Quyền truy cập là bắt buộc.'] }
    );
  }

  // Kiểm tra xem bài blog có tồn tại không
  const existingBlog = await prisma.blog.findUnique({
    where: { id: blogId }
  });

  if (!existingBlog) {
    throw new AppError('Bài viết không tồn tại', 404, 'NOT_FOUND');
  }

  // Cập nhật quyền truy cập
  const blog = await prisma.blog.update({
    where: { id: blogId },
    data: { isPremium },
    include: {
      blogType: true,
      creator: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });

  return sendSuccess(res, { blog }, 'Cập nhật quyền truy cập bài viết thành công');
});

