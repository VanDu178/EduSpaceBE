import express from 'express';
import authRoutes from './authRoutes';
import postRoutes from './postRoutes';
import postTypeRoutes from './postTypeRoutes';
import userRoutes from './userRoutes';

const apiRouter = express.Router();

// Đăng ký các phân hệ route con
apiRouter.use('/auth', authRoutes);
apiRouter.use('/posts', postRoutes);
apiRouter.use('/post-types', postTypeRoutes);
apiRouter.use('/users', userRoutes);

export default apiRouter;
