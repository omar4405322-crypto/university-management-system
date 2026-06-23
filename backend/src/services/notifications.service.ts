import prisma from '../utils/prismaClient';
import { NotificationType } from '@prisma/client';

/**
 * Helper to create a notification for a user
 */
export const createNotification = async (
  userId: number,
  title: string,
  message: string,
  type: NotificationType = 'GENERAL',
  link?: string
) => {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        link,
      },
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};
