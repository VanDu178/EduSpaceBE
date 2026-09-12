import express from 'express';
import {
  getVideosList,
  getAdminVideosList,
  getVideoByIdAdmin,
  getVideoByClient,
  getVideoBySlug,
  createVideo,
  updateVideo,
  updateVideoStatus,
  updateVideoAccess,
  deleteVideo,
  getVideoTypes,
  getDynamicHlsPlaylist,
  getDynamicHlsPlaylistBySlug,
  syncVideoProcessStatus,
} from './controller';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { optionalAuthMiddleware } from '../../middlewares/optionalAuthMiddleware';
import { adminMiddleware } from '../../middlewares/adminMiddleware';

const router = express.Router();

/* ============================================================================
 * 1. SHARED SYSTEM & CLIENT PUBLIC ENDPOINTS (Dành cho Người dùng / Học viên)
 * ============================================================================ */

// 1.1 Lấy danh sách 2 Loại Video cố định hệ thống (Public)
router.get('/types', getVideoTypes as express.RequestHandler);

// 1.2 Lấy danh sách Video xuất bản cho Client (Public / Phân trang & Lọc)
router.get('/', getVideosList as express.RequestHandler);

// 1.3 Lấy chi tiết Video cho Client theo Slug (Thân thiện SEO)
router.get('/slug/:slug', optionalAuthMiddleware as express.RequestHandler, getVideoBySlug as express.RequestHandler);

// 1.4 Lấy chi tiết Video cho Client theo ID (Đang được EduSpaceFEClient sử dụng)
router.get('/client/:id', optionalAuthMiddleware as express.RequestHandler, getVideoByClient as express.RequestHandler);


/* ============================================================================
 * 2. ADMIN MANAGEMENT ENDPOINTS (Bắt buộc xác thực Token & Quyền Admin)
 * ============================================================================ */

// 2.1 Lấy danh sách tất cả Video cho Admin (Đầy đủ thông tin quản trị)
router.get('/admin', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, getAdminVideosList as express.RequestHandler);

// 2.2 Lấy chi tiết 1 Video cho Admin theo ID (Bắt buộc quyền Admin)
router.get('/id/:id', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, getVideoByIdAdmin as express.RequestHandler);

// 2.3 Tạo mới Video
router.post('/', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, createVideo as express.RequestHandler);

// 2.4 Cập nhật toàn bộ thông tin Video
router.put('/:id', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, updateVideo as express.RequestHandler);

// 2.5 Cập nhật nhanh trạng thái Video (draft / published / archived)
router.patch('/:id/status', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, updateVideoStatus as express.RequestHandler);

// 2.6 Cập nhật nhanh quyền truy cập Premium (isPremium & teaserDuration)
router.patch('/:id/access', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, updateVideoAccess as express.RequestHandler);

// 2.7 Đồng bộ thủ công trạng thái mã hóa HLS với Bunny Stream
router.post('/:id/sync-status', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, syncVideoProcessStatus as express.RequestHandler);

// 2.8 Xóa Video theo ID
router.delete('/:id', authMiddleware as express.RequestHandler, adminMiddleware as express.RequestHandler, deleteVideo as express.RequestHandler);


/* ============================================================================
 * 3. DYNAMIC HLS STREAMING ENDPOINTS (.m3u8 Master & Variant Playlists)
 * ============================================================================ */

// 3.1 Dynamic HLS Playlist theo Slug (Public + Optional Auth)
router.get('/slug/:slug/playlist.m3u8', optionalAuthMiddleware as express.RequestHandler, getDynamicHlsPlaylistBySlug as express.RequestHandler);
router.get('/slug/:slug/:variant.m3u8', optionalAuthMiddleware as express.RequestHandler, getDynamicHlsPlaylistBySlug as express.RequestHandler);

// 3.2 Dynamic HLS Playlist theo ID (Tường minh /id/:id)
router.get('/id/:id/playlist.m3u8', optionalAuthMiddleware as express.RequestHandler, getDynamicHlsPlaylist as express.RequestHandler);
router.get('/id/:id/:variant.m3u8', optionalAuthMiddleware as express.RequestHandler, getDynamicHlsPlaylist as express.RequestHandler);


/* ============================================================================
 * 4. CATCH-ALL & LEGACY ALIAS FALLBACK ENDPOINTS (Đặt ở cuối cùng để tránh đè route)
 * ============================================================================ */

// 4.1 Dynamic HLS Playlist theo ID (Cú pháp rút gọn /:id/playlist.m3u8)
router.get('/:id/playlist.m3u8', optionalAuthMiddleware as express.RequestHandler, getDynamicHlsPlaylist as express.RequestHandler);
router.get('/:id/:variant.m3u8', optionalAuthMiddleware as express.RequestHandler, getDynamicHlsPlaylist as express.RequestHandler);

// 4.2 Lấy chi tiết Video cho Client theo ID (Cú pháp rút gọn /:id)
router.get('/:id', optionalAuthMiddleware as express.RequestHandler, getVideoByClient as express.RequestHandler);

export default router;

