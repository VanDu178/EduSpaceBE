import type { Request } from 'express';
import prisma from '../../config/db';
import { AppError } from '../../utils/appError';
import { generateSlug } from './utils';
import { BLOG_STATUS, VALID_BLOG_STATUSES, type BlogStatus } from './constants';

/**
 * 1. Validate tham số query cho lấy danh sách bài viết.
 */
export const validateGetBlogs = async (req: Request) => {
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

  if (blogType && blogType !== BLOG_STATUS.ALL) {
    where.blogType = {
      code: blogType
    };
  }

  if (status && status !== BLOG_STATUS.ALL) {
    where.status = status;
  }

  if (isPremium !== undefined && isPremium !== BLOG_STATUS.ALL) {
    where.isPremium = isPremium === 'true';
  }

  const skip = (page - 1) * limit;

  return {
    where,
    skip,
    limit,
    page
  };
};

/**
 * 2. Validate dữ liệu khi tạo bài viết mới.
 */
export const validateCreateBlog = async (req: Request) => {
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

  return {
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
  };
};

/**
 * 3. Validate dữ liệu khi cập nhật bài viết.
 */
export const validateUpdateBlog = async (req: Request) => {
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

  return {
    blogId,
    updateData,
    oldBannerUrl: existingBlog.bannerUrl
  };
};

/**
 * 4. Validate trước khi xóa bài viết.
 */
export const validateDeleteBlog = async (req: Request) => {
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

  return {
    blogId,
    bannerUrl: existingBlog.bannerUrl
  };
};

/**
 * 5. Validate cập nhật trạng thái (status) bài viết.
 */
export const validateUpdateBlogStatus = async (req: Request) => {
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

  return {
    blogId,
    updateData
  };
};

/**
 * 6. Validate lấy chi tiết bài viết theo ID.
 */
export const validateGetBlogById = async (req: Request) => {
  const { id } = req.params;
  const blogId = parseInt(id as string, 10);

  if (isNaN(blogId) || blogId <= 0) {
    throw new AppError('ID bài viết không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  return { blogId };
};

/**
 * 7. Validate lấy chi tiết bài viết theo Slug.
 */
export const validateGetBlogBySlug = async (req: Request) => {
  const { slug } = req.params;
  const slugStr = slug as string;

  if (!slugStr) {
    throw new AppError('Slug bài viết không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  return { slugStr, req };
};

/**
 * 8. Validate cập nhật quyền truy cập (isPremium) bài viết.
 */
export const validateUpdateBlogAccess = async (req: Request) => {
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

  return {
    blogId,
    isPremium
  };
};
