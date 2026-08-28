import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import { auditLog } from '../utils/audit.utils';
import catchAsync from '../utils/catchAsync';
import { NotFoundError, ValidationError, AuthorizationError } from '../utils/appError';
import { TimetableService } from '../services/timetable.service';
import { Prisma } from '@prisma/client';

export const createOverride = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const slotId = parseInt(req.params.slotId as string);
  const { startDate, endDate, room, dayOfWeek, startTime, endTime, doctorId, teachingAssistantId, reason } = req.body;

  if (new Date(startDate) > new Date(endDate)) {
    return next(new ValidationError('startDate must be before or equal to endDate'));
  }

  const slot = await prisma.scheduleSlot.findUnique({
    where: { id: slotId },
    include: { course: true }
  });
  if (!slot) return next(new NotFoundError('ScheduleSlot not found'));

  if (req.user!.role === 'DOCTOR') {
    const myDoctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
    if (!myDoctor || slot.doctorId !== myDoctor.id) {
      return next(new AuthorizationError('You can only override slots for your own sections'));
    }
  }
  if (req.user!.role === 'TEACHING_ASSISTANT' && slot.teachingAssistantId !== req.user!.teachingAssistant?.id) {
    return next(new AuthorizationError('You can only override slots assigned to you'));
  }

  // Verify Admin Scope
  if (req.user!.role === 'DEPARTMENT_ADMIN' && req.user!.managedDepartmentId) {
    if (slot.course.departmentId !== req.user!.managedDepartmentId) return next(new AuthorizationError('Out of scope'));
  } else if ((req.user!.role === 'ADMIN' || req.user!.role === 'COLLEGE_ADMIN') && req.user!.managedCollegeId) {
    const dept = slot.course.departmentId
      ? await prisma.department.findUnique({ where: { id: slot.course.departmentId } })
      : null;
    if (dept?.collegeId !== req.user!.managedCollegeId) return next(new AuthorizationError('Out of scope'));
  }

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
    // Conflict Check (Against Base Schedule)
    await TimetableService.checkConflicts({
      dayOfWeek: dayOfWeek || slot.dayOfWeek,
      startTime: startTime || slot.startTime,
      endTime: endTime || slot.endTime,
      room: room !== undefined ? room : slot.room,
      courseId: slot.courseId,
      doctorId: doctorId ? parseInt(doctorId) : slot.doctorId,
      groupId: slot.groupId,
      teachingAssistantId: teachingAssistantId !== undefined ? teachingAssistantId : slot.teachingAssistantId,
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
        doctorId: doctorId ? parseInt(doctorId) : null,
        teachingAssistantId,
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
  const overrides = await prisma.scheduleOverride.findMany({
    where: { scheduleSlotId: slotId },
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

  const existing = await prisma.scheduleOverride.findUnique({
    where: { id: overrideId },
    include: { scheduleSlot: true }
  });
  if (!existing) return next(new NotFoundError('Override not found'));

  if (req.user!.role === 'DOCTOR') {
    const myDoctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
    if (!myDoctor || existing.scheduleSlot.doctorId !== myDoctor.id) {
      return next(new AuthorizationError('You can only update overrides for your own sections'));
    }
  }
  if (req.user!.role === 'TEACHING_ASSISTANT' && existing.scheduleSlot.teachingAssistantId !== req.user!.teachingAssistant?.id) {
    return next(new AuthorizationError('You can only update overrides for slots assigned to you'));
  }

  const newStartDate = startDate ? new Date(startDate) : existing.startDate;
  const newEndDate = endDate ? new Date(endDate) : existing.endDate;

  if (newStartDate > newEndDate) {
    return next(new ValidationError('startDate must be before or equal to endDate'));
  }

  const override = await prisma.$transaction(async (tx) => {
    // Conflict Check
    await TimetableService.checkConflicts({
      dayOfWeek: dayOfWeek || existing.dayOfWeek || existing.scheduleSlot.dayOfWeek,
      startTime: startTime || existing.startTime || existing.scheduleSlot.startTime,
      endTime: endTime || existing.endTime || existing.scheduleSlot.endTime,
      room: room !== undefined ? room : (existing.room || existing.scheduleSlot.room),
      courseId: existing.scheduleSlot.courseId,
      doctorId: doctorId ? parseInt(doctorId) : (existing.doctorId || existing.scheduleSlot.doctorId),
      groupId: existing.scheduleSlot.groupId,
      teachingAssistantId: teachingAssistantId !== undefined ? teachingAssistantId : (existing.teachingAssistantId || existing.scheduleSlot.teachingAssistantId),
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
        doctorId: doctorId ? parseInt(doctorId) : null,
        teachingAssistantId,
        reason,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  auditLog('UPDATE_OVERRIDE', 'ScheduleOverride', override.id.toString(), req);
  res.json({ success: true, data: override });
});

export const deleteOverride = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const overrideId = parseInt(req.params.overrideId as string);
  const existing = await prisma.scheduleOverride.findUnique({ 
    where: { id: overrideId },
    include: { scheduleSlot: true }
  });
  if (!existing) return next(new NotFoundError('Override not found'));

  if (req.user!.role === 'DOCTOR') {
    const myDoctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
    if (!myDoctor || existing.scheduleSlot.doctorId !== myDoctor.id) {
      return next(new AuthorizationError('You can only delete overrides for your own sections'));
    }
  }
  if (req.user!.role === 'TEACHING_ASSISTANT' && existing.scheduleSlot.teachingAssistantId !== req.user!.teachingAssistant?.id) {
    return next(new AuthorizationError('You can only delete overrides for slots assigned to you'));
  }

  await prisma.scheduleOverride.delete({ where: { id: overrideId } });
  auditLog('DELETE_OVERRIDE', 'ScheduleOverride', overrideId.toString(), req);
  res.json({ success: true, message: 'Override deleted' });
});
