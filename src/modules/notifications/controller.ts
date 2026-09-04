import { Request, Response } from 'express';
import * as notificationService from './services';

export async function getNotificationsHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
    const page = parseInt((req.query.page as string) || '1');
    const limit = parseInt((req.query.limit as string) || '20');

    const data = await notificationService.getUserNotifications(userId, page, limit);
    return res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Lỗi lấy danh sách thông báo',
    });
  }
}

export async function markAsReadHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
    const rawId = req.params.id;
    const notificationId = rawId ? parseInt(Array.isArray(rawId) ? rawId[0] : rawId) : undefined;

    const data = await notificationService.markNotificationAsRead(userId, notificationId);
    return res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Lỗi cập nhật trạng thái thông báo',
    });
  }
}
