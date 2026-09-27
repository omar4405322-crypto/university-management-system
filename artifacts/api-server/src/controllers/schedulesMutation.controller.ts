/**
 * schedulesMutation.controller.ts
 *
 * Handles CRUD and lifecycle operations on individual ScheduleSlots:
 * create, update, delete, archive, restore.
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import { auditLog } from '../utils/audit.utils';
import { getScopeWhere } from '../utils/scope.utils';
import catchAsync from '../utils/catchAsync';
import {
  NotFoundError,
  AuthorizationError,
  AppError,
  ConflictError,
  ValidationError,
} from '../utils/appError';
import { TimetableService } from '../services/timetable.service';
import { Prisma } from '@prisma/client';
import { requireExistingCourseStaffAssignments } from '../utils/scheduleAssignment.utils';

// ── Private helpers ───────────────────────────────────────────────────────────

async function assertScheduleSlotMutationAccess(
  user: NonNullable<Request['user']>,
  slot: { doctorId: number | null; teachingAssistantId: string | null; course?: { departmentId: number | null; department?: { id?: number; collegeId?: number | null } | null } | null },
  action: 'archive' | 'restore' | 'delete'
) {
  if (user.role === 'DOCTOR') {
    const doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });
    if (!doctor || slot.doctorId !== doctor.id) {
      throw new AuthorizationError(`You can only ${action} slots for your own sections`);
    }
    return;
  }
  if (user.role === 'TEACHING_ASSISTANT') {
    if (slot.teachingAssistantId !== user.teachingAssistant?.id) {
      throw new AuthorizationError(`You can only ${action} slots assigned to you`);
    }
    return;
  }
  const departmentScope = getScopeWhere(user, 'department') as Record<string, unknown>;
  if (departmentScope && Object.keys(departmentScope).length) {
    if (departmentScope['collegeId'] && slot.course?.department?.collegeId !== departmentScope['collegeId']) {
      throw new AuthorizationError('Access denied');
    }
    if (departmentScope['id'] && slot.course?.departmentId !== departmentScope['id']) {
      throw new AuthorizationError('Access denied');
    }
  }
}

async function getScheduleSlotForMutation(slotId: number) {
  return prisma.scheduleSlot.findUnique({
    where: { id: slotId },
    include: { course: { include: { department: true } } },
  });
}

// ── Exported handlers ─────────────────────────────────────────────────────────

export const createSchedule = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { courseId, doctorId, groupId, slotType, dayOfWeek, startTime, endTime, room, teachingAssistantId, timetableId } = req.body;

    if (!courseId) return next(new ValidationError('courseId is required'));

    const course = await prisma.course.findUnique({
      where: { id: parseInt(courseId as string) },
      include: { department: true },
    });
    if (!course) return next(new NotFoundError('Course not found'));

    let parsedDoctorId = doctorId ? parseInt(doctorId as string) : null;
    const parsedGroupId = groupId ? parseInt(groupId as string) : null;
    let effectiveTeachingAssistantId = teachingAssistantId ? String(teachingAssistantId) : null;

    if (req.user!.role === 'DOCTOR') {
      const myDoctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
      if (!myDoctor || (parsedDoctorId && parsedDoctorId !== myDoctor.id)) {
        return next(new AuthorizationError('You can only schedule classes for yourself'));
      }
      if (effectiveTeachingAssistantId) {
        return next(new AuthorizationError('Staff reassignment must be performed by a scoped admin'));
      }
      parsedDoctorId = myDoctor.id;
    } else if (req.user!.role === 'TEACHING_ASSISTANT') {
      const myTeachingAssistantId = req.user!.teachingAssistant?.id;
      if (!myTeachingAssistantId || (effectiveTeachingAssistantId && String(effectiveTeachingAssistantId) !== String(myTeachingAssistantId))) {
        return next(new AuthorizationError('You can only schedule classes assigned to you'));
      }
      if (parsedDoctorId) {
        return next(new AuthorizationError('Staff reassignment must be performed by a scoped admin'));
      }
      effectiveTeachingAssistantId = String(myTeachingAssistantId);
    } else {
      const deptScope = getScopeWhere(req.user!, 'department') as Record<string, unknown>;
      if (deptScope && Object.keys(deptScope).length) {
        if (deptScope['collegeId'] && course.department?.collegeId !== deptScope['collegeId'])
          return next(new AuthorizationError('Access denied'));
        if (deptScope['id'] && course.departmentId !== deptScope['id'])
          return next(new AuthorizationError('Access denied'));
      }
    }

    if (timetableId) {
      const timetable = await prisma.timetable.findUnique({ where: { id: parseInt(timetableId as string) } });
      if (!timetable) return next(new NotFoundError('Timetable not found'));
      if (
        timetable.departmentId !== course.departmentId ||
        timetable.academicYear !== course.year ||
        timetable.semester !== course.semester
      ) {
        return next(new ValidationError('Timetable scope does not match Course scope'));
      }
    }

    let effectiveTimetableId: number | undefined = timetableId ? parseInt(timetableId as string) : undefined;
    if (!effectiveTimetableId) {
      const foundTb = await prisma.timetable.findFirst({
        where: {
          departmentId: course.departmentId!,
          academicYear: course.year,
          semester: course.semester,
        },
      });
      if (foundTb) effectiveTimetableId = foundTb.id;
    }

    let scheduleSlot;
    try {
      scheduleSlot = await prisma.$transaction(
        async (tx) => {
          await requireExistingCourseStaffAssignments(tx, {
            courseId: course.id,
            doctorId: parsedDoctorId,
            teachingAssistantId: effectiveTeachingAssistantId,
          });

          await TimetableService.checkConflicts(
            {
              dayOfWeek,
              startTime,
              endTime,
              room,
              courseId: parseInt(courseId as string),
              doctorId: parsedDoctorId,
              groupId: parsedGroupId,
              teachingAssistantId: effectiveTeachingAssistantId,
            },
            tx
          );

          return tx.scheduleSlot.create({
            data: {
              courseId: parseInt(courseId as string),
              doctorId: parsedDoctorId,
              groupId: parsedGroupId,
              slotType: slotType || 'LECTURE',
              dayOfWeek,
              startTime,
              endTime,
              room,
              teachingAssistantId: effectiveTeachingAssistantId,
              timetableId: effectiveTimetableId,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'P2034') {
        return next(new ConflictError('Scheduling conflict: another booking was committed simultaneously. Please retry.'));
      }
      throw err;
    }

    res.status(201).json({ success: true, data: scheduleSlot });
  }
);

export const updateSchedule = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { dayOfWeek, startTime, endTime, room, teachingAssistantId, courseId, doctorId, groupId, slotType } = req.body;
    const slotId = parseInt(req.params.id as string);

    const existing = await prisma.scheduleSlot.findUnique({
      where: { id: slotId },
      include: { course: { include: { department: true } } },
    });
    if (!existing) return next(new NotFoundError('ScheduleSlot not found'));

    const newCourseId = courseId ? parseInt(courseId as string) : existing.courseId;
    const newDoctorId = doctorId !== undefined ? (doctorId ? parseInt(doctorId as string) : null) : existing.doctorId;
    const newGroupId = groupId !== undefined ? (groupId ? parseInt(groupId as string) : null) : existing.groupId;
    const newTeachingAssistantId =
      teachingAssistantId !== undefined
        ? teachingAssistantId
          ? String(teachingAssistantId)
          : null
        : existing.teachingAssistantId;

    if (req.user!.role === 'DOCTOR') {
      const myDoctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
      if (!myDoctor || existing.doctorId !== myDoctor.id) {
        return next(new AuthorizationError('You can only modify slots for your own sections'));
      }
      if (newDoctorId !== myDoctor.id || newTeachingAssistantId !== existing.teachingAssistantId) {
        return next(new AuthorizationError('Staff reassignment must be performed by a scoped admin'));
      }
    } else if (req.user!.role === 'TEACHING_ASSISTANT') {
      const myTaId = req.user!.teachingAssistant?.id ? String(req.user!.teachingAssistant.id) : null;
      if (!myTaId || existing.teachingAssistantId !== myTaId) {
        return next(new AuthorizationError('You can only modify slots assigned to you'));
      }
      if (newTeachingAssistantId !== myTaId) {
        return next(new AuthorizationError('You cannot reassign to another TA'));
      }
      if (newDoctorId !== existing.doctorId) {
        return next(new AuthorizationError('Staff reassignment must be performed by a scoped admin'));
      }
    } else {
      const deptScope = getScopeWhere(req.user!, 'department') as Record<string, unknown>;
      if (deptScope && Object.keys(deptScope).length) {
        if (deptScope['collegeId'] && existing.course?.department?.collegeId !== deptScope['collegeId'])
          return next(new AuthorizationError('Access denied'));
        if (deptScope['id'] && existing.course?.departmentId !== deptScope['id'])
          return next(new AuthorizationError('Access denied'));
      }
    }

    let targetTimetableId = existing.timetableId;

    if (courseId && newCourseId !== existing.courseId) {
      const course = await prisma.course.findUnique({
        where: { id: newCourseId },
        include: { department: true },
      });
      if (!course) return next(new NotFoundError('Course not found'));

      const deptScope = getScopeWhere(req.user!, 'department') as Record<string, unknown>;
      if (deptScope && Object.keys(deptScope).length) {
        if (deptScope['collegeId'] && course.department?.collegeId !== deptScope['collegeId'])
          return next(new AuthorizationError('Access denied'));
        if (deptScope['id'] && course.departmentId !== deptScope['id'])
          return next(new AuthorizationError('Access denied'));
      }

      const foundTb = await prisma.timetable.findFirst({
        where: {
          departmentId: course.departmentId!,
          academicYear: course.year,
          semester: course.semester,
        },
      });
      targetTimetableId = foundTb ? foundTb.id : null;
    } else if (!targetTimetableId && existing.course) {
      const foundTb = await prisma.timetable.findFirst({
        where: {
          departmentId: existing.course.departmentId!,
          academicYear: existing.course.year,
          semester: existing.course.semester,
        },
      });
      if (foundTb) targetTimetableId = foundTb.id;
    }

    const scheduleSlot = await prisma.$transaction(
      async (tx) => {
        const doctorNeedsAssignmentProof =
          newDoctorId !== null && (newDoctorId !== existing.doctorId || newCourseId !== existing.courseId);
        const teachingAssistantNeedsAssignmentProof =
          newTeachingAssistantId !== null &&
          (newTeachingAssistantId !== existing.teachingAssistantId || newCourseId !== existing.courseId);

        await requireExistingCourseStaffAssignments(tx, {
          courseId: newCourseId,
          doctorId: doctorNeedsAssignmentProof ? newDoctorId : undefined,
          teachingAssistantId: teachingAssistantNeedsAssignmentProof ? newTeachingAssistantId : undefined,
          excludeSlotId: slotId,
        });

        await TimetableService.checkConflicts(
          {
            dayOfWeek: dayOfWeek || existing.dayOfWeek,
            startTime: startTime || existing.startTime,
            endTime: endTime || existing.endTime,
            room: room !== undefined ? room : existing.room,
            courseId: newCourseId,
            doctorId: newDoctorId,
            groupId: newGroupId,
            teachingAssistantId: newTeachingAssistantId,
            excludeSlotId: slotId,
          },
          tx
        );

        return tx.scheduleSlot.update({
          where: { id: slotId },
          data: {
            dayOfWeek,
            startTime,
            endTime,
            room,
            teachingAssistantId: newTeachingAssistantId,
            courseId: newCourseId,
            doctorId: newDoctorId,
            groupId: newGroupId,
            slotType: slotType || undefined,
            timetableId: targetTimetableId,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    res.json({ success: true, data: scheduleSlot });
  }
);

export const deleteSchedule = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const slotId = parseInt(req.params.id as string);
    const existing = await prisma.scheduleSlot.findUnique({
      where: { id: slotId },
      include: { course: { include: { department: true } } },
    });
    if (!existing) return next(new NotFoundError('ScheduleSlot not found'));

    await assertScheduleSlotMutationAccess(req.user!, existing, 'delete');

    await prisma.$transaction(
      async (tx) => {
        const attendanceEvidence = await tx.scheduleSlot.findFirst({
          where: {
            id: slotId,
            OR: [{ attendanceSessions: { some: {} } }, { attendances: { some: {} } }],
          },
          select: { id: true },
        });
        if (attendanceEvidence) {
          throw new AppError(
            'Cannot delete schedule slot: attendance evidence exists. Archive the slot instead to preserve historical session requirements.',
            409
          );
        }
        await tx.scheduleSlot.delete({ where: { id: slotId } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    auditLog('DELETE_SCHEDULE', 'ScheduleSlot', req.params.id as string, req);
    res.json({ success: true, message: 'ScheduleSlot deleted' });
  }
);

export const archiveSchedule = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const slotId = parseInt(req.params.id as string, 10);
    const existing = await getScheduleSlotForMutation(slotId);
    if (!existing) return next(new NotFoundError('ScheduleSlot not found'));
    await assertScheduleSlotMutationAccess(req.user!, existing, 'archive');

    const archived = await prisma.scheduleSlot.update({
      where: { id: slotId },
      data: { isArchived: true, archivedAt: new Date() },
    });
    auditLog('ARCHIVE_SCHEDULE', 'ScheduleSlot', req.params.id as string, req);
    res.json({ success: true, data: archived, message: 'ScheduleSlot archived' });
  }
);

export const restoreSchedule = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const slotId = parseInt(req.params.id as string, 10);
    const existing = await getScheduleSlotForMutation(slotId);
    if (!existing) return next(new NotFoundError('ScheduleSlot not found'));
    await assertScheduleSlotMutationAccess(req.user!, existing, 'restore');

    const restored = await prisma.scheduleSlot.update({
      where: { id: slotId },
      data: { isArchived: false, archivedAt: null },
    });
    auditLog('RESTORE_SCHEDULE', 'ScheduleSlot', req.params.id as string, req);
    res.json({ success: true, data: restored, message: 'ScheduleSlot restored' });
  }
);
