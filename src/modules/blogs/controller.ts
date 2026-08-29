import type { Request, Response } from 'express';
import prisma from '../../config/db';
import { AppError } from '../../utils/appError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/responseHelper';
import { verifyAccessToken } from '../../utils/authHelper';
import { checkUserFeatureAccess } from '../../utils/featureAccessHelper';
import { generateSlug, generateBlogCode } from './utils';
import { BLOG_STATUS, BLOG_FILTER, VALID_BLOG_STATUSES, type BlogStatus } from './constants';
import { deleteFromSupabase, extractStoragePath } from '../../utils/supabaseStorage';


/**
 * Lấy danh sách tất cả các bài viết (Public).
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

  if (blogType && blogType !== BLOG_FILTER.ALL) {
    where.blogType = {
      code: blogType
    };
  }

  if (status && status !== BLOG_FILTER.ALL) {
    where.status = status;
  }

  if (isPremium !== undefined && isPremium !== BLOG_FILTER.ALL) {
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
    'Lấy danh sách bài viết thành công'
  );
});

/**
 * Tạo bài viết mới (Protected).
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
      'Tiêu đề bài viết là bắt buộc.',
      400,
      'VALIDATION_ERROR',
      { title: ['Tiêu đề bài viết là bắt buộc.'] }
    );
  }

  if (!blogTypeId) {
    throw new AppError(
      'Thể loại bài viết là bắt buộc.',
      400,
      'VALIDATION_ERROR',
      { blogTypeId: ['Thể loại bài viết là bắt buộc.'] }
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
    throw new AppError('Slug đã tồn tại', 400, 'VALIDATION_ERROR', {
      slug: ['Slug đã được sử dụng bởi một bài viết khác.']
    });
  }

  // Kiểm tra xem blogType có tồn tại hay không
  const blogType = await prisma.blogType.findUnique({
    where: { id: Number(blogTypeId) }
  });

  if (!blogType) {
    throw new AppError(
      'Thể loại bài viết không tồn tại.',
      400,
      'VALIDATION_ERROR',
      { blogTypeId: ['Thể loại bài viết không tồn tại.'] }
    );
  }

  // Lấy userId từ JWT authMiddleware nếu có req.user
  const currentUserId = (req as any).user?.id || (createdBy ? Number(createdBy) : null);

  // Tạo bài viết mới
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
      publishedAt: publishedAt ? new Date(publishedAt) : (status === BLOG_STATUS.PUBLISHED ? new Date() : null),
      createdBy: currentUserId,
      status: status || BLOG_STATUS.DRAFT
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

  return sendSuccess(res, { blog: updatedBlog }, 'Tạo bài viết mới thành công', 201);
});

/**
 * Cập nhật bài viết (Protected).
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
    throw new AppError('Bài viết không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  // Kiểm tra xem bài viết có tồn tại không
  const existingBlog = await prisma.blog.findUnique({
    where: { id: blogId }
  });

  if (!existingBlog) {
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

  if (customSlug !== undefined) {
    const newSlug = generateSlug(customSlug);
    if (newSlug !== existingBlog.slug) {
      const slugExists = await prisma.blog.findUnique({
        where: { slug: newSlug }
      });
      if (slugExists) {
        throw new AppError('Slug đã tồn tại', 400, 'VALIDATION_ERROR', {
          slug: ['Slug đã được sử dụng bởi một bài viết khác.']
        });
      }
    }
    updateData.slug = newSlug;
  }

  if (blogTypeId !== undefined) {
    if (!blogTypeId) {
      throw new AppError(
        'Thể loại bài viết là bắt buộc.',
        400,
        'VALIDATION_ERROR',
        { blogTypeId: ['Thể loại bài viết là bắt buộc.'] }
      );
    }
    const blogType = await prisma.blogType.findUnique({
      where: { id: Number(blogTypeId) }
    });
    if (!blogType) {
      throw new AppError(
        'Thể loại bài viết không tồn tại.',
        400,
        'VALIDATION_ERROR',
        { blogTypeId: ['Thể loại bài viết không tồn tại.'] }
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
    if (status === BLOG_STATUS.PUBLISHED && !existingBlog.publishedAt && !publishedAt) {
      updateData.publishedAt = new Date();
    }
  }

  // Cập nhật bài viết
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

  // Tự động dọn dẹp ảnh bìa cũ trên Supabase Storage nếu bannerUrl bị thay đổi hoặc bị gỡ bỏ
  const oldBannerUrl = existingBlog.bannerUrl;
  const newBannerUrl = blog.bannerUrl;
  if (oldBannerUrl && oldBannerUrl !== newBannerUrl) {
    try {
      const oldStoragePath = extractStoragePath(oldBannerUrl);
      if (oldStoragePath) {
        deleteFromSupabase(oldStoragePath).catch(err => {
          console.error('Lỗi ngầm khi xóa banner cũ trên Supabase:', err);
        });
      }
    } catch (cleanupError) {
      console.error('Lỗi khi chuẩn bị xóa banner cũ:', cleanupError);
    }
  }

  return sendSuccess(res, { blog }, 'Cập nhật bài viết thành công');
});

/**
 * Xóa bài viết (Protected).
 */
