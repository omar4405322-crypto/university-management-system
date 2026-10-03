import type { AuthActor } from '../types/auth.types';
import prisma from '../utils/prismaClient';
import { AttendanceService } from './attendance.service';
import { calculateStudentGpa } from '../utils/gpa.utils';
import { TaskQueriesService } from './task/taskQueries.service';
import { getScopedUniversityCounts } from './administrativeSummary.service';
import { getAdministrativeAnalyticsScopes } from '../utils/administrativeAnalyticsScope.utils';
import { getScopeWhere } from '../utils/scope.utils';
import { toCairoTime } from '../utils/timezone.utils';
import {
  getAllowedAiTools as getRegistryAllowedAiTools,
  type FunctionTool,
} from './aiCapabilityRegistry.service';
import { retrieveKnowledgeChunks } from './knowledge/knowledgeRetrieval.service';
import {
  queryStudentPriorityOverview,
  queryStudentWeeklyOverview,
  queryDoctorTeachingInsights,
  queryTaSectionInsights,
  queryAdminOperationalInsights,
  compareScopedDepartments,
} from './aiCrossDomainAnalytics.service';
import {
  proposeAction,
  type SupportedActionType,
  type ProposalCreationOptions,
} from './aiActionProposal.service';
import logger from '../utils/logger';

export type StudentToolName =
  | 'get_my_academic_summary'
  | 'get_my_courses'
  | 'get_my_attendance_summary'
  | 'get_my_schedule'
  | 'get_my_tasks'
  | 'get_my_exams'
  | 'get_my_payments'
  | 'get_my_priority_overview'
  | 'get_my_weekly_overview'
  | 'get_my_notifications'
  | 'propose_mark_notification_read';

export type DoctorToolName =
  | 'get_my_teaching_courses'
  | 'get_my_teaching_schedule'
  | 'get_my_teaching_workload'
  | 'get_my_course_attendance_overview'
  | 'get_my_course_roster'
  | 'get_my_teaching_insights'
  | 'get_my_notifications'
  | 'propose_create_task'
  | 'propose_mark_notification_read';

export type TaToolName =
  | 'get_my_assigned_sections'
  | 'get_my_ta_schedule'
  | 'get_my_ta_workload'
  | 'get_my_section_students'
  | 'get_my_section_insights'
  | 'get_my_notifications'
  | 'propose_mark_notification_read';

export type AdminToolName =
  | 'get_scoped_university_summary'
  | 'get_scoped_academic_analytics'
  | 'get_scoped_attendance_analytics'
  | 'get_scoped_schedule_summary'
  | 'get_scoped_payment_summary'
  | 'get_scoped_registration_summary'
  | 'search_scoped_students'
  | 'search_scoped_doctors'
  | 'search_scoped_courses'
  | 'get_scoped_course_details'
  | 'list_scoped_departments'
  | 'get_scoped_operational_insights'
  | 'compare_scoped_departments'
  | 'get_my_notifications'
  | 'propose_create_task'
  | 'propose_scoped_announcement'
  | 'propose_mark_notification_read';

export type ToolName =
  | StudentToolName
  | DoctorToolName
  | TaToolName
  | AdminToolName
  | 'search_university_regulations';

export function getAllowedAiTools(actor?: AuthActor): FunctionTool[] {
  return getRegistryAllowedAiTools(actor);
}

// -------------------------------------------------------------
// STUDENT QUERIES (with deterministic date-relative enrichment)
// -------------------------------------------------------------

async function queryStudentAcademicSummary(studentId: number) {
  const [gpaData, studentRecord] = await Promise.all([
    calculateStudentGpa(studentId),
    prisma.student.findUnique({
      where: { id: studentId },
      select: {
        year: true,
        department: { select: { name: true, nameAr: true, college: { select: { name: true, nameAr: true } } } },
        successMetrics: {
          select: {
            attendanceRate: true,
            averageQuizScore: true,
            assignmentCompletionRate: true,
            predictedRisk: true,
          },
        },
      },
    }),
  ]);

  return {
    status: 'SUCCESS',
    hasData: true,
    message: `Academic summary retrieved for GPA ${gpaData.cumulativeGpa}.`,
    messageAr: `تم استرجاع السجل الأكاديمي، المعدل التراكمي: ${gpaData.cumulativeGpa}.`,
    cumulativeGpa: gpaData.cumulativeGpa,
    totalCreditsEarned: gpaData.totalCreditsEarned,
    totalCreditsAttempted: gpaData.totalCreditsAttempted,
    coursesCount: gpaData.coursesCount,
    year: studentRecord?.year ?? 1,
    departmentName: studentRecord?.department?.name || '',
    collegeName: studentRecord?.department?.college?.name || '',
    predictedRisk: studentRecord?.successMetrics?.predictedRisk ?? 'LOW',
    attendanceRate: studentRecord?.successMetrics?.attendanceRate ?? null,
    recentCourses: gpaData.courses.slice(-10).map((course) => ({
      courseCode: course.courseCode,
      courseName: course.courseName,
      finalGrade: course.finalGrade,
      status: course.status,
    })),
  };
}

async function queryStudentCourses(studentId: number) {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId, status: 'ENROLLED' },
    take: 25,
    select: {
      semester: true,
      academicYear: true,
      course: {
        select: {
          courseCode: true,
          name: true,
          credits: true,
          year: true,
          semester: true,
          department: { select: { name: true } },
        },
      },
    },
  });

  return {
    status: enrollments.length > 0 ? 'SUCCESS' : 'EMPTY',
    hasData: enrollments.length > 0,
    message: enrollments.length > 0
      ? `Found ${enrollments.length} enrolled course(s).`
      : 'You are not currently enrolled in any active courses.',
    messageAr: enrollments.length > 0
      ? `تم العثور على ${enrollments.length} مقرر مسجل.`
      : 'لا توجد مقررات مسجلة حالياً.',
    totalEnrolledCourses: enrollments.length,
    courses: enrollments.map((e) => ({
      courseCode: e.course.courseCode,
      courseName: e.course.name,
      credits: e.course.credits,
      year: e.course.year,
      semester: e.course.semester,
      department: e.course.department?.name || '',
    })),
  };
}

