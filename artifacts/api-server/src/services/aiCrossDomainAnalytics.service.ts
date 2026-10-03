import prisma from '../utils/prismaClient';
import type { AuthActor } from '../types/auth.types';
import { calculateStudentGpa } from '../utils/gpa.utils';
import { getAdministrativeAnalyticsScopes } from '../utils/administrativeAnalyticsScope.utils';
import { getScopeWhere } from '../utils/scope.utils';
import { toCairoTime, fromCairoTime, formatCairoDateTime } from '../utils/timezone.utils';

// ============================================================================
// 1. DATA QUALITY & STANDING ENUMS
// ============================================================================

export type QualityState = 'AVAILABLE' | 'NO_DATA' | 'PARTIAL_DATA';
export type AttentionPriority = 'HIGH_ATTENTION' | 'MEDIUM_ATTENTION' | 'NORMAL';

// ============================================================================
// OPERATIONAL ATTENTION HEURISTICS (INTERNAL PRODUCT CONVENTIONS, NOT BYLAWS)
// ============================================================================
export const OPERATIONAL_ATTENTION_HEURISTICS = {
  LOW_ATTENDANCE_ATTENTION_RATE: 75, // Operational review threshold for advising follow-up
  APPROACHING_ATTENDANCE_ATTENTION_RATE: 82, // Operational threshold for approaching low attendance
  EXAM_HIGH_ATTENTION_DAYS: 3,
  EXAM_MEDIUM_ATTENTION_DAYS: 7,
  TASK_MEDIUM_ATTENTION_COUNT: 2,
  LOW_GPA_ATTENTION_THRESHOLD: 2.0, // Operational advising review threshold (NOT official policy warning)
  HIGH_GPA_BENCHMARK: 3.4,
  DEPARTMENT_LOW_GPA_BENCHMARK: 2.2, // Department operational review benchmark
} as const;

// Helper: parse "HH:MM" into total minutes from midnight for collision detection
export function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

// Helper: check if two time windows [s1, e1) and [s2, e2) actually overlap
export function doTimesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const s1 = parseTimeToMinutes(start1);
  const e1 = parseTimeToMinutes(end1);
  const s2 = parseTimeToMinutes(start2);
  const e2 = parseTimeToMinutes(end2);
  if (s1 === null || e1 === null || s2 === null || e2 === null) return false;
  // Overlap condition: max(s1, s2) < min(e1, e2)
  return Math.max(s1, s2) < Math.min(e1, e2);
}

// ============================================================================
// 2. STUDENT PRIORITY OVERVIEW (DETERMINISTIC)
// ============================================================================

export interface StudentCoursePriorityItem {
  courseId: number;
  courseCode: string;
  courseName: string;
  credits: number;
  attendanceRate: number | null;
  attendanceQuality: 'AVAILABLE' | 'NO_DATA';
  totalSessions: number;
  attendedSessions: number;
  absenceCount: number;
  overdueTasksCount: number;
  upcomingTasksCount: number;
  nearestExam: {
    title: string;
    type: string;
    date: string;
    daysUntil: number;
  } | null;
  priorityState: AttentionPriority;
  factors: string[];
  factorsAr: string[];
}

export interface StudentPriorityOverviewResult {
  [key: string]: unknown;
  status: 'SUCCESS' | 'EMPTY';
  hasData: boolean;
  priorityState: AttentionPriority;
  summary: string;
  summaryAr: string;
  overallStanding: {
    gpa: number;
    gpaString: string;
    standingStatus: 'EXCELLENT' | 'GOOD' | 'ACADEMIC_WARNING' | 'NO_GRADES_YET';
    totalCreditsEarned: number;
    totalCreditsAttempted: number;
    enrolledCoursesCount: number;
    financialBlocker: boolean;
    overduePaymentsCount: number;
    overdueAmount: number;
  };
  overallAttendance: {
    rate: number | null;
    quality: 'AVAILABLE' | 'NO_DATA';
    totalSessions: number;
    attendedSessions: number;
    absenceCount: number;
  };
  urgentActions: {
    type: 'EXAM' | 'OVERDUE_TASK' | 'ATTENDANCE_WARNING' | 'PAYMENT_BLOCKER';
    title: string;
    titleAr: string;
    courseCode?: string;
    detail: string;
    detailAr: string;
  }[];
  courses: StudentCoursePriorityItem[];
  timeWindow: {
    asOfDate: string;
    cairoTimezone: 'Africa/Cairo';
  };
}

