import prisma from '../utils/prismaClient';
import { ConflictError, NotFoundError } from '../utils/appError';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const CAIRO_TZ = 'Africa/Cairo';

export interface ConflictCheckInput {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room?: string | null;
  courseId?: number | null;
  departmentId?: number | null;
  academicYear?: number | null;
  semester?: number | null;
  doctorId?: number | null;
  groupId?: number | null;
  teachingAssistantId?: string | null;
  excludeSlotId?: number;
}

export interface ConflictDetail {
  type: 'ROOM_OCCUPIED' | 'DOCTOR_BUSY' | 'TA_BUSY' | 'BATCH_OVERLAP' | 'GROUP_CONFLICT' | 'OVERRIDE_CONFLICT' | 'AMBIGUOUS_DOCTOR' | 'AMBIGUOUS_TA';
  messageAr: string;
  messageEn: string;
  conflictingSlot?: any;
}

class TimetableService {
  static async findConflicts(input: ConflictCheckInput, tx: any = prisma): Promise<ConflictDetail[]> {
    const {
      dayOfWeek,
      startTime,
      endTime,
      room,
      courseId,
      departmentId,
      academicYear,
      semester,
      doctorId,
      groupId,
      teachingAssistantId,
      excludeSlotId,
    } = input;

    if (!dayOfWeek || !startTime || !endTime) {
      return [];
    }

    const dayUpper = dayOfWeek.toUpperCase();

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

    const excludeCondition = excludeSlotId ? { id: { not: Number(excludeSlotId) } } : {};
    const conflicts: ConflictDetail[] = [];

    // 1. Room conflict
    if (room && room.trim() !== '') {
      const trimmedRoom = room.trim();
      const baseSlotConflicts = await tx.scheduleSlot.findMany({
        where: {
          dayOfWeek: dayUpper,
          room: { equals: trimmedRoom, mode: 'insensitive' },
          ...timeOverlap,
          ...excludeCondition,
        },
        include: {
          course: {
            select: { name: true, courseCode: true, department: { select: { name: true } } },
          },
          doctor: { select: { firstName: true, lastName: true } },
          teachingAssistant: { select: { firstName: true, lastName: true } },
          overrides: {
            where: {
              dayOfWeek: dayUpper,
              ...timeOverlap,
              ...activeOverrideDateRange,
            },
          },
        },
      });

      const unmovedConflict = baseSlotConflicts.find((slot: any) => {
        const activeOverrideChangesRoom = slot.overrides.some(
          (ov: any) => ov.room && ov.room.trim().toLowerCase() !== trimmedRoom.toLowerCase()
        );
        return !activeOverrideChangesRoom;
      });

      if (unmovedConflict) {
        const courseStr = unmovedConflict.course?.name || 'مادة أخرى';
        const deptStr = unmovedConflict.course?.department?.name || '';
        const docStr = unmovedConflict.doctor
          ? `د. ${unmovedConflict.doctor.firstName} ${unmovedConflict.doctor.lastName}`
          : unmovedConflict.teachingAssistant
          ? `م. ${unmovedConflict.teachingAssistant.firstName} ${unmovedConflict.teachingAssistant.lastName}`
          : '';

        conflicts.push({
          type: 'ROOM_OCCUPIED',
          messageAr: `القاعة/المعمل (${trimmedRoom}) محجوزة بالفعل لمادة (${courseStr}) ${deptStr ? `بقسم ${deptStr}` : ''} ${docStr ? `مع ${docStr}` : ''} في الفترة (${unmovedConflict.startTime} - ${unmovedConflict.endTime}).`,
          messageEn: `Room/Lab (${trimmedRoom}) is already booked for (${courseStr}) ${deptStr ? `[${deptStr}]` : ''} at (${unmovedConflict.startTime} - ${unmovedConflict.endTime}).`,
          conflictingSlot: {
            courseName: courseStr,
            doctorName: docStr,
            departmentName: deptStr,
            time: `${unmovedConflict.startTime} - ${unmovedConflict.endTime}`,
            room: trimmedRoom,
          },
        });
      }

      const overrideRoomConflict = await tx.scheduleOverride.findFirst({
        where: {
          dayOfWeek: dayUpper,
          room: { equals: trimmedRoom, mode: 'insensitive' },
          ...timeOverlap,
          ...activeOverrideDateRange,
          ...(excludeSlotId ? { scheduleSlotId: { not: Number(excludeSlotId) } } : {}),
        },
        include: {
          scheduleSlot: {
            include: {
              course: { select: { name: true, department: { select: { name: true } } } },
              doctor: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });

      if (overrideRoomConflict) {
        const courseStr = overrideRoomConflict.scheduleSlot?.course?.name || 'مادة أخرى';
        conflicts.push({
          type: 'ROOM_OCCUPIED',
          messageAr: `القاعة/المعمل (${trimmedRoom}) محجوزة بجدول استثنائي مؤقت لمادة (${courseStr}) في الفترة (${overrideRoomConflict.startTime || overrideRoomConflict.scheduleSlot?.startTime} - ${overrideRoomConflict.endTime || overrideRoomConflict.scheduleSlot?.endTime}).`,
          messageEn: `Room/Lab (${trimmedRoom}) is booked by an active schedule override for (${courseStr}) at (${overrideRoomConflict.startTime || overrideRoomConflict.scheduleSlot?.startTime} - ${overrideRoomConflict.endTime || overrideRoomConflict.scheduleSlot?.endTime}).`,
        });
      }
    }

    // 2. Doctor conflict
    if (doctorId) {
      const docId = Number(doctorId);
      const doctorConflict = await tx.scheduleSlot.findFirst({
        where: { dayOfWeek: dayUpper, doctorId: docId, ...timeOverlap, ...excludeCondition },
        include: {
          course: { select: { name: true, department: { select: { name: true } } } },
          doctor: { select: { firstName: true, lastName: true } },
        },
      });

      if (doctorConflict) {
        const docNameStr = doctorConflict.doctor
          ? `د. ${doctorConflict.doctor.firstName} ${doctorConflict.doctor.lastName}`
          : 'المحاضر';
        const courseStr = doctorConflict.course?.name || 'مادة أخرى';
        const deptStr = doctorConflict.course?.department?.name || '';
        conflicts.push({
          type: 'DOCTOR_BUSY',
          messageAr: `المحاضر (${docNameStr}) لديه محاضرة أخرى (${courseStr}) ${deptStr ? `بقسم ${deptStr}` : ''} بقاعة (${doctorConflict.room || 'غير محددة'}) في نفس الوقت (${doctorConflict.startTime} - ${doctorConflict.endTime}).`,
          messageEn: `Instructor (${docNameStr}) is already teaching (${courseStr}) in room (${doctorConflict.room || 'N/A'}) at (${doctorConflict.startTime} - ${doctorConflict.endTime}).`,
          conflictingSlot: {
            courseName: courseStr,
            doctorName: docNameStr,
            departmentName: deptStr,
            time: `${doctorConflict.startTime} - ${doctorConflict.endTime}`,
            room: doctorConflict.room,
          },
        });
      }

      const overrideDoctorConflict = await tx.scheduleOverride.findFirst({
        where: {
          dayOfWeek: dayUpper,
          doctorId: docId,
          ...timeOverlap,
          ...activeOverrideDateRange,
          ...(excludeSlotId ? { scheduleSlotId: { not: Number(excludeSlotId) } } : {}),
        },
        include: {
          scheduleSlot: {
            include: {
              course: { select: { name: true, department: { select: { name: true } } } },
            },
          },
        },
      });

      if (overrideDoctorConflict) {
        conflicts.push({
          type: 'DOCTOR_BUSY',
          messageAr: `المحاضر لديه جدول استثنائي/تعويضي نشط في نفس الوقت (${overrideDoctorConflict.startTime || overrideDoctorConflict.scheduleSlot?.startTime} - ${overrideDoctorConflict.endTime || overrideDoctorConflict.scheduleSlot?.endTime}).`,
          messageEn: `Instructor has an active schedule override at this time (${overrideDoctorConflict.startTime || overrideDoctorConflict.scheduleSlot?.startTime} - ${overrideDoctorConflict.endTime || overrideDoctorConflict.scheduleSlot?.endTime}).`,
        });
      }
    }

    // 3. TA conflict
    if (teachingAssistantId) {
      const taId = String(teachingAssistantId);
      const taConflict = await tx.scheduleSlot.findFirst({
        where: { dayOfWeek: dayUpper, teachingAssistantId: taId, ...timeOverlap, ...excludeCondition },
        include: {
          course: { select: { name: true, department: { select: { name: true } } } },
          teachingAssistant: { select: { firstName: true, lastName: true } },
        },
      });

      if (taConflict) {
        const taNameStr = taConflict.teachingAssistant
          ? `م. ${taConflict.teachingAssistant.firstName} ${taConflict.teachingAssistant.lastName}`
          : 'المعيد';
        const courseStr = taConflict.course?.name || 'سكشن آخر';
        conflicts.push({
          type: 'TA_BUSY',
          messageAr: `المعيد (${taNameStr}) لديه سكشن آخر (${courseStr}) بقاعة (${taConflict.room || 'غير محددة'}) في نفس الفترة (${taConflict.startTime} - ${taConflict.endTime}).`,
          messageEn: `Teaching Assistant (${taNameStr}) is already assigned to (${courseStr}) at (${taConflict.startTime} - ${taConflict.endTime}).`,
          conflictingSlot: {
            courseName: courseStr,
            doctorName: taNameStr,
            time: `${taConflict.startTime} - ${taConflict.endTime}`,
            room: taConflict.room,
          },
        });
      }

      const overrideTaConflict = await tx.scheduleOverride.findFirst({
        where: {
          dayOfWeek: dayUpper,
          teachingAssistantId: taId,
          ...timeOverlap,
          ...activeOverrideDateRange,
          ...(excludeSlotId ? { scheduleSlotId: { not: Number(excludeSlotId) } } : {}),
        },
      });

      if (overrideTaConflict) {
        conflicts.push({
          type: 'TA_BUSY',
          messageAr: `المعيد لديه جدول استثنائي نشط في هذه الفترة الزمنية.`,
          messageEn: `Teaching Assistant has an active schedule override at this time.`,
        });
      }
    }

    // 4. StudentGroup & Cohort conflict
    if (groupId) {
      const targetGroup = await tx.studentGroup.findUnique({
        where: { id: Number(groupId) },
        select: { id: true, name: true, departmentId: true, year: true, parentGroupId: true },
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
        const queue: number[] = [Number(groupId)];
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

        const lineageGroupIds = [Number(groupId), ...ancestorGroupIds, ...descendantGroupIds];

        const groupConflict = await tx.scheduleSlot.findFirst({
          where: {
            dayOfWeek: dayUpper,
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
          include: {
            course: { select: { name: true } },
            group: { select: { name: true } },
          },
        });

        if (groupConflict) {
          const courseStr = groupConflict.course?.name || 'مادة أخرى';
          conflicts.push({
            type: 'GROUP_CONFLICT',
            messageAr: `المجموعة الطلابية أو الدفعة لديها حصة أخرى (${courseStr}) مجدولة في نفس الفترة (${groupConflict.startTime} - ${groupConflict.endTime}).`,
            messageEn: `The student group or cohort is already scheduled for (${courseStr}) at (${groupConflict.startTime} - ${groupConflict.endTime}).`,
            conflictingSlot: {
              courseName: courseStr,
              time: `${groupConflict.startTime} - ${groupConflict.endTime}`,
              room: groupConflict.room,
            },
          });
        }

        const overrideGroupConflict = await tx.scheduleOverride.findFirst({
          where: {
            dayOfWeek: dayUpper,
            ...timeOverlap,
            ...activeOverrideDateRange,
            ...(excludeSlotId ? { scheduleSlotId: { not: Number(excludeSlotId) } } : {}),
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
          conflicts.push({
            type: 'GROUP_CONFLICT',
            messageAr: `توجد حصة استثنائية نشطة لهذه المجموعة الطلابية أو الدفعة في نفس الوقت.`,
            messageEn: `An active schedule override exists for this student group or cohort at this time.`,
          });
        }
      }
    } else {
      // Check department / year cohort conflict
      let targetDeptId = departmentId ? Number(departmentId) : null;
      let targetYear = academicYear ? Number(academicYear) : null;
      let targetSemester = semester ? Number(semester) : null;

      if ((!targetDeptId || !targetYear) && courseId) {
        const course = await tx.course.findUnique({
          where: { id: Number(courseId) },
          select: { departmentId: true, year: true, semester: true },
        });

        if (course) {
          if (!targetDeptId && course.departmentId) targetDeptId = course.departmentId;
          if (!targetYear && course.year) targetYear = course.year;
          if (!targetSemester && course.semester) targetSemester = course.semester;
        }
      }

      if (targetDeptId && targetYear) {
        const deptConflict = await tx.scheduleSlot.findFirst({
          where: {
            dayOfWeek: dayUpper,
            ...timeOverlap,
            ...excludeCondition,
            OR: [
              {
                course: {
                  departmentId: targetDeptId,
                  year: targetYear,
                  ...(targetSemester ? { semester: targetSemester } : {}),
                },
              },
              {
                group: {
                  departmentId: targetDeptId,
                  year: targetYear,
                },
              },
            ],
          },
          include: {
            course: { select: { name: true } },
          },
        });

        if (deptConflict) {
          const courseStr = deptConflict.course?.name || 'مادة أخرى';
          conflicts.push({
            type: 'BATCH_OVERLAP',
            messageAr: `توجد بالفعل مادة أخرى (${courseStr}) مجدولة لنفس السنة والقسم في هذه الفترة الزمنية (${deptConflict.startTime} - ${deptConflict.endTime}).`,
            messageEn: `Another course (${courseStr}) is already scheduled for this batch in this time slot (${deptConflict.startTime} - ${deptConflict.endTime}).`,
            conflictingSlot: {
              courseName: courseStr,
              time: `${deptConflict.startTime} - ${deptConflict.endTime}`,
              room: deptConflict.room,
            },
          });
        }

        const overrideDeptConflict = await tx.scheduleOverride.findFirst({
          where: {
            dayOfWeek: dayUpper,
            ...timeOverlap,
            ...activeOverrideDateRange,
            ...(excludeSlotId ? { scheduleSlotId: { not: Number(excludeSlotId) } } : {}),
            scheduleSlot: {
              OR: [
                {
                  course: {
                    departmentId: targetDeptId,
                    year: targetYear,
                    ...(targetSemester ? { semester: targetSemester } : {}),
                  },
                },
                {
                  group: {
                    departmentId: targetDeptId,
                    year: targetYear,
                  },
                },
              ],
            },
          },
        });

        if (overrideDeptConflict) {
          conflicts.push({
            type: 'BATCH_OVERLAP',
            messageAr: `توجد حصة استثنائية نشطة لنفس الفرقة والقسم في هذه الفترة الزمنية.`,
            messageEn: `An active schedule override exists for this department and year at this time.`,
          });
        }
      }
    }

    return conflicts;
  }

  static async checkConflicts(input: ConflictCheckInput, tx: any = prisma) {
    const conflicts = await TimetableService.findConflicts(input, tx);
    if (conflicts.length > 0) {
      throw new ConflictError(conflicts[0].messageEn);
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