async function queryStudentSchedule(actor: AuthActor, dayOfWeekFilter?: string) {
  const student = await prisma.student.findUnique({
    where: { userId: actor.id },
    select: { id: true, groupId: true, departmentId: true, year: true },
  });
  if (!student) {
    return {
      status: 'EMPTY',
      hasData: false,
      message: 'Student profile not found.',
      messageAr: 'لم يتم العثور على ملف الطالب.',
      currentDay: 'SUNDAY',
      totalSlots: 0,
      todaySlotsCount: 0,
      todaySlots: [],
      firstLectureToday: null,
      slots: [],
    };
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: student.id, status: 'ENROLLED' },
    select: { courseId: true },
  });
  const enrolledCourseIds = enrollments.map((e) => e.courseId);

  const baseCourseFilter = { departmentId: student.departmentId, year: student.year };
  let whereClause: any;

  if (student.groupId) {
    const deptGroups = student.departmentId
      ? await prisma.studentGroup.findMany({
          where: { departmentId: student.departmentId },
          select: { id: true, parentGroupId: true },
        })
      : [];
    const groupParentMap = new Map<number, number | null>();
    for (const g of deptGroups) groupParentMap.set(g.id, g.parentGroupId);

    const groupIds: number[] = [];
    let currentGroupId: number | null = student.groupId;
    while (currentGroupId) {
      groupIds.push(currentGroupId);
      currentGroupId = groupParentMap.get(currentGroupId) ?? null;
    }

    whereClause = {
      isArchived: false,
      AND: [
        { OR: [{ timetable: { status: 'PUBLISHED' } }, { timetableId: null }] },
        {
          OR: [
            { groupId: { in: groupIds }, course: { isPublished: true } },
            { groupId: null, course: { ...baseCourseFilter, isPublished: true } },
            { groupId: null, course: { id: { in: enrolledCourseIds }, isPublished: true } },
          ],
        },
      ],
    };
  } else {
    whereClause = {
      isArchived: false,
      AND: [
        { OR: [{ timetable: { status: 'PUBLISHED' } }, { timetableId: null }] },
        {
          OR: [
            { course: { ...baseCourseFilter, isPublished: true } },
            { course: { id: { in: enrolledCourseIds }, isPublished: true } },
          ],
        },
      ],
    };
  }

  if (dayOfWeekFilter?.trim()) {
    whereClause.dayOfWeek = dayOfWeekFilter.trim().toUpperCase();
  }

  const slots = await prisma.scheduleSlot.findMany({
    where: whereClause,
    take: 35,
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    select: {
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      room: true,
      slotType: true,
      course: { select: { courseCode: true, name: true } },
      doctor: { select: { firstName: true, lastName: true } },
      teachingAssistant: { select: { firstName: true, lastName: true } },
    },
  });

  const cairoDate = toCairoTime();
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;
  const currentDay = dayNames[cairoDate.getDay()];
  const tomorrowDay = dayNames[(cairoDate.getDay() + 1) % 7];

  const mappedSlots = slots.map((s) => ({
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    room: s.room || 'TBA',
    slotType: s.slotType,
    courseCode: s.course?.courseCode || '',
    courseName: s.course?.name || '',
    instructor: s.doctor
      ? `Dr. ${s.doctor.firstName} ${s.doctor.lastName}`
      : s.teachingAssistant
      ? `${s.teachingAssistant.firstName} ${s.teachingAssistant.lastName}`
      : 'TBA',
  }));

  const todaySlots = mappedSlots.filter((s) => s.dayOfWeek.toUpperCase() === currentDay);
  const tomorrowSlots = mappedSlots.filter((s) => s.dayOfWeek.toUpperCase() === tomorrowDay);
  const firstLectureToday = todaySlots.length > 0 ? todaySlots[0] : null;

  return {
    status: mappedSlots.length > 0 ? 'SUCCESS' : 'EMPTY',
    hasData: mappedSlots.length > 0,
    message: mappedSlots.length > 0
      ? `Found ${mappedSlots.length} weekly class slot(s). Today is ${currentDay} with ${todaySlots.length} slot(s).`
      : 'No scheduled class slots found for your enrolled courses.',
    messageAr: mappedSlots.length > 0
      ? `تم العثور على ${mappedSlots.length} حصة أسبوعية. اليوم هو ${currentDay} ولديك ${todaySlots.length} محاضرة.`
      : 'لا توجد محاضرات مجدولة حالياً لمقرراتك.',
    currentDay,
    tomorrowDay,
    totalSlots: mappedSlots.length,
    todaySlotsCount: todaySlots.length,
    todaySlots,
    tomorrowSlots,
    firstLectureToday,
    slots: mappedSlots,
  };
}

async function queryStudentExams(studentId: number) {
  const exams = await prisma.exam.findMany({
    where: {
      date: { gte: new Date() },
      course: {
        isPublished: true,
        enrollments: { some: { studentId, status: 'ENROLLED' } },
      },
    },
    take: 15,
    orderBy: { date: 'asc' },
    select: {
      title: true,
      type: true,
      date: true,
      startTime: true,
      endTime: true,
      room: true,
      course: { select: { courseCode: true, name: true } },
    },
  });

  const cairoDate = toCairoTime();
  const todayExams = exams.filter((e) => {
    const examCairo = toCairoTime(e.date);
    return (
      examCairo.getFullYear() === cairoDate.getFullYear() &&
      examCairo.getMonth() === cairoDate.getMonth() &&
      examCairo.getDate() === cairoDate.getDate()
    );
  });

  const mappedExams = exams.map((exam) => ({
    title: exam.title || `${exam.type} Exam`,
    type: exam.type,
    date: exam.date.toISOString().split('T')[0],
    startTime: exam.startTime,
    endTime: exam.endTime,
    room: exam.room || 'TBA',
    courseCode: exam.course.courseCode,
    courseName: exam.course.name,
  }));

  const nextExam = mappedExams.length > 0 ? mappedExams[0] : null;

  return {
    status: mappedExams.length > 0 ? 'SUCCESS' : 'EMPTY',
    hasData: mappedExams.length > 0,
    message: mappedExams.length > 0
      ? `Found ${mappedExams.length} upcoming examination(s).`
      : 'No upcoming examinations scheduled at this time.',
    messageAr: mappedExams.length > 0
      ? `تم العثور على ${mappedExams.length} امتحان قادم.`
      : 'لا توجد اختبارات قادمة مجدولة حالياً.',
    totalUpcomingExams: mappedExams.length,
    nextExam,
    todayExams: todayExams.map((e) => ({
      title: e.title || `${e.type} Exam`,
      type: e.type,
      date: e.date.toISOString().split('T')[0],
      startTime: e.startTime,
      endTime: e.endTime,
      room: e.room || 'TBA',
      courseCode: e.course.courseCode,
      courseName: e.course.name,
    })),
    upcomingExams: mappedExams,
  };
}

async function queryStudentPayments(studentId: number) {
  const [aggregates, payments] = await Promise.all([
    prisma.payment.groupBy({
      by: ['status'],
      where: { studentId },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.payment.findMany({
      where: { studentId },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        type: true,
        amount: true,
        status: true,
        dueDate: true,
        paidAt: true,
      },
    }),
  ]);

  const sumFor = (status: string) =>
    Number(aggregates.find((a) => a.status === status)?._sum.amount ?? 0);
  const countFor = (status: string) =>
    aggregates.find((a) => a.status === status)?._count._all ?? 0;

  const totalPaid = sumFor('PAID');
  const totalPending = sumFor('PENDING');
  const totalOverdue = sumFor('OVERDUE');

  return {
    status: 'SUCCESS',
    hasData: payments.length > 0,
    message: `Payment summary: Total Paid: ${totalPaid}, Pending: ${totalPending}, Overdue: ${totalOverdue}.`,
    messageAr: `ملخص المدفوعات: المسدد: ${totalPaid}، المعلق: ${totalPending}، المتأخر: ${totalOverdue}.`,
    totalPaid,
    totalPending,
    totalOverdue,
    pendingCount: countFor('PENDING'),
    overdueCount: countFor('OVERDUE'),
    recentPayments: payments.map((p) => ({
      type: p.type,
      amount: Number(p.amount),
      status: p.status,
      dueDate: p.dueDate ? p.dueDate.toISOString().split('T')[0] : null,
      paidAt: p.paidAt ? p.paidAt.toISOString().split('T')[0] : null,
    })),
  };
}

// -------------------------------------------------------------
// DOCTOR QUERIES
// -------------------------------------------------------------

async function queryDoctorTeachingCourses(doctorId: number) {
  const slots = await prisma.scheduleSlot.findMany({
    where: { doctorId, isArchived: false },
    select: { courseId: true },
  });

  const courseIds = Array.from(new Set(slots.map((s) => s.courseId)));
  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds } },
    select: {
      courseCode: true,
      name: true,
      credits: true,
      year: true,
      semester: true,
      department: { select: { name: true } },
      _count: { select: { enrollments: true } },
    },
  });

  return {
    status: courses.length > 0 ? 'SUCCESS' : 'EMPTY',
    hasData: courses.length > 0,
    message: courses.length > 0
      ? `You are assigned to teach ${courses.length} course(s).`
      : 'You are not assigned to any courses currently.',
    messageAr: courses.length > 0
      ? `أنت مسند لتدريس ${courses.length} مقرر.`
      : 'لا توجد مقررات مسندة لتدريسك حالياً.',
    totalTeachingCourses: courses.length,
    courses: courses.map((c) => ({
      courseCode: c.courseCode,
      courseName: c.name,
      credits: c.credits,
      year: c.year,
      semester: c.semester,
      department: c.department?.name || '',
      enrolledStudentsCount: c._count.enrollments,
    })),
  };
}

