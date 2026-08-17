import { AttendanceMethod, AttendanceStatus } from '@prisma/client';
import prisma from '../utils/prismaClient';
import { AppError, AuthorizationError, NotFoundError } from '../utils/appError';
import { getScopeWhere } from '../utils/scope.utils';
import attendanceEngine, { BulkManualRecord } from '../attendance/attendance.engine';
import { DriverValidationContext } from '../attendance/drivers/IAttendanceDriver';

class AttendanceService {
  static async recordByMethod(
    method: AttendanceMethod,
    payload: Record<string, any>,
    ctx: DriverValidationContext
  ) {
    return attendanceEngine.recordAttendance({ method, payload, ctx });
  }

  static async recordBulkManual(
    records: BulkManualRecord[],
    ctx: DriverValidationContext & { sessionId?: number; courseId?: number }
  ) {
    return attendanceEngine.recordBulkManual(records, ctx);
  }

  static async getCourseAttendance(
    user: any,
    courseId: number,
    date?: string
  ) {
    const where: any = { courseId };

    const courseScope = getScopeWhere(user, 'course');
    const course = await prisma.course.findFirst({
      where: { AND: [{ id: courseId }, courseScope] },
      include: { department: true },
    });
    if (!course) {
      throw new AuthorizationError(
        'Access denied: You are not authorized for this course.'
      );
    }

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      where.date = { gte: startOfDay, lte: endOfDay };
    }

