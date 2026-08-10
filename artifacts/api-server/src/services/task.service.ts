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

  static async getTasks(
    user: any,
    courseId?: number,
    opts?: {
      status?: 'ACTIVE' | 'OVERDUE';
      dueFrom?: Date;
      dueTo?: Date;
      sortBy?:
        | 'DUE_DATE_ASC'
        | 'DUE_DATE_DESC'
        | 'CREATED_AT_ASC'
        | 'CREATED_AT_DESC'
        | 'SUBMISSIONS_COUNT_ASC'
        | 'SUBMISSIONS_COUNT_DESC';
      search?: string;
    }
  ) {
    const now = new Date();
    const where: any = { NOT: { isDeleted: true } };

    if (courseId) {
      where.courseId = courseId;
    }

    if (opts?.status === 'ACTIVE') {
      where.dueDate = { gte: now };
    } else if (opts?.status === 'OVERDUE') {
      where.dueDate = { lt: now };
    }

    if (opts?.dueFrom || opts?.dueTo) {
      where.dueDate = where.dueDate || {};
      if (opts.dueFrom) where.dueDate.gte = new Date(opts.dueFrom);
      if (opts.dueTo) where.dueDate.lte = new Date(opts.dueTo);
    }

    if (opts?.search?.trim()) {
      const q = opts.search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
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

    let orderBy: any = { createdAt: 'desc' };
    switch (opts?.sortBy) {
      case 'DUE_DATE_ASC':
        orderBy = { dueDate: 'asc' };
        break;
      case 'DUE_DATE_DESC':
        orderBy = { dueDate: 'desc' };
        break;
      case 'CREATED_AT_ASC':
        orderBy = { createdAt: 'asc' };
        break;
      case 'CREATED_AT_DESC':
        orderBy = { createdAt: 'desc' };
        break;
      case 'SUBMISSIONS_COUNT_ASC':
        orderBy = { submissions: { _count: 'asc' as const } };
        break;
      case 'SUBMISSIONS_COUNT_DESC':
        orderBy = { submissions: { _count: 'desc' as const } };
        break;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        course: { select: { name: true, courseCode: true, year: true } },
        doctor: { select: { firstName: true, lastName: true, userId: true } },
        _count: { select: { submissions: true } },
      },
      orderBy,
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
        course: { select: { name: true, courseCode: true, year: true } },
        doctor: { select: { firstName: true, lastName: true, userId: true } },
        _count: { select: { submissions: true } },
      },
    });

    if (
      data.dueDate !== undefined &&
      existing.dueDate.getTime() !== new Date(data.dueDate).getTime()
    ) {
      const newDueDate = new Date(data.dueDate);
      if (newDueDate.getTime() > existing.dueDate.getTime()) {
        const formattedNewDate = newDueDate.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        await notifyStudentsInCourse({
          courseId: updated.courseId,
          title: 'Assignment Deadline Extended',
          message: `The deadline for "${updated.title}" has been extended to ${formattedNewDate}. You now have additional time to submit.`,
          type: 'info',
        });
      }
    }

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

  static async getTaskSubmissions(
    user: any,
    taskId: number,
    opts?: {
      page?: number;
      limit?: number;
      search?: string;
      status?: 'ALL' | 'SUBMITTED' | 'GRADED' | 'UNGRADED' | 'LATE' | 'NOT_SUBMITTED';
      studentYear?: number;
    }
  ) {
    const taskObj = await prisma.task.findUnique({
      where: { id: taskId, NOT: { isDeleted: true } },
      include: {
        course: { include: { department: true }, select: { id: true, name: true, year: true, department: true, departmentId: true } },
      },
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

    // Ensure course object is preserved for scope validation
    const courseForScope = {
      departmentId: taskObj.course.departmentId,
      department: taskObj.course.department,
    };
    await TaskService.validateCourseScope(user, courseForScope);

    const page = Math.max(1, opts?.page ?? 1);
    const limitRaw = opts?.limit ?? 25;
    const limit = Math.min(Math.max(1, limitRaw), 100);
    const skip = (page - 1) * limit;
    const taskDueDate = taskObj.dueDate;
    const courseId = taskObj.course.id;
    const status: NonNullable<typeof opts>['status'] = opts?.status ?? 'ALL';
    const search = opts?.search?.trim();
    const studentYear = opts?.studentYear;

    // ---------- Student filter (search + year) applied to both branches ----------
    const studentWhere: any = {};
    if (search) {
      studentWhere.OR = [
        { firstName: { contains: search, mode: 'insensitive' as const } },
        { lastName: { contains: search, mode: 'insensitive' as const } },
        { studentId: { contains: search, mode: 'insensitive' as const } },
      ];
    }
    if (studentYear != null && !Number.isNaN(studentYear)) {
      studentWhere.year = Number(studentYear);
    }

    // ---------- Shared helper: compute summary counts (always computed regardless of path) ----------
    const totalEnrolledPromise = prisma.enrollment.count({
      where: { courseId, status: 'ENROLLED' },
    });
    const submittedPromise = prisma.taskSubmission.count({ where: { taskId } });
    const gradedPromise = prisma.taskSubmission.count({ where: { taskId, score: { not: null } } });
    const lateRawPromise = prisma.taskSubmission.findMany({
      where: { taskId },
      select: { submittedAt: true },
    });

    // ---------- Two paths: with "NOT_SUBMITTED" we need enrollment LEFT JOIN; else submission-only query ----------
    const includeNotSubmitted = status === 'NOT_SUBMITTED' || status === 'ALL';

    if (includeNotSubmitted) {
      // ---------- DB-PAGINATED LEFT JOIN: Enrollments first (skip/take at DB level), then submissions for THIS PAGE's students only ----------
      const enrollmentWhere: any = {
        courseId,
        status: 'ENROLLED',
      };
      if (Object.keys(studentWhere).length) {
        enrollmentWhere.student = studentWhere;
      }

      // Total count (needed for pagination) computed via separate COUNT query
      const enrollmentTotalCountPromise = prisma.enrollment.count({ where: enrollmentWhere });

      // Page of enrollments — bounded at DB level by skip/take (limit) regardless of total enrollment size
      const enrollmentPagePromise = prisma.enrollment.findMany({
        where: enrollmentWhere,
        include: { student: true },
        orderBy: [{ student: { lastName: 'asc' as const } }, { student: { firstName: 'asc' as const } }],
        skip,
        take: limit,
      });

      const [enrollmentPage, enrollmentTotalCount] = await Promise.all([
        enrollmentPagePromise,
        enrollmentTotalCountPromise,
      ]);

      // Only fetch submissions for THIS PAGE's enrolled students — bounded by limit (not total enrollments)
      const pageStudentIds = enrollmentPage.map((e) => e.studentId);
      const pageSubmissions = pageStudentIds.length
        ? await prisma.taskSubmission.findMany({
            where: { taskId, studentId: { in: pageStudentIds } },
            include: { student: true },
          })
        : [];
      const subByStudentId = new Map<number, typeof pageSubmissions[number]>();
      for (const s of pageSubmissions) subByStudentId.set(s.studentId, s);

      interface UnifiedRow {
        key: string;
        student: any;
        submission: any | null;
        isSubmitted: boolean;
        isGraded: boolean;
        isLate: boolean;
        notSubmitted: boolean;
      }
      const pageRows: UnifiedRow[] = [];
      const statusAny = status as string;

      // Build rows only for the current page's enrollments (size <= limit, always bounded)
      for (const enrollment of enrollmentPage) {
        const stu = enrollment.student;
        const sub = subByStudentId.get(stu.id) ?? null;
        const isSubmitted = !!sub;
        const isGraded = !!(sub && sub.score != null);
        const isLate = !!(sub && new Date(sub.submittedAt) > taskDueDate);
        const notSubmitted = !isSubmitted;

        if (statusAny === 'SUBMITTED' && !isSubmitted) continue;
        if (statusAny === 'GRADED' && !isGraded) continue;
        if (statusAny === 'UNGRADED' && (!isSubmitted || isGraded)) continue;
        if (statusAny === 'LATE' && !isLate) continue;
        if (statusAny === 'NOT_SUBMITTED' && !notSubmitted) continue;

        pageRows.push({
          key: `enrollment-${enrollment.id}`,
          student: stu,
          submission: sub,
          isSubmitted,
          isGraded,
          isLate,
          notSubmitted,
        });
      }

      // Orphans (submissions from students not in enrollments): small edge-case data-integrity rows.
      // Only surfaced in ALL/SUBMITTED/GRADED/UNGRADED/LATE views.
      let orphanRows: UnifiedRow[] = [];
      let orphanTotalCount = 0;
      if (statusAny !== 'NOT_SUBMITTED') {
        const allCourseEnrollmentIds = await prisma.enrollment.findMany({
          where: { courseId, status: 'ENROLLED' },
          select: { studentId: true },
        });
        const enrolledStudentIdsSet = new Set(allCourseEnrollmentIds.map((e) => e.studentId));
        const orphanBaseWhere: any = {
          taskId,
          studentId: { notIn: Array.from(enrolledStudentIdsSet) },
        };
        if (Object.keys(studentWhere).length) {
          orphanBaseWhere.student = studentWhere;
        }
        if (statusAny === 'GRADED') orphanBaseWhere.score = { not: null };
        else if (statusAny === 'UNGRADED') orphanBaseWhere.score = null;
        else if (statusAny === 'LATE') orphanBaseWhere.submittedAt = { gt: taskDueDate };

        orphanTotalCount = await prisma.taskSubmission.count({ where: orphanBaseWhere });
        const orphanSkip = Math.max(0, skip - enrollmentTotalCount);
        const orphanTake = Math.max(0, limit - pageRows.length);
        if (orphanSkip >= 0 && orphanTake > 0 && orphanTotalCount > 0) {
          const orphanPage = await prisma.taskSubmission.findMany({
            where: orphanBaseWhere,
            include: { student: true },
            orderBy: { submittedAt: 'asc' as const },
            skip: orphanSkip,
            take: orphanTake,
          });
          for (const sub of orphanPage) {
            const stu = sub.student;
            if (search) {
              const hay = `${stu.firstName} ${stu.lastName} ${stu.studentId}`.toLowerCase();
              if (!hay.includes(search.toLowerCase())) continue;
            }
            if (studentYear != null && !Number.isNaN(studentYear) && stu.year !== Number(studentYear)) continue;
            const isSubmitted = true;
            const isGraded = sub.score != null;
            const isLate = new Date(sub.submittedAt) > taskDueDate;
            if (statusAny === 'SUBMITTED' && !isSubmitted) continue;
            if (statusAny === 'GRADED' && !isGraded) continue;
            if (statusAny === 'UNGRADED' && isGraded) continue;
            if (statusAny === 'LATE' && !isLate) continue;
            orphanRows.push({
              key: `orphan-${sub.id}`,
              student: stu,
              submission: sub,
              isSubmitted,
              isGraded,
              isLate,
              notSubmitted: false,
            });
          }
        }
      }

      const finalRows = [...pageRows, ...orphanRows];
      const totalCount = enrollmentTotalCount + orphanTotalCount;
      const totalPages = Math.max(1, Math.ceil(totalCount / limit));

      const [totalEnrolled, submitted, graded, lateRaw] = await Promise.all([
        totalEnrolledPromise,
        submittedPromise,
        gradedPromise,
        lateRawPromise,
      ]);
      const late = lateRaw.filter((s) => new Date(s.submittedAt) > taskDueDate).length;

      return {
        rows: finalRows,
        pagination: { page, limit, totalCount, totalPages },
        summary: {
          totalEnrolled,
          submitted,
          graded,
          ungraded: submitted - graded,
          late,
          notSubmitted: totalEnrolled - submitted,
        },
        defaultCourseYear: taskObj.course.year ?? null,
      };
    }

    // ---------- Pure submission-only path (status in SUBMITTED/GRADED/UNGRADED/LATE): DB pagination ----------
    const subWhere: any = { taskId };
    if (Object.keys(studentWhere).length) {
      subWhere.student = studentWhere;
    }
    const statusAny = status as string;
    if (statusAny === 'GRADED') subWhere.score = { not: null };
    else if (statusAny === 'UNGRADED') subWhere.score = null;
    else if (statusAny === 'LATE') subWhere.submittedAt = { gt: taskDueDate };

    const totalCount = await prisma.taskSubmission.count({ where: subWhere });
    const submissionRows = await prisma.taskSubmission.findMany({
      where: subWhere,
      include: { student: true },
      orderBy: [{ student: { lastName: 'asc' as const } }, { student: { firstName: 'asc' as const } }],
      skip,
      take: limit,
    });

    const rows = submissionRows.map((sub) => {
      const isLate = new Date(sub.submittedAt) > taskDueDate;
      return {
        key: `sub-${sub.id}`,
        student: sub.student,
        submission: sub,
        isSubmitted: true,
        isGraded: sub.score != null,
        isLate,
        notSubmitted: false,
      };
    });
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    const [totalEnrolled, submitted, graded, lateRaw] = await Promise.all([
      totalEnrolledPromise,
      submittedPromise,
      gradedPromise,
      lateRawPromise,
    ]);
    const late = lateRaw.filter((s) => new Date(s.submittedAt) > taskDueDate).length;

    return {
      rows,
      pagination: { page, limit, totalCount, totalPages },
      summary: {
        totalEnrolled,
        submitted,
        graded,
        ungraded: submitted - graded,
        late,
        notSubmitted: Math.max(0, totalEnrolled - submitted),
      },
      defaultCourseYear: taskObj.course.year ?? null,
    };
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
