import express from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
} from '../controllers/notification.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

router.use(protect);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);

router.put('/read-all', markAllAsRead);
router.patch('/read-all', markAllAsRead);

router.put('/:id/read', markAsRead);
router.patch('/:id/read', markAsRead);

router.delete('/all', deleteAllNotifications);
router.delete('/:id', deleteNotification);
router.delete('/', deleteAllNotifications);

export default router;