export const deleteBlog = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const blogId = parseInt(id as string, 10);

  if (isNaN(blogId)) {
    throw new AppError('Bài viết không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  // Kiểm tra xem bài viết có tồn tại không
  const existingBlog = await prisma.blog.findUnique({
    where: { id: blogId }
  });

  if (!existingBlog) {
    throw new AppError('Bài viết không tồn tại', 404, 'NOT_FOUND');
  }

  // Thực hiện xóa
  await prisma.blog.delete({
    where: { id: blogId }
  });

  // Tự động dọn dẹp ảnh bìa trên Supabase Storage nếu có
  if (existingBlog.bannerUrl) {
    try {
      const storagePath = extractStoragePath(existingBlog.bannerUrl);
      if (storagePath) {
        deleteFromSupabase(storagePath).catch(err => {
          console.error('Lỗi ngầm khi xóa banner của bài viết bị xóa:', err);
        });
      }
    } catch (cleanupError) {
      console.error('Lỗi khi chuẩn bị xóa banner của bài viết bị xóa:', cleanupError);
    }
  }

  return sendSuccess(res, null, 'Bài viết đã được xóa thành công');
});


/**
 * Cập nhật trạng thái (status) của bài viết (Protected).
 */
export const updateBlogStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const blogId = parseInt(id as string, 10);
  const { status } = req.body;

  if (isNaN(blogId)) {
    throw new AppError('Bài viết không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  if (!status || typeof status !== 'string' || !VALID_BLOG_STATUSES.includes(status as BlogStatus)) {
    throw new AppError(
      'Trạng thái bài viết không hợp lệ.',
      400,
      'VALIDATION_ERROR',
      { status: [`Trạng thái bài viết phải là một trong các giá trị: ${VALID_BLOG_STATUSES.join(', ')}.`] }
    );
  }

  // Kiểm tra xem bài viết có tồn tại không
  const existingBlog = await prisma.blog.findUnique({
    where: { id: blogId }
  });

  if (!existingBlog) {
    throw new AppError('Bài viết không tồn tại', 404, 'NOT_FOUND');
  }

  const updateData: any = { status };
  if (status === BLOG_STATUS.PUBLISHED && !existingBlog.publishedAt) {
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

  return sendSuccess(res, { blog }, 'Cập nhật trạng thái bài viết thành công');
});

/**
 * Lấy chi tiết một bài viết theo ID.
 */
export const getBlogById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const blogId = parseInt(id as string, 10);

  if (isNaN(blogId) || blogId <= 0) {
    throw new AppError('ID bài viết không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const blog = await prisma.blog.findUnique({
    where: { id: blogId },
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

  if (!blog) {
    throw new AppError('Bài viết không tồn tại', 404, 'NOT_FOUND');
  }

  return sendSuccess(res, { blog }, 'Lấy chi tiết bài viết theo ID thành công');
});

/**
 * Lấy chi tiết một bài viết theo Slug (Dành cho Client).
 */
export const getBlogBySlug = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;
  const slugStr = slug as string;

  if (!slugStr) {
    throw new AppError('Slug bài viết không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  let blog = await prisma.blog.findUnique({
    where: { slug: slugStr },
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

  if (!blog) {
    throw new AppError('Bài viết không tồn tại', 404, 'NOT_FOUND');
  }

  let hasFullAccess = true;

  // Nếu là bài viết Premium, xác thực token và phân quyền truy cập
  if (blog.isPremium) {
    hasFullAccess = false;
    const authHeader = req.headers.authorization;
    let userId: number | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = verifyAccessToken(token);
        if (decoded && decoded.userId) {
          userId = decoded.userId;
        }
      } catch (e) {
        userId = null;
      }
    }

    if (userId) {
      // 1. Kiểm tra nếu là ADMIN
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });

      if (user?.role === 'admin') {
        hasFullAccess = true;
      } else {
        // 2. Kiểm tra tính năng blog:read_premium trong gói hội viên của người dùng
        const { hasAccess } = await checkUserFeatureAccess(userId, 'blog:read_premium');
        if (hasAccess) {
          hasFullAccess = true;
        }
      }
    }
  }

  // Chuẩn bị dữ liệu bài viết trả về
  let finalContent = blog.content;

  if (!hasFullAccess) {
    // Tạo Teaser Content
    if (blog.content && blog.content.includes('<!--more-->')) {
      finalContent = blog.content.split('<!--more-->')[0];
    } else if (blog.content) {
      const pMatch = blog.content.match(/(<p[\s\S]*?<\/p>[\s\S]*?){1,2}/i);
      if (pMatch && pMatch[0]) {
        finalContent = pMatch[0];
      } else if (blog.content.length > 350) {
        finalContent = blog.content.slice(0, 350) + '...';
      }
    } else if (blog.summary) {
      finalContent = `<p>${blog.summary}</p>`;
    }
  }

  const blogResponse = {
    ...blog,
    content: finalContent,
    hasFullAccess,
    requiredFeatureCode: blog.isPremium ? 'blog:read_premium' : undefined,
  };

  return sendSuccess(res, { blog: blogResponse }, 'Lấy chi tiết bài viết theo Slug thành công');
});


/**
 * Cập nhật quyền truy cập (isPremium) của bài viết (Protected).
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

  // Kiểm tra xem bài viết có tồn tại không
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