async function queryDoctorTeachingSchedule(doctorId: number, dayOfWeekFilter?: string) {
  const where: any = { doctorId, isArchived: false };
  if (dayOfWeekFilter?.trim()) {
    where.dayOfWeek = dayOfWeekFilter.trim().toUpperCase();
  }

  const slots = await prisma.scheduleSlot.findMany({
    where,
    take: 35,
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    select: {
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      room: true,
      slotType: true,
      course: { select: { courseCode: true, name: true } },
    },
  });

  const cairoDate = toCairoTime();
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;
  const currentDay = dayNames[cairoDate.getDay()];
  const mappedSlots = slots.map((s) => ({
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    room: s.room || 'TBA',
    slotType: s.slotType,
    courseCode: s.course?.courseCode || '',
    courseName: s.course?.name || '',
  }));
  const todaySlots = mappedSlots.filter((s) => s.dayOfWeek.toUpperCase() === currentDay);

  return {
    status: mappedSlots.length > 0 ? 'SUCCESS' : 'EMPTY',
    hasData: mappedSlots.length > 0,
    message: mappedSlots.length > 0
      ? `Found ${mappedSlots.length} lecture/lab slot(s) assigned to you.`
      : 'No teaching schedule slots assigned to you.',
    messageAr: mappedSlots.length > 0
      ? `تم العثور على ${mappedSlots.length} محاضرة مسندة إليك.`
      : 'لا توجد محاضرات في جدولك حالياً.',
    currentDay,
    totalSlots: mappedSlots.length,
    todaySlotsCount: todaySlots.length,
    todaySlots,
    slots: mappedSlots,
  };
}

async function queryDoctorTeachingWorkload(doctorId: number) {
  const [totalSlots, totalQuizzes, totalTasks, pendingSubmissions] = await Promise.all([
    prisma.scheduleSlot.count({ where: { doctorId, isArchived: false } }),
    prisma.quiz.count({ where: { doctorId } }),
    prisma.task.count({ where: { doctorId, isDeleted: false } }),
    prisma.taskSubmission.count({
      where: {
        score: null,
        task: { doctorId, isDeleted: false },
      },
    }),
  ]);

  return {
    status: 'SUCCESS',
    hasData: true,
    message: `Teaching workload: ${totalSlots} assigned slots, ${totalQuizzes} quizzes, ${totalTasks} tasks, ${pendingSubmissions} pending submissions to grade.`,
    messageAr: `عبء التدريس: ${totalSlots} حصة/محاضرة، ${totalQuizzes} اختبار، ${totalTasks} تكليف، ${pendingSubmissions} تسليم ينتظر التصحيح.`,
    totalAssignedSlots: totalSlots,
    totalQuizzesCreated: totalQuizzes,
    totalTasksCreated: totalTasks,
    pendingSubmissionsToGrade: pendingSubmissions,
  };
}

async function queryDoctorAttendanceOverview(_userId: number, doctorId: number) {
  const sessions = await prisma.attendanceSession.findMany({
    where: { doctorId },
    select: { id: true },
  });

  const sessionIds = sessions.map((s) => s.id);
  const stats = await prisma.attendance.groupBy({
    by: ['status'],
    where: { sessionId: { in: sessionIds } },
    _count: { _all: true },
  });

  const countFor = (status: string) => stats.find((s) => s.status === status)?._count._all ?? 0;
  const present = countFor('PRESENT');
  const absent = countFor('ABSENT');
  const late = countFor('LATE');
  const excused = countFor('EXCUSED');
  const total = present + absent + late + excused;
  const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

  return {
    status: 'SUCCESS',
    hasData: sessions.length > 0,
    message: `Attendance overview: ${sessions.length} recorded session(s) with ${rate}% attendance rate.`,
    messageAr: `إحصائيات الحضور: ${sessions.length} جلسة مسجلة بنسبة حضور إجمالية ${rate}%.`,
    totalRecordedSessions: sessions.length,
    presentCount: present,
    absentCount: absent,
    lateCount: late,
    excusedCount: excused,
    overallAttendancePercentage: rate,
  };
}

