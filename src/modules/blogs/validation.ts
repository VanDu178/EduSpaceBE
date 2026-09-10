import type { Request } from 'express';
import prisma from '../../config/db';
import { AppError } from '../../utils/appError';
import { generateSlug } from './utils';
import { BLOG_STATUS, VALID_BLOG_STATUSES, type BlogStatus } from './constants';
import {
  blogIdParamSchema,
  blogSlugParamSchema,
  getBlogsQuerySchema,
  createBlogBodySchema,
  updateBlogBodySchema,
  updateBlogStatusBodySchema,
  updateBlogAccessBodySchema
} from './zodSchemas';

/**
 * Helper định dạng lỗi Zod thành object lỗi chi tiết
 */
const formatZodErrors = (error: any): Record<string, string[]> => {
  const formattedErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] ? String(issue.path[0]) : 'general';
    if (!formattedErrors[field]) {
      formattedErrors[field] = [];
    }
    formattedErrors[field].push(issue.message);
  }
  return formattedErrors;
};

/**
 * 1. Validate tham số query cho lấy danh sách bài viết.
 */
export const validateGetBlogs = async (req: Request, isClient: boolean = false) => {
  const parsedQuery = getBlogsQuerySchema.safeParse(req.query);
  
  if (!parsedQuery.success) {
    throw new AppError(
      'Tham số truy vấn danh sách bài viết không hợp lệ.',
      400,
      'VALIDATION_ERROR',
      formatZodErrors(parsedQuery.error)
    );
  }

  const { page, limit, keyword, blogType, status, isPremium } = parsedQuery.data;

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

  if (isClient) {
    where.status = BLOG_STATUS.PUBLISHED;
  } else if (status && status !== BLOG_STATUS.ALL) {
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
  // Tầng 1: Validate bằng Zod Schema
  const parsed = createBlogBodySchema.safeParse(req.body);

  if (!parsed.success) {
    throw new AppError(
      'Dữ liệu tạo bài viết không hợp lệ.',
      400,
      'VALIDATION_ERROR',
      formatZodErrors(parsed.error)
    );
  }

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
  } = parsed.data;

  // Tạo slug từ customSlug hoặc tự sinh từ title
  let slug = customSlug ? generateSlug(customSlug) : generateSlug(title);
  if (!slug) {
    slug = `blog-${Date.now()}`;
  }

  // Tầng 2: Kiểm tra trùng lặp slug trong DB
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
    where: { id: blogTypeId }
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
  // Tầng 1: Validate Param ID và Body bằng Zod Schemas
  const paramParsed = blogIdParamSchema.safeParse(req.params);
  if (!paramParsed.success) {
    throw new AppError('Bài viết không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const bodyParsed = updateBlogBodySchema.safeParse(req.body);
  if (!bodyParsed.success) {
    throw new AppError(
      'Dữ liệu cập nhật bài viết không hợp lệ.',
      400,
      'VALIDATION_ERROR',
      formatZodErrors(bodyParsed.error)
    );
  }

  const blogId = paramParsed.data.id;
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
  } = bodyParsed.data;

  // Tầng 2: Kiểm tra xem bài viết có tồn tại không
  const existingBlog = await prisma.blog.findUnique({
    where: { id: blogId }
  });

  if (!existingBlog) {
    throw new AppError('Bài viết không tồn tại', 404, 'NOT_FOUND');
  }

  const updateData: any = {};

  if (title !== undefined) {
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
    const blogType = await prisma.blogType.findUnique({
      where: { id: blogTypeId }
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
  const paramParsed = blogIdParamSchema.safeParse(req.params);
  if (!paramParsed.success) {
    throw new AppError('Bài viết không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const blogId = paramParsed.data.id;

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
  const paramParsed = blogIdParamSchema.safeParse(req.params);
  if (!paramParsed.success) {
    throw new AppError('Bài viết không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const bodyParsed = updateBlogStatusBodySchema.safeParse(req.body);
  if (!bodyParsed.success) {
    throw new AppError(
      'Trạng thái bài viết không hợp lệ.',
      400,
      'VALIDATION_ERROR',
      formatZodErrors(bodyParsed.error)
    );
  }

  const blogId = paramParsed.data.id;
  const { status } = bodyParsed.data;

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
  const paramParsed = blogIdParamSchema.safeParse(req.params);
  if (!paramParsed.success) {
    throw new AppError('ID bài viết không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  return { blogId: paramParsed.data.id };
};

/**
 * 7. Validate lấy chi tiết bài viết theo Slug.
 */
export const validateGetBlogBySlug = async (req: Request) => {
  const paramParsed = blogSlugParamSchema.safeParse(req.params);
  if (!paramParsed.success) {
    throw new AppError('Slug bài viết không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  return { slugStr: paramParsed.data.slug, req };
};

/**
 * 8. Validate cập nhật quyền truy cập (isPremium) bài viết.
 */
export const validateUpdateBlogAccess = async (req: Request) => {
  const paramParsed = blogIdParamSchema.safeParse(req.params);
  if (!paramParsed.success) {
    throw new AppError('Bài viết không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const bodyParsed = updateBlogAccessBodySchema.safeParse(req.body);
  if (!bodyParsed.success) {
    throw new AppError(
      'Quyền truy cập không hợp lệ.',
      400,
      'VALIDATION_ERROR',
      formatZodErrors(bodyParsed.error)
    );
  }

  const blogId = paramParsed.data.id;
  const { isPremium } = bodyParsed.data;

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
