export type SlotType = 'LECTURE' | 'LAB';

export interface WizardSlotForm {
  departmentId: string;
  collegeId: string;
  academicYear: string;
  semester: string;
  courseId: string;
  courseName: string;
  slotType: SlotType;
  groupId: string;
  groupName: string;
  doctorId: string;
  doctorName: string;
  teachingAssistantId: string;
  teachingAssistantName: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomId: number | null;
  roomName: string;
  legacyRoomName?: string | null;
  timetableId?: number | null;
}

export interface ScheduleConflict {
  type: string;
  messageAr: string;
  messageEn: string;
  conflictingSlot?: Record<string, unknown>;
}

export interface ResolvedTerm {
  id: number;
  name: string;
  code?: string;
  isCurrent?: boolean;
}

export interface ResolvedRoom {
  id: number;
  name: string;
  isActive?: boolean;
}

export interface CheckConflictResult {
  hasConflict: boolean;
  conflicts: ScheduleConflict[];
  resolvedTerm?: ResolvedTerm | null;
  resolvedRoom?: ResolvedRoom | null;
}

export type WizardStep = 1 | 2 | 3 | 4;
