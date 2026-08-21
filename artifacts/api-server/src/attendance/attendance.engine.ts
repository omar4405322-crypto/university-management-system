import { AttendanceMethod, AttendanceStatus, Prisma } from '@prisma/client';
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

export interface RecordAttendanceOptions {
  method: AttendanceMethod;
  payload: Record<string, any>;
  ctx: DriverValidationContext;
}

export interface RecordAttendanceResult {
  attendance: any;
  isNew: boolean;
  existingStatus?: AttendanceStatus;
  warnings?: string[];
  message?: string;
}

export interface BulkManualRecord {
  studentId: number;
  status: AttendanceStatus;
  remarks?: string;
}

class AttendanceEngine {
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

    const txResult = await prisma.$transaction(
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
          ...(intent.recordedById !== undefined && intent.recordedById !== null && {
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
          ...(intent.scheduleSlotId !== undefined &&
            intent.scheduleSlotId !== null && {
              scheduleSlotId: intent.scheduleSlotId,
            }),
          ...(intent.sessionId !== undefined &&
            intent.sessionId !== null && {
              sessionId: intent.sessionId,
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

        return { attendance, isNew: wasChange, existingStatus };
      },
      { isolationLevel: 'Serializable' }
    );

    if (txResult.isNew) {
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

    const results = await Promise.all(
      records.map((record) =>
        this.recordAttendance({
          method: 'MANUAL',
          payload: {
            studentId: record.studentId,
            status: record.status,
            remarks: record.remarks,
            sessionId: ctx.sessionId,
          },
          ctx,
        })
      )
    );

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
        await this.recalculateAbsence(intent.studentId, intent.courseId);
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
      default:
        return status;
    }
  }

  async recalculateAbsence(studentId: number, courseId: number): Promise<void> {
    const statsData = await prisma.attendance.groupBy({
      by: ['status'],
      where: { studentId, courseId },
      _count: true,
    });

    let total = 0;
    let excused = 0;
    let absent = 0;
    let late = 0;

    statsData.forEach((item: any) => {
      total += item._count;
      if (item.status === 'EXCUSED') excused += item._count;
      if (item.status === 'ABSENT') absent += item._count;
      if (item.status === 'LATE') late += item._count;
    });

    const activeTotal = total - excused;
    const absencePercent =
      activeTotal > 0 ? ((absent + late * 0.5) / activeTotal) * 100 : 0;

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { department: true },
    });

    const policies = await prisma.absenceThresholdPolicy.findMany({
      where: {
        OR: [
          { courseId },
          { departmentId: course?.departmentId },
          { departmentId: null, courseId: null },
        ],
      },
    });

    let policy = policies.find((p: any) => p.courseId === courseId);
    if (!policy)
      policy = policies.find((p: any) => p.departmentId === course?.departmentId);
    if (!policy)
      policy = policies.find(
        (p: any) => p.courseId === null && p.departmentId === null
      );

    const maxAbsencePercent = policy ? policy.maxAbsencePercent : 25;

    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId, courseId },
      orderBy: [{ academicYear: 'desc' }, { semester: 'desc' }, { id: 'desc' }],
    });

    if (!enrollment || (enrollment.status !== 'ENROLLED' && enrollment.status !== 'BLOCKED')) return;

    if (absencePercent >= maxAbsencePercent) {
      if (enrollment.status !== 'BLOCKED') {
        await prisma.enrollment.update({
          where: { id: enrollment.id },
          data: { status: 'BLOCKED' },
        });

        const student = await prisma.student.findUnique({
          where: { id: studentId },
        });
        if (student) {
          await createNotification({
            userId: student.userId,
            title: 'Enrollment Blocked',
            message: `Your enrollment in ${course?.name} has been blocked due to exceeding the maximum absence limit (${maxAbsencePercent}%).`,
            type: 'error',
          });
        }
      }
    } else if (enrollment.status === 'BLOCKED') {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { status: 'ENROLLED' },
      });

      const student = await prisma.student.findUnique({
        where: { id: studentId },
      });
      if (student) {
        await createNotification({
          userId: student.userId,
          title: 'Enrollment Restored',
          message: `Your enrollment in ${course?.name} has been restored as your absence rate (${absencePercent.toFixed(1)}%) is now below the limit (${maxAbsencePercent}%).`,
          type: 'success',
        });
      }
    }
  }
}

export const attendanceEngine = new AttendanceEngine();
export default attendanceEngine;