async function queryDoctorCourseRoster(
  doctorId: number,
  courseCode: string,
  page = 1,
  limit = 15,
) {
  const cleanCode = courseCode.trim();
  const assignment = await prisma.scheduleSlot.findFirst({
    where: {
      doctorId,
      isArchived: false,
      course: { courseCode: { equals: cleanCode, mode: 'insensitive' } },
    },
    select: {
      courseId: true,
      course: { select: { id: true, courseCode: true, name: true } },
    },
  });

  if (!assignment) {
    return {
      status: 'UNAUTHORIZED_SCOPE',
      hasData: false,
      message: `You are not assigned as an instructor for course code '${cleanCode}'.`,
      messageAr: `لست مسنداً كمدرس لمقرر '${cleanCode}'.`,
      courseCode: cleanCode,
      totalEnrolled: 0,
      students: [],
    };
  }

  const take = Math.min(25, Math.max(1, limit));
  const skip = (Math.max(1, page) - 1) * take;

  const [total, enrollments] = await Promise.all([
    prisma.enrollment.count({
      where: { courseId: assignment.courseId, status: 'ENROLLED' },
    }),
    prisma.enrollment.findMany({
      where: { courseId: assignment.courseId, status: 'ENROLLED' },
      skip,
      take,
      orderBy: [{ student: { firstName: 'asc' } }, { student: { lastName: 'asc' } }],
      select: {
        student: {
          select: {
            studentId: true,
            firstName: true,
            lastName: true,
            year: true,
            department: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const students = enrollments.map((e) => ({
    studentId: e.student.studentId,
    fullName: `${e.student.firstName} ${e.student.lastName}`.trim(),
    year: e.student.year,
    departmentName: e.student.department?.name || '',
  }));

  return {
    status: students.length > 0 ? 'SUCCESS' : 'EMPTY',
    hasData: students.length > 0,
    message: students.length > 0
      ? `Found ${total} student(s) enrolled in ${assignment.course.name} (${assignment.course.courseCode}).`
      : `No students currently enrolled in ${assignment.course.name}.`,
    messageAr: students.length > 0
      ? `تم العثور على ${total} طالب مسجل في مقرر ${assignment.course.name}.`
      : `لا يوجد طلاب مسجلون حالياً في مقرر ${assignment.course.name}.`,
    courseCode: assignment.course.courseCode,
    courseName: assignment.course.name,
    totalEnrolled: total,
    page,
    limit: take,
    totalPages: Math.ceil(total / take) || 1,
    students,
  };
}

// -------------------------------------------------------------
// TEACHING ASSISTANT QUERIES
// -------------------------------------------------------------

async function queryTaAssignedSections(taId: string | number) {
  const normalizedId = String(taId);
  const slots = await prisma.scheduleSlot.findMany({
    where: { teachingAssistantId: normalizedId, isArchived: false },
    select: {
      course: {
        select: {
          courseCode: true,
          name: true,
          department: { select: { name: true } },
        },
      },
      group: { select: { name: true } },
    },
  });

  const courseMap = new Map<string, { courseCode: string; courseName: string; department: string; assignedGroups: Set<string> }>();
  for (const s of slots) {
    if (!s.course) continue;
    const existing = courseMap.get(s.course.courseCode) ?? {
      courseCode: s.course.courseCode,
      courseName: s.course.name,
      department: s.course.department?.name || '',
      assignedGroups: new Set<string>(),
    };
    if (s.group?.name) existing.assignedGroups.add(s.group.name);
    courseMap.set(s.course.courseCode, existing);
  }

  const sections = Array.from(courseMap.values()).map((c) => ({
    courseCode: c.courseCode,
    courseName: c.courseName,
    department: c.department,
    assignedGroups: Array.from(c.assignedGroups),
  }));

  return {
    status: sections.length > 0 ? 'SUCCESS' : 'EMPTY',
    hasData: sections.length > 0,
    message: sections.length > 0
      ? `Assigned to ${sections.length} course section(s).`
      : 'No sections or labs assigned to you currently.',
    messageAr: sections.length > 0
      ? `أنت مسند لـ ${sections.length} شعبة/معمل.`
      : 'لا توجد شعب أو معامل مسندة إليك حالياً.',
    totalAssignedCourses: sections.length,
    sections,
  };
}

async function queryTaSchedule(taId: string | number, dayOfWeekFilter?: string) {
  const normalizedId = String(taId);
  const where: any = { teachingAssistantId: normalizedId, isArchived: false };
  if (dayOfWeekFilter?.trim()) {
    where.dayOfWeek = dayOfWeekFilter.trim().toUpperCase();
  }

  const slots = await prisma.scheduleSlot.findMany({
    where,
    take: 35,
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    select: {
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      room: true,
      slotType: true,
      course: { select: { courseCode: true, name: true } },
      group: { select: { name: true } },
    },
  });

  const cairoDate = toCairoTime();
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;
  const currentDay = dayNames[cairoDate.getDay()];
  const mappedSlots = slots.map((s) => ({
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    room: s.room || 'TBA',
    slotType: s.slotType,
    courseCode: s.course?.courseCode || '',
    courseName: s.course?.name || '',
    groupName: s.group?.name || null,
  }));
  const todaySlots = mappedSlots.filter((s) => s.dayOfWeek.toUpperCase() === currentDay);

  return {
    status: mappedSlots.length > 0 ? 'SUCCESS' : 'EMPTY',
    hasData: mappedSlots.length > 0,
    message: mappedSlots.length > 0
      ? `Found ${mappedSlots.length} lab/section slot(s) assigned to you.`
      : 'No TA schedule slots assigned to you.',
    messageAr: mappedSlots.length > 0
      ? `تم العثور على ${mappedSlots.length} معمل/سكشن مسند إليك.`
      : 'لا توجد معامل في جدولك حالياً.',
    currentDay,
    totalSlots: mappedSlots.length,
    todaySlotsCount: todaySlots.length,
    todaySlots,
    slots: mappedSlots,
  };
}

async function queryTaWorkload(taId: string | number) {
  const normalizedId = String(taId);
  const totalSlots = await prisma.scheduleSlot.count({
    where: { teachingAssistantId: normalizedId, isArchived: false },
  });
  return {
    status: 'SUCCESS',
    hasData: true,
    message: `TA workload: ${totalSlots} assigned lab slot(s).`,
    messageAr: `عبء العمل: ${totalSlots} حصة معمل/سكشن مسندة إليك.`,
    totalAssignedSlots: totalSlots,
  };
}

async function queryTaSectionStudents(
  taId: string | number,
  courseCode?: string,
  page = 1,
  limit = 15,
) {
  const normalizedId = String(taId);
  const taSlots = await prisma.scheduleSlot.findMany({
    where: {
      teachingAssistantId: normalizedId,
      isArchived: false,
      ...(courseCode ? { course: { courseCode: { equals: courseCode.trim(), mode: 'insensitive' } } } : {}),
    },
    select: {
      groupId: true,
      courseId: true,
      course: { select: { courseCode: true, name: true } },
      group: { select: { id: true, name: true } },
    },
  });

  if (taSlots.length === 0) {
    return {
      status: 'EMPTY',
      hasData: false,
      message: 'No sections or student groups assigned to you for this query.',
      messageAr: 'لا توجد شعب أو مجموعات طلابية مسندة إليك لهذا البحث.',
      totalStudents: 0,
      students: [],
    };
  }

  const groupIds = Array.from(new Set(taSlots.map((s) => s.groupId).filter(Boolean))) as number[];
  const courseIds = Array.from(new Set(taSlots.map((s) => s.courseId)));
  const take = Math.min(25, Math.max(1, limit));
  const skip = (Math.max(1, page) - 1) * take;

  const whereStudent: any = {
    AND: [
      groupIds.length > 0 ? { groupId: { in: groupIds } } : {},
      { enrollments: { some: { courseId: { in: courseIds }, status: 'ENROLLED' } } },
    ],
  };

  const [total, studentsList] = await Promise.all([
    prisma.student.count({ where: whereStudent }),
    prisma.student.findMany({
      where: whereStudent,
      skip,
      take,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: {
        studentId: true,
        firstName: true,
        lastName: true,
        year: true,
        group: { select: { name: true } },
        department: { select: { name: true } },
      },
    }),
  ]);

  const students = studentsList.map((s) => ({
    studentId: s.studentId,
    fullName: `${s.firstName} ${s.lastName}`.trim(),
    year: s.year,
    groupName: s.group?.name || 'Unassigned',
    departmentName: s.department?.name || '',
  }));

  return {
    status: students.length > 0 ? 'SUCCESS' : 'EMPTY',
    hasData: students.length > 0,
    message: students.length > 0
      ? `Found ${total} student(s) in your assigned section(s).`
      : 'No students found in your assigned sections.',
    messageAr: students.length > 0
      ? `تم العثور على ${total} طالب في السكاشن المسندة إليك.`
      : 'لا يوجد طلاب في السكاشن المسندة إليك حالياً.',
    totalStudents: total,
    page,
    limit: take,
    totalPages: Math.ceil(total / take) || 1,
    students,
  };
}

// -------------------------------------------------------------
// ADMINISTRATIVE AGGREGATES & SEARCH DIRECTORY
// -------------------------------------------------------------

async function queryAdminAcademicAnalytics(scopes: NonNullable<ReturnType<typeof getAdministrativeAnalyticsScopes>>) {
  const [totalStudents, totalCourses, yearDistribution, atRiskCount] = await Promise.all([
    prisma.student.count({ where: scopes.student }),
    prisma.course.count({ where: scopes.course }),
    prisma.student.groupBy({
      by: ['year'],
      where: scopes.student,
      _count: { _all: true },
    }),
    prisma.studentSuccessMetric.count({
      where: {
        predictedRisk: { in: ['HIGH', 'CRITICAL'] },
        student: scopes.student,
      },
    }),
  ]);

  return {
    status: 'SUCCESS',
    hasData: true,
    message: `Academic analytics: ${totalStudents} students, ${totalCourses} courses, ${atRiskCount} at-risk students.`,
    messageAr: `الإحصائيات الأكاديمية: ${totalStudents} طالب، ${totalCourses} مقرر، ${atRiskCount} طالب معرض للتعثر.`,
    totalStudents,
    totalCourses,
    atRiskStudentsCount: atRiskCount,
    studentYearDistribution: yearDistribution.map((y) => ({
      year: y.year,
      studentsCount: y._count._all,
    })),
  };
}

async function queryAdminAttendanceAnalytics(scopes: NonNullable<ReturnType<typeof getAdministrativeAnalyticsScopes>>) {
  const stats = await prisma.attendance.groupBy({
    by: ['status'],
    where: { student: scopes.student },
    _count: { _all: true },
  });

  const countFor = (status: string) => stats.find((s) => s.status === status)?._count._all ?? 0;
  const present = countFor('PRESENT');
  const absent = countFor('ABSENT');
  const late = countFor('LATE');
  const excused = countFor('EXCUSED');
  const pendingReview = countFor('PENDING_REVIEW');
  const total = present + absent + late + excused + pendingReview;
  const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

  return {
    status: 'SUCCESS',
    hasData: total > 0,
    message: `Attendance analytics: ${total} attendance records with ${rate}% overall attendance rate.`,
    messageAr: `إحصائيات الحضور: ${total} سجل حضور بنسبة حضور إجمالية ${rate}%.`,
    totalAttendanceRecords: total,
    presentCount: present,
    absentCount: absent,
    lateCount: late,
    excusedCount: excused,
    pendingReviewCount: pendingReview,
    overallAttendancePercentage: rate,
  };
}

async function queryAdminScheduleSummary(scopes: NonNullable<ReturnType<typeof getAdministrativeAnalyticsScopes>>) {
  const [totalSlots, byDay, byType] = await Promise.all([
    prisma.scheduleSlot.count({ where: { course: scopes.course, isArchived: false } }),
    prisma.scheduleSlot.groupBy({
      by: ['dayOfWeek'],
      where: { course: scopes.course, isArchived: false },
      _count: { _all: true },
    }),
    prisma.scheduleSlot.groupBy({
      by: ['slotType'],
      where: { course: scopes.course, isArchived: false },
      _count: { _all: true },
    }),
  ]);

  return {
    status: 'SUCCESS',
    hasData: totalSlots > 0,
    message: `Schedule analytics: ${totalSlots} total weekly slot(s).`,
    messageAr: `إحصائيات الجداول: إجمالي ${totalSlots} حصة/محاضرة أسبوعية.`,
    totalSlots,
    slotsByDay: byDay.map((d) => ({ dayOfWeek: d.dayOfWeek, count: d._count._all })),
    slotsByType: byType.map((t) => ({ slotType: t.slotType, count: t._count._all })),
  };
}

async function queryAdminPaymentSummary(scopes: NonNullable<ReturnType<typeof getAdministrativeAnalyticsScopes>>) {
  const [aggregates, counts] = await Promise.all([
    prisma.payment.groupBy({
      by: ['status'],
      where: { student: scopes.student },
      _sum: { amount: true },
    }),
    prisma.payment.groupBy({
      by: ['status'],
      where: { student: scopes.student },
      _count: { _all: true },
    }),
  ]);

  const sumFor = (status: string) =>
    Number(aggregates.find((a) => a.status === status)?._sum.amount ?? 0);
  const countFor = (status: string) =>
    counts.find((c) => c.status === status)?._count._all ?? 0;

  const totalCollected = sumFor('PAID');
  const totalPending = sumFor('PENDING');
  const totalOverdue = sumFor('OVERDUE');

  return {
    status: 'SUCCESS',
    hasData: true,
    message: `Financial summary: Collected: ${totalCollected}, Pending: ${totalPending}, Overdue: ${totalOverdue}.`,
    messageAr: `الملخص المالي: المحصل: ${totalCollected}، المعلق: ${totalPending}، المتأخر: ${totalOverdue}.`,
    totalCollected,
    totalPending,
    totalOverdue,
    paidPaymentsCount: countFor('PAID'),
    pendingPaymentsCount: countFor('PENDING'),
    overduePaymentsCount: countFor('OVERDUE'),
  };
}

async function queryAdminRegistrationSummary(actor: AuthActor) {
  const scopes = getAdministrativeAnalyticsScopes(actor);
  const where: any = {};
  if (actor.role === 'COLLEGE_ADMIN' && actor.managedCollegeId) {
    where.department = { collegeId: actor.managedCollegeId };
  } else if (actor.role === 'DEPARTMENT_ADMIN' && actor.managedDepartmentId) {
    where.departmentId = actor.managedDepartmentId;
  }

  const stats = await prisma.registrationRequest.groupBy({
    by: ['status'],
    where,
    _count: { _all: true },
  });

  const countFor = (status: string) => stats.find((s) => s.status === status)?._count._all ?? 0;
  const pending = countFor('PENDING');
  const approved = countFor('APPROVED');
  const rejected = countFor('REJECTED');

  return {
    status: 'SUCCESS',
    hasData: pending + approved + rejected > 0,
    message: `Registration requests: ${pending} pending, ${approved} approved, ${rejected} rejected.`,
    messageAr: `طلبات التسجيل: ${pending} معلق، ${approved} مقبول، ${rejected} مرفوض.`,
    pendingRequestsCount: pending,
    approvedRequestsCount: approved,
    rejectedRequestsCount: rejected,
    totalRequestsCount: pending + approved + rejected,
  };
}

async function searchScopedStudents(
  actor: AuthActor,
  filters: { query?: string; year?: number; departmentId?: number; page?: number; limit?: number } = {},
) {
  const baseScope = getScopeWhere(actor, 'student');
  const queryFilters: any[] = [baseScope];

  if (filters.departmentId !== undefined) {
    const deptAllowed = await prisma.department.findFirst({
      where: { AND: [{ id: filters.departmentId }, getScopeWhere(actor, 'department')] },
      select: { id: true },
    });
    if (!deptAllowed) {
      return {
        status: 'UNAUTHORIZED_SCOPE',
        hasData: false,
        message: 'The requested department is outside your authorized administrative scope.',
        messageAr: 'القسم المطلوب يقع خارج نطاق صلاحياتك الإدارية.',
        totalStudents: 0,
        page: 1,
        limit: filters.limit ?? 10,
        totalPages: 1,
        students: [],
      };
    }
    queryFilters.push({ departmentId: filters.departmentId });
  }

  if (filters.year !== undefined && filters.year >= 1 && filters.year <= 6) {
    queryFilters.push({ year: filters.year });
  }

  if (filters.query?.trim()) {
    const sanitized = filters.query.trim().slice(0, 100);
    queryFilters.push({
      OR: [
        { firstName: { contains: sanitized, mode: 'insensitive' } },
        { lastName: { contains: sanitized, mode: 'insensitive' } },
        { studentId: { contains: sanitized, mode: 'insensitive' } },
      ],
    });
  }

  const where = { AND: queryFilters };
  const take = Math.min(20, Math.max(1, Number(filters.limit) || 10));
  const page = Math.max(1, Number(filters.page) || 1);
  const skip = (page - 1) * take;

  const [total, students] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      skip,
      take,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        year: true,
        isActive: true,
        department: {
          select: {
            name: true,
            nameAr: true,
            college: { select: { name: true, nameAr: true } },
          },
        },
      },
    }),
  ]);

  const mapped = students.map((s) => ({
    id: s.id,
    studentId: s.studentId,
    fullName: `${s.firstName} ${s.lastName}`.trim(),
    year: s.year,
    departmentName: s.department?.name || '',
    collegeName: s.department?.college?.name || '',
    status: s.isActive ? 'ACTIVE' : 'INACTIVE',
  }));

  return {
    status: mapped.length > 0 ? 'SUCCESS' : 'EMPTY',
    hasData: mapped.length > 0,
    message: mapped.length > 0
      ? `Found ${total} student(s) matching your criteria.`
      : 'No students found matching your criteria within your scope.',
    messageAr: mapped.length > 0
      ? `تم العثور على ${total} طالب مطابق لمعايير البحث.`
      : 'لا يوجد طلاب مطابقون لمعايير البحث ضمن نطاق صلاحياتك.',
    totalStudents: total,
    page,
    limit: take,
    totalPages: Math.ceil(total / take) || 1,
    students: mapped,
  };
}

async function searchScopedDoctors(
  actor: AuthActor,
  filters: { query?: string; departmentId?: number; page?: number; limit?: number } = {},
) {
  const baseScope = getScopeWhere(actor, 'doctor');
  const queryFilters: any[] = [baseScope];

  if (filters.departmentId !== undefined) {
    const deptAllowed = await prisma.department.findFirst({
      where: { AND: [{ id: filters.departmentId }, getScopeWhere(actor, 'department')] },
      select: { id: true },
    });
    if (!deptAllowed) {
      return {
        status: 'UNAUTHORIZED_SCOPE',
        hasData: false,
        message: 'The requested department is outside your authorized administrative scope.',
        messageAr: 'القسم المطلوب يقع خارج نطاق صلاحياتك الإدارية.',
        totalDoctors: 0,
        page: 1,
        limit: filters.limit ?? 10,
        totalPages: 1,
        doctors: [],
      };
    }
    queryFilters.push({ departmentId: filters.departmentId });
  }

  if (filters.query?.trim()) {
    const sanitized = filters.query.trim().slice(0, 100);
    queryFilters.push({
      OR: [
        { firstName: { contains: sanitized, mode: 'insensitive' } },
        { lastName: { contains: sanitized, mode: 'insensitive' } },
        { doctorId: { contains: sanitized, mode: 'insensitive' } },
        { specialty: { contains: sanitized, mode: 'insensitive' } },
      ],
    });
  }

  const where = { AND: queryFilters };
  const take = Math.min(20, Math.max(1, Number(filters.limit) || 10));
  const page = Math.max(1, Number(filters.page) || 1);
  const skip = (page - 1) * take;

  const [total, doctors] = await Promise.all([
    prisma.doctor.count({ where }),
    prisma.doctor.findMany({
      where,
      skip,
      take,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: {
        doctorId: true,
        firstName: true,
        lastName: true,
        specialty: true,
        department: {
          select: {
            name: true,
            nameAr: true,
            college: { select: { name: true, nameAr: true } },
          },
        },
      },
    }),
  ]);

  const mapped = doctors.map((d) => ({
    doctorId: d.doctorId,
    fullName: `Dr. ${d.firstName} ${d.lastName}`.trim(),
    specialty: d.specialty || 'General',
    departmentName: d.department?.name || '',
    collegeName: d.department?.college?.name || '',
  }));

  return {
    status: mapped.length > 0 ? 'SUCCESS' : 'EMPTY',
    hasData: mapped.length > 0,
    message: mapped.length > 0
      ? `Found ${total} doctor(s) matching your criteria.`
      : 'No doctors found matching your criteria within your scope.',
    messageAr: mapped.length > 0
      ? `تم العثور على ${total} دكتور/عضو هيئة تدريس مطابق للبحث.`
      : 'لا يوجد دكاترة مطابقون للبحث ضمن نطاق صلاحياتك.',
    totalDoctors: total,
    page,
    limit: take,
    totalPages: Math.ceil(total / take) || 1,
    doctors: mapped,
  };
}

async function searchScopedCourses(
  actor: AuthActor,
  filters: { query?: string; departmentId?: number; year?: number; semester?: number; page?: number; limit?: number } = {},
) {
  const baseScope = getScopeWhere(actor, 'course');
  const queryFilters: any[] = [baseScope];

  if (filters.departmentId !== undefined) {
    const deptAllowed = await prisma.department.findFirst({
      where: { AND: [{ id: filters.departmentId }, getScopeWhere(actor, 'department')] },
      select: { id: true },
    });
    if (!deptAllowed) {
      return {
        status: 'UNAUTHORIZED_SCOPE',
        hasData: false,
        message: 'The requested department is outside your authorized administrative scope.',
        messageAr: 'القسم المطلوب يقع خارج نطاق صلاحياتك الإدارية.',
        totalCourses: 0,
        page: 1,
        limit: filters.limit ?? 10,
        totalPages: 1,
        courses: [],
      };
    }
    queryFilters.push({ departmentId: filters.departmentId });
  }

  if (filters.year !== undefined && filters.year >= 1 && filters.year <= 6) {
    queryFilters.push({ year: filters.year });
  }
  if (filters.semester !== undefined && (filters.semester === 1 || filters.semester === 2)) {
    queryFilters.push({ semester: filters.semester });
  }

  if (filters.query?.trim()) {
    const sanitized = filters.query.trim().slice(0, 100);
    queryFilters.push({
      OR: [
        { name: { contains: sanitized, mode: 'insensitive' } },
        { courseCode: { contains: sanitized, mode: 'insensitive' } },
      ],
    });
  }

  const where = { AND: queryFilters };
  const take = Math.min(20, Math.max(1, Number(filters.limit) || 10));
  const page = Math.max(1, Number(filters.page) || 1);
  const skip = (page - 1) * take;

  const [total, courses] = await Promise.all([
    prisma.course.count({ where }),
    prisma.course.findMany({
      where,
      skip,
      take,
      orderBy: [{ courseCode: 'asc' }],
      select: {
        courseCode: true,
        name: true,
        credits: true,
        year: true,
        semester: true,
        department: {
          select: {
            name: true,
            nameAr: true,
            college: { select: { name: true, nameAr: true } },
          },
        },
        _count: { select: { enrollments: true } },
      },
    }),
  ]);

  const mapped = courses.map((c) => ({
    courseCode: c.courseCode,
    name: c.name,
    credits: c.credits,
    year: c.year,
    semester: c.semester,
    departmentName: c.department?.name || '',
    collegeName: c.department?.college?.name || '',
    enrolledStudentsCount: c._count.enrollments,
  }));

  return {
    status: mapped.length > 0 ? 'SUCCESS' : 'EMPTY',
    hasData: mapped.length > 0,
    message: mapped.length > 0
      ? `Found ${total} course(s) matching your criteria.`
      : 'No courses found matching your criteria within your scope.',
    messageAr: mapped.length > 0
      ? `تم العثور على ${total} مقرر مطابق للبحث.`
      : 'لا توجد مقررات مطابقة للبحث ضمن نطاق صلاحياتك.',
    totalCourses: total,
    page,
    limit: take,
    totalPages: Math.ceil(total / take) || 1,
    courses: mapped,
  };
}

async function getScopedCourseDetails(actor: AuthActor, courseCode: string) {
  const cleanCode = courseCode.trim();
  const course = await prisma.course.findFirst({
    where: {
      AND: [
        { courseCode: { equals: cleanCode, mode: 'insensitive' } },
        getScopeWhere(actor, 'course'),
      ],
    },
    select: {
      courseCode: true,
      name: true,
      description: true,
      credits: true,
      year: true,
      semester: true,
      department: {
        select: {
          name: true,
          nameAr: true,
          college: { select: { name: true, nameAr: true } },
        },
      },
      _count: { select: { enrollments: true } },
      scheduleSlots: {
        where: { isArchived: false },
        select: {
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          room: true,
          slotType: true,
          doctor: { select: { firstName: true, lastName: true } },
          teachingAssistant: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!course) {
    return {
      status: 'EMPTY',
      hasData: false,
      message: `Course with code '${cleanCode}' was not found within your authorized scope.`,
      messageAr: `المقرر ذو الرمز '${cleanCode}' غير موجود ضمن نطاق صلاحياتك.`,
      courseCode: cleanCode,
    };
  }

  const doctors = Array.from(
    new Set(
      course.scheduleSlots
        .filter((s) => s.doctor)
        .map((s) => `Dr. ${s.doctor!.firstName} ${s.doctor!.lastName}`)
    )
  );

  const teachingAssistants = Array.from(
    new Set(
      course.scheduleSlots
        .filter((s) => s.teachingAssistant)
        .map((s) => `${s.teachingAssistant!.firstName} ${s.teachingAssistant!.lastName}`)
    )
  );

  return {
    status: 'SUCCESS',
    hasData: true,
    message: `Details for course ${course.name} (${course.courseCode}): ${course._count.enrollments} enrolled students, ${doctors.length} instructor(s).`,
    messageAr: `تفاصيل مقرر ${course.name} (${course.courseCode}): ${course._count.enrollments} طالب مسجل، ${doctors.length} دكتور/محاضر.`,
    courseCode: course.courseCode,
    name: course.name,
    description: course.description || '',
    credits: course.credits,
    year: course.year,
    semester: course.semester,
    departmentName: course.department?.name || '',
    collegeName: course.department?.college?.name || '',
    enrolledStudentsCount: course._count.enrollments,
    instructors: doctors,
    teachingAssistants,
    scheduleSlots: course.scheduleSlots.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room || 'TBA',
      slotType: s.slotType,
      instructor: s.doctor
        ? `Dr. ${s.doctor.firstName} ${s.doctor.lastName}`
        : s.teachingAssistant
        ? `${s.teachingAssistant.firstName} ${s.teachingAssistant.lastName}`
        : 'TBA',
    })),
  };
}

async function listScopedDepartments(actor: AuthActor) {
  const departments = await prisma.department.findMany({
    where: getScopeWhere(actor, 'department'),
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      nameAr: true,
      college: { select: { name: true, nameAr: true } },
      _count: {
        select: {
          students: true,
          doctors: true,
          courses: true,
        },
      },
    },
  });

  const mapped = departments.map((d) => ({
    id: d.id,
    name: d.name,
    nameAr: d.nameAr || d.name,
    collegeName: d.college?.name || '',
    studentsCount: d._count.students,
    doctorsCount: d._count.doctors,
    coursesCount: d._count.courses,
  }));

  return {
    status: mapped.length > 0 ? 'SUCCESS' : 'EMPTY',
    hasData: mapped.length > 0,
    message: `Found ${mapped.length} department(s) within your scope.`,
    messageAr: `تم العثور على ${mapped.length} قسم أكاديمي ضمن الصلاحية.`,
    totalDepartments: mapped.length,
    departments: mapped,
  };
}

// -------------------------------------------------------------
// SHARED QUERIES
// -------------------------------------------------------------

async function queryUserNotifications(userId: number) {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      title: true,
      message: true,
      type: true,
      isRead: true,
      createdAt: true,
    },
  });

  return {
    status: 'SUCCESS',
    hasData: notifications.length > 0,
    message: `Found ${notifications.length} recent notification(s).`,
    messageAr: `تم العثور على ${notifications.length} إشعار حديث.`,
    totalRecent: notifications.length,
    notifications: notifications.map((n) => ({
      title: n.title,
      message: n.message,
      type: n.type,
      isRead: n.isRead,
      date: n.createdAt.toISOString().split('T')[0],
    })),
  };
}

