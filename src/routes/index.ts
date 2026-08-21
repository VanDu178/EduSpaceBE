import express from 'express';
import authRoutes from './authRoutes';
import blogRoutes from './blogRoutes';
import blogTypeRoutes from './blogTypeRoutes';
import userRoutes from './userRoutes';

const apiRouter = express.Router();

// Đăng ký các route con
apiRouter.use('/auth', authRoutes);
apiRouter.use('/blogs', blogRoutes);
apiRouter.use('/blog-types', blogTypeRoutes);
apiRouter.use('/users', userRoutes);

export default apiRouter;
