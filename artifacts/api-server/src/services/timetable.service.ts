import prisma from '../utils/prismaClient';
import { ConflictError, NotFoundError } from '../utils/appError';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const CAIRO_TZ = 'Africa/Cairo';

export interface ConflictCheckInput {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room: string | null;
  courseId: number;
  doctorId?: number | null;
  groupId?: number | null;
  teachingAssistantId: string | null;
  excludeSlotId?: number;
}

class TimetableService {
  static async checkConflicts(input: ConflictCheckInput, tx: any = prisma) {
    const { dayOfWeek, startTime, endTime, room, doctorId, groupId, teachingAssistantId, excludeSlotId } = input;

    // Active date range in Africa/Cairo timezone
    const now = new Date();
    const cairoNow = toZonedTime(now, CAIRO_TZ);
    const startOfCairoToday = fromZonedTime(
      new Date(cairoNow.getFullYear(), cairoNow.getMonth(), cairoNow.getDate(), 0, 0, 0, 0),
      CAIRO_TZ
    );
    const endOfCairoToday = fromZonedTime(
      new Date(cairoNow.getFullYear(), cairoNow.getMonth(), cairoNow.getDate(), 23, 59, 59, 999),
      CAIRO_TZ
    );

    const activeOverrideDateRange = {
      startDate: { lte: endOfCairoToday },
      endDate: { gte: startOfCairoToday },
    };

    // Common time overlap condition
    const timeOverlap = {
      OR: [
        { AND: [{ startTime: { lte: startTime } }, { endTime: { gt: startTime } }] },
        { AND: [{ startTime: { lt: endTime } }, { endTime: { gte: endTime } }] },
        { AND: [{ startTime: { gte: startTime } }, { endTime: { lte: endTime } }] },
      ],
    };

    const excludeCondition = excludeSlotId ? { id: { not: excludeSlotId } } : {};

    // 1. Room conflict
    if (room) {
      const baseSlotConflicts = await tx.scheduleSlot.findMany({
        where: { dayOfWeek, room, ...timeOverlap, ...excludeCondition },
        include: {
          overrides: {
            where: {
              dayOfWeek,
              ...timeOverlap,
              ...activeOverrideDateRange,
            },
          },
        },
      });
      const unmovedConflict = baseSlotConflicts.find((slot: any) => {
        const activeOverrideChangesRoom = slot.overrides.some(
          (ov: any) => ov.room && ov.room !== room
        );
        return !activeOverrideChangesRoom;
      });
      if (unmovedConflict) throw new ConflictError(`Time conflict in room ${room} on ${dayOfWeek}`);
      
      const overrideRoomConflict = await tx.scheduleOverride.findFirst({
        where: {
          dayOfWeek,
          room,
          ...timeOverlap,
          ...activeOverrideDateRange,
          ...(excludeSlotId ? { scheduleSlotId: { not: excludeSlotId } } : {}),
        },
      });
      if (overrideRoomConflict) throw new ConflictError(`Time conflict with an active override in room ${room} on ${dayOfWeek}`);
    }

    // 2. Doctor conflict
    if (doctorId) {
      const doctorConflict = await tx.scheduleSlot.findFirst({
        where: { dayOfWeek, doctorId, ...timeOverlap, ...excludeCondition },
      });
      if (doctorConflict) throw new ConflictError('Time conflict: The doctor is already scheduled at this time');

      const overrideDoctorConflict = await tx.scheduleOverride.findFirst({
        where: {
          dayOfWeek,
          doctorId,
          ...timeOverlap,
          ...activeOverrideDateRange,
          ...(excludeSlotId ? { scheduleSlotId: { not: excludeSlotId } } : {}),
        },
      });
      if (overrideDoctorConflict) throw new ConflictError('Time conflict: The doctor has an active override at this time');
    }

    // 3. TA conflict
    if (teachingAssistantId) {
      const taConflict = await tx.scheduleSlot.findFirst({
        where: { dayOfWeek, teachingAssistantId, ...timeOverlap, ...excludeCondition },
      });
      if (taConflict) throw new ConflictError('Time conflict: The teaching assistant is already scheduled at this time');
      
      const overrideTaConflict = await tx.scheduleOverride.findFirst({
        where: {
          dayOfWeek,
          teachingAssistantId,
          ...timeOverlap,
          ...activeOverrideDateRange,
          ...(excludeSlotId ? { scheduleSlotId: { not: excludeSlotId } } : {}),
        },
      });
      if (overrideTaConflict) throw new ConflictError('Time conflict: The TA has an active override at this time');
    }

    // 4. StudentGroup conflict — check if any slot already targets the same group
    if (groupId) {
      const groupConflict = await tx.scheduleSlot.findFirst({
        where: {
          dayOfWeek,
          groupId,
          ...timeOverlap,
          ...excludeCondition,
        },
      });
      if (groupConflict) throw new ConflictError('Time conflict: The student group is already scheduled at this time');
    }
  }

  static async getGridByDepartment(departmentId: number) {
    return prisma.timetable.findMany({
      where: { departmentId, status: 'PUBLISHED' },
      include: {
        college: { select: { name: true } },
        department: { select: { name: true } },
      },
      orderBy: [{ academicYear: 'asc' }, { semester: 'asc' }],
    });
  }
}

export { TimetableService };
