import { Prisma, AcademicTerm, Room } from '@prisma/client';
import prisma from '../utils/prismaClient';
import { ConflictError, AuthorizationError, NotFoundError } from '../utils/appError';
import { TimetableService } from './timetable.service';
import { isTermPast } from '../utils/termLock.utils';

export interface PlacementInput {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  courseId?: number | null;
  termId?: number | null;
  roomId?: number | null;
  room?: string | null;
  doctorId?: number | null;
  teachingAssistantId?: string | null;
  groupId?: number | null;
  excludeSlotId?: number;
  timetableId?: number | null;
  departmentId?: number | null;
  academicYear?: number | null;
  semester?: number | null;
}

export interface PlacementConflict {
  type: string;
  messageAr: string;
  messageEn: string;
  conflictingSlot?: any;
}

export interface PlacementValidationResult {
  isValid: boolean;
  conflicts: PlacementConflict[];
  resolvedTerm: AcademicTerm | null;
  resolvedRoom: Room | null;
}

export class SchedulePlacementService {
  /**
   * Evaluates placement rules without throwing:
   * 1. Term resolution (explicit termId, fallback to isCurrent term, OD-29)
   * 2. Past-term lock (term not current and endDate < now)
   * 3. Room resolution & validation (active Room, case-insensitive string match, OD-45)
   * 4. Cross-department TA authorization check (OD-31 / OD-43)
   * 5. Reuse TimetableService queries for doctor, TA, room, and group conflicts
   */
  static async findPlacementConflicts(
    input: PlacementInput,
    options?: { tx?: any }
  ): Promise<PlacementValidationResult> {
    const tx = options?.tx || prisma;
    const termClient = (tx as any)?.academicTerm || prisma.academicTerm;
    const roomClient = (tx as any)?.room || prisma.room;
    const taClient = (tx as any)?.teachingAssistant || prisma.teachingAssistant;
    const courseClient = (tx as any)?.course || prisma.course;
    const taApprovalClient = (tx as any)?.tACrossDepartmentApproval || prisma.tACrossDepartmentApproval;
    const conflicts: PlacementConflict[] = [];

    // 1. Resolve Academic Term (OD-29)
    let resolvedTerm: AcademicTerm | null = null;
    if (input.termId !== undefined && input.termId !== null) {
      const term = await termClient.findUnique({
        where: { id: Number(input.termId) },
      });
      if (!term) {
        conflicts.push({
          type: 'INVALID_TERM',
          messageAr: 'الفصل الدراسي المحدد غير موجود.',
          messageEn: `Academic term with ID ${input.termId} was not found.`,
        });
      } else {
        resolvedTerm = term;
      }
    } else {
      const currentTerm = await termClient.findFirst({
        where: { isCurrent: true },
      });
      resolvedTerm = currentTerm || null;
      if (!resolvedTerm) {
        conflicts.push({
          type: 'NO_ACTIVE_TERM',
          messageAr: 'لا يوجد فصل دراسي حالي نشط للجدولة.',
          messageEn: 'No active academic term exists for schedule placement.',
        });
      }
    }

    // Past-term lock: term not current and endDate < now
    if (isTermPast(resolvedTerm)) {
      conflicts.push({
        type: 'PAST_TERM_LOCKED',
        messageAr: 'لا يمكن التعديل أو الجدولة في فصل دراسي منتهٍ.',
        messageEn: 'Cannot schedule in a past academic term.',
      });
    }

    // 2. Resolve Room (OD-45)
    let resolvedRoom: Room | null = null;
    if (input.roomId !== undefined && input.roomId !== null) {
      const roomRow = await roomClient.findUnique({
        where: { id: Number(input.roomId) },
      });
      if (!roomRow) {
        conflicts.push({
          type: 'ROOM_NOT_FOUND',
          messageAr: `القاعة برقم ${input.roomId} غير موجودة.`,
          messageEn: `Room with ID ${input.roomId} not found.`,
        });
      } else {
        resolvedRoom = roomRow;
        if (!roomRow.isActive) {
          conflicts.push({
            type: 'ROOM_INACTIVE',
            messageAr: `القاعة (${roomRow.name}) غير مفعلة ولا يمكن جدولتها.`,
            messageEn: `Room (${roomRow.name}) is inactive and cannot be scheduled.`,
          });
        }
      }
    } else if (input.room && typeof input.room === 'string' && input.room.trim() !== '') {
      const trimmed = input.room.trim();
      const matchedRoom = await roomClient.findFirst({
        where: { name: { equals: trimmed, mode: 'insensitive' } },
      });
      if (matchedRoom) {
        resolvedRoom = matchedRoom;
        if (!matchedRoom.isActive) {
          conflicts.push({
            type: 'ROOM_INACTIVE',
            messageAr: `القاعة (${matchedRoom.name}) غير مفعلة ولا يمكن جدولتها.`,
            messageEn: `Room (${matchedRoom.name}) is inactive and cannot be scheduled.`,
          });
        }
      } else {
        // Unmapped legacy string is kept as legacy fallback
        resolvedRoom = null;
      }
    }

    // 3. Cross-Department TA Authorization (OD-31 / OD-43)
    if (input.teachingAssistantId && input.courseId) {
      const [ta, course] = await Promise.all([
        taClient.findUnique({
          where: { id: String(input.teachingAssistantId) },
          select: { id: true, departmentId: true, firstName: true, lastName: true },
        }),
        courseClient.findUnique({
          where: { id: Number(input.courseId) },
          select: { id: true, departmentId: true, name: true },
        }),
      ]);

      if (
        ta &&
        course &&
        ta.departmentId !== null &&
        course.departmentId !== null &&
        ta.departmentId !== course.departmentId
      ) {
        const approval = await taApprovalClient.findUnique({
          where: {
            teachingAssistantId_courseId: {
              teachingAssistantId: String(input.teachingAssistantId),
              courseId: Number(input.courseId),
            },
          },
        });

        if (!approval || approval.status !== 'APPROVED') {
          conflicts.push({
            type: 'UNAPPROVED_CROSS_DEPARTMENT_TA',
            messageAr: `المعيد (${ta.firstName} ${ta.lastName}) غير معتمد للتدريس بقسم آخر لمادة (${course.name}).`,
            messageEn: `Teaching assistant (${ta.firstName} ${ta.lastName}) requires an approved cross-department authorization to teach course (${course.name}).`,
          });
        }
      }
    }

    // 4. TimetableService conflict queries reuse (Doctor, TA, Room, Group conflicts)
    const roomNameForCheck = resolvedRoom
      ? resolvedRoom.name
      : input.room && typeof input.room === 'string' && input.room.trim() !== ''
      ? input.room.trim()
      : undefined;

    const timetableConflicts = await TimetableService.findConflicts(
      {
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        room: roomNameForCheck,
        courseId: input.courseId ? Number(input.courseId) : undefined,
        departmentId: input.departmentId ? Number(input.departmentId) : undefined,
        academicYear: input.academicYear ? Number(input.academicYear) : undefined,
        semester: input.semester ? Number(input.semester) : undefined,
        doctorId: input.doctorId ? Number(input.doctorId) : undefined,
        teachingAssistantId: input.teachingAssistantId ? String(input.teachingAssistantId) : undefined,
        groupId: input.groupId ? Number(input.groupId) : undefined,
        excludeSlotId: input.excludeSlotId ? Number(input.excludeSlotId) : undefined,
      },
      tx
    );

    conflicts.push(...timetableConflicts);

    return {
      isValid: conflicts.length === 0,
      conflicts,
      resolvedTerm,
      resolvedRoom,
    };
  }

