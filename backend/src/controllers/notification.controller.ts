import { Request, Response } from 'express';
import prisma from '../utils/prismaClient';
import { auditLog } from '../utils/audit.utils';
import catchAsync from '../utils/catchAsync';
import { NotFoundError } from '../utils/appError';

// @desc    Get all notifications for current user
// @route   GET /api/notifications
// @access  Private
export const getNotifications = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    success: true,
    data: notifications,
  });
});

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const notificationId = parseInt(req.params.id as string);

  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  const updatedNotification = await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  res.json({
    success: true,
    data: updatedNotification,
  });
});

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllAsRead = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: { isRead: true },
  });

  res.json({
    success: true,
    message: 'All notifications marked as read',
  });
});

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const notificationId = parseInt(req.params.id as string);

  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  await prisma.notification.delete({
    where: { id: notificationId },
  });

  auditLog('DELETE_NOTIFICATION', 'Notification', req.params.id as string, req);
  res.json({
    success: true,
    message: 'Notification deleted',
  });
});
