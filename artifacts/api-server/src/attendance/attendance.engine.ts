import { AttendanceMethod, AttendanceStatus, Prisma, Attendance } from '@prisma/client';
import prisma from '../utils/prismaClient';
import { AppError, ConflictError } from '../utils/appError';
import { createNotification } from '../utils/notification.utils';
import logger from '../utils/logger';
import driverRegistry from './drivers';
import {
  AttendanceIntent,
  DriverValidationContext,
  IAttendanceDriver,
} from './drivers/IAttendanceDriver';
import { requireManualAttendanceAccess } from '../utils/manualAttendanceScope.utils';
import { availableParallelism } from 'node:os';

const MAX_BULK_ATTENDANCE_CONCURRENCY = 8;
const ABSENCE_RECALCULATION_BATCH_SIZE = 100;

function getPrismaConnectionLimit(): number {
  const configuredUrl = process.env.DATABASE_URL;
  if (configuredUrl) {
    try {
      const configuredLimit = Number(
        new URL(configuredUrl).searchParams.get('connection_limit')
      );
      if (Number.isSafeInteger(configuredLimit) && configuredLimit > 0) {
        return configuredLimit;
      }
    } catch {
      // Prisma will report an invalid DATABASE_URL; use its default pool sizing here.
    }
  }

  return availableParallelism() * 2 + 1;
}

function getBulkAttendanceConcurrency(): number {
  const connectionLimit = getPrismaConnectionLimit();
  return Math.max(
    1,
    Math.min(
      MAX_BULK_ATTENDANCE_CONCURRENCY,
      Math.floor(connectionLimit / 2)
    )
  );
}

export interface RecordAttendanceOptions {
  method: AttendanceMethod;
  payload: Record<string, any>;
  ctx: DriverValidationContext;
}

export interface RecordAttendanceResult {
  attendance: Attendance | null;
  isNew: boolean;
  existingStatus?: AttendanceStatus;
  warnings?: string[];
  message?: string;
  wasChange?: boolean;
  alreadyRecorded?: boolean;
  recordedAt?: Date;
  overlapBlocked?: boolean;
  conflictingCourse?: {
    courseCode: string;
    name: string;
    startTime: string;
    endTime: string;
  };
}

export interface BulkManualRecord {
  studentId: number;
  status: AttendanceStatus;
  remarks?: string;
}

interface AbsenceRecalculationKey {
  studentId: number;
  courseId: number;
}

interface PendingAbsenceRecalculation extends AbsenceRecalculationKey {
  waiters: Array<{
    resolve: () => void;
    reject: (reason?: unknown) => void;
  }>;
}

class AttendanceEngine {
  private readonly pendingAbsenceRecalculations = new Map<
    string,
    PendingAbsenceRecalculation
  >();
  private absenceRecalculationFlushScheduled = false;
  private absenceRecalculationFlushRunning = false;

  getDriver(method: AttendanceMethod): IAttendanceDriver {
    const driver = driverRegistry.get(method);
    if (!driver) {
      throw new AppError(
        `Unsupported attendance method: ${method}. Supported methods: ${driverRegistry.supportedMethods().join(', ')}`,
        400
      );
    }
    return driver;
  }