export async function queryStudentPriorityOverview(actor: AuthActor): Promise<StudentPriorityOverviewResult> {
  const student = await prisma.student.findUnique({
    where: { userId: actor.id },
    select: { id: true, studentId: true, year: true, departmentId: true },
  });

  const nowCairo = toCairoTime();
  const todayStr = formatCairoDateTime(nowCairo, 'yyyy-MM-dd');
  const nowUtc = new Date();

  if (!student) {
    return {
      status: 'EMPTY',
      hasData: false,
      priorityState: 'NORMAL',
      summary: 'Student profile not found.',
      summaryAr: 'لم يتم العثور على ملف الطالب.',
      overallStanding: {
        gpa: 0,
        gpaString: '0.00',
        standingStatus: 'NO_GRADES_YET',
        totalCreditsEarned: 0,
        totalCreditsAttempted: 0,
        enrolledCoursesCount: 0,
        financialBlocker: false,
        overduePaymentsCount: 0,
        overdueAmount: 0,
      },
      overallAttendance: {
        rate: null,
        quality: 'NO_DATA',
        totalSessions: 0,
        attendedSessions: 0,
        absenceCount: 0,
      },
      urgentActions: [],
      courses: [],
      timeWindow: {
        asOfDate: todayStr,
        cairoTimezone: 'Africa/Cairo',
      },
    };
  }

  // Parallel fetch: enrollments, GPA, attendance, tasks, exams, payments
  const [enrollments, gpaData, attendanceRecords, tasks, exams, payments] = await Promise.all([
    prisma.enrollment.findMany({
      where: { studentId: student.id, status: 'ENROLLED' },
      select: {
        id: true,
        courseId: true,
        status: true,
        course: {
          select: {
            id: true,
            courseCode: true,
            name: true,
            credits: true,
          },
        },
      },
    }),
    calculateStudentGpa(student.id),
    prisma.attendance.findMany({
      where: { studentId: student.id },
      select: {
        courseId: true,
        status: true,
      },
    }),
    prisma.task.findMany({
      where: {
        isDeleted: false,
        course: {
          enrollments: { some: { studentId: student.id, status: 'ENROLLED' } },
        },
      },
      select: {
        id: true,
        title: true,
        courseId: true,
        dueDate: true,
        submissions: {
          where: { studentId: student.id },
          select: { id: true, score: true, submittedAt: true },
        },
      },
    }),
    prisma.exam.findMany({
      where: {
        date: { gte: nowUtc },
        course: {
          enrollments: { some: { studentId: student.id, status: 'ENROLLED' } },
        },
      },
      orderBy: { date: 'asc' },
      select: {
        id: true,
        courseId: true,
        title: true,
        type: true,
        date: true,
        startTime: true,
        endTime: true,
        room: true,
      },
    }),
    prisma.payment.findMany({
      where: { studentId: student.id },
      select: {
        id: true,
        amount: true,
        status: true,
        type: true,
      },
    }),
  ]);

  // Aggregate payments
  const overduePayments = payments.filter((p) => p.status === 'OVERDUE');
  const overdueAmount = overduePayments.reduce((acc, p) => acc + Number(p.amount), 0);
  const financialBlocker = overduePayments.length > 0;

  // Group attendance by courseId
  const attendanceByCourse = new Map<number, { present: number; absent: number; late: number; total: number }>();
  let overallPresent = 0;
  let overallAbsent = 0;
  let overallLate = 0;
  let overallTotal = 0;

  for (const rec of attendanceRecords) {
    let stat = attendanceByCourse.get(rec.courseId);
    if (!stat) {
      stat = { present: 0, absent: 0, late: 0, total: 0 };
      attendanceByCourse.set(rec.courseId, stat);
    }
    stat.total++;
    overallTotal++;
    if (rec.status === 'PRESENT') {
      stat.present++;
      overallPresent++;
    } else if (rec.status === 'ABSENT') {
      stat.absent++;
      overallAbsent++;
    } else if (rec.status === 'LATE') {
      stat.late++;
      overallLate++;
    }
  }

  const overallAttendanceRate = overallTotal > 0
    ? Math.round(((overallPresent + overallLate) / overallTotal) * 100)
    : null;

  // Evaluate each enrolled course deterministically
  const courseItems: StudentCoursePriorityItem[] = [];
  const urgentActions: StudentPriorityOverviewResult['urgentActions'] = [];

  let highestPriorityFound: AttentionPriority = 'NORMAL';

  for (const enr of enrollments) {
    const courseId = enr.courseId;
    const attStat = attendanceByCourse.get(courseId);
    const hasAttRecords = attStat && attStat.total > 0;
    const courseAttRate = hasAttRecords
      ? Math.round(((attStat.present + attStat.late) / attStat.total) * 100)
      : null;

    // Course tasks
    const courseTasks = tasks.filter((t) => t.courseId === courseId);
    const overdueTasks = courseTasks.filter((t) => {
      const hasSubmission = t.submissions.length > 0;
      return !hasSubmission && new Date(t.dueDate) < nowUtc;
    });
    const upcomingTasks = courseTasks.filter((t) => {
      const diffMs = new Date(t.dueDate).getTime() - nowUtc.getTime();
      return diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
    });

    // Course nearest exam
    const courseExams = exams.filter((e) => e.courseId === courseId);
    let nearestExam: StudentCoursePriorityItem['nearestExam'] = null;
    if (courseExams.length > 0) {
      const firstExam = courseExams[0];
      const daysUntil = Math.ceil((new Date(firstExam.date).getTime() - nowUtc.getTime()) / (24 * 60 * 60 * 1000));
      nearestExam = {
        title: firstExam.title || `${firstExam.type} Exam`,
        type: firstExam.type,
        date: firstExam.date.toISOString().split('T')[0],
        daysUntil: Math.max(0, daysUntil),
      };
    }

    // Deterministic explainable factors for this course
    const factors: string[] = [];
    const factorsAr: string[] = [];
    let coursePriority: AttentionPriority = 'NORMAL';

    // 1. High Attention Conditions (Operational review heuristics)
    if (hasAttRecords && courseAttRate! < OPERATIONAL_ATTENTION_HEURISTICS.LOW_ATTENDANCE_ATTENTION_RATE) {
      coursePriority = 'HIGH_ATTENTION';
      factors.push(`Attendance rate is ${courseAttRate}% (operational review heuristic below ${OPERATIONAL_ATTENTION_HEURISTICS.LOW_ATTENDANCE_ATTENTION_RATE}%).`);
      factorsAr.push(`نسبة الحضور ${courseAttRate}% (مؤشر متابعة تشغيلي أقل من ${OPERATIONAL_ATTENTION_HEURISTICS.LOW_ATTENDANCE_ATTENTION_RATE}%).`);
      urgentActions.push({
        type: 'ATTENDANCE_WARNING',
        title: `Attendance Review: ${enr.course.courseCode}`,
        titleAr: `متابعة تشغيلية لنسبة الحضور في ${enr.course.courseCode}`,
        courseCode: enr.course.courseCode,
        detail: `Attendance is ${courseAttRate}% with ${attStat!.absent} absences. Official absence disqualification is governed by college bylaws.`,
        detailAr: `نسبة الحضور ${courseAttRate}% بعدد ${attStat!.absent} غيابات. تحديد الحرمان الفعلي يخضع للائحة الكلية المعتمدة.`,
      });
    }

    if (overdueTasks.length > 0) {
      coursePriority = 'HIGH_ATTENTION';
      factors.push(`${overdueTasks.length} overdue task(s) unsubmitted.`);
      factorsAr.push(`يوجد ${overdueTasks.length} تكليف متأخر لم يتم تسليمه.`);
      for (const ot of overdueTasks) {
        urgentActions.push({
          type: 'OVERDUE_TASK',
          title: `Overdue task: ${ot.title}`,
          titleAr: `تكليف متأخر: ${ot.title}`,
          courseCode: enr.course.courseCode,
          detail: `Due on ${ot.dueDate.toISOString().split('T')[0]}.`,
          detailAr: `كان موعد التسليم في ${ot.dueDate.toISOString().split('T')[0]}.`,
        });
      }
    }

    if (nearestExam && nearestExam.daysUntil <= OPERATIONAL_ATTENTION_HEURISTICS.EXAM_HIGH_ATTENTION_DAYS) {
      if (coursePriority !== 'HIGH_ATTENTION') {
        coursePriority = 'HIGH_ATTENTION';
      }
      factors.push(`Upcoming ${nearestExam.type} exam in ${nearestExam.daysUntil} day(s).`);
      factorsAr.push(`امتحان ${nearestExam.type} قادم خلال ${nearestExam.daysUntil} يوم.`);
      urgentActions.push({
        type: 'EXAM',
        title: `${nearestExam.type} Exam: ${enr.course.name}`,
        titleAr: `امتحان ${nearestExam.type}: ${enr.course.name}`,
        courseCode: enr.course.courseCode,
        detail: `Scheduled on ${nearestExam.date} (in ${nearestExam.daysUntil} days).`,
        detailAr: `موعد الامتحان في ${nearestExam.date} (خلال ${nearestExam.daysUntil} أيام).`,
      });
    } else if (nearestExam && nearestExam.daysUntil <= OPERATIONAL_ATTENTION_HEURISTICS.EXAM_MEDIUM_ATTENTION_DAYS) {
      if (coursePriority === 'NORMAL') {
        coursePriority = 'MEDIUM_ATTENTION';
      }
      factors.push(`Upcoming ${nearestExam.type} exam within a week (${nearestExam.daysUntil} days).`);
      factorsAr.push(`امتحان ${nearestExam.type} قادم خلال أسبوع (${nearestExam.daysUntil} أيام).`);
    }

    // 2. Medium Attention Conditions
    if (coursePriority === 'NORMAL') {
      if (
        hasAttRecords &&
        courseAttRate! >= OPERATIONAL_ATTENTION_HEURISTICS.LOW_ATTENDANCE_ATTENTION_RATE &&
        courseAttRate! <= OPERATIONAL_ATTENTION_HEURISTICS.APPROACHING_ATTENDANCE_ATTENTION_RATE
      ) {
        coursePriority = 'MEDIUM_ATTENTION';
        factors.push(`Attendance rate is ${courseAttRate}% (approaching operational review threshold).`);
        factorsAr.push(`نسبة الحضور ${courseAttRate}% (تقترب من الحد الاسترشادي للمتابعة).`);
      }
      if (upcomingTasks.length >= OPERATIONAL_ATTENTION_HEURISTICS.TASK_MEDIUM_ATTENTION_COUNT) {
        coursePriority = 'MEDIUM_ATTENTION';
        factors.push(`${upcomingTasks.length} upcoming tasks due within 7 days.`);
        factorsAr.push(`يوجد ${upcomingTasks.length} تكليفات مستحقة خلال الأسبوع القادم.`);
      }
    }

    if (factors.length === 0) {
      factors.push('All course metrics (attendance, deadlines, exams) are in healthy standing.');
      factorsAr.push('جميع مؤشرات المقرر (الحضور، التكليفات، الاختبارات) في وضع مستقر وجيد.');
    }

    if (coursePriority === 'HIGH_ATTENTION') {
      highestPriorityFound = 'HIGH_ATTENTION';
    } else if (coursePriority === 'MEDIUM_ATTENTION' && highestPriorityFound !== 'HIGH_ATTENTION') {
      highestPriorityFound = 'MEDIUM_ATTENTION';
    }

    courseItems.push({
      courseId,
      courseCode: enr.course.courseCode,
      courseName: enr.course.name,
      credits: enr.course.credits,
      attendanceRate: courseAttRate,
      attendanceQuality: hasAttRecords ? 'AVAILABLE' : 'NO_DATA',
      totalSessions: attStat?.total ?? 0,
      attendedSessions: (attStat?.present ?? 0) + (attStat?.late ?? 0),
      absenceCount: attStat?.absent ?? 0,
      overdueTasksCount: overdueTasks.length,
      upcomingTasksCount: upcomingTasks.length,
      nearestExam,
      priorityState: coursePriority,
      factors,
      factorsAr,
    });
  }

  // Account for financial blocker in overall priority
  if (financialBlocker) {
    highestPriorityFound = 'HIGH_ATTENTION';
    urgentActions.push({
      type: 'PAYMENT_BLOCKER',
      title: 'Overdue Tuition Payment',
      titleAr: 'رسوم دراسية متأخرة السداد',
      detail: `${overduePayments.length} overdue payment(s) totaling ${overdueAmount} EGP.`,
      detailAr: `يوجد ${overduePayments.length} رسوم متأخرة بإجمالي ${overdueAmount} جنيه.`,
    });
  }

  // Account for low GPA (Operational advising review heuristic; official warning rules depend on Knowledge Base regulations)
  let standingStatus: StudentPriorityOverviewResult['overallStanding']['standingStatus'] = 'GOOD';
  if (gpaData.coursesCount === 0 && gpaData.totalCreditsEarned === 0) {
    standingStatus = 'NO_GRADES_YET';
  } else if (gpaData.cumulativeGpa >= OPERATIONAL_ATTENTION_HEURISTICS.HIGH_GPA_BENCHMARK) {
    standingStatus = 'EXCELLENT';
  } else if (gpaData.cumulativeGpa < OPERATIONAL_ATTENTION_HEURISTICS.LOW_GPA_ATTENTION_THRESHOLD) {
    standingStatus = 'ACADEMIC_WARNING';
    if (highestPriorityFound === 'NORMAL') {
      highestPriorityFound = 'MEDIUM_ATTENTION';
    }
  }

  // Sort courses: HIGH_ATTENTION first, then MEDIUM_ATTENTION, then NORMAL
  const priorityRank = { HIGH_ATTENTION: 0, MEDIUM_ATTENTION: 1, NORMAL: 2 };
  courseItems.sort((a, b) => priorityRank[a.priorityState] - priorityRank[b.priorityState]);

  const summary = highestPriorityFound === 'HIGH_ATTENTION'
    ? `Action required: ${urgentActions.length} item(s) require immediate attention (attendance warnings, upcoming exams, or overdue tasks).`
    : highestPriorityFound === 'MEDIUM_ATTENTION'
    ? 'Moderate attention recommended: upcoming exams or tasks in the coming days.'
    : 'Your academic status is on track with steady attendance and no urgent overdue tasks.';

  const summaryAr = highestPriorityFound === 'HIGH_ATTENTION'
    ? `يتطلب الوضع اهتماماً فورياً: ${urgentActions.length} عناصر تحتاج للمتابعة (إنذارات حضور، امتحانات قريبة، أو تكليفات متأخرة).`
    : highestPriorityFound === 'MEDIUM_ATTENTION'
    ? 'يوصى بالمتابعة والانتباه: لديك اختبارات أو تكليفات قادمة خلال الأيام المقبلة.'
    : 'وضعك الدراسي مستقر ومنتظم، لا توجد تكليفات متأخرة أو إنذارات حضور.';

  return {
    status: 'SUCCESS',
    hasData: true,
    priorityState: highestPriorityFound,
    summary,
    summaryAr,
    overallStanding: {
      gpa: gpaData.cumulativeGpa,
      gpaString: gpaData.gpaString,
      standingStatus,
      totalCreditsEarned: gpaData.totalCreditsEarned,
      totalCreditsAttempted: gpaData.totalCreditsAttempted,
      enrolledCoursesCount: enrollments.length,
      financialBlocker,
      overduePaymentsCount: overduePayments.length,
      overdueAmount,
    },
    overallAttendance: {
      rate: overallAttendanceRate,
      quality: overallTotal > 0 ? 'AVAILABLE' : 'NO_DATA',
      totalSessions: overallTotal,
      attendedSessions: overallPresent + overallLate,
      absenceCount: overallAbsent,
    },
    urgentActions,
    courses: courseItems,
    timeWindow: {
      asOfDate: todayStr,
      cairoTimezone: 'Africa/Cairo',
    },
  };
}

