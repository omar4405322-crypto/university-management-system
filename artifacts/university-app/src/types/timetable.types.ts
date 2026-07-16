export type Day = 'Saturday' | 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday';

export type SlotType = 'LECTURE' | 'LAB' | 'SECTION';

/** A single occupied slot in the flat slot map coming from the API. */
export interface SlotEntry {
  courseName: string;
  doctorName: string;
  room: string;
  slotType: SlotType;
  /** The parent timetable id — needed when saving back. */
  timetableId: number | null;
  courseId?: number;
  doctorId?: number;
  groupId?: number | null;
  id?: number;
  /** Set to true when an active ScheduleOverride exists for today */
  isTemporarilyModified?: boolean;
  overrideReason?: string | null;
  /** The raw overrides array from the API (active overrides only) */
  overrides?: Array<{ id: number; room?: string | null; reason?: string | null }>;
}

/**
 * The full timetable document shape returned by the API.
 * Only the fields consumed by TimetableGrid are typed here.
 */
export interface TimetableDocument {
  id: number;
  departmentId: number;
  collegeId: number;
  academicYear: number;
  semester: number;

}

export interface College {
  id: number;
  name: string;
  nameAr?: string;
}

export interface Department {
  id: number;
  name: string;
  nameAr?: string;
  collegeId: number;
}

export interface Course {
  id: number;
  name: string;
  courseCode: string;

}

export interface Doctor {
  id: number;
  firstName: string;
  lastName: string;
  department?: {
    id: number;
    collegeId: number;
  } | null;
}

/** The flat key format used in the local slot map: "Saturday_08:00-10:00" */
export type SlotKey = string;

/** The local in-memory map that drives the grid UI. */
export type SlotsMap = Record<SlotKey, SlotEntry>;

export interface TimetableFilters {
  collegeId?: string;
  departmentId: string;
  academicYear: string;
  semester: string;
}

export interface SlotDialog {
  day: Day;
  slot: string;
}