  async recordAttendance(
    options: RecordAttendanceOptions
  ): Promise<RecordAttendanceResult> {
    const { method, payload, ctx } = options;
    const driver = this.getDriver(method);
    const warnings: string[] = [];

    const intent = await driver.buildIntent(payload, ctx);
    if (method === AttendanceMethod.MANUAL) {
      await requireManualAttendanceAccess(
        { courseId: intent.courseId, sessionId: intent.sessionId },
        ctx
      );
    }
    await this.validateIntent(intent, ctx);

    let targetSemester: number | undefined;

    if (intent.sessionId) {
      const session = await prisma.attendanceSession.findUnique({
        where: { id: intent.sessionId },
        include: {
          scheduleSlot: {
            include: {
              course: true,
              timetable: true,
            },
          },
        },
      });

      if (!session) {
        throw new AppError('Session not found', 404);
      }

      if (!session.isActive) {
        throw new AppError('Session is closed', 400);
      }

      if (!intent.courseId) intent.courseId = session.scheduleSlot.courseId;
      if (!intent.scheduleSlotId) intent.scheduleSlotId = session.scheduleSlot.id;

      targetSemester =
        session.scheduleSlot.timetable?.semester ||
        session.scheduleSlot.course?.semester;
    } else if (payload?.semester !== undefined || (ctx as any)?.semester !== undefined) {
      targetSemester = parseInt(payload?.semester ?? (ctx as any)?.semester);
    } else {
      throw new AppError('Semester is required for standalone attendance recording', 400);
    }

    if (intent.courseId && intent.studentId !== undefined) {
      const enrollments = await prisma.enrollment.findMany({
        where: {
          studentId: intent.studentId,
          courseId: intent.courseId,
          ...(targetSemester !== undefined && { semester: targetSemester }),
        },
        orderBy: [
          { academicYear: 'desc' },
          { id: 'desc' },
        ],
      });

      if (enrollments.length === 0) {
        throw new AppError('عذراً، أنت غير مسجل في هذا المقرر الدراسي.', 403);
      }

      const enrollment = enrollments[0];

      if (enrollment.status === 'BLOCKED') {
        throw new AppError(
          'عذراً، تم حظر تسجيلك في هذا المقرر بسبب تجاوز نسبة الغياب.',
          403
        );
      }

      if (enrollment.status !== 'ENROLLED') {
        throw new AppError(
          'عذراً، لا يمكنك تسجيل الحضور لأنك غير مسجل حالياً في هذا المقرر الدراسي.',
          403
        );
      }
    }

    interface TransactionResult {
      attendance: Attendance | null;
      isNew: boolean;
      existingStatus?: AttendanceStatus;
      wasChange?: boolean;
      alreadyRecorded?: boolean;
      recordedAt?: Date;
      overlapBlocked?: boolean;
      conflictingCourse?: {
        courseCode: string;
        name: string;
        startTime: string;
        endTime: string;
      };
    }

    const txResult = await prisma.$transaction<TransactionResult>(
      async (tx) => {
        if (
          intent.deviceId &&
          intent.ipAddress &&
          intent.sessionId &&
          (intent.method === 'QR' || intent.method === 'GPS') // Duplicate-device check applies to student self-submission methods (QR & GPS)
        ) {
          const duplicate = await tx.attendance.findFirst({
            where: {
              sessionId: intent.sessionId,
              ipAddress: intent.ipAddress as string,
              deviceId: intent.deviceId as string,
              studentId: { not: intent.studentId },
            },
          });

          if (duplicate) {
            throw new AppError(
              'تم استخدام هذا الجهاز لتقييد حضور طالب آخر في هذه الجلسة.',
              403
            );
          }
        }

        let existingStatus: AttendanceStatus | undefined;
        let existingId: number | undefined;
        let existingIsPresentOrLate: boolean = false;

        if (intent.sessionId) {
          const existing = await tx.attendance.findUnique({
            where: {
              studentId_sessionId: {
                studentId: intent.studentId,
                sessionId: intent.sessionId,
              },
            },
          });

          if (existing) {
            existingId = existing.id;
            existingStatus = existing.status;
            existingIsPresentOrLate =
              existing.status === 'PRESENT' || existing.status === 'LATE';

            // Hard-block: self-service methods cannot overwrite an existing PRESENT/LATE record
            if (
              existingIsPresentOrLate &&
              ['QR', 'RFID', 'GPS', 'FACE'].includes(intent.method)
            ) {
              return {
                attendance: existing,
                isNew: false,
                existingStatus,
                alreadyRecorded: true,
                recordedAt: existing.createdAt,
              };
            }

            const targetStatus: AttendanceStatus =
              (intent.status as AttendanceStatus) || 'PRESENT';

            if (
              existingIsPresentOrLate &&
              existing.status === targetStatus &&
              targetStatus !== 'LATE' &&
              targetStatus !== 'PRESENT'
            ) {
              return { attendance: existing, isNew: false, existingStatus };
            }
          }
        }

        const attendanceDate = intent.date || new Date();
        attendanceDate.setHours(0, 0, 0, 0);

        // Hard-block: prevent self-service check-in to overlapping lectures on the same day
        if (
          ['QR', 'RFID', 'GPS', 'FACE'].includes(intent.method) &&
          intent.scheduleSlotId
        ) {
          const currentSlot = await tx.scheduleSlot.findUnique({
            where: { id: intent.scheduleSlotId }
          });

          if (currentSlot && currentSlot.startTime && currentSlot.endTime) {
            const parseTime = (timeStr: string) => {
              const [hours, minutes] = timeStr.split(':').map(Number);
              return hours * 60 + minutes;
            };

            const currentStart = parseTime(currentSlot.startTime);
            const currentEnd = parseTime(currentSlot.endTime);

            const otherAttendances = await tx.attendance.findMany({
              where: {
                studentId: intent.studentId,
                date: attendanceDate,
                scheduleSlotId: { not: intent.scheduleSlotId },
                status: { in: ['PRESENT', 'LATE'] }
              },
              include: {
                scheduleSlot: {
                  include: { course: true }
                }
              }
            });

            for (const other of otherAttendances) {
              if (
                other.scheduleSlot &&
                other.scheduleSlot.startTime &&
                other.scheduleSlot.endTime
              ) {
                const otherStart = parseTime(other.scheduleSlot.startTime);
                const otherEnd = parseTime(other.scheduleSlot.endTime);

                if (currentStart < otherEnd && otherStart < currentEnd) {
                  return {
                    attendance: null,
                    isNew: false,
                    overlapBlocked: true,
                    conflictingCourse: {
                      courseCode: other.scheduleSlot.course.courseCode,
                      name: other.scheduleSlot.course.name,
                      startTime: other.scheduleSlot.startTime,
                      endTime: other.scheduleSlot.endTime
                    }
                  };
                }
              }
            }
          }
        }

        if (existingId === undefined && intent.courseId) {
          const existingByDate = await tx.attendance.findFirst({
            where: {
              studentId: intent.studentId,
              courseId: intent.courseId,
              date: attendanceDate,
            },
          });

          if (existingByDate) {
            existingId = existingByDate.id;
            if (existingStatus === undefined) {
              existingStatus = existingByDate.status;
            }
          }
        }

        const updateData: Prisma.AttendanceUpdateInput = {
          status: intent.status || 'PRESENT',
          method: intent.method,
          ...(intent.remarks !== undefined && { remarks: intent.remarks }),
          ...(intent.recordedById !== undefined &&
            intent.recordedById !== null && {
              recordedBy: { connect: { id: intent.recordedById } },
            }),
          ...(intent.ipAddress !== undefined && {
            ipAddress: intent.ipAddress,
          }),
          ...(intent.deviceId !== undefined && { deviceId: intent.deviceId }),
          ...(intent.locationData !== undefined && {
            locationData: intent.locationData as any,
          }),
          ...(intent.locationFlagged !== undefined && {
            locationFlagged: intent.locationFlagged,
          }),
          ...(intent.pendingApprovedStatus !== undefined && {
            pendingApprovedStatus: intent.pendingApprovedStatus,
          }),
          ...(intent.scheduleSlotId !== undefined &&
            intent.scheduleSlotId !== null && {
              scheduleSlot: { connect: { id: intent.scheduleSlotId } },
            }),
          ...(intent.sessionId !== undefined &&
            intent.sessionId !== null && {
              session: { connect: { id: intent.sessionId } },
            }),
        };

        const createData: Prisma.AttendanceCreateInput = {
          student: { connect: { id: intent.studentId } },
          course: { connect: { id: intent.courseId! } },
          date: attendanceDate,
          status: intent.status || 'PRESENT',
          method: intent.method,
          ...(intent.remarks && { remarks: intent.remarks }),
          ...(intent.recordedById !== undefined && intent.recordedById !== null && {
            recordedBy: { connect: { id: intent.recordedById } },
          }),
          ...(intent.ipAddress && { ipAddress: intent.ipAddress }),
          ...(intent.deviceId && { deviceId: intent.deviceId }),
          ...(intent.locationData && {
            locationData: intent.locationData as any,
          }),
          ...(intent.locationFlagged !== undefined && { locationFlagged: intent.locationFlagged }),
          ...(intent.pendingApprovedStatus !== undefined && {
            pendingApprovedStatus: intent.pendingApprovedStatus,
          }),
          ...(intent.sessionId && {
            session: { connect: { id: intent.sessionId } },
          }),
          ...(intent.scheduleSlotId && {
            scheduleSlot: { connect: { id: intent.scheduleSlotId } },
          }),
        };

        const attendance =
          existingId !== undefined
            ? await tx.attendance.update({
                where: { id: existingId },
                data: updateData,
              })
            : await tx.attendance.create({ data: createData });

        const wasChange =
          existingStatus === undefined || existingStatus !== attendance.status;

        return { attendance, isNew: existingId === undefined, existingStatus, wasChange };
      },
      { isolationLevel: 'Serializable' }
    );

    if (txResult.wasChange) {
      setImmediate(() => {
        this.postProcessAsync(intent).catch((err) =>
          logger.error(
            `[ATTENDANCE-ENGINE] Post-process failed: ${err.message}`
          )
        );
      });
    }

    let message: string | undefined;
    if (intent.locationFlagged) {
      message =
        'أنت خارج نطاق القاعة الجغرافي. تم تسجيل الطلب وتحويله لقائمة المراجعة لدى الدكتور.';
    }

    return {
      ...txResult,
      warnings,
      message,
    };
  }

