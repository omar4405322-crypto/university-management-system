// @ts-nocheck
import prisma from './prismaClient';
import { Role } from '@prisma/client';

export interface BaseNotificationParams {
  title: string;
  message: string;
  type?: string;
}

export interface CreateNotificationParams extends BaseNotificationParams {
  userId: number;
}

/**
 * Creates a notification for a specific user
 */
export const createNotification = async ({
  userId,
  title,
  message,
  type = 'info',
}: CreateNotificationParams) => {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
      },
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

export interface NotifyRoleParams extends BaseNotificationParams {
  role: Role | any;
}

export const notifyRole = async ({ role, title, message, type = 'info' }: NotifyRoleParams) => {
  try {
    const users = await prisma.user.findMany({
      where: { role },
      select: { id: true },
    });

    return await Promise.all(
      users.map((user: { id: number }) =>
        createNotification({ userId: user.id, title, message, type })
      )
    );
  } catch (error) {
    console.error(`Error notifying role ${role}:`, error);
  }
};

export interface NotifyStudentsParams extends BaseNotificationParams {
  courseId: string | number;
}

/**
 * Creates notifications for all students enrolled in a specific course
 */
export const notifyStudentsInCourse = async ({
  courseId,
  title,
  message,
  type = 'info',
}: NotifyStudentsParams) => {
  try {
    const parsedCourseId = typeof courseId === 'string' ? parseInt(courseId, 10) : courseId;
    const course = await prisma.course.findUnique({
      where: { id: parsedCourseId },
      include: {
        enrollments: {
          where: { status: 'ENROLLED' },
          select: { student: { select: { userId: true } } },
        },
      },
    });

    if (!course || !course.enrollments.length) return;

    const notifications = course.enrollments.map(
      ({ student }: { student: { userId: number } }) => ({
        userId: student.userId,
        title,
        message,
        type,
      })
    );

    return await prisma.notification.createMany({
      data: notifications,
    });
  } catch (error) {
    console.error('Error notifying students in course:', error);
  }
};

export interface NotifyAdminsParams {
  role: string;
  firstName: string;
  lastName: string;
  departmentId: string | number;
}

/**
 * Notifies relevant administrators about a new registration request
 */
export const notifyAdminsOfNewRequest = async ({
  role,
  firstName,
  lastName,
  departmentId,
}: NotifyAdminsParams) => {
  try {
    const parsedDeptId =
      typeof departmentId === 'string' ? parseInt(departmentId, 10) : departmentId;
    const department = await prisma.department.findUnique({
      where: { id: parsedDeptId },
      select: { name: true, collegeId: true },
    });

    if (!department) return;

    // Find all potential admins to notify
    const admins = await prisma.user.findMany({
      where: {
        role: { in: ['SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'] },
      },
      select: { id: true, role: true, collegeId: true, departmentId: true },
    });

    const title = 'New Registration Request';
    const message = `New ${role.toLowerCase()} request: ${firstName} ${lastName} for ${department.name}.`;
    const notifications: { userId: number; title: string; message: string; type: string }[] = [];

    admins.forEach(
      (admin: {
        id: number;
        role: string;
        collegeId: number | null;
        departmentId: number | null;
      }) => {
        let shouldNotify = false;

        if (admin.role === 'SUPER_ADMIN') {
          shouldNotify = true;
        } else if (admin.role === 'COLLEGE_ADMIN' && admin.collegeId === department.collegeId) {
          shouldNotify = true;
        } else if (admin.role === 'DEPARTMENT_ADMIN' && admin.departmentId === parsedDeptId) {
          shouldNotify = true;
        }

        if (shouldNotify) {
          notifications.push({
            userId: admin.id,
            title,
            message,
            type: 'info',
          });
        }
      }
    );

    if (notifications.length > 0) {
      return await prisma.notification.createMany({
        data: notifications,
      });
    }
  } catch (error) {
    console.error('Error notifying admins of new request:', error);
  }
};
