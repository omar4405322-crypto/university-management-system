import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import catchAsync from '../utils/catchAsync';
import { AppError, NotFoundError, AuthorizationError } from '../utils/appError';
import { auditLog } from '../utils/audit.utils';
import { TimetableService } from '../services/timetable.service';
import { Prisma } from '@prisma/client';

export const createRequest = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { type, courseId, scheduleSlotId, proposedData, reason } = req.body;

  const course = await prisma.course.findUnique({ where: { id: parseInt(courseId) } });
  if (!course) return next(new NotFoundError('Course not found'));

  if (req.user!.role === 'DOCTOR') {
    // Verify doctor teaches this course (has schedule slots for it)
    const myDoctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
    if (!myDoctor) return next(new AuthorizationError('Doctor profile not found'));
    const hasSlot = await prisma.scheduleSlot.findFirst({
      where: { courseId: parseInt(courseId), doctorId: myDoctor.id }
    });
    if (!hasSlot) return next(new AuthorizationError('You can only request changes for your own courses'));
  }
  // TAs own slots, so if scheduleSlotId is provided, they must own the slot
  if (req.user!.role === 'TEACHING_ASSISTANT') {
    if (!scheduleSlotId) {
      return next(new AuthorizationError('TAs must specify the schedule slot they are requesting to change'));
    }
    const slot = await prisma.scheduleSlot.findUnique({ where: { id: parseInt(scheduleSlotId) } });
    if (!slot || slot.teachingAssistantId !== req.user!.teachingAssistant?.id) {
      return next(new AuthorizationError('You can only request changes for slots assigned to you'));
    }
  }

  const newReq = await prisma.scheduleChangeRequest.create({
    data: {
      type,
      courseId: parseInt(courseId),
      scheduleSlotId: scheduleSlotId ? parseInt(scheduleSlotId) : undefined,
      proposedData,
      reason,
      requesterId: req.user!.id
    }
  });

  auditLog('CREATE_SCHEDULE_REQUEST', 'ScheduleChangeRequest', newReq.id.toString(), req);
  res.status(201).json({ success: true, data: newReq });
});

export const getRequests = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  let where: any = {};

  if (req.user!.role === 'DOCTOR' || req.user!.role === 'TEACHING_ASSISTANT') {
    where.requesterId = req.user!.id;
  } else if (req.user!.role === 'DEPARTMENT_ADMIN' && req.user!.managedDepartmentId) {
    where.course = { departmentId: req.user!.managedDepartmentId };
  } else if ((req.user!.role === 'ADMIN' || req.user!.role === 'COLLEGE_ADMIN') && req.user!.managedCollegeId) {
    where.course = { department: { collegeId: req.user!.managedCollegeId } };
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

  const changeReq = await prisma.scheduleChangeRequest.findUnique({
    where: { id: parseInt(id as string) },
    include: { course: true }
  });

  if (!changeReq) return next(new NotFoundError('Request not found'));
  if (changeReq.status !== 'PENDING') return next(new AppError('Request is not pending', 400));

  // Verify Admin Scope
  if (req.user!.role === 'DEPARTMENT_ADMIN' && req.user!.managedDepartmentId) {
    if (changeReq.course.departmentId !== req.user!.managedDepartmentId) return next(new AuthorizationError('Out of scope'));
  } else if ((req.user!.role === 'ADMIN' || req.user!.role === 'COLLEGE_ADMIN') && req.user!.managedCollegeId) {
    const dept = changeReq.course.departmentId
      ? await prisma.department.findUnique({ where: { id: changeReq.course.departmentId } })
      : null;
    if (dept?.collegeId !== req.user!.managedCollegeId) return next(new AuthorizationError('Out of scope'));
  }

  // Apply the change
  const data: any = changeReq.proposedData;
  await prisma.$transaction(async (tx) => {
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
      const slot = await tx.scheduleSlot.findUnique({ where: { id: changeReq.scheduleSlotId } });
      if (!slot) throw new NotFoundError('ScheduleSlot not found');
      await TimetableService.checkConflicts({
        dayOfWeek: data.dayOfWeek || slot.dayOfWeek,
        startTime: data.startTime || slot.startTime,
        endTime: data.endTime || slot.endTime,
        room: data.room !== undefined ? data.room : slot.room,
        courseId: changeReq.courseId,
        doctorId: data.doctorId !== undefined ? (data.doctorId ? parseInt(data.doctorId) : null) : slot.doctorId,
        groupId: data.groupId !== undefined ? (data.groupId ? parseInt(data.groupId) : null) : slot.groupId,
        teachingAssistantId: data.teachingAssistantId !== undefined ? data.teachingAssistantId : slot.teachingAssistantId,
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
      await tx.scheduleSlot.delete({ where: { id: changeReq.scheduleSlotId } });
    } else if (changeReq.type === 'OVERRIDE') {
      if (!changeReq.scheduleSlotId) throw new AppError('scheduleSlotId required for OVERRIDE', 400);
      const slot = await tx.scheduleSlot.findUnique({ where: { id: changeReq.scheduleSlotId } });
      if (!slot) throw new NotFoundError('ScheduleSlot not found');
      await TimetableService.checkConflicts({
        dayOfWeek: data.dayOfWeek || slot.dayOfWeek,
        startTime: data.startTime || slot.startTime,
        endTime: data.endTime || slot.endTime,
        room: data.room !== undefined ? data.room : slot.room,
        courseId: changeReq.courseId,
        doctorId: data.doctorId !== undefined ? (data.doctorId ? parseInt(data.doctorId) : null) : slot.doctorId,
        groupId: data.groupId !== undefined ? (data.groupId ? parseInt(data.groupId) : null) : slot.groupId,
        teachingAssistantId: data.teachingAssistantId !== undefined ? data.teachingAssistantId : slot.teachingAssistantId,
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

  const changeReq = await prisma.scheduleChangeRequest.findUnique({
    where: { id: parseInt(id as string) },
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