  async recordBulkManual(
    records: BulkManualRecord[],
    ctx: DriverValidationContext & {
      sessionId?: number;
      courseId?: number;
    }
  ): Promise<any[]> {
    if (!records || records.length === 0) {
      throw new AppError('No attendance records provided', 400);
    }

    await requireManualAttendanceAccess(
      { courseId: ctx.courseId, sessionId: ctx.sessionId },
      ctx
    );

    const concurrency = getBulkAttendanceConcurrency();
    const results: RecordAttendanceResult[] = [];

    for (let index = 0; index < records.length; index += concurrency) {
      const chunk = records.slice(index, index + concurrency);
      const chunkResults = await Promise.all(
        chunk.map((record) =>
          this.recordAttendance({
            method: 'MANUAL',
            payload: {
              studentId: record.studentId,
              status: record.status,
              remarks: record.remarks,
              sessionId: ctx.sessionId,
              courseId: ctx.courseId,
            },
            ctx,
          })
        )
      );
      results.push(...chunkResults);
    }

    return results.map((r) => r.attendance);
  }

  private async validateIntent(
    intent: AttendanceIntent,
    ctx: DriverValidationContext
  ): Promise<void> {
    if (!intent.studentId) {
      throw new AppError('Student ID is required', 400);
    }

    if (!intent.courseId && !intent.sessionId) {
      throw new AppError(
        'Either courseId or sessionId must be provided',
        400
      );
    }
  }

