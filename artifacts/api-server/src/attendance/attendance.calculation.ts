import { AttendanceStatus, Prisma } from '@prisma/client';
import { toZonedTime } from 'date-fns-tz';
import prisma from '../utils/prismaClient';

export const ATTENDANCE_TIME_ZONE = 'Africa/Cairo';

export type AttendanceAttempt = {
  id: number;
  studentId: number;
  courseId: number;
  semester: number;
  academicYear: number;
  groupId: number | null;
  enrolledAt: Date;
  exemptionPeriods: Array<{ startDate: Date; endDate: Date }>;
};

export type AttendanceCalculation = {
  enrollmentId: number;
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  pendingReview: number;
  activeTotal: number;
  attendancePercentage: number;
  absencePercent: number;
  sessions: Array<{
    sessionId: number;
    date: Date;
    status: AttendanceStatus;
    remarks: string | null;
    attendanceId: number | null;
  }>;
};

type PolicyCandidate = {
  id: number;
  courseId: number | null;
  departmentId: number | null;
  maxAbsencePercent: number;
};

type PolicyAttempt = {
  courseId: number;
  departmentId: number | null;
  customAbsenceThreshold: number | null;
};

const isExempt = (
  date: Date,
  periods: Array<{ startDate: Date; endDate: Date }>
) => periods.some((period) => date >= period.startDate && date <= period.endDate);

export const getCairoCalendarYear = (date: Date): number =>
  toZonedTime(date, ATTENDANCE_TIME_ZONE).getFullYear();

export const selectAbsenceThreshold = (
  attempt: PolicyAttempt,
  policies: PolicyCandidate[]
): number => {
  if (attempt.customAbsenceThreshold !== null) {
    return attempt.customAbsenceThreshold;
  }

  const ordered = [...policies].sort((left, right) => left.id - right.id);
  return (
    ordered.find((policy) => policy.courseId === attempt.courseId)
      ?.maxAbsencePercent ??
    ordered.find(
      (policy) =>
        policy.courseId === null &&
        policy.departmentId === attempt.departmentId
    )?.maxAbsencePercent ??
    ordered.find(
      (policy) => policy.courseId === null && policy.departmentId === null
    )?.maxAbsencePercent ??
    25
  );
};

const calculateMetrics = (
  enrollmentId: number,
  sessions: AttendanceCalculation['sessions'],
  standaloneStatuses: AttendanceStatus[]
): AttendanceCalculation => {
  const statuses = [
    ...sessions.map((session) => session.status),
    ...standaloneStatuses,
  ];
  const present = statuses.filter((status) => status === 'PRESENT').length;
  const absent = statuses.filter((status) => status === 'ABSENT').length;
  const late = statuses.filter((status) => status === 'LATE').length;
  const excused = statuses.filter((status) => status === 'EXCUSED').length;
  const pendingReview = statuses.filter(
    (status) => status === 'PENDING_REVIEW'
  ).length;
  const total = statuses.length;
  const activeTotal = total - excused - pendingReview;

  return {
    enrollmentId,
    total,
    present,
    absent,
    late,
    excused,
    pendingReview,
    activeTotal,
    attendancePercentage:
      activeTotal > 0 ? ((present + late * 0.5) / activeTotal) * 100 : 0,
    absencePercent:
      activeTotal > 0 ? ((absent + late * 0.5) / activeTotal) * 100 : 0,
    sessions,
  };
};

export const combineAttendanceCalculations = (
  calculations: AttendanceCalculation[]
): AttendanceCalculation => {
  const sessions = calculations.flatMap((calculation) => calculation.sessions);
  const totals = calculations.reduce(
    (accumulator, calculation) => ({
      total: accumulator.total + calculation.total,
      present: accumulator.present + calculation.present,
      absent: accumulator.absent + calculation.absent,
      late: accumulator.late + calculation.late,
      excused: accumulator.excused + calculation.excused,
      pendingReview:
        accumulator.pendingReview + calculation.pendingReview,
    }),
    { total: 0, present: 0, absent: 0, late: 0, excused: 0, pendingReview: 0 }
  );
  const activeTotal = totals.total - totals.excused - totals.pendingReview;

  return {
    enrollmentId: 0,
    ...totals,
    activeTotal,
    attendancePercentage:
      activeTotal > 0
        ? ((totals.present + totals.late * 0.5) / activeTotal) * 100
        : 0,
    absencePercent:
      activeTotal > 0
        ? ((totals.absent + totals.late * 0.5) / activeTotal) * 100
        : 0,
    sessions,
  };
};

/**
 * Shared attendance definition used by enforcement and reporting.
 *
 * Required sessions are closed sessions for the enrollment's exact course,
 * semester, calendar academic year, enrollment start, and student group ancestry.
 * Sessions inside an exemption window are removed before missing rows are counted.
 */
