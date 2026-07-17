import express from 'express';
import {
  getPostTypes,
  createPostType,
  updatePostType,
  deletePostType
} from '../controllers/postTypeController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = express.Router();

// Tất cả các route trong phân hệ thể loại bài viết đều yêu cầu đăng nhập
router.use(authMiddleware as express.RequestHandler);

// Route lấy danh sách thể loại
router.get('/', getPostTypes as express.RequestHandler);

// Route tạo mới thể loại
router.post('/', createPostType as express.RequestHandler);

// Route cập nhật thể loại
router.put('/:id', updatePostType as express.RequestHandler);

// Route xóa thể loại
router.delete('/:id', deletePostType as express.RequestHandler);

export default router;
