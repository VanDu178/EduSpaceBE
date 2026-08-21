import express from 'express';
import {
  getBlogs,
  getBlogByIdOrSlug,
  createBlog,
  updateBlog,
  deleteBlog,
  updateBlogStatus
} from '../controllers/blogController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = express.Router();

// Lấy danh sách các bài blog (Public)
router.get('/', getBlogs as express.RequestHandler);

// Lấy chi tiết bài blog theo ID hoặc Slug (Public)
router.get('/:idOrSlug', getBlogByIdOrSlug as express.RequestHandler);

// Tạo mới bài blog (Protected)
router.post('/', authMiddleware as express.RequestHandler, createBlog as express.RequestHandler);

// Cập nhật bài blog (Protected)
router.put('/:id', authMiddleware as express.RequestHandler, updateBlog as express.RequestHandler);

// Cập nhật trạng thái bài blog (Protected)
router.patch('/:id/status', authMiddleware as express.RequestHandler, updateBlogStatus as express.RequestHandler);

// Xóa bài blog (Protected)
router.delete('/:id', authMiddleware as express.RequestHandler, deleteBlog as express.RequestHandler);

export default router;