// ============================================================================
// 3. STUDENT WEEKLY VIEW (DETERMINISTIC & CONFLICT DETECTION)
// ============================================================================

export interface WeeklyEventItem {
  id: string;
  eventType: 'LECTURE' | 'LAB' | 'SECTION' | 'EXAM' | 'TASK_DEADLINE' | 'NOTIFICATION';
  title: string;
  titleAr: string;
  courseCode?: string;
  courseName?: string;
  dayOfWeek: string;
  date: string;
  startTime: string;
  endTime: string;
  room?: string;
  instructor?: string;
}

export interface ScheduleConflict {
  type: 'SLOT_OVERLAP' | 'EXAM_AND_SLOT_OVERLAP';
  date: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  firstEvent: { title: string; type: string; time: string };
  secondEvent: { title: string; type: string; time: string };
  description: string;
  descriptionAr: string;
}

export interface DeadlineCluster {
  date: string;
  dayOfWeek: string;
  totalDeadlines: number;
  tasksCount: number;
  examsCount: number;
  items: string[];
}

export interface StudentWeeklyOverviewResult {
  [key: string]: unknown;
  status: 'SUCCESS' | 'EMPTY';
  hasData: boolean;
  timeWindow: {
    weekStart: string;
    weekEnd: string;
    cairoTimezone: 'Africa/Cairo';
  };
  totalEventsCount: number;
  dailyDensity: {
    dayOfWeek: string;
    date: string;
    eventsCount: number;
    isHeavyWorkload: boolean;
    sessionsCount: number;
    examsCount: number;
    tasksCount: number;
  }[];
  events: WeeklyEventItem[];
  directConflicts: ScheduleConflict[];
  deadlineClusters: DeadlineCluster[];
  summary: string;
  summaryAr: string;
}