  /**
   * Asserts valid placement and throws appropriate operational error:
   * - Unapproved cross-dept TA -> 403 Forbidden
   * - Conflicts, inactive room, or past-term lock -> 409 Conflict
   */
  static async assertValidPlacement(
    input: PlacementInput,
    options?: { tx?: any }
  ): Promise<PlacementValidationResult> {
    const result = await SchedulePlacementService.findPlacementConflicts(input, options);

    if (!result.isValid) {
      const crossDept = result.conflicts.find(
        (c) => c.type === 'UNAPPROVED_CROSS_DEPARTMENT_TA'
      );
      if (crossDept) {
        throw new AuthorizationError(crossDept.messageEn);
      }
      throw new ConflictError(result.conflicts[0].messageEn);
    }

    return result;
  }

  /**
   * Executes placement write in a Serializable transaction.
   * Catches P2034 write-conflict / serialization failure and maps to 409 with a retry message.
   */
  static async executeSchedulePlacement<T>(
    placementData: PlacementInput,
    writeOperation: (tx: Prisma.TransactionClient, placementResult: PlacementValidationResult) => Promise<T>,
    options?: {
      prismaClient?: any;
      beforePlacement?: (tx: Prisma.TransactionClient) => Promise<void>;
    }
  ): Promise<T> {
    const client = options?.prismaClient || prisma;
    try {
      return await client.$transaction(
        async (tx: Prisma.TransactionClient) => {
          if (options?.beforePlacement) {
            await options.beforePlacement(tx);
          }
          const placementResult = await SchedulePlacementService.assertValidPlacement(placementData, { tx });
          return await writeOperation(tx, placementResult);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }
      );
    } catch (error: any) {
      if (
        error?.code === 'P2034' ||
        (typeof error?.message === 'string' && error.message.includes('P2034'))
      ) {
        throw new ConflictError(
          'Schedule placement conflict due to concurrent modification. Please retry.'
        );
      }
      throw error;
    }
  }