// -------------------------------------------------------------
// TOOL DEPENDENCIES & DISPATCH
// -------------------------------------------------------------

export const defaultDependencies = {
  // Student
  studentAcademicSummary: (studentId: number) => queryStudentAcademicSummary(studentId),
  studentCourses: (studentId: number) => queryStudentCourses(studentId),
  attendance: (userId: number, options: { page: number; limit: number }) => AttendanceService.getMyAttendance(userId, options),
  studentSchedule: (actor: AuthActor, dayOfWeek?: string) => queryStudentSchedule(actor, dayOfWeek),
  tasks: (actor: AuthActor, courseId: undefined, options: { page: number; limit: number }) => TaskQueriesService.getTasks(actor, courseId, options),
  studentExams: (studentId: number) => queryStudentExams(studentId),
  studentPayments: (studentId: number) => queryStudentPayments(studentId),

  // Doctor
  doctorCourses: (doctorId: number) => queryDoctorTeachingCourses(doctorId),
  doctorSchedule: (doctorId: number, dayOfWeek?: string) => queryDoctorTeachingSchedule(doctorId, dayOfWeek),
  doctorWorkload: (doctorId: number) => queryDoctorTeachingWorkload(doctorId),
  doctorAttendance: (userId: number, doctorId: number) => queryDoctorAttendanceOverview(userId, doctorId),
  doctorCourseRoster: (doctorId: number, courseCode: string, page?: number, limit?: number) =>
    queryDoctorCourseRoster(doctorId, courseCode, page, limit),

  // TA
  taSections: (taId: string | number) => queryTaAssignedSections(taId),
  taSchedule: (taId: string | number, dayOfWeek?: string) => queryTaSchedule(taId, dayOfWeek),
  taWorkload: (taId: string | number) => queryTaWorkload(taId),
  taSectionStudents: (taId: string | number, courseCode?: string, page?: number, limit?: number) =>
    queryTaSectionStudents(taId, courseCode, page, limit),

  // Admin
  adminSummary: (actor: AuthActor) => getScopedUniversityCounts(actor),
  adminAcademic: (scopes: NonNullable<ReturnType<typeof getAdministrativeAnalyticsScopes>>) => queryAdminAcademicAnalytics(scopes),
  adminAttendance: (scopes: NonNullable<ReturnType<typeof getAdministrativeAnalyticsScopes>>) => queryAdminAttendanceAnalytics(scopes),
  adminSchedule: (scopes: NonNullable<ReturnType<typeof getAdministrativeAnalyticsScopes>>) => queryAdminScheduleSummary(scopes),
  adminPayments: (scopes: NonNullable<ReturnType<typeof getAdministrativeAnalyticsScopes>>) => queryAdminPaymentSummary(scopes),
  adminRegistrations: (actor: AuthActor) => queryAdminRegistrationSummary(actor),
  adminSearchStudents: (actor: AuthActor, filters: any) => searchScopedStudents(actor, filters),
  adminSearchDoctors: (actor: AuthActor, filters: any) => searchScopedDoctors(actor, filters),
  adminSearchCourses: (actor: AuthActor, filters: any) => searchScopedCourses(actor, filters),
  adminCourseDetails: (actor: AuthActor, courseCode: string) => getScopedCourseDetails(actor, courseCode),
  adminDepartments: (actor: AuthActor) => listScopedDepartments(actor),

  // Cross-Domain Composite Analytics
  studentPriorityOverview: (actor: AuthActor) => queryStudentPriorityOverview(actor),
  studentWeeklyOverview: (actor: AuthActor) => queryStudentWeeklyOverview(actor),
  doctorTeachingInsights: (actor: AuthActor) => queryDoctorTeachingInsights(actor),
  taSectionInsights: (actor: AuthActor) => queryTaSectionInsights(actor),
  adminOperationalInsights: (actor: AuthActor) => queryAdminOperationalInsights(actor),
  compareScopedDepartments: (actor: AuthActor, departmentIds?: number[]) =>
    compareScopedDepartments(actor, departmentIds),

  // Shared
  notifications: (userId: number) => queryUserNotifications(userId),
  knowledge: (actor: AuthActor, query: string, docType?: string) =>
    queryUniversityRegulations(actor, query, docType),
  proposeAction: (actor: AuthActor, type: SupportedActionType, args: any, options?: ProposalCreationOptions) =>
    proposeAction(actor, type, args, options),
};

