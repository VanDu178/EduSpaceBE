import express from 'express';
import {
  getPosts,
  createPost,
  deletePost
} from '../controllers/postController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = express.Router();

// Route lấy danh sách bài viết (Yêu cầu đăng nhập)
router.get('/', authMiddleware as express.RequestHandler, getPosts as express.RequestHandler);

// Route tạo bài viết mới (Yêu cầu đăng nhập)
router.post('/', authMiddleware as express.RequestHandler, createPost as express.RequestHandler);

// Route xóa bài viết (Yêu cầu đăng nhập)
router.delete('/:id', authMiddleware as express.RequestHandler, deletePost as express.RequestHandler);

export default router;