  private async postProcessAsync(intent: AttendanceIntent): Promise<void> {
    try {
      if (intent.courseId) {
        await this.queueAbsenceRecalculation(intent.studentId, intent.courseId);
      }

      if (intent.status && intent.status !== 'PRESENT' && intent.courseId) {
        const student = await prisma.student.findUnique({
          where: { id: intent.studentId },
          include: { user: true },
        });
        const course = await prisma.course.findUnique({
          where: { id: intent.courseId },
        });

        if (student && course && student.user) {
          const type = intent.status === 'ABSENT' ? 'error' : 'warning';
          const methodLabel =
            intent.method === 'QR'
              ? 'عبر رمز الاستجابة السريعة'
              : intent.method === 'RFID'
              ? 'عبر جهاز RFID'
              : intent.method === 'MANUAL'
              ? 'يدوياً'
              : '';
          await createNotification({
            userId: student.userId,
            title:
              intent.status === 'ABSENT'
                ? 'تم تسجيل غيابك'
                : 'تم تسجيل حضورك (متأخر)',
            message: `لقد تم تسجيلك ${this.statusArabic(intent.status)} في ${course.name} ${methodLabel}.`,
            type,
          });
        }
      }
    } catch (err: any) {
      logger.error(
        `[ATTENDANCE-ENGINE] Post-process notification/absence failed: ${err.message}`
      );
    }
  }

