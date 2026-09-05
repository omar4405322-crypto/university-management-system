import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import { auditLog } from '../utils/audit.utils';
import catchAsync from '../utils/catchAsync';
import { NotFoundError, ValidationError, AuthorizationError } from '../utils/appError';
import { TimetableService } from '../services/timetable.service';
import { Prisma } from '@prisma/client';
import { requireExistingCourseStaffAssignments } from '../utils/scheduleAssignment.utils';
import { getAdminMutationScopeWhere } from '../utils/adminMutationScope.utils';
import {
  getScheduleSlotOverrideAccessWhere,
  getScopedScheduleOverrideWhere,
  getScopedScheduleSlotForOverrideWhere,
} from '../utils/scheduleOverrideScope.utils';

const OVERRIDE_ADMIN_ROLES = new Set([
  'SUPER_ADMIN',
  'ADMIN',
  'COLLEGE_ADMIN',
  'DEPARTMENT_ADMIN',
]);

async function requireOverrideReplacementStaffAssignments(
  client: any,
  user: any,
  courseId: number,
  doctorId: number | null | undefined,
  teachingAssistantId: string | null | undefined
): Promise<void> {
  if (!OVERRIDE_ADMIN_ROLES.has(user?.role)) {
    await requireExistingCourseStaffAssignments(client, {
      courseId,
      doctorId,
      teachingAssistantId,
    });
    return;
  }

  if (doctorId !== undefined && doctorId !== null) {
    const doctorAssignment = await client.scheduleSlot.findFirst({
      where: {
        courseId,
        doctorId,
        doctor: { is: getAdminMutationScopeWhere(user, 'doctor') },
      },
      select: { id: true },
    });
    if (!doctorAssignment) {
      throw new AuthorizationError(
        'Replacement doctor must be assigned to the course and inside your managed scope'
      );
    }
  }

  if (teachingAssistantId !== undefined && teachingAssistantId !== null) {
    const teachingAssistantAssignment = await client.scheduleSlot.findFirst({
      where: {
        courseId,
        teachingAssistantId,
        teachingAssistant: {
          is: getAdminMutationScopeWhere(user, 'teachingAssistant'),
        },
      },
      select: { id: true },
    });
    if (!teachingAssistantAssignment) {
      throw new AuthorizationError(
        'Replacement teaching assistant must be assigned to the course and inside your managed scope'
      );
    }
  }
}

function parseReplacementDoctorId(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new ValidationError('doctorId must be a positive integer');
  }
  return parsed;
}

function parseReplacementTeachingAssistantId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 64) {
    throw new ValidationError('teachingAssistantId must be a valid identifier');
  }
  return value;
}

