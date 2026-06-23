export type Day = 'Saturday' | 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday';

export type SessionType = 'LECTURE' | 'LAB' | 'SEMINAR';

/** A single occupied slot in the flat slot map coming from the API. */
export interface SlotEntry {
  courseName: string;
  doctorName: string;
  room: string;
  sessionType: SessionType;
  /** The parent timetable id — needed when saving back. */
  timetableId: number | null;
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
  scheduleData: {
    slots: Array<{
      day: Day;
      startTime: string;
      endTime: string;
      courseName: string;
      instructor: string;
      room: string;
      sessionType?: SessionType;
    }>;
  } | null;
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
  doctor?: {
    id: number;
    firstName: string;
    lastName: string;
  } | null;
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
  departmentId: string;
  academicYear: string;
  semester: string;
}

export interface SlotDialog {
  day: Day;
  slot: string;
}