  private statusArabic(status: AttendanceStatus): string {
    switch (status) {
      case 'PRESENT':
        return 'حاضراً';
      case 'ABSENT':
        return 'غائباً';
      case 'LATE':
        return 'حاضراً متأخراً';
      case 'EXCUSED':
        return 'بعذر';
      case 'PENDING_REVIEW':
        return 'قيد المراجعة';
      default:
        return status;
    }
  }

  async recalculateAbsence(studentId: number, courseId: number): Promise<void> {
    await this.recalculateAbsenceBatch([{ studentId, courseId }]);
  }

  queueAbsenceRecalculation(studentId: number, courseId: number): Promise<void> {
    const key = `${studentId}:${courseId}`;

    const completion = new Promise<void>((resolve, reject) => {
      const pending = this.pendingAbsenceRecalculations.get(key);
      if (pending) {
        pending.waiters.push({ resolve, reject });
      } else {
        this.pendingAbsenceRecalculations.set(key, {
          studentId,
          courseId,
          waiters: [{ resolve, reject }],
        });
      }
    });

    if (
      !this.absenceRecalculationFlushScheduled &&
      !this.absenceRecalculationFlushRunning
    ) {
      this.absenceRecalculationFlushScheduled = true;
      setImmediate(() => {
        void this.flushAbsenceRecalculationQueue();
      });
    }

    return completion;
  }

  private async flushAbsenceRecalculationQueue(): Promise<void> {
    this.absenceRecalculationFlushScheduled = false;
    if (this.absenceRecalculationFlushRunning) return;

    this.absenceRecalculationFlushRunning = true;
    try {
      while (this.pendingAbsenceRecalculations.size > 0) {
        const batch = Array.from(this.pendingAbsenceRecalculations.values()).slice(
          0,
          ABSENCE_RECALCULATION_BATCH_SIZE
        );
        for (const pending of batch) {
          this.pendingAbsenceRecalculations.delete(
            `${pending.studentId}:${pending.courseId}`
          );
        }

        try {
          await this.recalculateAbsenceBatch(batch);
          batch.forEach((pending) =>
            pending.waiters.forEach(({ resolve }) => resolve())
          );
        } catch (error) {
          batch.forEach((pending) =>
            pending.waiters.forEach(({ reject }) => reject(error))
          );
        }
      }
    } finally {
      this.absenceRecalculationFlushRunning = false;
      if (
        this.pendingAbsenceRecalculations.size > 0 &&
        !this.absenceRecalculationFlushScheduled
      ) {
        this.absenceRecalculationFlushScheduled = true;
        setImmediate(() => {
          void this.flushAbsenceRecalculationQueue();
        });
      }
    }
  }