    const attendance = await prisma.attendance.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            group: { select: { id: true, name: true } },
          },
        },
        recordedBy: {
          select: {
            id: true,
            role: true,
            doctor: { select: { firstName: true, lastName: true } },
            teachingAssistant: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    return attendance.map((record: any) => ({
      ...record,
      recordedBy: record.recordedBy
        ? {
            id: record.recordedBy.id,
            role: record.recordedBy.role,
            firstName:
              record.recordedBy.doctor?.firstName ||
              record.recordedBy.teachingAssistant?.firstName ||
              'Admin',
            lastName:
              record.recordedBy.doctor?.lastName ||
              record.recordedBy.teachingAssistant?.lastName ||
              'User',
          }
        : null,
      group: record.student.group || null,
      recordedAt: record.createdAt,
    }));
  }

  static async getStudentAttendance(
    user: any,
    studentId: number,
    courseId?: number,
    page: number = 1,
    limit: number = 20
  ) {
    if (user.role === 'STUDENT') {
      const myStudent = await prisma.student.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!myStudent || myStudent.id !== studentId) {
        throw new AuthorizationError(
          'You can only view your own attendance records.'
        );
      }
    } else {
      const studentScope = getScopeWhere(user, 'student');
      const studentRecord = await prisma.student.findFirst({
        where: { AND: [{ id: studentId }, studentScope] },
      });
      if (!studentRecord) {
        throw new AuthorizationError('Access denied or Student not found');
      }
    }

    const skip = (page - 1) * limit;
    const where: any = { studentId };
    if (courseId) where.courseId = courseId;

    const [attendance, total, statsData] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          course: { select: { name: true, courseCode: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.attendance.count({ where }),
      prisma.attendance.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
    ]);

    const stats: any = {
      total,
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      EXCUSED: 0,
    };
    statsData.forEach((item: any) => {
      stats[item.status] = item._count;
    });

    const effectiveTotal = total - stats.EXCUSED;
    const percentage =
      effectiveTotal > 0
        ? ((stats.PRESENT + stats.LATE * 0.5) / effectiveTotal) * 100
        : 0;

    return {
      data: attendance,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        ...stats,
        percentage: Math.round(percentage * 100) / 100,
      },
    };
  }

  static async getMyCourses(user: any) {
    const userRole = user.role;

    if (
      ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(
        userRole
      )
    ) {
      const courseScope = getScopeWhere(user, 'course');
      return prisma.course.findMany({
        where: courseScope,
        select: { id: true, name: true, courseCode: true },
      });
    }

    if (userRole === 'STUDENT') {
      const myStudent = await prisma.student.findUnique({
        where: { userId: user.id },
      });
      if (!myStudent) return [];

      const slotCourseIds: number[] = [];
      if (myStudent.groupId) {
        const slots = await prisma.scheduleSlot.findMany({
          where: { groupId: myStudent.groupId },
          select: { courseId: true },
        });
        slots.forEach((s: any) => slotCourseIds.push(s.courseId));
      }

      const enrollments = await prisma.enrollment.findMany({
        where: { studentId: myStudent.id, status: 'ENROLLED' },
        select: { courseId: true },
      });

      const deptCourses = myStudent.departmentId
        ? await prisma.course.findMany({
            where: {
              departmentId: myStudent.departmentId,
              year: myStudent.year,
            },
            select: { id: true },
          })
        : [];

      const courseIds = Array.from(
        new Set([
          ...slotCourseIds,
          ...enrollments.map((e: any) => e.courseId),
          ...deptCourses.map((c: any) => c.id),
        ])
      );

      return prisma.course.findMany({
        where: { id: { in: courseIds } },
        select: { id: true, name: true, courseCode: true },
      });
    }

    if (userRole === 'TEACHING_ASSISTANT') {
      const myTA = await prisma.teachingAssistant.findUnique({
        where: { userId: user.id },
      });
      if (!myTA) return [];

      const slots = await prisma.scheduleSlot.findMany({
        where: { teachingAssistantId: myTA.id },
        select: { courseId: true },
      });

      const courseIds = Array.from(
        new Set(slots.map((s: any) => s.courseId))
      );
      let courses = await prisma.course.findMany({
        where: { id: { in: courseIds } },
        select: { id: true, name: true, courseCode: true },
      });

      if (courses.length === 0 && myTA.departmentId) {
        courses = await prisma.course.findMany({
          where: { departmentId: myTA.departmentId },
          select: { id: true, name: true, courseCode: true },
        });
      }

      return courses;
    }

    if (userRole === 'DOCTOR') {
      const myDoctor = await prisma.doctor.findUnique({
        where: { userId: user.id },
      });
      if (!myDoctor) return [];

      const slots = await prisma.scheduleSlot.findMany({
        where: { doctorId: myDoctor.id },
        select: { courseId: true },
      });

      const courseIds = Array.from(
        new Set(slots.map((s: any) => s.courseId))
      );
      let courses = await prisma.course.findMany({
        where: { id: { in: courseIds } },
        select: { id: true, name: true, courseCode: true },
      });

      if (courses.length === 0 && myDoctor.departmentId) {
        courses = await prisma.course.findMany({
          where: { departmentId: myDoctor.departmentId },
          select: { id: true, name: true, courseCode: true },
        });
      }

      return courses;
    }

    return [];
  }

  static async getMySlots(user: any) {
    const userRole = user.role;
    let slots: any[] = [];

    const selectFields = {
      course: { select: { id: true, name: true, courseCode: true } },
      group: { select: { id: true, name: true } },
      doctor: { select: { firstName: true, lastName: true } },
      teachingAssistant: { select: { firstName: true, lastName: true } },
    };
    const orderBy: any = [
      { dayOfWeek: 'asc' },
      { startTime: 'asc' },
    ];

    if (userRole === 'DOCTOR') {
      const myDoctor = await prisma.doctor.findUnique({
        where: { userId: user.id },
      });
      if (myDoctor) {
        slots = await prisma.scheduleSlot.findMany({
          where: { doctorId: myDoctor.id },
          include: selectFields,
          orderBy,
        });

        if (slots.length === 0 && myDoctor.departmentId) {
          slots = await prisma.scheduleSlot.findMany({
            where: { course: { departmentId: myDoctor.departmentId } },
            include: selectFields,
            orderBy,
          });
        }
      }
    } else if (userRole === 'TEACHING_ASSISTANT') {
      const myTA = await prisma.teachingAssistant.findUnique({
        where: { userId: user.id },
      });
      if (myTA) {
        slots = await prisma.scheduleSlot.findMany({
          where: { teachingAssistantId: myTA.id },
          include: selectFields,
          orderBy,
        });

        if (slots.length === 0 && myTA.departmentId) {
          slots = await prisma.scheduleSlot.findMany({
            where: { course: { departmentId: myTA.departmentId } },
            include: selectFields,
            orderBy,
          });
        }
      }
    } else if (
      ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(
        userRole
      )
    ) {
      const courseScope: any = getScopeWhere(user, 'course');
      const where: any =
        courseScope && Object.keys(courseScope).length > 0
          ? { course: courseScope }
          : {};
      slots = await prisma.scheduleSlot.findMany({
        where,
        include: selectFields,
        orderBy,
      });
    }

    if (
      slots.length === 0 &&
      [
        'DOCTOR',
        'TEACHING_ASSISTANT',
        'SUPER_ADMIN',
        'ADMIN',
        'COLLEGE_ADMIN',
        'DEPARTMENT_ADMIN',
      ].includes(userRole)
    ) {
      slots = await prisma.scheduleSlot.findMany({
        include: selectFields,
        orderBy,
      });
    }

    return slots;
  }

  static async getMyAttendance(userId: number, courseId: number) {
    const student = await prisma.student.findUnique({
      where: { userId },
    });
    if (!student) {
      throw new AuthorizationError('Student profile not found.');
    }

    const studentId = student.id;

    const slots = await prisma.scheduleSlot.findMany({
      where: {
        courseId,
        OR: [{ groupId: student.groupId }, { groupId: null }],
      },
    });

    const slotIds = slots.map((s) => s.id);

    const sessions = await prisma.attendanceSession.findMany({
      where: { scheduleSlotId: { in: slotIds } },
      orderBy: { createdAt: 'desc' },
      include: { scheduleSlot: { include: { course: true } } },
    });

    const attendances = await prisma.attendance.findMany({
      where: {
        studentId,
        sessionId: { in: sessions.map((s) => s.id) },
      },
    });

    const attendanceMap = new Map();
    attendances.forEach((a: any) => attendanceMap.set(a.sessionId, a));

    return sessions.map((session) => {
      const record = attendanceMap.get(session.id);
      return {
        sessionId: session.id,
        date: session.createdAt,
        course: session.scheduleSlot.course,
        status: record ? record.status : 'ABSENT',
        remarks: record ? record.remarks : null,
      };
    });
  }

  static async getAttendanceSummary(user: any, courseId: number) {
    const courseScope: any = getScopeWhere(user, 'course');
    const course = await prisma.course.findFirst({
      where: { AND: [{ id: courseId }, courseScope] },
    });
    if (!course) {
      throw new AuthorizationError(
        'Access denied: You are not authorized for this course.'
      );
    }

    const statsData = await prisma.attendance.groupBy({
      by: ['status'],
      where: { courseId },
      _count: true,
    });
    const stats: any = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    statsData.forEach((item) => (stats[item.status] = item._count));
    return stats;
  }

  static async getAttendanceRecords(
    user: any,
    options: {
      courseId?: number;
      date?: string;
      departmentId?: number;
      collegeId?: number;
      page?: number;
      limit?: number;
    }
  ) {
    const {
      courseId,
      date,
      departmentId,
      collegeId,
      page = 1,
      limit = 50,
    } = options;

    const where: any = {};

    if (courseId) where.courseId = courseId;
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      where.date = { gte: startOfDay, lte: endOfDay };
    }

    if (departmentId) {
      where.course = { departmentId };
    } else if (collegeId) {
      where.course = { department: { collegeId } };
    }

    const courseScope: any = getScopeWhere(user, 'course');
    if (courseScope && Object.keys(courseScope).length) {
      if (where.course) {
        where.course = { AND: [where.course, courseScope] };
      } else {
        where.course = courseScope;
      }
    }

    const skip = (page - 1) * limit;

    const [attendance, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              studentId: true,
              firstName: true,
              lastName: true,
              group: { select: { id: true, name: true } },
            },
          },
          course: { select: { name: true, courseCode: true } },
          recordedBy: {
            select: {
              id: true,
              role: true,
              doctor: { select: { firstName: true, lastName: true } },
              teachingAssistant: {
                select: { firstName: true, lastName: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.attendance.count({ where }),
    ]);

    const mappedData = attendance.map((record: any) => ({
      ...record,
      recordedBy: record.recordedBy
        ? {
            id: record.recordedBy.id,
            role: record.recordedBy.role,
            firstName:
              record.recordedBy.doctor?.firstName ||
              record.recordedBy.teachingAssistant?.firstName ||
              'Admin',
            lastName:
              record.recordedBy.doctor?.lastName ||
              record.recordedBy.teachingAssistant?.lastName ||
              'User',
          }
        : null,
      group: record.student.group || null,
      recordedAt: record.createdAt,
    }));

    return {
      data: mappedData,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async unblockEnrollment(user: any, enrollmentId: number) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { course: true, student: true },
    });

    if (!enrollment) {
      throw new NotFoundError('Enrollment not found');
    }

    const courseScope: any = getScopeWhere(user, 'course');
    if (courseScope && Object.keys(courseScope).length) {
      const courseCheck = await prisma.course.findFirst({
        where: { AND: [{ id: enrollment.courseId }, courseScope] },
      });
      if (!courseCheck) {
        throw new AuthorizationError(
          'Access denied: You are not authorized for this course.'
        );
      }
    }

    if (enrollment.status !== 'BLOCKED') {
      return { message: 'Enrollment is not blocked' };
    }

    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { status: 'ENROLLED' },
    });

    return { message: 'Student unblocked successfully' };
  }

  static async getAuditDuplicateDevices() {
    const duplicates: any[] = await prisma.$queryRaw`
      SELECT "deviceId", 
             COUNT(DISTINCT "studentId")::int as "studentCount", 
             array_agg(DISTINCT "studentId") as "studentIds"
      FROM "Attendance"
      WHERE "deviceId" IS NOT NULL
      GROUP BY "deviceId"
      HAVING COUNT(DISTINCT "studentId") > 1
    `;

    if (!duplicates || duplicates.length === 0) {
      return [];
    }

    return Promise.all(
      duplicates.map(async (dup) => {
        const students = await prisma.student.findMany({
          where: { id: { in: dup.studentIds } },
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            user: { select: { email: true } },
          },
        });
        return {
          deviceId: dup.deviceId,
          studentCount: dup.studentCount,
          students,
        };
      })
    );
  }

  static async overrideFlaggedRecord(
    user: any,
    attendanceId: number,
    note?: string
  ) {
    const attendanceRecord = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: { session: { include: { scheduleSlot: true } } },
    });

    if (!attendanceRecord || !attendanceRecord.session) {
      throw new NotFoundError('Record not found');
    }

    let authorized = false;
    const session = attendanceRecord.session;
    if (
      ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(
        user.role
      )
    ) {
      authorized = true;
    } else if (user.role === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({
        where: { userId: user.id },
      });
      if (
        doctor &&
        (session.scheduleSlot?.doctorId === doctor.id ||
          session.doctorId === doctor.id)
      ) {
        authorized = true;
      }
    } else if (user.role === 'TEACHING_ASSISTANT') {
      const ta = await prisma.teachingAssistant.findUnique({
        where: { userId: user.id },
      });
      if (ta && session.scheduleSlot?.teachingAssistantId === ta.id) {
        authorized = true;
      }
    }

    if (!authorized) {
      throw new AuthorizationError(
        'Not authorized to override records for this session'
      );
    }

    return prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        locationFlagged: false,
        overriddenBy: user.email,
        overrideNote: note,
      },
    });
  }
}

export { AttendanceService };
export default AttendanceService;