export const createOverride = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const slotId = parseInt(req.params.slotId as string);
  const { startDate, endDate, room, dayOfWeek, startTime, endTime, doctorId, teachingAssistantId, reason } = req.body;
  const replacementDoctorId = parseReplacementDoctorId(doctorId);
  const replacementTeachingAssistantId = parseReplacementTeachingAssistantId(teachingAssistantId);

  if (!Number.isSafeInteger(slotId) || slotId <= 0) {
    return next(new ValidationError('slotId must be a positive integer'));
  }

  if (new Date(startDate) > new Date(endDate)) {
    return next(new ValidationError('startDate must be before or equal to endDate'));
  }

  const slot = await prisma.scheduleSlot.findFirst({
    where: getScopedScheduleSlotForOverrideWhere(req.user!, slotId),
    include: { course: true }
  });
  if (!slot) return next(new AuthorizationError('Schedule slot is outside your override scope'));

  // Ensure no overlapping overrides for this specific slot
  const overlapping = await prisma.scheduleOverride.findFirst({
    where: {
      scheduleSlotId: slotId,
      AND: [
        { startDate: { lte: new Date(endDate) } },
        { endDate: { gte: new Date(startDate) } },
      ],
    },
  });

  if (overlapping) {
    return next(new ValidationError('An override already exists for this slot in the specified date range'));
  }

  const override = await prisma.$transaction(async (tx) => {
    await requireOverrideReplacementStaffAssignments(
      tx,
      req.user!,
      slot.courseId,
      replacementDoctorId,
      replacementTeachingAssistantId
    );

    // Conflict Check (Against Base Schedule)
    await TimetableService.checkConflicts({
      dayOfWeek: dayOfWeek || slot.dayOfWeek,
      startTime: startTime || slot.startTime,
      endTime: endTime || slot.endTime,
      room: room !== undefined ? room : slot.room,
      courseId: slot.courseId,
      doctorId: replacementDoctorId ?? slot.doctorId,
      groupId: slot.groupId,
      teachingAssistantId: replacementTeachingAssistantId ?? slot.teachingAssistantId,
      excludeSlotId: slotId, // We exclude the slot being overridden so it doesn't conflict with itself
    }, tx);

    return tx.scheduleOverride.create({
      data: {
        scheduleSlotId: slotId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        room,
        dayOfWeek,
        startTime,
        endTime,
        doctorId: replacementDoctorId ?? null,
        teachingAssistantId: replacementTeachingAssistantId ?? null,
        reason,
        createdBy: req.user!.id,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  auditLog('CREATE_OVERRIDE', 'ScheduleOverride', override.id.toString(), req);
  res.status(201).json({ success: true, data: override });
});

export const getOverrides = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const slotId = parseInt(req.params.slotId as string);
  if (!Number.isSafeInteger(slotId) || slotId <= 0) {
    return next(new ValidationError('slotId must be a positive integer'));
  }
  const overrides = await prisma.scheduleOverride.findMany({
    where: {
      scheduleSlotId: slotId,
      scheduleSlot: getScheduleSlotOverrideAccessWhere(req.user!),
    },
    orderBy: { startDate: 'desc' },
    include: {
      doctor: { select: { firstName: true, lastName: true } },
      teachingAssistant: { select: { firstName: true, lastName: true } },
    }
  });
  res.json({ success: true, data: overrides });
});

export const updateOverride = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const overrideId = parseInt(req.params.overrideId as string);
  const { startDate, endDate, room, dayOfWeek, startTime, endTime, doctorId, teachingAssistantId, reason } = req.body;
  const replacementDoctorId = parseReplacementDoctorId(doctorId);
  const replacementTeachingAssistantId = parseReplacementTeachingAssistantId(teachingAssistantId);

  if (!Number.isSafeInteger(overrideId) || overrideId <= 0) {
    return next(new ValidationError('overrideId must be a positive integer'));
  }

  const existing = await prisma.scheduleOverride.findFirst({
    where: getScopedScheduleOverrideWhere(req.user!, overrideId),
    include: { scheduleSlot: true }
  });
  if (!existing) return next(new NotFoundError('Override not found'));

  const newStartDate = startDate ? new Date(startDate) : existing.startDate;
  const newEndDate = endDate ? new Date(endDate) : existing.endDate;

  if (newStartDate > newEndDate) {
    return next(new ValidationError('startDate must be before or equal to endDate'));
  }

  const override = await prisma.$transaction(async (tx) => {
    await requireOverrideReplacementStaffAssignments(
      tx,
      req.user!,
      existing.scheduleSlot.courseId,
      replacementDoctorId,
      replacementTeachingAssistantId
    );

    const effectiveDoctorId = replacementDoctorId === undefined
      ? existing.doctorId ?? existing.scheduleSlot.doctorId
      : replacementDoctorId ?? existing.scheduleSlot.doctorId;
    const effectiveTeachingAssistantId = replacementTeachingAssistantId === undefined
      ? existing.teachingAssistantId ?? existing.scheduleSlot.teachingAssistantId
      : replacementTeachingAssistantId ?? existing.scheduleSlot.teachingAssistantId;

    // Conflict Check
    await TimetableService.checkConflicts({
      dayOfWeek: dayOfWeek || existing.dayOfWeek || existing.scheduleSlot.dayOfWeek,
      startTime: startTime || existing.startTime || existing.scheduleSlot.startTime,
      endTime: endTime || existing.endTime || existing.scheduleSlot.endTime,
      room: room !== undefined ? room : (existing.room || existing.scheduleSlot.room),
      courseId: existing.scheduleSlot.courseId,
      doctorId: effectiveDoctorId,
      groupId: existing.scheduleSlot.groupId,
      teachingAssistantId: effectiveTeachingAssistantId,
      excludeSlotId: existing.scheduleSlotId,
    }, tx);

    return tx.scheduleOverride.update({
      where: { id: overrideId },
      data: {
        startDate: newStartDate,
        endDate: newEndDate,
        room,
        dayOfWeek,
        startTime,
        endTime,
        doctorId: replacementDoctorId,
        teachingAssistantId: replacementTeachingAssistantId,
        reason,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  auditLog('UPDATE_OVERRIDE', 'ScheduleOverride', override.id.toString(), req);
  res.json({ success: true, data: override });
});

export const deleteOverride = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const overrideId = parseInt(req.params.overrideId as string);
  if (!Number.isSafeInteger(overrideId) || overrideId <= 0) {
    return next(new ValidationError('overrideId must be a positive integer'));
  }

  const existing = await prisma.scheduleOverride.findFirst({
    where: getScopedScheduleOverrideWhere(req.user!, overrideId),
    include: { scheduleSlot: true }
  });
  if (!existing) return next(new NotFoundError('Override not found'));

  await prisma.scheduleOverride.delete({ where: { id: overrideId } });
  auditLog('DELETE_OVERRIDE', 'ScheduleOverride', overrideId.toString(), req);
  res.json({ success: true, message: 'Override deleted' });
});
