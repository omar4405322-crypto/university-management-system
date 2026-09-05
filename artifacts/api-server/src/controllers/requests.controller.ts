import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import catchAsync from '../utils/catchAsync';
import { AppError, NotFoundError, AuthorizationError, ValidationError } from '../utils/appError';
import { auditLog } from '../utils/audit.utils';
import { TimetableService } from '../services/timetable.service';
import { Prisma } from '@prisma/client';
import {
  getAdminMutationScopeWhere,
  getAdminMutationTargetWhere,
  isAdminMutationScopeConfigured,
} from '../utils/adminMutationScope.utils';

const ADMIN_ROLES = new Set([
  'SUPER_ADMIN',
  'ADMIN',
  'COLLEGE_ADMIN',
  'DEPARTMENT_ADMIN',
]);

function getScopedRequestWhere(user: any, requestId: number) {
  return {
    AND: [
      { id: requestId },
      { course: getAdminMutationScopeWhere(user, 'course') },
    ],
  };
}

function getScopedRequestSlotWhere(user: any, slotId: number, courseId: number) {
  return {
    AND: [
      { id: slotId, courseId },
      { course: getAdminMutationScopeWhere(user, 'course') },
    ],
  };
}

export const createRequest = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { type, courseId, scheduleSlotId, proposedData, reason } = req.body;

  const parsedCourseId = Number(courseId);
  const parsedScheduleSlotId = scheduleSlotId !== undefined && scheduleSlotId !== null
    ? Number(scheduleSlotId)
    : null;
  if (!Number.isSafeInteger(parsedCourseId) || parsedCourseId <= 0) {
    return next(new ValidationError('courseId must be a positive integer'));
  }
  if (
    parsedScheduleSlotId !== null &&
    (!Number.isSafeInteger(parsedScheduleSlotId) || parsedScheduleSlotId <= 0)
  ) {
    return next(new ValidationError('scheduleSlotId must be a positive integer'));
  }
  if (type !== 'NEW_SLOT' && parsedScheduleSlotId === null) {
    return next(new ValidationError('scheduleSlotId is required for this request type'));
  }

  if (req.user!.role === 'DOCTOR') {
    const doctorId = req.user!.doctor?.id;
    if (!Number.isInteger(doctorId)) {
      return next(new AuthorizationError('Doctor profile not found'));
    }
    const ownedResource = parsedScheduleSlotId === null
      ? await prisma.course.findFirst({
          where: {
            id: parsedCourseId,
            scheduleSlots: { some: { doctorId } },
          },
          select: { id: true },
        })
      : await prisma.scheduleSlot.findFirst({
          where: {
            id: parsedScheduleSlotId,
            courseId: parsedCourseId,
            doctorId,
          },
          select: { id: true },
        });
    if (!ownedResource) {
      return next(new AuthorizationError('You can only request changes for your own course slots'));
    }
  } else if (req.user!.role === 'TEACHING_ASSISTANT') {
    const teachingAssistantId = req.user!.teachingAssistant?.id;
    if (!teachingAssistantId || parsedScheduleSlotId === null) {
      return next(new AuthorizationError('TAs must specify the schedule slot they are requesting to change'));
    }
    const slot = await prisma.scheduleSlot.findFirst({
      where: {
        id: parsedScheduleSlotId,
        courseId: parsedCourseId,
        teachingAssistantId,
      },
      select: { id: true },
    });
    if (!slot) {
      return next(new AuthorizationError('You can only request changes for slots assigned to you'));
    }
  } else if (ADMIN_ROLES.has(req.user!.role)) {
    const course = await prisma.course.findFirst({
      where: getAdminMutationTargetWhere(req.user!, 'course', parsedCourseId),
      select: { id: true },
    });
    if (!course) return next(new AuthorizationError('Course is outside your managed scope'));

    if (parsedScheduleSlotId !== null) {
      const slot = await prisma.scheduleSlot.findFirst({
        where: getScopedRequestSlotWhere(
          req.user!,
          parsedScheduleSlotId,
          parsedCourseId
        ),
        select: { id: true },
      });
      if (!slot) return next(new AuthorizationError('Schedule slot is outside your managed scope'));
    }
  } else {
    return next(new AuthorizationError('Access denied'));
  }

  const newReq = await prisma.scheduleChangeRequest.create({
    data: {
      type,
      courseId: parsedCourseId,
      scheduleSlotId: parsedScheduleSlotId ?? undefined,
      proposedData,
      reason,
      requesterId: req.user!.id
    }
  });

  auditLog('CREATE_SCHEDULE_REQUEST', 'ScheduleChangeRequest', newReq.id.toString(), req);
  res.status(201).json({ success: true, data: newReq });
});

