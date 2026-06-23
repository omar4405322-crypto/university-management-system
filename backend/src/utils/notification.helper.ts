import prisma from './prismaClient';
import { NotificationType } from '@prisma/client';

export const createNotification = async ({
  userId,
  type,
  title,
  message,
  link,
}: {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) => {
  try {
    return await prisma.notification.create({
      data: { userId, type, title, message, link },
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};