async function queryUniversityRegulations(actor: AuthActor, query: string, documentType?: string) {
  const result = await retrieveKnowledgeChunks({
    actor,
    query,
    documentType,
    topK: 4,
  });

  if (result.chunks.length === 0) {
    return {
      status: 'EMPTY',
      hasData: false,
      message: `No official university regulations found matching: "${query}".`,
      messageAr: `لم يتم العثور على لوائح أو نصوص رسمية مطابقة للاستفسار: "${query}".`,
      query,
      sourcesCount: 0,
      sources: [],
    };
  }

  return {
    status: 'SUCCESS',
    hasData: true,
    message: `Retrieved ${result.chunks.length} excerpts from official university regulations.`,
    messageAr: `تم استرجاع ${result.chunks.length} مقتطفات رسمية من لوائح وقواعد الجامعة المعتمدة.`,
    query,
    hasPotentialConflict: result.hasPotentialConflict,
    sourcesCount: result.chunks.length,
    sources: result.chunks.map((c) => ({
      documentTitle: c.documentTitle,
      documentTitleAr: c.documentTitleAr,
      version: c.version,
      pageNumber: c.pageNumber,
      sectionTitle: c.sectionTitle,
      articleNumber: c.articleNumber,
      documentVersionId: c.documentVersionId,
      chunkId: c.chunkId,
      // Prompt injection defense: Wrap excerpt in explicit boundaries
      excerpt: `<untrusted_university_document_excerpt source="${c.documentTitle}" version="${c.version}">\n${c.content}\n</untrusted_university_document_excerpt>`,
    })),
  };
}