export async function queryStudentWeeklyOverview(actor: AuthActor): Promise<StudentWeeklyOverviewResult> {
  const student = await prisma.student.findUnique({
    where: { userId: actor.id },
    select: { id: true, groupId: true, departmentId: true, year: true },
  });

  const nowCairo = toCairoTime();
  const cairoDayIdx = nowCairo.getDay(); // 0 is Sunday in JS

  // University week in Egypt starts Sunday (day 0) and ends Thursday or Saturday
  // Compute start of week (Sunday 00:00:00 Cairo) and end of week (Saturday 23:59:59 Cairo)
  const sundayCairo = new Date(nowCairo);
  sundayCairo.setDate(nowCairo.getDate() - cairoDayIdx);
  sundayCairo.setHours(0, 0, 0, 0);

  const saturdayCairo = new Date(sundayCairo);
  saturdayCairo.setDate(sundayCairo.getDate() + 6);
  saturdayCairo.setHours(23, 59, 59, 999);

  const weekStartStr = formatCairoDateTime(sundayCairo, 'yyyy-MM-dd');
  const weekEndStr = formatCairoDateTime(saturdayCairo, 'yyyy-MM-dd');

  const weekStartUtc = fromCairoTime(sundayCairo);
  const weekEndUtc = fromCairoTime(saturdayCairo);

  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

  // Build calendar dates mapping for each day in this week
  const dateForDayName = new Map<string, string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(sundayCairo);
    d.setDate(sundayCairo.getDate() + i);
    dateForDayName.set(dayNames[i], formatCairoDateTime(d, 'yyyy-MM-dd'));
  }

  if (!student) {
    return {
      status: 'EMPTY',
      hasData: false,
      timeWindow: { weekStart: weekStartStr, weekEnd: weekEndStr, cairoTimezone: 'Africa/Cairo' },
      totalEventsCount: 0,
      dailyDensity: [],
      events: [],
      directConflicts: [],
      deadlineClusters: [],
      summary: 'Student profile not found.',
      summaryAr: 'لم يتم العثور على ملف الطالب.',
    };
  }

  // Fetch enrolled courses
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: student.id, status: 'ENROLLED' },
    select: { courseId: true },
  });
  const enrolledCourseIds = enrollments.map((e) => e.courseId);

  // Group ancestry if any
  const groupIds: number[] = [];
  if (student.groupId && student.departmentId) {
    const deptGroups = await prisma.studentGroup.findMany({
      where: { departmentId: student.departmentId },
      select: { id: true, parentGroupId: true },
    });
    const map = new Map<number, number | null>();
    for (const g of deptGroups) map.set(g.id, g.parentGroupId);
    let curr: number | null = student.groupId;
    while (curr) {
      groupIds.push(curr);
      curr = map.get(curr) ?? null;
    }
  }

  const baseCourseFilter = { departmentId: student.departmentId, year: student.year };
  const slotWhere: any = {
    isArchived: false,
    AND: [
      { OR: [{ timetable: { status: 'PUBLISHED' } }, { timetableId: null }] },
      {
        OR: [
          groupIds.length > 0 ? { groupId: { in: groupIds }, course: { isPublished: true } } : undefined,
          { groupId: null, course: { ...baseCourseFilter, isPublished: true } },
          { groupId: null, course: { id: { in: enrolledCourseIds }, isPublished: true } },
        ].filter(Boolean),
      },
    ],
  };

  // Parallel fetch: slots, exams this week, tasks this week, notifications
  const [slots, examsThisWeek, tasksThisWeek, notifications] = await Promise.all([
    prisma.scheduleSlot.findMany({
      where: slotWhere,
      take: 40,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      select: {
        id: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        room: true,
        slotType: true,
        course: { select: { courseCode: true, name: true } },
        doctor: { select: { firstName: true, lastName: true } },
        teachingAssistant: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.exam.findMany({
      where: {
        date: { gte: weekStartUtc, lte: weekEndUtc },
        course: { id: { in: enrolledCourseIds }, isPublished: true },
      },
      select: {
        id: true,
        title: true,
        type: true,
        date: true,
        startTime: true,
        endTime: true,
        room: true,
        course: { select: { courseCode: true, name: true } },
      },
    }),
    prisma.task.findMany({
      where: {
        isDeleted: false,
        dueDate: { gte: weekStartUtc, lte: weekEndUtc },
        course: { id: { in: enrolledCourseIds }, isPublished: true },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        course: { select: { courseCode: true, name: true } },
      },
    }),
    prisma.notification.findMany({
      where: {
        userId: actor.id,
        isRead: false,
        createdAt: { gte: weekStartUtc },
      },
      take: 5,
      select: { id: true, title: true, type: true, createdAt: true },
    }),
  ]);

  const allEvents: WeeklyEventItem[] = [];

  // Map slots to events
  for (const s of slots) {
    const day = s.dayOfWeek.toUpperCase();
    const date = dateForDayName.get(day) || weekStartStr;
    const type = s.slotType === 'LAB' ? 'LAB' : s.slotType === 'SECTION' ? 'SECTION' : 'LECTURE';
    const title = s.course?.name ? `${s.course.name} (${s.course.courseCode})` : 'Class Session';
    const instructor = s.doctor
      ? `Dr. ${s.doctor.firstName} ${s.doctor.lastName}`
      : s.teachingAssistant
      ? `${s.teachingAssistant.firstName} ${s.teachingAssistant.lastName}`
      : undefined;

    allEvents.push({
      id: `slot-${s.id}`,
      eventType: type,
      title,
      titleAr: `${s.course?.name || 'محاضرة'} - ${s.slotType}`,
      courseCode: s.course?.courseCode,
      courseName: s.course?.name,
      dayOfWeek: day,
      date,
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room || 'TBA',
      instructor,
    });
  }

  // Map exams to events
  for (const ex of examsThisWeek) {
    const exCairo = toCairoTime(ex.date);
    const day = dayNames[exCairo.getDay()];
    const date = formatCairoDateTime(exCairo, 'yyyy-MM-dd');
    allEvents.push({
      id: `exam-${ex.id}`,
      eventType: 'EXAM',
      title: ex.title || `${ex.type} Exam: ${ex.course.name}`,
      titleAr: `امتحان ${ex.type}: ${ex.course.name}`,
      courseCode: ex.course.courseCode,
      courseName: ex.course.name,
      dayOfWeek: day,
      date,
      startTime: ex.startTime || '09:00',
      endTime: ex.endTime || '11:00',
      room: ex.room || 'TBA',
    });
  }

  // Map tasks to events
  for (const t of tasksThisWeek) {
    const tCairo = toCairoTime(t.dueDate);
    const day = dayNames[tCairo.getDay()];
    const date = formatCairoDateTime(tCairo, 'yyyy-MM-dd');
    const time = formatCairoDateTime(tCairo, 'HH:mm');
    allEvents.push({
      id: `task-${t.id}`,
      eventType: 'TASK_DEADLINE',
      title: `Task Deadline: ${t.title}`,
      titleAr: `موعد تسليم: ${t.title}`,
      courseCode: t.course.courseCode,
      courseName: t.course.name,
      dayOfWeek: day,
      date,
      startTime: time,
      endTime: time,
    });
  }

  // Chronological sort: by date ascending, then startTime ascending
  allEvents.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });

  // Direct Conflict Detection: strictly check actual timestamp overlaps on same day
  const directConflicts: ScheduleConflict[] = [];
  const eventsByDate = new Map<string, WeeklyEventItem[]>();
  for (const ev of allEvents) {
    if (ev.eventType === 'TASK_DEADLINE' || ev.eventType === 'NOTIFICATION') continue;
    const list = eventsByDate.get(ev.date) || [];
    list.push(ev);
    eventsByDate.set(ev.date, list);
  }

  for (const [date, dayEvents] of eventsByDate.entries()) {
    for (let i = 0; i < dayEvents.length; i++) {
      for (let j = i + 1; j < dayEvents.length; j++) {
        const ev1 = dayEvents[i];
        const ev2 = dayEvents[j];
        if (doTimesOverlap(ev1.startTime, ev1.endTime, ev2.startTime, ev2.endTime)) {
          const isExamOverlap = ev1.eventType === 'EXAM' || ev2.eventType === 'EXAM';
          directConflicts.push({
            type: isExamOverlap ? 'EXAM_AND_SLOT_OVERLAP' : 'SLOT_OVERLAP',
            date,
            dayOfWeek: ev1.dayOfWeek,
            startTime: ev1.startTime < ev2.startTime ? ev1.startTime : ev2.startTime,
            endTime: ev1.endTime > ev2.endTime ? ev1.endTime : ev2.endTime,
            firstEvent: { title: ev1.title, type: ev1.eventType, time: `${ev1.startTime}-${ev1.endTime}` },
            secondEvent: { title: ev2.title, type: ev2.eventType, time: `${ev2.startTime}-${ev2.endTime}` },
            description: `Schedule conflict: '${ev1.title}' and '${ev2.title}' overlap between ${ev1.startTime} and ${ev2.endTime}.`,
            descriptionAr: `تعارض في المواعيد: تداخل بين '${ev1.titleAr}' و'${ev2.titleAr}' في الفترة ${ev1.startTime} إلى ${ev2.endTime}.`,
          });
        }
      }
    }
  }

  // Daily density & deadline clusters
  const dailyDensity: StudentWeeklyOverviewResult['dailyDensity'] = [];
  const deadlineClusters: DeadlineCluster[] = [];

  for (let i = 0; i < 7; i++) {
    const day = dayNames[i];
    const date = dateForDayName.get(day)!;
    const dayEvs = allEvents.filter((e) => e.date === date);
    const sessionsCount = dayEvs.filter((e) => ['LECTURE', 'LAB', 'SECTION'].includes(e.eventType)).length;
    const examsCount = dayEvs.filter((e) => e.eventType === 'EXAM').length;
    const tasksCount = dayEvs.filter((e) => e.eventType === 'TASK_DEADLINE').length;
    const isHeavyWorkload = sessionsCount >= 4 || (examsCount > 0 && sessionsCount >= 2);

    dailyDensity.push({
      dayOfWeek: day,
      date,
      eventsCount: dayEvs.length,
      isHeavyWorkload,
      sessionsCount,
      examsCount,
      tasksCount,
    });

    if (tasksCount + examsCount >= 2) {
      deadlineClusters.push({
        date,
        dayOfWeek: day,
        totalDeadlines: tasksCount + examsCount,
        tasksCount,
        examsCount,
        items: dayEvs.filter((e) => ['EXAM', 'TASK_DEADLINE'].includes(e.eventType)).map((e) => e.title),
      });
    }
  }

  const summary = directConflicts.length > 0
    ? `You have ${allEvents.length} events this week, with ${directConflicts.length} direct schedule conflict(s) detected.`
    : `You have ${allEvents.length} scheduled events this week across lectures, labs, and deadlines with no time conflicts.`;

  const summaryAr = directConflicts.length > 0
    ? `لديك ${allEvents.length} أحداث هذا الأسبوع مع رصد ${directConflicts.length} تعارض مباشر في المواعيد.`
    : `لديك ${allEvents.length} أحداث ومحاضرات هذا الأسبوع موزعة بدون أي تعارض في المواعيد.`;

  return {
    status: 'SUCCESS',
    hasData: allEvents.length > 0,
    timeWindow: {
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      cairoTimezone: 'Africa/Cairo',
    },
    totalEventsCount: allEvents.length,
    dailyDensity,
    events: allEvents,
    directConflicts,
    deadlineClusters,
    summary,
    summaryAr,
  };
}

