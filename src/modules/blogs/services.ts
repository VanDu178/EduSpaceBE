import type { Request } from 'express';
import prisma from '../../config/db';
import { AppError } from '../../utils/appError';
import { verifyAccessToken } from '../auth/utils';
import { checkUserFeatureAccess } from '../../services/featureAccessService';
import { generateBlogCode } from './utils';
import { deleteFromSupabase, extractStoragePath } from '../../services/supabaseStorageService';

/**
 * 1. Lấy danh sách bài viết phân trang và lọc theo điều kiện.
 */
export const getBlogsService = async (params: {
  where: any;
  skip: number;
  limit: number;
  page: number;
}) => {
  const { where, skip, limit, page } = params;

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

  return {
    blogs,
    pagination: {
      total,
      page,
      limit,
      totalPages
    }
  };
};

/**
 * 2. Tạo bài viết mới.
 */
export const createBlogService = async (blogData: any) => {
  const blog = await prisma.blog.create({
    data: blogData
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

  return updatedBlog;
};

/**
 * 3. Cập nhật bài viết.
 */
export const updateBlogService = async (params: {
  blogId: number;
  updateData: any;
  oldBannerUrl: string | null;
}) => {
  const { blogId, updateData, oldBannerUrl } = params;

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

  return blog;
};

/**
 * 4. Xóa bài viết.
 */
export const deleteBlogService = async (params: {
  blogId: number;
  bannerUrl: string | null;
}) => {
  const { blogId, bannerUrl } = params;

  await prisma.blog.delete({
    where: { id: blogId }
  });

  // Tự động dọn dẹp ảnh bìa trên Supabase Storage nếu có
  if (bannerUrl) {
    try {
      const storagePath = extractStoragePath(bannerUrl);
      if (storagePath) {
        deleteFromSupabase(storagePath).catch(err => {
          console.error('Lỗi ngầm khi xóa banner của bài viết bị xóa:', err);
        });
      }
    } catch (cleanupError) {
      console.error('Lỗi khi chuẩn bị xóa banner của bài viết bị xóa:', cleanupError);
    }
  }

  return null;
};

/**
 * 5. Cập nhật trạng thái bài viết.
 */
export const updateBlogStatusService = async (params: {
  blogId: number;
  updateData: any;
}) => {
  const { blogId, updateData } = params;

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

  return blog;
};

/**
 * 6. Lấy chi tiết bài viết theo ID.
 */
export const getBlogByIdService = async (blogId: number) => {
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

  return blog;
};

/**
 * 7. Lấy chi tiết bài viết theo Slug (xử lý quyền truy cập Premium).
 */
export const getBlogBySlugService = async (params: {
  slugStr: string;
  req: Request;
}) => {
  const { slugStr, req } = params;

  const blog = await prisma.blog.findUnique({
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

  return {
    ...blog,
    content: finalContent,
    hasFullAccess,
    requiredFeatureCode: blog.isPremium ? 'blog:read_premium' : undefined
  };
};

/**
 * 8. Cập nhật quyền truy cập (isPremium) bài viết.
 */
export const updateBlogAccessService = async (params: {
  blogId: number;
  isPremium: boolean;
}) => {
  const { blogId, isPremium } = params;

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

  return blog;
};
