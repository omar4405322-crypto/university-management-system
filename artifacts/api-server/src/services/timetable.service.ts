import prisma from '../utils/prismaClient';
import { ConflictError, NotFoundError } from '../utils/appError';
import { Prisma } from '@prisma/client';

class TimetableService {
  static async checkRoomConflict(
    room: string,
    day: string,
    startTime: string,
    endTime: string,
    excludeId?: number
  ) {
    const conflict = await prisma.schedule.findFirst({
      where: {
        dayOfWeek: day,
        room,
        id: excludeId ? { not: excludeId } : undefined,
        OR: [
          { AND: [{ startTime: { lte: startTime } }, { endTime: { gt: startTime } }] },
          { AND: [{ startTime: { lt: endTime } }, { endTime: { gte: endTime } }] },
          { AND: [{ startTime: { gte: startTime } }, { endTime: { lte: endTime } }] },
        ],
      },
    });
    return conflict !== null;
  }

  static async createTimetable(data: any) {
    const {
      collegeId,
      departmentId,
      academicYear,
      semester,
      title,
      description,
      scheduleData,
      fileUrl,
      status,
    } = data;

    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { collegeId: true },
    });
    if (!department) {
      throw new NotFoundError('Department not found');
    }
    if (department.collegeId !== collegeId) {
      throw new ConflictError('Department does not belong to this college');
    }

    const existing = await prisma.timetable.findUnique({
      where: {
        collegeId_departmentId_academicYear_semester: {
          collegeId,
          departmentId,
          academicYear,
          semester,
        },
      },
    });
    if (existing) {
      throw new ConflictError(
        'A timetable for this Faculty, Department, Year, and Semester combination already exists.'
      );
    }

    const slots = scheduleData?.slots ?? [];
    for (const slot of slots) {
      if (slot.room) {
        const hasConflict = await TimetableService.checkRoomConflict(
          slot.room,
          slot.day,
          slot.startTime,
          slot.endTime
        );
        if (hasConflict) {
          throw new ConflictError(`Time conflict in room ${slot.room} on ${slot.day}`);
        }
      }
    }

    return prisma.timetable.create({
      data: {
        collegeId,
        departmentId,
        academicYear,
        semester,
        title,
        description,
        scheduleData: scheduleData ?? {},
        fileUrl,
        status: status ?? 'DRAFT',
      },
    });
  }

  static async syncSlotsToSchedule(timetableId: number) {
    const timetable = await prisma.timetable.findUnique({ where: { id: timetableId } });
    if (!timetable?.scheduleData) return;

    const slots = (timetable.scheduleData as any).slots ?? [];

    for (const slot of slots) {
      if (!slot.courseName) continue;
      const course = await prisma.course.findFirst({
        where: { name: slot.courseName, departmentId: timetable.departmentId },
      });
      if (!course) continue;

      const existingSchedule = await prisma.schedule.findFirst({
        where: {
          courseId: course.id,
          dayOfWeek: slot.day,
          startTime: slot.startTime,
          room: slot.room ?? '',
        },
      });
      if (!existingSchedule) {
        await prisma.schedule.create({
          data: {
            courseId: course.id,
            dayOfWeek: slot.day,
            startTime: slot.startTime,
            endTime: slot.endTime,
            room: slot.room ?? '',
          },
        });
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