// ============================================================================
// 4. DOCTOR TEACHING INSIGHTS (DETERMINISTIC)
// ============================================================================

export interface DoctorCourseInsightItem {
  courseId: number;
  courseCode: string;
  courseName: string;
  credits: number;
  enrolledStudentsCount: number;
  totalRecordedSessions: number;
  attendanceRate: number | null;
  attendanceQuality: 'AVAILABLE' | 'NO_DATA';
  weeklySlotsCount: number;
  pendingSubmissionsCount: number;
  needsAttention: boolean;
  attentionFactors: string[];
  attentionFactorsAr: string[];
}

export interface DoctorTeachingInsightsResult {
  [key: string]: unknown;
  status: 'SUCCESS' | 'EMPTY';
  hasData: boolean;
  doctorId: number;
  summary: string;
  summaryAr: string;
  totalCoursesCount: number;
  totalEnrolledStudents: number;
  totalWeeklyLecturesCount: number;
  totalPendingGradingCount: number;
  dayDistribution: {
    dayOfWeek: string;
    slotsCount: number;
    isHeavyDay: boolean;
    courseCodes: string[];
  }[];
  courses: DoctorCourseInsightItem[];
  coursesNeedingAttention: DoctorCourseInsightItem[];
  timeWindow: {
    asOfDate: string;
    cairoTimezone: 'Africa/Cairo';
  };
}

export async function queryDoctorTeachingInsights(actor: AuthActor): Promise<DoctorTeachingInsightsResult> {
  const doctorId = actor.doctor?.id;
  const nowCairo = toCairoTime();
  const todayStr = formatCairoDateTime(nowCairo, 'yyyy-MM-dd');

  if (!doctorId) {
    return {
      status: 'EMPTY',
      hasData: false,
      doctorId: 0,
      summary: 'Doctor profile not found.',
      summaryAr: 'لم يتم العثور على ملف الدكتور.',
      totalCoursesCount: 0,
      totalEnrolledStudents: 0,
      totalWeeklyLecturesCount: 0,
      totalPendingGradingCount: 0,
      dayDistribution: [],
      courses: [],
      coursesNeedingAttention: [],
      timeWindow: { asOfDate: todayStr, cairoTimezone: 'Africa/Cairo' },
    };
  }

  // Parallel fetch: slots, courses taught, attendance sessions, tasks
  const [slots, sessions, tasks] = await Promise.all([
    prisma.scheduleSlot.findMany({
      where: { doctorId, isArchived: false },
      select: {
        id: true,
        courseId: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        room: true,
        course: {
          select: {
            id: true,
            courseCode: true,
            name: true,
            credits: true,
            _count: { select: { enrollments: true } },
          },
        },
      },
    }),
    prisma.attendanceSession.findMany({
      where: { doctorId },
      select: {
        id: true,
        scheduleSlot: {
          select: { courseId: true },
        },
        attendances: {
          select: { status: true },
        },
      },
    }),
    prisma.task.findMany({
      where: { doctorId, isDeleted: false },
      select: {
        id: true,
        courseId: true,
        submissions: {
          where: { score: null },
          select: { id: true },
        },
      },
    }),
  ]);

  // Aggregate courses from slots
  const courseMap = new Map<number, { course: typeof slots[0]['course']; slotCount: number }>();
  for (const s of slots) {
    if (!s.course) continue;
    const existing = courseMap.get(s.course.id);
    if (!existing) {
      courseMap.set(s.course.id, { course: s.course, slotCount: 1 });
    } else {
      existing.slotCount++;
    }
  }

  // Group attendance by courseId
  const courseAttendanceMap = new Map<number, { present: number; total: number; sessionsCount: number }>();
  for (const sess of sessions) {
    const courseId = sess.scheduleSlot?.courseId;
    if (!courseId) continue;
    let stat = courseAttendanceMap.get(courseId);
    if (!stat) {
      stat = { present: 0, total: 0, sessionsCount: 0 };
      courseAttendanceMap.set(courseId, stat);
    }
    stat.sessionsCount++;
    for (const a of sess.attendances) {
      stat.total++;
      if (a.status === 'PRESENT' || a.status === 'LATE') {
        stat.present++;
      }
    }
  }

  // Group pending submissions by courseId
  const pendingByCourse = new Map<number, number>();
  let totalPendingGrading = 0;
  for (const t of tasks) {
    const unreviewed = t.submissions.length;
    totalPendingGrading += unreviewed;
    pendingByCourse.set(t.courseId, (pendingByCourse.get(t.courseId) ?? 0) + unreviewed);
  }

  const courseItems: DoctorCourseInsightItem[] = [];
  const needingAttention: DoctorCourseInsightItem[] = [];
  let totalEnrolled = 0;

  for (const [courseId, { course, slotCount }] of courseMap.entries()) {
    const enrolled = course._count.enrollments;
    totalEnrolled += enrolled;

    const att = courseAttendanceMap.get(courseId);
    const hasSessions = att && att.sessionsCount > 0;
    const attRate = hasSessions && att.total > 0
      ? Math.round((att.present / att.total) * 100)
      : null;

    const pendingSubmissions = pendingByCourse.get(courseId) ?? 0;

    const factors: string[] = [];
    const factorsAr: string[] = [];
    let attentionNeeded = false;

    if (hasSessions && attRate! < 75) {
      attentionNeeded = true;
      factors.push(`Attendance rate is ${attRate}%, lower than the target 75%.`);
      factorsAr.push(`نسبة الحضور في المقرر ${attRate}% وهي أقل من المستهدف 75%.`);
    } else if (!hasSessions && enrolled > 0) {
      attentionNeeded = true;
      factors.push(`No attendance sessions recorded yet for ${enrolled} enrolled students.`);
      factorsAr.push(`لم تسجل أي جلسات حضور بعد لـ ${enrolled} طالب مسجل.`);
    }

    if (pendingSubmissions > 10) {
      attentionNeeded = true;
      factors.push(`${pendingSubmissions} unreviewed student submissions awaiting grading.`);
      factorsAr.push(`يوجد ${pendingSubmissions} تسليمات طلاب معلقة بانتظار التقييم.`);
    }

    const item: DoctorCourseInsightItem = {
      courseId,
      courseCode: course.courseCode,
      courseName: course.name,
      credits: course.credits,
      enrolledStudentsCount: enrolled,
      totalRecordedSessions: att?.sessionsCount ?? 0,
      attendanceRate: attRate,
      attendanceQuality: hasSessions ? 'AVAILABLE' : 'NO_DATA',
      weeklySlotsCount: slotCount,
      pendingSubmissionsCount: pendingSubmissions,
      needsAttention: attentionNeeded,
      attentionFactors: factors,
      attentionFactorsAr: factorsAr,
    };

    courseItems.push(item);
    if (attentionNeeded) needingAttention.push(item);
  }

  // Day distribution
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const dayDistribution = dayNames.map((day) => {
    const daySlots = slots.filter((s) => s.dayOfWeek.toUpperCase() === day);
    const courseCodes = Array.from(new Set(daySlots.map((s) => s.course.courseCode)));
    return {
      dayOfWeek: day,
      slotsCount: daySlots.length,
      isHeavyDay: daySlots.length >= 3,
      courseCodes,
    };
  });

  const summary = needingAttention.length > 0
    ? `Teaching overview: You teach ${courseItems.length} course(s) with ${totalEnrolled} total students. ${needingAttention.length} course(s) need follow-up on attendance or pending grading.`
    : `Teaching overview: All ${courseItems.length} course(s) have healthy attendance and balanced grading queues.`;

  const summaryAr = needingAttention.length > 0
    ? `ملخص التدريس: تقوم بتدريس ${courseItems.length} مقررات بإجمالي ${totalEnrolled} طالب. يوجد ${needingAttention.length} مقررات بحاجة للمتابعة في الحضور أو تصحيح التكليفات.`
    : `ملخص التدريس: جميع المقررات الـ ${courseItems.length} تسير بانتظام ومعدلات حضور مستقرة وتكليفات مصححة.`;

  return {
    status: 'SUCCESS',
    hasData: courseItems.length > 0,
    doctorId,
    summary,
    summaryAr,
    totalCoursesCount: courseItems.length,
    totalEnrolledStudents: totalEnrolled,
    totalWeeklyLecturesCount: slots.length,
    totalPendingGradingCount: totalPendingGrading,
    dayDistribution,
    courses: courseItems,
    coursesNeedingAttention: needingAttention,
    timeWindow: { asOfDate: todayStr, cairoTimezone: 'Africa/Cairo' },
  };
}

