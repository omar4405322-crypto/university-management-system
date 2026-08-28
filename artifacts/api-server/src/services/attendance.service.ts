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

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        enrollments: {
          where: { status: 'ENROLLED' },
          select: { courseId: true },
        },
      },
    });

    const enrolledCourseIds =
      student?.enrollments.map((e) => e.courseId) || [];

    // ENROLLED-Only Scope Guard:
    // If a specific courseId is requested, verify that the student has an active ENROLLED status.
    // If the student is not enrolled (or has WITHDRAWN), return early with empty stats rather than fabricating numbers.
    if (courseId && !enrolledCourseIds.includes(courseId)) {
      return {
        data: [],
        pagination: {
          total: 0,
          page,
          totalPages: 0,
        },
        stats: {
          total: 0,
          PRESENT: 0,
          ABSENT: 0,
          LATE: 0,
          EXCUSED: 0,
          percentage: 0,
        },
      };
    }

    // Explicitly scope "All Courses" (courseId is undefined) strictly to ENROLLED courses.
    if (!courseId && enrolledCourseIds.length === 0) {
      return {
        data: [],
        pagination: {
          total: 0,
          page,
          totalPages: 0,
        },
        stats: {
          total: 0,
          PRESENT: 0,
          ABSENT: 0,
          LATE: 0,
          EXCUSED: 0,
          percentage: 0,
        },
      };
    }

    const targetCourseFilter = courseId
      ? courseId
      : { in: enrolledCourseIds };

    const slots = await prisma.scheduleSlot.findMany({
      where: {
        courseId: targetCourseFilter,
        OR: [{ groupId: student?.groupId }, { groupId: null }],
      },
      select: { id: true },
    });
    const slotIds = slots.map((s) => s.id);

    const sessions = await prisma.attendanceSession.findMany({
      where: { scheduleSlotId: { in: slotIds } },
      select: { id: true },
    });
    const totalHeldSessions = sessions.length;
    const sessionIds = sessions.map((s) => s.id);

    const [sessionAttendances, standaloneAttendances, paginatedAttendance, recordCount] =
      await Promise.all([
        prisma.attendance.findMany({
          where: {
            studentId,
            sessionId: { in: sessionIds },
          },
          select: { status: true },
        }),
        prisma.attendance.findMany({
          where: {
            studentId,
            courseId: targetCourseFilter,
            sessionId: null,
          },
          select: { status: true },
        }),
        // Intentionally scope paginated raw records and count to targetCourseFilter
        // (single requested enrolled course or all currently ENROLLED courses).
        // This ensures the All Courses aggregate path never leaks historical records
        // from courses that the student has withdrawn from or is not actively enrolled in.
        prisma.attendance.findMany({
          where: {
            studentId,
            courseId: targetCourseFilter,
          },
          include: {
            course: { select: { name: true, courseCode: true } },
          },
          orderBy: { date: 'desc' },
          skip,
          take: limit,
        }),
        prisma.attendance.count({
          where: {
            studentId,
            courseId: targetCourseFilter,
          },
        }),
      ]);

    let present = 0;
    let late = 0;
    let excused = 0;
    let explicitAbsent = 0;

    sessionAttendances.forEach((a: any) => {
      if (a.status === 'PRESENT') present++;
      else if (a.status === 'LATE') late++;
      else if (a.status === 'EXCUSED') excused++;
      else if (a.status === 'ABSENT') explicitAbsent++;
    });

    standaloneAttendances.forEach((a: any) => {
      if (a.status === 'PRESENT') present++;
      else if (a.status === 'LATE') late++;
      else if (a.status === 'EXCUSED') excused++;
      else if (a.status === 'ABSENT') explicitAbsent++;
    });

    // Unattended held sessions without an explicit record are counted as ABSENT
    const recordedSessionCount = sessionAttendances.length;
    const unrecordedAbsent = Math.max(0, totalHeldSessions - recordedSessionCount);
    const totalAbsent = explicitAbsent + unrecordedAbsent;
    const totalSessions = totalHeldSessions + standaloneAttendances.length;

    const effectiveTotal = totalSessions - excused;
    const percentage =
      effectiveTotal > 0
        ? ((present + late * 0.5) / effectiveTotal) * 100
        : 0;

    const stats = {
      total: totalSessions,
      PRESENT: present,
      ABSENT: totalAbsent,
      LATE: late,
      EXCUSED: excused,
      percentage: Math.round(percentage * 100) / 100,
    };

    return {
      data: paginatedAttendance,
      pagination: {
        total: recordCount,
        page,
        totalPages: Math.ceil(recordCount / limit),
      },
      stats,
    };
  }

  static async getMyCourses(user: any) {
    const userRole = user.role;

    const courseSelect = {
      id: true,
      name: true,
      courseCode: true,
      credits: true,
      year: true,
      semester: true,
      departmentId: true,
      department: {
        select: {
          id: true,
          name: true,
          nameAr: true,
          collegeId: true,
          college: {
            select: {
              id: true,
              name: true,
              nameAr: true,
            },
          },
        },
      },
      scheduleSlots: {
        select: {
          id: true,
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          slotType: true,
          groupId: true,
          group: {
            select: {
              id: true,
              name: true,
              year: true,
            },
          },
        },
      },
      _count: {
        select: {
          enrollments: true,
          scheduleSlots: true,
        },
      },
    };

    const mapCourseSlots = (courseList: any[]) =>
      courseList.map((c: any) => ({
        ...c,
        scheduleSlots: c.scheduleSlots?.map((slot: any) => ({
          ...slot,
          studentGroupId: slot.groupId,
          studentGroup: slot.group,
        })),
      }));

    if (
      ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(
        userRole
      )
    ) {
      const courseScope = getScopeWhere(user, 'course');
      const courses = await prisma.course.findMany({
        where: courseScope,
        select: courseSelect,
      });
      return mapCourseSlots(courses);
    }

    if (userRole === 'STUDENT') {
      const myStudent = await prisma.student.findUnique({
        where: { userId: user.id },
      });
      if (!myStudent) return [];

      // A student must only see courses for which they have an active ENROLLED status.
      // Withdrawn courses or un-enrolled department courses must NEVER be returned as active course chips.
      const enrollments = await prisma.enrollment.findMany({
        where: { studentId: myStudent.id, status: 'ENROLLED' },
        select: { courseId: true },
      });

      const enrolledCourseIds = enrollments.map((e: any) => e.courseId);

      if (enrolledCourseIds.length === 0) {
        return [];
      }

      const courses = await prisma.course.findMany({
        where: { id: { in: enrolledCourseIds } },
        select: courseSelect,
      });
      return mapCourseSlots(courses);
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
        select: courseSelect,
      });

      if (courses.length === 0 && myTA.departmentId) {
        courses = await prisma.course.findMany({
          where: { departmentId: myTA.departmentId },
          select: courseSelect,
        });
      }

      return mapCourseSlots(courses);
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
        select: courseSelect,
      });

      if (courses.length === 0 && myDoctor.departmentId) {
        courses = await prisma.course.findMany({
          where: { departmentId: myDoctor.departmentId },
          select: courseSelect,
        });
      }

      return mapCourseSlots(courses);
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

  static async getMyAttendance(userId: number, courseId?: number) {
    const student = await prisma.student.findUnique({
      where: { userId },
      include: {
        enrollments: {
          where: { status: 'ENROLLED' },
          select: { courseId: true },
        },
      },
    });
    if (!student) {
      throw new AuthorizationError('Student profile not found.');
    }

    const studentId = student.id;
    const enrolledCourseIds =
      student.enrollments.map((e) => e.courseId) || [];

    // ENROLLED-Only Scope Guard:
    // If a specific courseId is requested, verify active enrollment.
    // If the student is not enrolled (or has WITHDRAWN), return an empty list immediately.
    if (courseId && !enrolledCourseIds.includes(courseId)) {
      return [];
    }

    // Explicitly scope "All Courses" (courseId is undefined) strictly to ENROLLED courses.
    if (!courseId && enrolledCourseIds.length === 0) {
      return [];
    }

    const targetCourseFilter = courseId
      ? courseId
      : { in: enrolledCourseIds };

    const slots = await prisma.scheduleSlot.findMany({
      where: {
        courseId: targetCourseFilter,
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

  static async getMyAbsenceWarnings(user: any) {
    if (user.role !== 'STUDENT') {
      return this.getStaffAbsenceWarnings(user);
    }

    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      include: {
        enrollments: {
          where: {
            status: { in: ['ENROLLED', 'BLOCKED'] },
          },
          include: {
            course: {
              select: {
                id: true,
                courseCode: true,
                name: true,
                departmentId: true,
              },
            },
            exemptionPeriods: {
              select: {
                id: true,
                startDate: true,
                endDate: true,
                reason: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!student) {
      return {
        isStaff: false,
        courses: [],
        notifications: [],
      };
    }

    const coursesData = await Promise.all(
      student.enrollments.map(async (enrollment) => {
        const courseId = enrollment.courseId;
        const attendanceData = await this.getStudentAttendance(
          user,
          student.id,
          courseId,
          1,
          1
        );

        let maxAbsencePercent = 25.0;
        if (
          enrollment.customAbsenceThreshold !== null &&
          enrollment.customAbsenceThreshold !== undefined
        ) {
          maxAbsencePercent = enrollment.customAbsenceThreshold;
        } else {
          const policies = await prisma.absenceThresholdPolicy.findMany({
            where: {
              OR: [
                { courseId },
                { departmentId: enrollment.course.departmentId },
                { departmentId: null, courseId: null },
              ],
            },
          });

          let policy = policies.find((p) => p.courseId === courseId);
          if (!policy) {
            policy = policies.find(
              (p) => p.departmentId === enrollment.course.departmentId
            );
          }
          if (!policy) {
            policy = policies.find(
              (p) => p.courseId === null && p.departmentId === null
            );
          }
          if (policy) {
            maxAbsencePercent = policy.maxAbsencePercent;
          }
        }

        const stats = attendanceData.stats;
        const activeTotal = stats.total - stats.EXCUSED;
        const absencePercent =
          activeTotal > 0
            ? Math.round(
                ((stats.ABSENT + stats.LATE * 0.5) / activeTotal) * 1000
              ) / 10
            : 0;

        const isBlocked = enrollment.status === 'BLOCKED';
        const isExceeding = absencePercent >= maxAbsencePercent;
        const isNearLimit =
          !isExceeding && absencePercent >= Math.max(0, maxAbsencePercent - 5);

        return {
          enrollmentId: enrollment.id,
          courseId: enrollment.course.id,
          courseCode: enrollment.course.courseCode,
          courseName: enrollment.course.name,
          status: enrollment.status,
          isBlocked,
          absencePercent,
          maxAbsencePercent,
          isExceeding,
          isNearLimit,
          totalSessions: stats.total,
          present: stats.PRESENT,
          late: stats.LATE,
          absent: stats.ABSENT,
          excused: stats.EXCUSED,
          exemptionPeriods: enrollment.exemptionPeriods,
        };
      })
    );

    // Fetch student's related notifications regarding absence/enrollment
    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
        OR: [
          { title: { contains: 'Enrollment', mode: 'insensitive' } },
          { title: { contains: 'Absence', mode: 'insensitive' } },
          { title: { contains: 'حرمان', mode: 'insensitive' } },
          { title: { contains: 'غياب', mode: 'insensitive' } },
          { title: { contains: 'إنذار', mode: 'insensitive' } },
          { message: { contains: 'absence', mode: 'insensitive' } },
          { message: { contains: 'غياب', mode: 'insensitive' } },
          { message: { contains: 'blocked', mode: 'insensitive' } },
          { message: { contains: 'restored', mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      isStaff: false,
      courses: coursesData,
      notifications,
    };
  }

  static async getStaffAbsenceWarnings(user: any) {
    const userRole = user.role;
    let courseIds: number[] = [];

    if (['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(userRole)) {
      const courseScope = getScopeWhere(user, 'course');
      const courses = await prisma.course.findMany({
        where: courseScope,
        select: { id: true },
      });
      courseIds = courses.map((c) => c.id);
    } else if (userRole === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });
      if (doctor) {
        const slots = await prisma.scheduleSlot.findMany({
          where: { doctorId: doctor.id },
          select: { courseId: true },
        });
        courseIds = Array.from(new Set(slots.map((s) => s.courseId)));
        if (courseIds.length === 0 && doctor.departmentId) {
          const deptCourses = await prisma.course.findMany({
            where: { departmentId: doctor.departmentId },
            select: { id: true },
          });
          courseIds = deptCourses.map((c) => c.id);
        }
      }
    } else if (userRole === 'TEACHING_ASSISTANT') {
      const ta = await prisma.teachingAssistant.findUnique({ where: { userId: user.id } });
      if (ta) {
        const slots = await prisma.scheduleSlot.findMany({
          where: { teachingAssistantId: ta.id },
          select: { courseId: true },
        });
        courseIds = Array.from(new Set(slots.map((s) => s.courseId)));
        if (courseIds.length === 0 && ta.departmentId) {
          const deptCourses = await prisma.course.findMany({
            where: { departmentId: ta.departmentId },
            select: { id: true },
          });
          courseIds = deptCourses.map((c) => c.id);
        }
      }
    }

    if (courseIds.length === 0) {
      return {
        isStaff: true,
        summary: {
          totalMonitored: 0,
          blockedCount: 0,
          finalWarningCount: 0,
          firstWarningCount: 0,
          safeCount: 0,
        },
        warningRecords: [],
        coursesList: [],
      };
    }

    const enrollments = await prisma.enrollment.findMany({
      where: {
        courseId: { in: courseIds },
        status: { in: ['ENROLLED', 'BLOCKED'] },
      },
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            year: true,
            department: {
              select: {
                id: true,
                name: true,
                nameAr: true,
                college: {
                  select: { id: true, name: true, nameAr: true },
                },
              },
            },
            user: { select: { email: true } },
          },
        },
        course: {
          select: {
            id: true,
            courseCode: true,
            name: true,
            credits: true,
            year: true,
            semester: true,
            departmentId: true,
          },
        },
        exemptionPeriods: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            reason: true,
            createdAt: true,
          },
        },
      },
    });

    const slots = await prisma.scheduleSlot.findMany({
      where: { courseId: { in: courseIds } },
      select: { id: true, courseId: true },
    });
    const slotToCourseMap = new Map<number, number>();
    slots.forEach((s) => slotToCourseMap.set(s.id, s.courseId));

    const sessions = await prisma.attendanceSession.findMany({
      where: { scheduleSlotId: { in: slots.map((s) => s.id) } },
      select: { id: true, scheduleSlotId: true },
    });
    const courseSessionsCountMap = new Map<number, number>();

    sessions.forEach((sess) => {
      const cId = slotToCourseMap.get(sess.scheduleSlotId!);
      if (cId) {
        courseSessionsCountMap.set(cId, (courseSessionsCountMap.get(cId) || 0) + 1);
      }
    });

    const studentIds = Array.from(new Set(enrollments.map((e) => e.studentId)));
    const attendances = await prisma.attendance.findMany({
      where: {
        studentId: { in: studentIds },
        courseId: { in: courseIds },
      },
      select: {
        studentId: true,
        courseId: true,
        status: true,
      },
    });

    const attendanceStatsMap = new Map<string, { present: number; late: number; absent: number; excused: number; total: number }>();
    attendances.forEach((att) => {
      const key = `${att.studentId}_${att.courseId}`;
      let stat = attendanceStatsMap.get(key);
      if (!stat) {
        stat = { present: 0, late: 0, absent: 0, excused: 0, total: 0 };
        attendanceStatsMap.set(key, stat);
      }
      stat.total++;
      if (att.status === 'PRESENT') stat.present++;
      else if (att.status === 'LATE') stat.late++;
      else if (att.status === 'ABSENT') stat.absent++;
      else if (att.status === 'EXCUSED') stat.excused++;
    });

    const policies = await prisma.absenceThresholdPolicy.findMany({
      where: {
        OR: [
          { courseId: { in: courseIds } },
          { departmentId: null, courseId: null },
        ],
      },
    });

    let blockedCount = 0;
    let finalWarningCount = 0;
    let firstWarningCount = 0;
    let safeCount = 0;

    const warningRecords = enrollments.map((enrollment) => {
      const courseId = enrollment.courseId;
      const studentId = enrollment.studentId;
      const key = `${studentId}_${courseId}`;
      const stat = attendanceStatsMap.get(key) || { present: 0, late: 0, absent: 0, excused: 0, total: 0 };

      const totalHeld = Math.max(stat.total, courseSessionsCountMap.get(courseId) || 0);
      const activeTotal = totalHeld - stat.excused;

      let maxAbsencePercent = enrollment.customAbsenceThreshold ?? 25.0;
      if (enrollment.customAbsenceThreshold === null || enrollment.customAbsenceThreshold === undefined) {
        const policy = policies.find((p) => p.courseId === courseId) || policies.find((p) => !p.courseId && !p.departmentId);
        if (policy) maxAbsencePercent = policy.maxAbsencePercent;
      }

      const calculatedAbsenceCount = stat.absent + stat.late * 0.5;
      const absencePercent =
        activeTotal > 0 ? Math.round((calculatedAbsenceCount / activeTotal) * 1000) / 10 : 0;

      const isBlocked = enrollment.status === 'BLOCKED' || absencePercent >= maxAbsencePercent;
      const isFinalWarning = !isBlocked && absencePercent >= Math.max(0, maxAbsencePercent - 5);
      const isFirstWarning = !isBlocked && !isFinalWarning && absencePercent >= 10.0;

      let warningStage: 'BLOCKED' | 'FINAL_WARNING' | 'FIRST_WARNING' | 'SAFE' = 'SAFE';
      if (isBlocked) {
        warningStage = 'BLOCKED';
        blockedCount++;
      } else if (isFinalWarning) {
        warningStage = 'FINAL_WARNING';
        finalWarningCount++;
      } else if (isFirstWarning) {
        warningStage = 'FIRST_WARNING';
        firstWarningCount++;
      } else {
        safeCount++;
      }

      return {
        enrollmentId: enrollment.id,
        studentId: enrollment.student.id,
        studentCode: enrollment.student.studentId,
        studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`.trim(),
        studentEmail: enrollment.student.user?.email,
        studentYear: enrollment.student.year || enrollment.course.year || 1,
        departmentName: enrollment.student.department?.name,
        departmentNameAr: enrollment.student.department?.nameAr,
        collegeName: enrollment.student.department?.college?.name,
        collegeNameAr: enrollment.student.department?.college?.nameAr,
        courseId: enrollment.course.id,
        courseCode: enrollment.course.courseCode,
        courseName: enrollment.course.name,
        courseYear: enrollment.course.year,
        courseSemester: enrollment.course.semester,
        status: enrollment.status,
        warningStage,
        absencePercent,
        maxAbsencePercent,
        totalSessions: totalHeld,
        present: stat.present,
        late: stat.late,
        absent: stat.absent,
        excused: stat.excused,
        exemptionPeriods: enrollment.exemptionPeriods || [],
      };
    });

    const coursesList = Array.from(
      new Map(
        enrollments.map((e) => [
          e.course.id,
          {
            id: e.course.id,
            courseCode: e.course.courseCode,
            name: e.course.name,
            year: e.course.year,
            semester: e.course.semester,
          },
        ])
      ).values()
    );

    return {
      isStaff: true,
      summary: {
        totalMonitored: enrollments.length,
        blockedCount,
        finalWarningCount,
        firstWarningCount,
        safeCount,
      },
      warningRecords,
      coursesList,
    };
  }
}

export { AttendanceService };
export default AttendanceService;
