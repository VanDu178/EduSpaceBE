import express from 'express';
import {
  getPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  updatePostStatus
} from '../controllers/postController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = express.Router();

// Route lấy danh sách bài viết (Yêu cầu đăng nhập)
router.get('/', authMiddleware as express.RequestHandler, getPosts as express.RequestHandler);

// Route lấy chi tiết bài viết (Yêu cầu đăng nhập)
router.get('/:id', authMiddleware as express.RequestHandler, getPostById as express.RequestHandler);

// Route tạo bài viết mới (Yêu cầu đăng nhập)
router.post('/', authMiddleware as express.RequestHandler, createPost as express.RequestHandler);

// Route cập nhật bài viết (Yêu cầu đăng nhập)
router.put('/:id', authMiddleware as express.RequestHandler, updatePost as express.RequestHandler);

// Route cập nhật trạng thái bài viết (Yêu cầu đăng nhập)
router.patch('/:id/status', authMiddleware as express.RequestHandler, updatePostStatus as express.RequestHandler);

// Route xóa bài viết (Yêu cầu đăng nhập)
router.delete('/:id', authMiddleware as express.RequestHandler, deletePost as express.RequestHandler);

export default router;