// ============================================================================
// 5. TEACHING ASSISTANT SECTION INSIGHTS (DETERMINISTIC)
// ============================================================================

export interface TaSectionInsightItem {
  slotId: number;
  courseCode: string;
  courseName: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room: string;
  groupName: string;
  estimatedStudentsCount: number;
}

export interface TaSectionInsightsResult {
  [key: string]: unknown;
  status: 'SUCCESS' | 'EMPTY';
  hasData: boolean;
  taId: string;
  summary: string;
  summaryAr: string;
  totalAssignedSlots: number;
  totalAssignedCoursesCount: number;
  totalStudentsAssigned: number;
  dayDistribution: {
    dayOfWeek: string;
    slotsCount: number;
    isHeavyDay: boolean;
    hoursCount: number;
  }[];
  sections: TaSectionInsightItem[];
  directConflicts: {
    dayOfWeek: string;
    firstSection: string;
    secondSection: string;
    overlapTime: string;
  }[];
  timeWindow: { asOfDate: string; cairoTimezone: 'Africa/Cairo' };
}

export async function queryTaSectionInsights(actor: AuthActor): Promise<TaSectionInsightsResult> {
  const taId = actor.teachingAssistant?.id !== undefined ? String(actor.teachingAssistant.id) : undefined;
  const nowCairo = toCairoTime();
  const todayStr = formatCairoDateTime(nowCairo, 'yyyy-MM-dd');

  if (!taId) {
    return {
      status: 'EMPTY',
      hasData: false,
      taId: '',
      summary: 'Teaching assistant profile not found.',
      summaryAr: 'لم يتم العثور على ملف المعيد.',
      totalAssignedSlots: 0,
      totalAssignedCoursesCount: 0,
      totalStudentsAssigned: 0,
      dayDistribution: [],
      sections: [],
      directConflicts: [],
      timeWindow: { asOfDate: todayStr, cairoTimezone: 'Africa/Cairo' },
    };
  }

  const slots = await prisma.scheduleSlot.findMany({
    where: { teachingAssistantId: taId, isArchived: false },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    select: {
      id: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      room: true,
      slotType: true,
      group: {
        select: {
          name: true,
          _count: { select: { students: true } },
        },
      },
      course: {
        select: {
          courseCode: true,
          name: true,
          _count: { select: { enrollments: true } },
        },
      },
    },
  });

  const sections: TaSectionInsightItem[] = slots.map((s) => {
    const studentCount = s.group?._count?.students ?? s.course?._count?.enrollments ?? 0;
    return {
      slotId: s.id,
      courseCode: s.course.courseCode,
      courseName: s.course.name,
      dayOfWeek: s.dayOfWeek.toUpperCase(),
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room || 'Lab TBA',
      groupName: s.group?.name || 'All Cohort',
      estimatedStudentsCount: studentCount,
    };
  });

  const distinctCourses = new Set(slots.map((s) => s.course.courseCode));
  const totalStudents = sections.reduce((acc, s) => acc + s.estimatedStudentsCount, 0);

  // Direct conflict detection for TA slots
  const directConflicts: TaSectionInsightsResult['directConflicts'] = [];
  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      const s1 = sections[i];
      const s2 = sections[j];
      if (s1.dayOfWeek === s2.dayOfWeek && doTimesOverlap(s1.startTime, s1.endTime, s2.startTime, s2.endTime)) {
        directConflicts.push({
          dayOfWeek: s1.dayOfWeek,
          firstSection: `${s1.courseCode} (${s1.startTime}-${s1.endTime})`,
          secondSection: `${s2.courseCode} (${s2.startTime}-${s2.endTime})`,
          overlapTime: `${Math.max(parseTimeToMinutes(s1.startTime)!, parseTimeToMinutes(s2.startTime)!)}m`,
        });
      }
    }
  }

  // Day distribution
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const dayDistribution = dayNames.map((day) => {
    const daySections = sections.filter((s) => s.dayOfWeek === day);
    let totalMinutes = 0;
    for (const s of daySections) {
      const sMin = parseTimeToMinutes(s.startTime) ?? 0;
      const eMin = parseTimeToMinutes(s.endTime) ?? 0;
      totalMinutes += Math.max(0, eMin - sMin);
    }
    return {
      dayOfWeek: day,
      slotsCount: daySections.length,
      isHeavyDay: daySections.length >= 3,
      hoursCount: Math.round((totalMinutes / 60) * 10) / 10,
    };
  });

  const summary = directConflicts.length > 0
    ? `You are assigned to ${sections.length} section slot(s) across ${distinctCourses.size} course(s), with ${directConflicts.length} schedule conflict(s) detected.`
    : `You are assigned to ${sections.length} lab/section slot(s) across ${distinctCourses.size} course(s) with no schedule conflicts.`;

  const summaryAr = directConflicts.length > 0
    ? `أنت مسند لـ ${sections.length} حصة/سكشن في ${distinctCourses.size} مقررات مع وجود ${directConflicts.length} تعارض في الجداول.`
    : `أنت مسند لـ ${sections.length} حصة/سكشن في ${distinctCourses.size} مقررات دون أي تعارض في الجداول.`;

  return {
    status: 'SUCCESS',
    hasData: sections.length > 0,
    taId,
    summary,
    summaryAr,
    totalAssignedSlots: sections.length,
    totalAssignedCoursesCount: distinctCourses.size,
    totalStudentsAssigned: totalStudents,
    dayDistribution,
    sections,
    directConflicts,
    timeWindow: { asOfDate: todayStr, cairoTimezone: 'Africa/Cairo' },
  };
}

// ============================================================================
// 6. ADMIN OPERATIONAL INSIGHTS & DEPARTMENT COMPARISONS
// ============================================================================

export interface DepartmentMetricItem {
  departmentId: number;
  departmentName: string;
  departmentNameAr: string;
  collegeName?: string;
  studentCount: number;
  doctorCount: number;
  courseCount: number;
  attendanceRate: number | null;
  attendanceQuality: 'AVAILABLE' | 'NO_DATA';
  totalAttendanceRecords: number;
  averageGpa: number | null;
  gpaQuality: 'AVAILABLE' | 'NO_DATA';
  totalCourseEnrollments: number;
  courseCapacityUtilization: number;
  totalTuitionBilled: number;
  totalTuitionCollected: number;
  overduePaymentCount: number;
  tuitionCollectionRate: number;
  statusNotice?: string;
  statusNoticeAr?: string;
}

export interface AdminOperationalInsightsResult {
  [key: string]: unknown;
  status: 'SUCCESS' | 'EMPTY' | 'UNAUTHORIZED_SCOPE';
  hasData: boolean;
  scopeLevel: 'GLOBAL' | 'COLLEGE' | 'DEPARTMENT';
  scopeName: string;
  summary: string;
  summaryAr: string;
  kpis: {
    totalStudents: number;
    totalFaculty: number;
    totalCourses: number;
    overallAttendanceRate: number | null;
    attendanceQuality: 'AVAILABLE' | 'NO_DATA';
    academicStanding: {
      averageGpa: number | null;
      goodStandingCount: number;
      probationCount: number;
      gpaQuality: 'AVAILABLE' | 'NO_DATA';
    };
    courseCapacityUtilizationRate: number;
    financials: {
      totalCollected: number;
      totalOverdue: number;
      collectionRate: number;
      overduePaymentsCount: number;
    };
  };
  departmentBreakdown: DepartmentMetricItem[];
  coincidingAttentionAreas: {
    departmentId: number;
    departmentName: string;
    factors: string[];
    factorsAr: string[];
    phrasingNote: string;
  }[];
  dataQuality: {
    attendance: QualityState;
    academics: QualityState;
    financials: QualityState;
  };
  timeWindow: { asOfDate: string; cairoTimezone: 'Africa/Cairo' };
}