export const getRequests = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  let where: Record<string, unknown>;
  if (req.user!.role === 'DOCTOR' || req.user!.role === 'TEACHING_ASSISTANT') {
    where = { requesterId: req.user!.id };
  } else if (ADMIN_ROLES.has(req.user!.role)) {
    if (!isAdminMutationScopeConfigured(req.user!)) {
      return next(new AuthorizationError('Managed scope is required to list schedule requests'));
    }
    where = { course: getAdminMutationScopeWhere(req.user!, 'course') };
  } else {
    return next(new AuthorizationError('Access denied'));
  }

  const requests = await prisma.scheduleChangeRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      requester: { select: { email: true, role: true, doctor: true, teachingAssistant: true } },
      course: true
    }
  });

  res.json({ success: true, data: requests });
});

export const approveRequest = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { adminComment } = req.body;

  const changeReq = await prisma.scheduleChangeRequest.findFirst({
    where: getScopedRequestWhere(req.user!, parseInt(id as string)),
    include: { course: true }
  });

  if (!changeReq) return next(new NotFoundError('Request not found'));
  if (changeReq.status !== 'PENDING') return next(new AppError('Request is not pending', 400));

  // Apply the change
  const data: any = changeReq.proposedData;
  await prisma.$transaction(async (tx) => {
    const scopedSlot = changeReq.scheduleSlotId
      ? await tx.scheduleSlot.findFirst({
          where: getScopedRequestSlotWhere(
            req.user!,
            changeReq.scheduleSlotId,
            changeReq.courseId
          ),
        })
      : null;
    if (changeReq.scheduleSlotId && !scopedSlot) {
      throw new AuthorizationError('Schedule slot is outside your managed scope');
    }

    if (changeReq.type === 'NEW_SLOT') {
      await TimetableService.checkConflicts({
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        room: data.room,
        courseId: changeReq.courseId,
        doctorId: data.doctorId ? parseInt(data.doctorId) : null,
        groupId: data.groupId ? parseInt(data.groupId) : null,
        teachingAssistantId: data.teachingAssistantId,
      }, tx);
      await tx.scheduleSlot.create({
        data: {
          courseId: changeReq.courseId,
          doctorId: data.doctorId ? parseInt(data.doctorId) : null,
          groupId: data.groupId ? parseInt(data.groupId) : null,
          slotType: data.slotType || 'LECTURE',
          dayOfWeek: data.dayOfWeek,
          startTime: data.startTime,
          endTime: data.endTime,
          room: data.room,
          teachingAssistantId: data.teachingAssistantId
        }
      });
    } else if (changeReq.type === 'UPDATE_SLOT') {
      if (!changeReq.scheduleSlotId) throw new AppError('scheduleSlotId required for UPDATE_SLOT', 400);
      if (!scopedSlot) throw new AuthorizationError('Schedule slot is outside your managed scope');
      await TimetableService.checkConflicts({
        dayOfWeek: data.dayOfWeek || scopedSlot.dayOfWeek,
        startTime: data.startTime || scopedSlot.startTime,
        endTime: data.endTime || scopedSlot.endTime,
        room: data.room !== undefined ? data.room : scopedSlot.room,
        courseId: changeReq.courseId,
        doctorId: data.doctorId !== undefined ? (data.doctorId ? parseInt(data.doctorId) : null) : scopedSlot.doctorId,
        groupId: data.groupId !== undefined ? (data.groupId ? parseInt(data.groupId) : null) : scopedSlot.groupId,
        teachingAssistantId: data.teachingAssistantId !== undefined ? data.teachingAssistantId : scopedSlot.teachingAssistantId,
        excludeSlotId: changeReq.scheduleSlotId
      }, tx);
      await tx.scheduleSlot.update({
        where: { id: changeReq.scheduleSlotId },
        data: {
          dayOfWeek: data.dayOfWeek,
          startTime: data.startTime,
          endTime: data.endTime,
          room: data.room,
          teachingAssistantId: data.teachingAssistantId,
          slotType: data.slotType,
        }
      });
    } else if (changeReq.type === 'DELETE_SLOT') {
      if (!changeReq.scheduleSlotId) throw new AppError('scheduleSlotId required for DELETE_SLOT', 400);
      if (!scopedSlot) throw new AuthorizationError('Schedule slot is outside your managed scope');
      await tx.scheduleSlot.delete({ where: { id: changeReq.scheduleSlotId } });
    } else if (changeReq.type === 'OVERRIDE') {
      if (!changeReq.scheduleSlotId) throw new AppError('scheduleSlotId required for OVERRIDE', 400);
      if (!scopedSlot) throw new AuthorizationError('Schedule slot is outside your managed scope');
      await TimetableService.checkConflicts({
        dayOfWeek: data.dayOfWeek || scopedSlot.dayOfWeek,
        startTime: data.startTime || scopedSlot.startTime,
        endTime: data.endTime || scopedSlot.endTime,
        room: data.room !== undefined ? data.room : scopedSlot.room,
        courseId: changeReq.courseId,
        doctorId: data.doctorId !== undefined ? (data.doctorId ? parseInt(data.doctorId) : null) : scopedSlot.doctorId,
        groupId: data.groupId !== undefined ? (data.groupId ? parseInt(data.groupId) : null) : scopedSlot.groupId,
        teachingAssistantId: data.teachingAssistantId !== undefined ? data.teachingAssistantId : scopedSlot.teachingAssistantId,
        excludeSlotId: changeReq.scheduleSlotId
      }, tx);
      await tx.scheduleOverride.create({
        data: {
          scheduleSlotId: changeReq.scheduleSlotId,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          room: data.room,
          dayOfWeek: data.dayOfWeek,
          startTime: data.startTime,
          endTime: data.endTime,
          doctorId: data.doctorId ? parseInt(data.doctorId) : null,
          teachingAssistantId: data.teachingAssistantId,
          reason: changeReq.reason,
          createdBy: req.user!.id,
        }
      });
    }

    await tx.scheduleChangeRequest.update({
      where: { id: changeReq.id },
      data: { status: 'APPROVED', adminComment, resolvedById: req.user!.id }
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  auditLog('APPROVE_SCHEDULE_REQUEST', 'ScheduleChangeRequest', changeReq.id.toString(), req);
  res.json({ success: true, message: 'Request approved and applied' });
});

export const rejectRequest = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { adminComment } = req.body;

  const changeReq = await prisma.scheduleChangeRequest.findFirst({
    where: getScopedRequestWhere(req.user!, parseInt(id as string)),
    include: { course: true }
  });

  if (!changeReq) return next(new NotFoundError('Request not found'));
  if (changeReq.status !== 'PENDING') return next(new AppError('Request is not pending', 400));

  await prisma.scheduleChangeRequest.update({
    where: { id: changeReq.id },
    data: { status: 'REJECTED', adminComment, resolvedById: req.user!.id }
  });

  auditLog('REJECT_SCHEDULE_REQUEST', 'ScheduleChangeRequest', changeReq.id.toString(), req);
  res.json({ success: true, message: 'Request rejected' });
});
