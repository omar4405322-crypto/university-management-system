import prisma from '../utils/prismaClient';
import {
  AppError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  ValidationError,
} from '../utils/appError';
import { getScopeWhere } from '../utils/scope.utils';
import { notifyStudentsInCourse } from '../utils/notification.utils';
import { auditLog } from '../utils/audit.utils';

class TaskService {
  private static async getDoctorOrThrow(userId: number) {
    const doctor = await prisma.doctor.findUnique({ where: { userId } });
    if (!doctor) {
      throw new AuthorizationError('Only doctors can perform this action');
    }
    return doctor;
  }

  private static async getStudentOrThrow(userId: number) {
    const student = await prisma.student.findUnique({ where: { userId } });
    if (!student) {
      throw new AuthorizationError('Only students can perform this action');
    }
    return student;
  }

  private static async validateCourseScope(
    user: any,
    course: { departmentId?: number | null; department?: { collegeId?: number | null } | null }
  ) {
    const courseScope: any = getScopeWhere(user, 'course');
    if (courseScope && Object.keys(courseScope).length) {
      if (
        courseScope.department &&
        course.department?.collegeId !== courseScope.department.collegeId
      ) {
        throw new AuthorizationError('Access denied');
      }
      if (courseScope.departmentId && course.departmentId !== courseScope.departmentId) {
        throw new AuthorizationError('Access denied');
      }
    }
  }

  private static async ensureDoctorAssignedToCourse(
    doctorId: number,
    courseId: number
  ): Promise<void> {
    const isAssigned = await prisma.scheduleSlot.findFirst({
      where: { courseId, doctorId },
    });
    if (!isAssigned) {
      throw new AuthorizationError(
        'Access denied: You are not assigned to teach this course'
      );
    }
  }

  private static async ensureCourseOwnershipOrScope(
    user: any,
    task: {
      doctorId: number;
      courseId: number;
      course?: { departmentId?: number | null; department?: { collegeId?: number | null } | null } | null;
    }
  ) {
    if (user.role === 'DOCTOR') {
      const doctor = await TaskService.getDoctorOrThrow(user.id);
      if (task.doctorId !== doctor.id) {
        throw new AuthorizationError(
          'Access denied: You did not create this task'
        );
      }
    }
    if (task.course) {
      await TaskService.validateCourseScope(user, task.course);
    }
  }