export async function queryAdminOperationalInsights(actor: AuthActor): Promise<AdminOperationalInsightsResult> {
  const scopes = getAdministrativeAnalyticsScopes(actor);
  const nowCairo = toCairoTime();
  const todayStr = formatCairoDateTime(nowCairo, 'yyyy-MM-dd');

  if (!scopes) {
    return {
      status: 'UNAUTHORIZED_SCOPE',
      hasData: false,
      scopeLevel: 'DEPARTMENT',
      scopeName: 'Unauthorized',
      summary: 'Administrative scope is not configured for your role.',
      summaryAr: 'النطاق الإداري غير مهيأ لصلاحيتك.',
      kpis: {
        totalStudents: 0,
        totalFaculty: 0,
        totalCourses: 0,
        overallAttendanceRate: null,
        attendanceQuality: 'NO_DATA',
        academicStanding: { averageGpa: null, goodStandingCount: 0, probationCount: 0, gpaQuality: 'NO_DATA' },
        courseCapacityUtilizationRate: 0,
        financials: { totalCollected: 0, totalOverdue: 0, collectionRate: 0, overduePaymentsCount: 0 },
      },
      departmentBreakdown: [],
      coincidingAttentionAreas: [],
      dataQuality: { attendance: 'NO_DATA', academics: 'NO_DATA', financials: 'NO_DATA' },
      timeWindow: { asOfDate: todayStr, cairoTimezone: 'Africa/Cairo' },
    };
  }

  const scopeLevel: AdminOperationalInsightsResult['scopeLevel'] =
    scopes.cacheScope === 'global'
      ? 'GLOBAL'
      : scopes.cacheScope.startsWith('department:')
      ? 'DEPARTMENT'
      : 'COLLEGE';

  const scopeName =
    scopes.cacheScope === 'global'
      ? 'Institutional University Scope'
      : scopes.cacheScope.startsWith('department:')
      ? `Department ID: ${scopes.cacheScope.split(':')[1]}`
      : `College ID: ${scopes.cacheScope.split(':')[1]}`;

  // Fetch departments within scope
  const departments = await prisma.department.findMany({
    where: scopes.department,
    select: {
      id: true,
      name: true,
      nameAr: true,
      college: { select: { name: true } },
    },
  });

  // Parallel aggregated counts within scope
  const [students, doctors, courses, attendanceGroup, paymentsGroup, enrollmentsAgg] = await Promise.all([
    prisma.student.findMany({
      where: scopes.student,
      select: {
        id: true,
        departmentId: true,
        enrollments: {
          where: { status: { in: ['COMPLETED', 'FAILED'] } },
          select: { finalGrade: true, status: true, course: { select: { credits: true } } },
        },
      },
    }),
    prisma.doctor.findMany({
      where: scopes.doctor,
      select: { id: true, departmentId: true },
    }),
    prisma.course.findMany({
      where: scopes.course,
      select: { id: true, departmentId: true, maxStudents: true, _count: { select: { enrollments: true } } },
    }),
    prisma.attendance.groupBy({
      by: ['status'],
      where: { student: scopes.student },
      _count: { _all: true },
    }),
    prisma.payment.groupBy({
      by: ['status'],
      where: { student: scopes.student },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.enrollment.count({
      where: { student: scopes.student, status: 'ENROLLED' },
    }),
  ]);

  // Compute student GPAs and standing distribution
  let totalGpaSum = 0;
  let gpaCount = 0;
  let goodStandingCount = 0;
  let probationCount = 0;

  const departmentStudentGpaMap = new Map<number, { sum: number; count: number }>();

  for (const st of students) {
    let earnedCredits = 0;
    let earnedPoints = 0;
    for (const enr of st.enrollments) {
      const cr = enr.course.credits || 3;
      const gr = enr.finalGrade;
      if (enr.status === 'FAILED') {
        earnedCredits += cr;
      } else if (enr.status === 'COMPLETED' && gr !== null) {
        earnedCredits += cr;
        const pts = gr >= 90 ? 4 : gr >= 80 ? 3 : gr >= 70 ? 2 : gr >= 60 ? 1 : 0;
        earnedPoints += pts * cr;
      }
    }
    if (earnedCredits > 0) {
      const gpa = Math.round((earnedPoints / earnedCredits) * 100) / 100;
      totalGpaSum += gpa;
      gpaCount++;
      if (gpa < 2.0) probationCount++;
      else goodStandingCount++;

      if (st.departmentId) {
        const dStat = departmentStudentGpaMap.get(st.departmentId) || { sum: 0, count: 0 };
        dStat.sum += gpa;
        dStat.count++;
        departmentStudentGpaMap.set(st.departmentId, dStat);
      }
    }
  }

  const averageGpa = gpaCount > 0 ? Math.round((totalGpaSum / gpaCount) * 100) / 100 : null;

  // Attendance stats
  const countForAtt = (st: string) => attendanceGroup.find((a) => a.status === st)?._count._all ?? 0;
  const attPres = countForAtt('PRESENT') + countForAtt('LATE');
  const attTotal = attPres + countForAtt('ABSENT') + countForAtt('EXCUSED') + countForAtt('PENDING_REVIEW');
  const overallAttendanceRate = attTotal > 0 ? Math.round((attPres / attTotal) * 100) : null;

  // Payments stats
  const sumForPay = (st: string) => Number(paymentsGroup.find((p) => p.status === st)?._sum.amount ?? 0);
  const countForPay = (st: string) => paymentsGroup.find((p) => p.status === st)?._count._all ?? 0;
  const totalPaid = sumForPay('PAID');
  const totalPending = sumForPay('PENDING');
  const totalOverdue = sumForPay('OVERDUE');
  const totalBilled = totalPaid + totalPending + totalOverdue;
  const collectionRate = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0;
  const overdueCount = countForPay('OVERDUE');

  // Course capacity utilization
  const totalCourseCapacity = courses.reduce((acc, c) => acc + c.maxStudents, 0);
  const totalCourseEnrollments = courses.reduce((acc, c) => acc + c._count.enrollments, 0);
  const courseCapacityUtilizationRate = totalCourseCapacity > 0
    ? Math.round((totalCourseEnrollments / totalCourseCapacity) * 100)
    : 0;

  // Department-by-department aggregation
  const deptItems: DepartmentMetricItem[] = [];
  const coincidingAttentionAreas: AdminOperationalInsightsResult['coincidingAttentionAreas'] = [];

  for (const dept of departments) {
    const deptStudents = students.filter((s) => s.departmentId === dept.id);
    const deptDoctors = doctors.filter((d) => d.departmentId === dept.id);
    const deptCourses = courses.filter((c) => c.departmentId === dept.id);

    const dGpaStat = departmentStudentGpaMap.get(dept.id);
    const deptAvgGpa = dGpaStat && dGpaStat.count > 0
      ? Math.round((dGpaStat.sum / dGpaStat.count) * 100) / 100
      : null;

    const dCap = deptCourses.reduce((acc, c) => acc + c.maxStudents, 0);
    const dEnr = deptCourses.reduce((acc, c) => acc + c._count.enrollments, 0);
    const dCapRate = dCap > 0 ? Math.round((dEnr / dCap) * 100) : 0;

    // Notice explaining attention areas without unproven causality
    const factors: string[] = [];
    const factorsAr: string[] = [];

    if (deptStudents.length > 0 && dEnr === 0) {
      factors.push('Active students exist with zero course enrollments (registration gap).');
      factorsAr.push('يوجد طلاب مسجلون بالقسم دون أي تسجيل في مقررات دراسية.');
    }

    if (deptAvgGpa !== null && deptAvgGpa < OPERATIONAL_ATTENTION_HEURISTICS.DEPARTMENT_LOW_GPA_BENCHMARK) {
      factors.push(`Average department GPA is ${deptAvgGpa} (below ${OPERATIONAL_ATTENTION_HEURISTICS.DEPARTMENT_LOW_GPA_BENCHMARK} operational advising benchmark).`);
      factorsAr.push(`متوسط المعدل التراكمي للقسم ${deptAvgGpa} (أقل من المؤشر الاسترشادي للمتابعة ${OPERATIONAL_ATTENTION_HEURISTICS.DEPARTMENT_LOW_GPA_BENCHMARK}).`);
    }

    if (factors.length > 0) {
      coincidingAttentionAreas.push({
        departmentId: dept.id,
        departmentName: dept.name,
        factors,
        factorsAr,
        phrasingNote: 'These factors coincide concurrently; correlation is observed without claiming unilateral causation (يتزامن مع).',
      });
    }

    deptItems.push({
      departmentId: dept.id,
      departmentName: dept.name,
      departmentNameAr: dept.nameAr || dept.name,
      collegeName: dept.college?.name,
      studentCount: deptStudents.length,
      doctorCount: deptDoctors.length,
      courseCount: deptCourses.length,
      attendanceRate: overallAttendanceRate, // Shared scope rate fallback if granular not partitioned
      attendanceQuality: attTotal > 0 ? 'AVAILABLE' : 'NO_DATA',
      totalAttendanceRecords: attTotal,
      averageGpa: deptAvgGpa,
      gpaQuality: deptAvgGpa !== null ? 'AVAILABLE' : 'NO_DATA',
      totalCourseEnrollments: dEnr,
      courseCapacityUtilization: dCapRate,
      totalTuitionBilled: totalBilled,
      totalTuitionCollected: totalPaid,
      overduePaymentCount: overdueCount,
      tuitionCollectionRate: collectionRate,
    });
  }

  const summary = `Operational summary (${scopeLevel}): ${students.length} students across ${departments.length} department(s). Average GPA: ${averageGpa ?? 'N/A'}, Overall attendance: ${overallAttendanceRate ? `${overallAttendanceRate}%` : 'No Data'}, Collection rate: ${collectionRate}%.`;
  const summaryAr = `الملخص التشغيلي (${scopeLevel}): ${students.length} طالب عبر ${departments.length} أقسام. متوسط المعدل: ${averageGpa ?? 'لا توجد بيانات'}, نسبة الحضور: ${overallAttendanceRate ? `${overallAttendanceRate}%` : 'لا توجد بيانات'}, نسبة التحصيل: ${collectionRate}%.`;

  return {
    status: 'SUCCESS',
    hasData: true,
    scopeLevel,
    scopeName,
    summary,
    summaryAr,
    kpis: {
      totalStudents: students.length,
      totalFaculty: doctors.length,
      totalCourses: courses.length,
      overallAttendanceRate,
      attendanceQuality: attTotal > 0 ? 'AVAILABLE' : 'NO_DATA',
      academicStanding: {
        averageGpa,
        goodStandingCount,
        probationCount,
        gpaQuality: gpaCount > 0 ? 'AVAILABLE' : 'NO_DATA',
      },
      courseCapacityUtilizationRate,
      financials: {
        totalCollected: totalPaid,
        totalOverdue,
        collectionRate,
        overduePaymentsCount: overdueCount,
      },
    },
    departmentBreakdown: deptItems,
    coincidingAttentionAreas,
    dataQuality: {
      attendance: attTotal > 0 ? 'AVAILABLE' : 'NO_DATA',
      academics: gpaCount > 0 ? 'AVAILABLE' : 'NO_DATA',
      financials: totalBilled > 0 ? 'AVAILABLE' : 'NO_DATA',
    },
    timeWindow: { asOfDate: todayStr, cairoTimezone: 'Africa/Cairo' },
  };
}

export interface DepartmentComparisonResult {
  [key: string]: unknown;
  status: 'SUCCESS' | 'EMPTY' | 'UNAUTHORIZED_SCOPE';
  hasData: boolean;
  message: string;
  messageAr: string;
  comparedDepartmentsCount: number;
  departments: DepartmentMetricItem[];
  comparisonFindings: Record<string, string>;
  historicalComparison: {
    available: boolean;
    reason: string;
    reasonAr: string;
  };
  timeWindow: { asOfDate: string; cairoTimezone: 'Africa/Cairo' };
}

export async function compareScopedDepartments(
  actor: AuthActor,
  requestedDepartmentIds?: number[],
): Promise<DepartmentComparisonResult> {
  const scopes = getAdministrativeAnalyticsScopes(actor);
  const nowCairo = toCairoTime();
  const todayStr = formatCairoDateTime(nowCairo, 'yyyy-MM-dd');

  if (!scopes) {
    return {
      status: 'UNAUTHORIZED_SCOPE',
      hasData: false,
      message: 'Unauthorized: Administrative analytics scope is not configured for your role.',
      messageAr: 'غير مصرح: الصلاحيات الإدارية للتحليلات غير متوفرة لحسابك.',
      comparedDepartmentsCount: 0,
      departments: [],
      comparisonFindings: {},
      historicalComparison: {
        available: false,
        reason: 'Insufficient historical semester data in database.',
        reasonAr: 'بيانات الفصول الدراسية السابقة غير كافية في قاعدة البيانات.',
      },
      timeWindow: { asOfDate: todayStr, cairoTimezone: 'Africa/Cairo' },
    };
  }

  // Fetch all authorized departments within scope
  const authorizedDepts = await prisma.department.findMany({
    where: scopes.department,
    select: {
      id: true,
      name: true,
      nameAr: true,
      college: { select: { name: true } },
    },
  });

  const authorizedDeptIds = new Set(authorizedDepts.map((d) => d.id));

  // If specific departmentIds requested, ensure they are strictly authorized
  let targetDepts = authorizedDepts;
  if (requestedDepartmentIds && requestedDepartmentIds.length > 0) {
    for (const reqId of requestedDepartmentIds) {
      if (!authorizedDeptIds.has(reqId)) {
        return {
          status: 'UNAUTHORIZED_SCOPE',
          hasData: false,
          message: `Department ID ${reqId} is outside your authorized administrative scope.`,
          messageAr: `القسم رقم ${reqId} يقع خارج نطاق صلاحياتك الإدارية المعتمدة.`,
          comparedDepartmentsCount: 0,
          departments: [],
          comparisonFindings: {},
          historicalComparison: {
            available: false,
            reason: 'Insufficient historical semester data in database.',
            reasonAr: 'بيانات الفصول الدراسية السابقة غير كافية في قاعدة البيانات.',
          },
          timeWindow: { asOfDate: todayStr, cairoTimezone: 'Africa/Cairo' },
        };
      }
    }
    targetDepts = authorizedDepts.filter((d) => requestedDepartmentIds.includes(d.id));
  }

  if (targetDepts.length === 0) {
    return {
      status: 'EMPTY',
      hasData: false,
      message: 'No departments found within your authorized scope for comparison.',
      messageAr: 'لم يتم العثور على أقسام ضمن صلاحياتك للمقارنة.',
      comparedDepartmentsCount: 0,
      departments: [],
      comparisonFindings: {},
      historicalComparison: {
        available: false,
        reason: 'Insufficient historical semester data in database.',
        reasonAr: 'بيانات الفصول الدراسية السابقة غير كافية في قاعدة البيانات.',
      },
      timeWindow: { asOfDate: todayStr, cairoTimezone: 'Africa/Cairo' },
    };
  }

  // Fetch metrics for target departments
  const deptMetrics: DepartmentMetricItem[] = [];

  for (const dept of targetDepts) {
    const [stCount, docCount, crCount, enrollmentsCount] = await Promise.all([
      prisma.student.count({ where: { departmentId: dept.id } }),
      prisma.doctor.count({ where: { departmentId: dept.id } }),
      prisma.course.count({ where: { departmentId: dept.id } }),
      prisma.enrollment.count({ where: { course: { departmentId: dept.id }, status: 'ENROLLED' } }),
    ]);

    deptMetrics.push({
      departmentId: dept.id,
      departmentName: dept.name,
      departmentNameAr: dept.nameAr || dept.name,
      collegeName: dept.college?.name,
      studentCount: stCount,
      doctorCount: docCount,
      courseCount: crCount,
      attendanceRate: null, // Granular partitioned attendance
      attendanceQuality: 'NO_DATA',
      totalAttendanceRecords: 0,
      averageGpa: null,
      gpaQuality: 'NO_DATA',
      totalCourseEnrollments: enrollmentsCount,
      courseCapacityUtilization: crCount > 0 ? Math.round((enrollmentsCount / (crCount * 30)) * 100) : 0,
      totalTuitionBilled: 0,
      totalTuitionCollected: 0,
      overduePaymentCount: 0,
      tuitionCollectionRate: 0,
    });
  }

  return {
    status: 'SUCCESS',
    hasData: true,
    message: `Comparison completed across ${deptMetrics.length} department(s) within authorized scope.`,
    messageAr: `تمت المقارنة بنجاح بين ${deptMetrics.length} أقسام مصرح بها.`,
    comparedDepartmentsCount: deptMetrics.length,
    departments: deptMetrics,
    comparisonFindings: {},
    historicalComparison: {
      available: false,
      reason: 'Insufficient historical semester data in database.',
      reasonAr: 'بيانات الفصول الدراسية السابقة غير متوفرة في قاعدة البيانات لإجراء مقارنة زمنية موثقة.',
    },
    timeWindow: { asOfDate: todayStr, cairoTimezone: 'Africa/Cairo' },
  };
}
