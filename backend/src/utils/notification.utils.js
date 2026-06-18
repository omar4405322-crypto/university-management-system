const prisma = require('./prismaClient');

/**
 * Creates a notification for a specific user
 */
const createNotification = async ({ userId, title, message, type = 'info' }) => {
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

const notifyRole = async ({ role, title, message, type = 'info' }) => {
  try {
    const users = await prisma.user.findMany({
      where: { role },
      select: { id: true }
    });

    return await Promise.all(users.map(user => 
      createNotification({ userId: user.id, title, message, type })
    ));
  } catch (error) {
    console.error(`Error notifying role ${role}:`, error);
  }
};

/**
 * Creates notifications for all students enrolled in a specific course
 */
const notifyStudentsInCourse = async({ courseId, title, message, type = 'info' }) => {
try {
const course = await prisma.course.findUnique({
where: { id: parseInt(courseId) },
include: {
enrollments: {
where: { status: 'ENROLLED' },
select: { student: { select: { userId: true } } }

}
}
});

if (!course || !course.enrollments.length) return;

const notifications = course.enrollments.map(({ student }) => ({
userId: student.userId,
title,
message,
type
}));
return await prisma.notification.createMany({
data: notifications
});

} catch (error) {
console.error('Error notifying students in course:', error);

}
};

/**
 * Notifies relevant administrators about a new registration request
 */
const notifyAdminsOfNewRequest = async ({ role, firstName, lastName, departmentId }) => {
  try {
    const department = await prisma.department.findUnique({
      where: { id: parseInt(departmentId) },
      select: { name: true, collegeId: true }
    });

    if (!department) return;

    // Find all potential admins to notify
    const admins = await prisma.user.findMany({
      where: {
        role: { in: ['SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'] },
      },
      select: { id: true, role: true, collegeId: true, departmentId: true }
    });

    const title = 'New Registration Request';
    const message = `New ${role.toLowerCase()} request: ${firstName} ${lastName} for ${department.name}.`;
    const notifications = [];

    admins.forEach(admin => {
      let shouldNotify = false;

      if (admin.role === 'SUPER_ADMIN') {
        shouldNotify = true;
      } else if (admin.role === 'COLLEGE_ADMIN' && admin.collegeId === department.collegeId) {
        shouldNotify = true;
      } else if (admin.role === 'DEPARTMENT_ADMIN' && admin.departmentId === departmentId) {
        shouldNotify = true;
      }

      if (shouldNotify) {
        notifications.push({
          userId: admin.id,
          title,
          message,
          type: 'info'
        });
      }
    });

    if (notifications.length > 0) {
      return await prisma.notification.createMany({
        data: notifications
      });
    }
  } catch (error) {
    console.error('Error notifying admins of new request:', error);
  }
};

module.exports = {
  createNotification,
  notifyRole,
  notifyStudentsInCourse,
  notifyAdminsOfNewRequest
};
