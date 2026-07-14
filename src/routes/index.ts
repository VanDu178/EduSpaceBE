import express from 'express';
import authRoutes from './authRoutes';
import postRoutes from './postRoutes';

const apiRouter = express.Router();

// Đăng ký các phân hệ route con
apiRouter.use('/auth', authRoutes);
apiRouter.use('/posts', postRoutes);

export default apiRouter;