  private async recalculateAbsenceBatch(
    requestedKeys: AbsenceRecalculationKey[]
  ): Promise<void> {
    const uniqueKeys = Array.from(
      new Map(
        requestedKeys.map((key) => [`${key.studentId}:${key.courseId}`, key])
      ).values()
    );
    if (uniqueKeys.length === 0) return;

    const enrollmentRows = await prisma.enrollment.findMany({
      where: {
        OR: uniqueKeys.map(({ studentId, courseId }) => ({
          studentId,
          courseId,
        })),
      },
      select: {
        id: true,
        studentId: true,
        courseId: true,
        semester: true,
        academicYear: true,
        status: true,
        customAbsenceThreshold: true,
        exemptionPeriods: {
          select: { startDate: true, endDate: true },
        },
        student: { select: { userId: true } },
        course: { select: { name: true, departmentId: true } },
      },
    });

    const latestEnrollmentByKey = new Map<string, (typeof enrollmentRows)[number]>();
    for (const enrollment of enrollmentRows) {
      const key = `${enrollment.studentId}:${enrollment.courseId}`;
      const current = latestEnrollmentByKey.get(key);
      if (
        !current ||
        enrollment.academicYear > current.academicYear ||
        (enrollment.academicYear === current.academicYear &&
          enrollment.semester > current.semester) ||
        (enrollment.academicYear === current.academicYear &&
          enrollment.semester === current.semester &&
          enrollment.id > current.id)
      ) {
        latestEnrollmentByKey.set(key, enrollment);
      }
    }

    const enrollments = Array.from(latestEnrollmentByKey.values()).filter(
      (enrollment) =>
        enrollment.status === 'ENROLLED' || enrollment.status === 'BLOCKED'
    );
    if (enrollments.length === 0) return;

    const attendanceScopes: Prisma.AttendanceWhereInput[] = enrollments.map(
      (enrollment) => ({
        studentId: enrollment.studentId,
        courseId: enrollment.courseId,
        ...(enrollment.exemptionPeriods.length > 0 && {
          NOT: {
            OR: enrollment.exemptionPeriods.map((period) => ({
              date: { gte: period.startDate, lte: period.endDate },
            })),
          },
        }),
      })
    );
    const courseIds = Array.from(
      new Set(enrollments.map((enrollment) => enrollment.courseId))
    );
    const departmentIds = Array.from(
      new Set(
        enrollments
          .map((enrollment) => enrollment.course.departmentId)
          .filter((departmentId): departmentId is number => departmentId !== null)
      )
    );

    const [attendanceGroups, policies] = await Promise.all([
      prisma.attendance.groupBy({
        by: ['studentId', 'courseId', 'status'],
        where: { OR: attendanceScopes },
        _count: { _all: true },
      }),
      prisma.absenceThresholdPolicy.findMany({
        where: {
          OR: [
            { courseId: { in: courseIds } },
            ...(departmentIds.length > 0
              ? [{ departmentId: { in: departmentIds } }]
              : []),
            { departmentId: null, courseId: null },
          ],
        },
      }),
    ]);

    const countsByEnrollment = new Map<string, Map<AttendanceStatus, number>>();
    for (const group of attendanceGroups) {
      const key = `${group.studentId}:${group.courseId}`;
      const counts = countsByEnrollment.get(key) ?? new Map();
      counts.set(group.status, group._count._all);
      countsByEnrollment.set(key, counts);
    }

    for (const enrollment of enrollments) {
      const counts = countsByEnrollment.get(
        `${enrollment.studentId}:${enrollment.courseId}`
      );
      const total = counts
        ? Array.from(counts.values()).reduce((sum, count) => sum + count, 0)
        : 0;
      const excused = counts?.get('EXCUSED') ?? 0;
      const pendingReview = counts?.get('PENDING_REVIEW') ?? 0;
      const absent = counts?.get('ABSENT') ?? 0;
      const late = counts?.get('LATE') ?? 0;
      const activeTotal = total - excused - pendingReview;
      const absencePercent =
        activeTotal > 0 ? ((absent + late * 0.5) / activeTotal) * 100 : 0;

      let maxAbsencePercent = enrollment.customAbsenceThreshold ?? 25;
      if (
        enrollment.customAbsenceThreshold === null ||
        enrollment.customAbsenceThreshold === undefined
      ) {
        const policy =
          policies.find((candidate) => candidate.courseId === enrollment.courseId) ||
          policies.find(
            (candidate) =>
              candidate.departmentId === enrollment.course.departmentId
          ) ||
          policies.find(
            (candidate) =>
              candidate.courseId === null && candidate.departmentId === null
          );
        if (policy) maxAbsencePercent = policy.maxAbsencePercent;
      }

      if (
        absencePercent >= maxAbsencePercent &&
        enrollment.status !== 'BLOCKED'
      ) {
        await prisma.enrollment.update({
          where: { id: enrollment.id },
          data: { status: 'BLOCKED' },
        });
        await createNotification({
          userId: enrollment.student.userId,
          title: 'Enrollment Blocked',
          message: `Your enrollment in ${enrollment.course.name} has been blocked due to exceeding the maximum absence limit (${maxAbsencePercent}%).`,
          type: 'error',
        });
      } else if (
        absencePercent < maxAbsencePercent &&
        enrollment.status === 'BLOCKED'
      ) {
        await prisma.enrollment.update({
          where: { id: enrollment.id },
          data: { status: 'ENROLLED' },
        });
        await createNotification({
          userId: enrollment.student.userId,
          title: 'Enrollment Restored',
          message: `Your enrollment in ${enrollment.course.name} has been restored as your absence rate (${absencePercent.toFixed(1)}%) is now below the limit (${maxAbsencePercent}%).`,
          type: 'success',
        });
      }
    }
  }
}

export const attendanceEngine = new AttendanceEngine();
export default attendanceEngine;