export async function executeAiTool(
  name: string,
  argumentJson: string,
  actor: AuthActor,
  deps: typeof defaultDependencies = defaultDependencies,
  toolContext?: { conversationId?: string; sourceUserMessageId?: string },
): Promise<Record<string, unknown>> {
  const allowedTools = getAllowedAiTools(actor);
  const toolDef = allowedTools.find((tool) => tool.name === name);
  if (!toolDef) {
    logger.warn('[AI] tool rejected', { userId: actor.id, role: actor.role, tool: 'unavailable', requested: name, success: false });
    throw new Error('AI tool unavailable');
  }

  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argumentJson);
  } catch {
    logger.warn('[AI] tool arguments rejected', { userId: actor.id, role: actor.role, tool: name, success: false });
    throw new Error('Invalid AI tool arguments');
  }

  if (args === null || typeof args !== 'object' || Array.isArray(args)) {
    logger.warn('[AI] tool arguments rejected', { userId: actor.id, role: actor.role, tool: name, success: false });
    throw new Error('Invalid AI tool arguments');
  }

  // Schema-level validation against tool's allowed parameters
  const declaredProperties = toolDef.parameters && typeof toolDef.parameters === 'object' && 'properties' in toolDef.parameters
    ? Object.keys(toolDef.parameters.properties as Record<string, unknown>)
    : [];

  for (const key of Object.keys(args)) {
    if (!declaredProperties.includes(key)) {
      logger.warn('[AI] tool arguments rejected: unexpected property', { userId: actor.id, role: actor.role, tool: name, key, success: false });
      throw new Error('Invalid AI tool arguments');
    }
  }

  const startedAt = Date.now();
  try {
    let result: Record<string, unknown>;
    switch (name as ToolName) {
      // Student Tools
      case 'get_my_academic_summary': {
        const data = await deps.studentAcademicSummary(actor.student!.id) as any;
        result = {
          status: 'SUCCESS',
          hasData: true,
          cumulativeGpa: data.cumulativeGpa,
          totalCreditsEarned: data.totalCreditsEarned,
          totalCreditsAttempted: data.totalCreditsAttempted,
          coursesCount: data.coursesCount,
          year: data.year,
          departmentName: data.departmentName,
          collegeName: data.collegeName,
          predictedRisk: data.predictedRisk,
          attendanceRate: data.attendanceRate,
          recentCourses: Array.isArray(data.recentCourses)
            ? data.recentCourses.slice(-10).map((c: any) => ({
                courseCode: c.courseCode,
                courseName: c.courseName,
                finalGrade: c.finalGrade,
                status: c.status,
              }))
            : [],
        };
        break;
      }
      case 'get_my_courses': {
        result = await deps.studentCourses(actor.student!.id);
        break;
      }
      case 'get_my_attendance_summary': {
        const data = await deps.attendance(actor.id, { page: 1, limit: 1 });
        const stats = data.stats;
        result = {
          status: 'SUCCESS',
          hasData: stats.total > 0,
          present: stats.PRESENT,
          absent: stats.ABSENT,
          late: stats.LATE,
          excused: stats.EXCUSED,
          pendingReview: stats.PENDING_REVIEW,
          total: stats.total,
          attendancePercentage: stats.attendancePercentage,
        };
        break;
      }
      case 'get_my_schedule': {
        const dayFilter = typeof args.dayOfWeek === 'string' ? args.dayOfWeek : undefined;
        result = await deps.studentSchedule(actor, dayFilter);
        break;
      }
      case 'get_my_tasks': {
        const data = await deps.tasks(actor, undefined, { page: 1, limit: 10 });
        const now = new Date();
        const mapped = data.rows.slice(0, 10).map((task) => ({
          title: task.title,
          dueDate: task.dueDate,
          courseCode: task.course.courseCode,
          courseName: task.course.name,
        }));
        const overdue = mapped.filter((t) => new Date(t.dueDate) < now);
        const upcoming = mapped.filter((t) => new Date(t.dueDate) >= now);
        result = {
          status: mapped.length > 0 ? 'SUCCESS' : 'EMPTY',
          hasData: mapped.length > 0,
          totalCount: data.pagination.totalCount,
          overdueCount: overdue.length,
          upcomingCount: upcoming.length,
          overdueTasks: overdue,
          upcomingTasks: upcoming,
          tasks: mapped,
        };
        break;
      }
      case 'get_my_exams': {
        result = await deps.studentExams(actor.student!.id);
        break;
      }
      case 'get_my_payments': {
        result = await deps.studentPayments(actor.student!.id);
        break;
      }
      case 'get_my_priority_overview': {
        result = await deps.studentPriorityOverview(actor);
        break;
      }
      case 'get_my_weekly_overview': {
        result = await deps.studentWeeklyOverview(actor);
        break;
      }

      // Doctor Tools
      case 'get_my_teaching_courses': {
        result = await deps.doctorCourses(actor.doctor!.id);
        break;
      }
      case 'get_my_teaching_schedule': {
        const dayFilter = typeof args.dayOfWeek === 'string' ? args.dayOfWeek : undefined;
        result = await deps.doctorSchedule(actor.doctor!.id, dayFilter);
        break;
      }
      case 'get_my_teaching_workload': {
        result = await deps.doctorWorkload(actor.doctor!.id);
        break;
      }
      case 'get_my_course_attendance_overview': {
        result = await deps.doctorAttendance(actor.id, actor.doctor!.id);
        break;
      }
      case 'get_my_course_roster': {
        if (!args.courseCode || typeof args.courseCode !== 'string') {
          throw new Error('Invalid AI tool arguments');
        }
        const page = typeof args.page === 'number' ? args.page : 1;
        const limit = typeof args.limit === 'number' ? args.limit : 15;
        result = await deps.doctorCourseRoster(actor.doctor!.id, args.courseCode, page, limit);
        break;
      }
      case 'get_my_teaching_insights': {
        result = await deps.doctorTeachingInsights(actor);
        break;
      }

      // Teaching Assistant Tools
      case 'get_my_assigned_sections': {
        result = await deps.taSections(actor.teachingAssistant!.id);
        break;
      }
      case 'get_my_ta_schedule': {
        const dayFilter = typeof args.dayOfWeek === 'string' ? args.dayOfWeek : undefined;
        result = await deps.taSchedule(actor.teachingAssistant!.id, dayFilter);
        break;
      }
      case 'get_my_ta_workload': {
        result = await deps.taWorkload(actor.teachingAssistant!.id);
        break;
      }
      case 'get_my_section_students': {
        const courseCode = typeof args.courseCode === 'string' ? args.courseCode : undefined;
        const page = typeof args.page === 'number' ? args.page : 1;
        const limit = typeof args.limit === 'number' ? args.limit : 15;
        result = await deps.taSectionStudents(actor.teachingAssistant!.id, courseCode, page, limit);
        break;
      }
      case 'get_my_section_insights': {
        result = await deps.taSectionInsights(actor);
        break;
      }

      // Administrative Tools
      case 'get_scoped_university_summary': {
        result = await deps.adminSummary(actor);
        break;
      }
      case 'get_scoped_academic_analytics': {
        const scopes = getAdministrativeAnalyticsScopes(actor)!;
        result = await deps.adminAcademic(scopes);
        break;
      }
      case 'get_scoped_attendance_analytics': {
        const scopes = getAdministrativeAnalyticsScopes(actor)!;
        result = await deps.adminAttendance(scopes);
        break;
      }
      case 'get_scoped_schedule_summary': {
        const scopes = getAdministrativeAnalyticsScopes(actor)!;
        result = await deps.adminSchedule(scopes);
        break;
      }
      case 'get_scoped_payment_summary': {
        const scopes = getAdministrativeAnalyticsScopes(actor)!;
        result = await deps.adminPayments(scopes);
        break;
      }
      case 'get_scoped_registration_summary': {
        result = await deps.adminRegistrations(actor);
        break;
      }
      case 'search_scoped_students': {
        result = await deps.adminSearchStudents(actor, args);
        break;
      }
      case 'search_scoped_doctors': {
        result = await deps.adminSearchDoctors(actor, args);
        break;
      }
      case 'search_scoped_courses': {
        result = await deps.adminSearchCourses(actor, args);
        break;
      }
      case 'get_scoped_course_details': {
        if (!args.courseCode || typeof args.courseCode !== 'string') {
          throw new Error('Invalid AI tool arguments');
        }
        result = await deps.adminCourseDetails(actor, args.courseCode);
        break;
      }
      case 'list_scoped_departments': {
        result = await deps.adminDepartments(actor);
        break;
      }
      case 'get_scoped_operational_insights': {
        result = await deps.adminOperationalInsights(actor);
        break;
      }
      case 'compare_scoped_departments': {
        const departmentIds = Array.isArray(args.departmentIds)
          ? (args.departmentIds.filter((id) => typeof id === 'number') as number[])
          : undefined;
        result = await deps.compareScopedDepartments(actor, departmentIds);
        break;
      }

      // Shared Tools
      case 'get_my_notifications': {
        result = await deps.notifications(actor.id);
        break;
      }
      case 'search_university_regulations': {
        const query = typeof args.query === 'string' ? args.query : '';
        const docType = typeof args.documentType === 'string' ? args.documentType : undefined;
        result = await deps.knowledge(actor, query, docType);
        break;
      }

      // Action Proposal Tools (Zero Business Mutation)
      case 'propose_create_task': {
        try {
          result = await deps.proposeAction(actor, 'CREATE_TASK', args, toolContext);
        } catch (proposalErr: any) {
          if (proposalErr?.statusCode && proposalErr.statusCode < 500) {
            result = {
              status: 'REJECTED',
              requiresConfirmation: false,
              reason: proposalErr.message,
            };
            break;
          }
          throw proposalErr;
        }
        break;
      }
      case 'propose_mark_notification_read': {
        try {
          result = await deps.proposeAction(actor, 'MARK_NOTIFICATION_READ', args, toolContext);
        } catch (proposalErr: any) {
          if (proposalErr?.statusCode && proposalErr.statusCode < 500) {
            result = {
              status: 'REJECTED',
              requiresConfirmation: false,
              reason: proposalErr.message,
            };
            break;
          }
          throw proposalErr;
        }
        break;
      }
      case 'propose_scoped_announcement': {
        try {
          result = await deps.proposeAction(actor, 'CREATE_ANNOUNCEMENT', args, toolContext);
        } catch (proposalErr: any) {
          if (proposalErr?.statusCode && proposalErr.statusCode < 500) {
            result = {
              status: 'REJECTED',
              requiresConfirmation: false,
              reason: proposalErr.message,
            };
            break;
          }
          throw proposalErr;
        }
        break;
      }

      default:
        throw new Error('AI tool unavailable');
    }

    logger.info('[AI] tool completed', {
      userId: actor.id,
      role: actor.role,
      tool: name,
      success: true,
      latencyMs: Date.now() - startedAt,
    });
    return result;
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Invalid AI tool arguments') {
      throw err;
    }
    logger.warn('[AI] tool failed', {
      userId: actor.id,
      role: actor.role,
      tool: name,
      success: false,
      latencyMs: Date.now() - startedAt,
    });
    throw new Error('AI tool temporarily unavailable');
  }
}