export const calculateAttendanceAttempts = async (
  attempts: AttendanceAttempt[],
  options: { dateWhere?: Prisma.DateTimeFilter } = {}
): Promise<Map<number, AttendanceCalculation>> => {
  if (attempts.length === 0) return new Map();

  const groupIds = Array.from(
    new Set(
      attempts
        .map((attempt) => attempt.groupId)
        .filter((groupId): groupId is number => groupId !== null)
    )
  );
  const [groups, slots] = await Promise.all([
    groupIds.length > 0
      ? prisma.studentGroup.findMany({
          select: { id: true, parentGroupId: true },
        })
      : Promise.resolve([]),
    prisma.scheduleSlot.findMany({
      where: {
        courseId: {
          in: Array.from(new Set(attempts.map((attempt) => attempt.courseId))),
        },
      },
      select: {
        id: true,
        courseId: true,
        groupId: true,
        timetable: { select: { semester: true } },
        course: { select: { semester: true } },
      },
    }),
  ]);

  const parentByGroupId = new Map(
    groups.map((group) => [group.id, group.parentGroupId])
  );
  const ancestryByGroupId = new Map<number, Set<number>>();
  for (const groupId of groupIds) {
    const ancestry = new Set<number>();
    let current: number | null | undefined = groupId;
    while (current !== null && current !== undefined && !ancestry.has(current)) {
      ancestry.add(current);
      current = parentByGroupId.get(current);
    }
    ancestryByGroupId.set(groupId, ancestry);
  }

  const slotIdsByAttempt = new Map<number, Set<number>>();
  for (const attempt of attempts) {
    const ancestry = attempt.groupId === null
      ? new Set<number>()
      : ancestryByGroupId.get(attempt.groupId) ?? new Set([attempt.groupId]);
    const ids = new Set(
      slots
        .filter((slot) => {
          const semester = slot.timetable?.semester ?? slot.course.semester;
          const groupMatches = slot.groupId === null || ancestry.has(slot.groupId);
          return (
            slot.courseId === attempt.courseId &&
            semester === attempt.semester &&
            groupMatches
          );
        })
        .map((slot) => slot.id)
    );
    slotIdsByAttempt.set(attempt.id, ids);
  }

  const allSlotIds = Array.from(
    new Set([...slotIdsByAttempt.values()].flatMap((ids) => [...ids]))
  );
  const sessions = allSlotIds.length > 0
    ? await prisma.attendanceSession.findMany({
        where: {
          scheduleSlotId: { in: allSlotIds },
          isActive: false,
          ...(options.dateWhere && { createdAt: options.dateWhere }),
        },
        select: { id: true, scheduleSlotId: true, createdAt: true },
      })
    : [];

  const requiredSessionsByAttempt = new Map<
    number,
    Array<(typeof sessions)[number]>
  >();
  for (const attempt of attempts) {
    const slotIds = slotIdsByAttempt.get(attempt.id) ?? new Set<number>();
    requiredSessionsByAttempt.set(
      attempt.id,
      sessions.filter(
        (session) =>
          slotIds.has(session.scheduleSlotId) &&
          session.createdAt >= attempt.enrolledAt &&
          getCairoCalendarYear(session.createdAt) === attempt.academicYear &&
          !isExempt(session.createdAt, attempt.exemptionPeriods)
      )
    );
  }

  const attendanceClauses: Prisma.AttendanceWhereInput[] = [];
  for (const attempt of attempts) {
    const sessionIds = (requiredSessionsByAttempt.get(attempt.id) ?? []).map(
      (session) => session.id
    );
    if (sessionIds.length > 0) {
      attendanceClauses.push({
        studentId: attempt.studentId,
        sessionId: { in: sessionIds },
      });
    }
    attendanceClauses.push({
      studentId: attempt.studentId,
      courseId: attempt.courseId,
      semester: attempt.semester,
      academicYear: attempt.academicYear,
      sessionId: null,
      ...(options.dateWhere && { date: options.dateWhere }),
      ...(attempt.exemptionPeriods.length > 0 && {
        NOT: {
          OR: attempt.exemptionPeriods.map((period) => ({
            date: { gte: period.startDate, lte: period.endDate },
          })),
        },
      }),
    });
  }

  const attendances = await prisma.attendance.findMany({
    where: { OR: attendanceClauses },
    select: {
      id: true,
      studentId: true,
      courseId: true,
      semester: true,
      academicYear: true,
      sessionId: true,
      status: true,
      remarks: true,
      date: true,
    },
  });
  const attendanceByStudentSession = new Map(
    attendances
      .filter((attendance) => attendance.sessionId !== null)
      .map((attendance) => [
        `${attendance.studentId}:${attendance.sessionId}`,
        attendance,
      ])
  );

  const calculations = new Map<number, AttendanceCalculation>();
  for (const attempt of attempts) {
    const requiredSessions = requiredSessionsByAttempt.get(attempt.id) ?? [];
    const sessionEntries = requiredSessions.map((session) => {
      const attendance = attendanceByStudentSession.get(
        `${attempt.studentId}:${session.id}`
      );
      return {
        sessionId: session.id,
        date: session.createdAt,
        status: attendance?.status ?? AttendanceStatus.ABSENT,
        remarks: attendance?.remarks ?? null,
        attendanceId: attendance?.id ?? null,
      };
    });
    const standaloneStatuses = attendances
      .filter(
        (attendance) =>
          attendance.sessionId === null &&
          attendance.studentId === attempt.studentId &&
          attendance.courseId === attempt.courseId &&
          attendance.semester === attempt.semester &&
          attendance.academicYear === attempt.academicYear
      )
      .map((attendance) => attendance.status);

    calculations.set(
      attempt.id,
      calculateMetrics(attempt.id, sessionEntries, standaloneStatuses)
    );
  }

  return calculations;
};