  /**
   * Executes a batch of grid slots in a single Serializable transaction.
   * Validates against final state:
   * 1. Evaluates each slot's term, room, and cross-dept TA authorizations.
   * 2. Evaluates inter-database conflicts, ignoring conflicts with slots in options.excludedSlotIds.
   * 3. Detects intra-batch conflicts between slots in the incoming payload.
   * 4. All-or-nothing: any conflict throws 409 (or 403) and rolls back all writes.
   */
  static async executeSyncGrid<T>(
    slots: PlacementInput[],
    syncOperation: (
      tx: Prisma.TransactionClient,
      validationResults: Array<{ slot: PlacementInput; placementResult: PlacementValidationResult }>
    ) => Promise<T>,
    options?: { prismaClient?: any; excludedSlotIds?: number[] }
  ): Promise<T> {
    const client = options?.prismaClient || prisma;
    try {
      return await client.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const validationResults: Array<{ slot: PlacementInput; placementResult: PlacementValidationResult }> = [];
          const allConflicts: PlacementConflict[] = [];

          // Temporarily archive slots being updated in this batch so their old cells are freed in the final state
          if (options?.excludedSlotIds && options.excludedSlotIds.length > 0) {
            await tx.scheduleSlot.updateMany({
              where: { id: { in: options.excludedSlotIds } },
              data: { isArchived: true },
            });
          }

          // 1. Resolve term, room, and cross-dept TA for each slot
          for (let i = 0; i < slots.length; i++) {
            const slotInput = slots[i];
            const result = await SchedulePlacementService.findPlacementConflicts(slotInput, { tx });

            if (result.conflicts.length > 0) {
              allConflicts.push(...result.conflicts);
            }
            validationResults.push({
              slot: slotInput,
              placementResult: result,
            });
          }

          // 2. Intra-batch collision validation
          for (let i = 0; i < slots.length; i++) {
            for (let j = i + 1; j < slots.length; j++) {
              const s1 = slots[i];
              const s2 = slots[j];
              const r1 = validationResults[i].placementResult;
              const r2 = validationResults[j].placementResult;

              if (s1.dayOfWeek.toUpperCase() === s2.dayOfWeek.toUpperCase()) {
                if (s1.startTime < s2.endTime && s1.endTime > s2.startTime) {
                  // Room collision
                  const room1Id = r1.resolvedRoom?.id ?? s1.roomId;
                  const room2Id = r2.resolvedRoom?.id ?? s2.roomId;
                  const room1Name = r1.resolvedRoom?.name ?? (s1.room ? String(s1.room).trim().toLowerCase() : null);
                  const room2Name = r2.resolvedRoom?.name ?? (s2.room ? String(s2.room).trim().toLowerCase() : null);

                  if (
                    (room1Id && room2Id && room1Id === room2Id) ||
                    (!room1Id && !room2Id && room1Name && room2Name && room1Name === room2Name)
                  ) {
                    allConflicts.push({
                      type: 'ROOM_OCCUPIED',
                      messageAr: 'تعارض بالقاعة: القاعة محجوزة في نفس التوقيت داخل الجدول.',
                      messageEn: `Room conflict: Room is occupied by another slot in the grid at the same time.`,
                    });
                  }

                  // Doctor collision
                  if (s1.doctorId && s2.doctorId && s1.doctorId === s2.doctorId) {
                    allConflicts.push({
                      type: 'DOCTOR_BUSY',
                      messageAr: 'تعارض للمحاضر: المحاضر معيّن لمحاضرة أخرى في نفس التوقيت داخل الجدول.',
                      messageEn: `Doctor conflict: Doctor ID ${s1.doctorId} is assigned to another slot in the grid at the same time.`,
                    });
                  }

                  // TA collision
                  if (s1.teachingAssistantId && s2.teachingAssistantId && s1.teachingAssistantId === s2.teachingAssistantId) {
                    allConflicts.push({
                      type: 'TA_BUSY',
                      messageAr: 'تعارض للمعيد: المعيد معيّن لمحاضرة أخرى في نفس التوقيت داخل الجدول.',
                      messageEn: `Teaching assistant conflict: TA ID ${s1.teachingAssistantId} is assigned to another slot in the grid at the same time.`,
                    });
                  }

                  // Group collision
                  if (s1.groupId && s2.groupId && s1.groupId === s2.groupId) {
                    allConflicts.push({
                      type: 'GROUP_CONFLICT',
                      messageAr: 'تعارض للمجموعة: المجموعة لديها محاضرة أخرى في نفس التوقيت داخل الجدول.',
                      messageEn: `Group conflict: Group ID ${s1.groupId} has another class scheduled at the same time.`,
                    });
                  }
                }
              }
            }
          }

          if (allConflicts.length > 0) {
            const crossDept = allConflicts.find((c) => c.type === 'UNAPPROVED_CROSS_DEPARTMENT_TA');
            if (crossDept) {
              throw new AuthorizationError(crossDept.messageEn);
            }
            throw new ConflictError(allConflicts[0].messageEn);
          }

          return await syncOperation(tx, validationResults);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }
      );
    } catch (error: any) {
      if (
        error?.code === 'P2034' ||
        (typeof error?.message === 'string' && error.message.includes('P2034'))
      ) {
        throw new ConflictError(
          'Schedule placement conflict due to concurrent modification. Please retry.'
        );
      }
      throw error;
    }
  }
}

export const findPlacementConflicts = SchedulePlacementService.findPlacementConflicts;
export const assertValidPlacement = SchedulePlacementService.assertValidPlacement;
export const executeSchedulePlacement = SchedulePlacementService.executeSchedulePlacement;
export const executeSyncGrid = SchedulePlacementService.executeSyncGrid;
export default SchedulePlacementService;

