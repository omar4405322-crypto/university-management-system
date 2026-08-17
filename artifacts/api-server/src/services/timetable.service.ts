import prisma from '../utils/prismaClient';
import { ConflictError, NotFoundError } from '../utils/appError';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const CAIRO_TZ = 'Africa/Cairo';

export interface ConflictCheckInput {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room: string | null;
  courseId?: number | null;
  doctorId?: number | null;
  groupId?: number | null;
  teachingAssistantId: string | null;
  excludeSlotId?: number;
}

class TimetableService {
  static async checkConflicts(input: ConflictCheckInput, tx: any = prisma) {
    const { dayOfWeek, startTime, endTime, room, courseId, doctorId, groupId, teachingAssistantId, excludeSlotId } = input;

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

    // 4. StudentGroup & Cohort conflict — check lineage (ancestors, descendants) and department-wide slots
    if (groupId) {
      const targetGroup = await tx.studentGroup.findUnique({
        where: { id: groupId },
        select: { id: true, departmentId: true, year: true, parentGroupId: true },
      });

      if (targetGroup) {
        // Collect ancestor group IDs (the target group's parents up to the root)
        const ancestorGroupIds: number[] = [];
        let currentParentId: number | null = targetGroup.parentGroupId;
        while (currentParentId) {
          ancestorGroupIds.push(currentParentId);
          const parentGroup: any = await tx.studentGroup.findUnique({
            where: { id: currentParentId },
            select: { parentGroupId: true },
          });
          currentParentId = parentGroup?.parentGroupId ?? null;
        }

        // Collect descendant group IDs (all sub-groups underneath this group)
        const descendantGroupIds: number[] = [];
        const queue: number[] = [groupId];
        while (queue.length > 0) {
          const currentId = queue.shift()!;
          const children: any[] = await tx.studentGroup.findMany({
            where: { parentGroupId: currentId },
            select: { id: true },
          });
          for (const child of children) {
            descendantGroupIds.push(child.id);
            queue.push(child.id);
          }
        }

        const lineageGroupIds = [groupId, ...ancestorGroupIds, ...descendantGroupIds];

        const groupConflict = await tx.scheduleSlot.findFirst({
          where: {
            dayOfWeek,
            ...timeOverlap,
            ...excludeCondition,
            OR: [
              { groupId: { in: lineageGroupIds } },
              {
                groupId: null,
                course: {
                  departmentId: targetGroup.departmentId,
                  year: targetGroup.year,
                },
              },
            ],
          },
        });
        if (groupConflict) {
          throw new ConflictError('Time conflict: The student group or cohort is already scheduled at this time');
        }

        const overrideGroupConflict = await tx.scheduleOverride.findFirst({
          where: {
            dayOfWeek,
            ...timeOverlap,
            ...activeOverrideDateRange,
            ...(excludeSlotId ? { scheduleSlotId: { not: excludeSlotId } } : {}),
            scheduleSlot: {
              OR: [
                { groupId: { in: lineageGroupIds } },
                {
                  groupId: null,
                  course: {
                    departmentId: targetGroup.departmentId,
                    year: targetGroup.year,
                  },
                },
              ],
            },
          },
        });
        if (overrideGroupConflict) {
          throw new ConflictError('Time conflict: An active override for this student group or cohort exists at this time');
        }
      }
    } else if (courseId) {
      // Scheduling a department-wide slot (groupId: null) with a known course
      const course = await tx.course.findUnique({
        where: { id: courseId },
        select: { departmentId: true, year: true },
      });

      if (course && course.departmentId && course.year) {
        const deptConflict = await tx.scheduleSlot.findFirst({
          where: {
            dayOfWeek,
            ...timeOverlap,
            ...excludeCondition,
            OR: [
              {
                course: {
                  departmentId: course.departmentId,
                  year: course.year,
                },
              },
              {
                group: {
                  departmentId: course.departmentId,
                  year: course.year,
                },
              },
            ],
          },
        });
        if (deptConflict) {
          throw new ConflictError('Time conflict: A cohort or group session is already scheduled for this department and year at this time');
        }

        const overrideDeptConflict = await tx.scheduleOverride.findFirst({
          where: {
            dayOfWeek,
            ...timeOverlap,
            ...activeOverrideDateRange,
            ...(excludeSlotId ? { scheduleSlotId: { not: excludeSlotId } } : {}),
            scheduleSlot: {
              OR: [
                {
                  course: {
                    departmentId: course.departmentId,
                    year: course.year,
                  },
                },
                {
                  group: {
                    departmentId: course.departmentId,
                    year: course.year,
                  },
                },
              ],
            },
          },
        });
        if (overrideDeptConflict) {
          throw new ConflictError('Time conflict: An active override for this department and year exists at this time');
        }
      }
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
