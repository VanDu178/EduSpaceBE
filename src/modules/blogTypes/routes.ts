import express from 'express';
import {
  getBlogTypes,
  createBlogType,
  updateBlogType,
  deleteBlogType
} from './controller';
import { authMiddleware } from '../../middlewares/authMiddleware';

const router = express.Router();

// Lấy danh sách thể loại bài blog
router.get('/', getBlogTypes as express.RequestHandler);

// Tạo mới thể loại bài blog (cần đăng nhập)
router.post('/', authMiddleware as express.RequestHandler, createBlogType as express.RequestHandler);

// Cập nhật thể loại bài blog (cần đăng nhập)
router.put('/:id', authMiddleware as express.RequestHandler, updateBlogType as express.RequestHandler);

// Xóa thể loại bài blog (cần đăng nhập)
router.delete('/:id', authMiddleware as express.RequestHandler, deleteBlogType as express.RequestHandler);

export default router;
