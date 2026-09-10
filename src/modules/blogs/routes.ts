import express from 'express';
import {
  getBlogs,
  getAdminBlogs,
  getBlogById,
  getBlogBySlug,
  createBlog,
  updateBlog,
  deleteBlog,
  updateBlogStatus,
  updateBlogAccess
} from './controller';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { adminMiddleware } from '../../middlewares/adminMiddleware';

const router = express.Router();

// Lấy danh sách các bài blog cho Admin (Protected Admin)
router.get('/admin', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, getAdminBlogs as express.RequestHandler);

// Lấy danh sách các bài blog (Public Client)
router.get('/', getBlogs as express.RequestHandler);

// Lấy chi tiết bài blog theo ID
router.get('/id/:id', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, getBlogById as express.RequestHandler);

// Lấy chi tiết bài blog theo Slug (Dành cho Client)
router.get('/slug/:slug', getBlogBySlug as express.RequestHandler);

// Tạo mới bài blog (Protected Admin)
router.post('/', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, createBlog as express.RequestHandler);

// Cập nhật bài blog (Protected Admin)
router.put('/:id', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, updateBlog as express.RequestHandler);

// Cập nhật trạng thái bài blog (Protected Admin)
router.patch('/:id/status', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, updateBlogStatus as express.RequestHandler);

// Cập nhật quyền truy cập bài blog (Protected Admin)
router.patch('/:id/access', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, updateBlogAccess as express.RequestHandler);

// Xóa bài blog (Protected Admin)
router.delete('/:id', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, deleteBlog as express.RequestHandler);


export default router;