  static async createTask(
    user: any,
    data: {
      title: string;
      description: string;
      courseId: number;
      dueDate: Date;
      maxScore: number;
    }
  ) {
    const doctor = await TaskService.getDoctorOrThrow(user.id);

    const course = await prisma.course.findUnique({
      where: { id: data.courseId },
      include: { department: true },
    });
    if (!course) {
      throw new NotFoundError('Course not found');
    }

    if (user.role === 'DOCTOR') {
      await TaskService.ensureDoctorAssignedToCourse(doctor.id, course.id);
    }

    await TaskService.validateCourseScope(user, course);

    const task = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        courseId: data.courseId,
        doctorId: doctor.id,
        dueDate: data.dueDate,
        maxScore: data.maxScore,
      },
      include: {
        course: { select: { name: true } },
      },
    });

    await notifyStudentsInCourse({
      courseId: task.courseId,
      title: 'New Assignment Posted',
      message: `A new assignment "${task.title}" has been posted for course ${task.course.name}.`,
      type: 'info',
    });

    return task;
  }

  static async getTasks(user: any, courseId?: number) {
    const where: any = { NOT: { isDeleted: true } };

    if (courseId) {
      where.courseId = courseId;
    }

    if (user.role === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });
      if (doctor) {
        where.doctorId = doctor.id;
      }
    } else if (user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({ where: { userId: user.id } });
      if (student) {
        where.course = {
          enrollments: { some: { studentId: student.id, status: 'ENROLLED' } },
        };
      }
    }

    const courseScope: any = getScopeWhere(user, 'course');
    if (courseScope && Object.keys(courseScope).length) {
      if (courseScope.department) {
        where.course = courseScope.department;
      } else if (courseScope.departmentId) {
        where.course = { departmentId: courseScope.departmentId };
      }
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        course: { select: { name: true, courseCode: true } },
        doctor: { select: { firstName: true, lastName: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tasks;
  }

  static async updateTask(
    user: any,
    taskId: number,
    data: {
      title?: string;
      description?: string;
      dueDate?: Date;
      maxScore?: number;
    }
  ) {
    const existing = await prisma.task.findUnique({
      where: { id: taskId, NOT: { isDeleted: true } },
      include: { course: { include: { department: true } } },
    });

    if (!existing) {
      throw new NotFoundError('Task not found');
    }

    await TaskService.ensureCourseOwnershipOrScope(user, existing);

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);
    if (data.maxScore !== undefined) updateData.maxScore = data.maxScore;

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        course: { select: { name: true, courseCode: true } },
        doctor: { select: { firstName: true, lastName: true } },
        _count: { select: { submissions: true } },
      },
    });

    return updated;
  }

  static async deleteTask(
    user: any,
    taskId: number,
    force: boolean = false
  ) {
    const existing = await prisma.task.findUnique({
      where: { id: taskId, NOT: { isDeleted: true } },
      include: {
        course: { include: { department: true } },
        _count: { select: { submissions: true } },
      },
    });

    if (!existing) {
      throw new NotFoundError('Task not found');
    }

    await TaskService.ensureCourseOwnershipOrScope(user, existing);

    if (force) {
      if (existing._count.submissions > 0) {
        throw new ConflictError(
          `Cannot permanently delete task: has ${existing._count.submissions} existing submission(s). Use soft-delete instead.`
        );
      }
      await prisma.task.delete({
        where: { id: taskId },
      });
      return {
        success: true,
        hardDeleted: true,
        message: 'Task permanently deleted.',
      };
    }

    await prisma.task.update({
      where: { id: taskId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return {
      success: true,
      hardDeleted: false,
      message: 'Task soft-deleted.',
    };
  }

  static async submitTask(
    user: any,
    taskId: number,
    data: { notes?: string; fileUrl?: string }
  ) {
    const student = await TaskService.getStudentOrThrow(user.id);

    const taskObj = await prisma.task.findUnique({
      where: { id: taskId, NOT: { isDeleted: true } },
      include: { course: { include: { department: true } } },
    });
    if (!taskObj) {
      throw new NotFoundError('Task not found');
    }

    if (user.role === 'STUDENT') {
      const enrollment = await prisma.enrollment.findFirst({
        where: { courseId: taskObj.courseId, studentId: student.id, status: 'ENROLLED' },
      });
      if (!enrollment) {
        throw new AuthorizationError(
          'Access denied: You are not enrolled in this course'
        );
      }
    }

    await TaskService.validateCourseScope(user, taskObj.course);

    const existingSubmission = await prisma.taskSubmission.findUnique({
      where: { taskId_studentId: { taskId, studentId: student.id } },
    });
    if (existingSubmission) {
      throw new ConflictError(
        'You have already submitted this task. Only one submission per task is allowed.'
      );
    }

    const submission = await prisma.taskSubmission.create({
      data: {
        taskId,
        studentId: student.id,
        notes: data.notes,
        fileUrl: data.fileUrl,
      },
    });

    return submission;
  }

  static async gradeSubmission(
    user: any,
    submissionId: number,
    score: number,
    feedback?: string,
    reqSource?: any
  ) {
    const existingSubmission = await prisma.taskSubmission.findUnique({
      where: { id: submissionId },
      include: { task: { include: { course: { include: { department: true } } } } },
    });
    if (!existingSubmission) {
      throw new NotFoundError('Submission not found');
    }

    if (existingSubmission.task.isDeleted) {
      throw new NotFoundError('Task not found');
    }

    if (user.role === 'DOCTOR') {
      const doctor = await TaskService.getDoctorOrThrow(user.id);
      if (existingSubmission.task.doctorId !== doctor.id) {
        throw new AuthorizationError(
          'Access denied: You did not create this task'
        );
      }
    }

    await TaskService.validateCourseScope(user, existingSubmission.task.course);

    const numericScore = parseFloat(String(score));
    if (isNaN(numericScore)) {
      throw new ValidationError('Invalid score value');
    }
    if (numericScore < 0) {
      throw new ValidationError('Score cannot be negative');
    }
    if (numericScore > existingSubmission.task.maxScore) {
      throw new ValidationError(
        `Score ${numericScore} exceeds maximum allowed score ${existingSubmission.task.maxScore}`
      );
    }

    const submission = await prisma.taskSubmission.update({
      where: { id: submissionId },
      data: {
        score: numericScore,
        feedback: feedback != null ? String(feedback) : undefined,
      },
    });

    if (reqSource) {
      auditLog('UPDATE_GRADE', 'TaskSubmission', String(submissionId), reqSource);
    }

    return submission;
  }

  static async getTaskSubmissions(user: any, taskId: number) {
    const taskObj = await prisma.task.findUnique({
      where: { id: taskId, NOT: { isDeleted: true } },
      include: { course: { include: { department: true } } },
    });
    if (!taskObj) {
      throw new NotFoundError('Task not found');
    }

    if (user.role === 'DOCTOR') {
      const doctor = await TaskService.getDoctorOrThrow(user.id);
      if (taskObj.doctorId !== doctor.id) {
        throw new AuthorizationError(
          'Access denied: You did not create this task'
        );
      }
    }

    await TaskService.validateCourseScope(user, taskObj.course);

    const submissions = await prisma.taskSubmission.findMany({
      where: { taskId },
      include: { student: true },
    });

    return submissions;
  }

  static async getMySubmission(user: any, taskId: number) {
    const student = await TaskService.getStudentOrThrow(user.id);

    const taskObj = await prisma.task.findUnique({
      where: { id: taskId, NOT: { isDeleted: true } },
      include: { course: true },
    });
    if (!taskObj) {
      throw new NotFoundError('Task not found');
    }

    const enrollment = await prisma.enrollment.findFirst({
      where: { courseId: taskObj.courseId, studentId: student.id, status: 'ENROLLED' },
    });
    if (!enrollment) {
      throw new AuthorizationError(
        'Access denied: You are not enrolled in this course'
      );
    }

    const submission = await prisma.taskSubmission.findUnique({
      where: { taskId_studentId: { taskId, studentId: student.id } },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            dueDate: true,
            maxScore: true,
          },
        },
      },
    });

    if (!submission) {
      return null;
    }

    return submission;
  }
}

export { TaskService };
export default TaskService;
