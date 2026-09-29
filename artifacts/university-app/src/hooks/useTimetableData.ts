import React, { useState, useEffect, useCallback } from 'react';
import departmentService from '../services/department.service';
import coursesService from '../services/courses.service';
import doctorsService from '../services/doctors.service';
import timetableService from '../services/timetable.service';
import schedulesService from '../services/schedules.service';
import collegeService from '../services/college.service';
import type {
  TimetableFilters,
  SlotsMap,
  Department,
  Course,
  Doctor,
  College,
} from '../types/timetable.types';

// ── Raw API shapes for mapping ────────────────────────────────────────────────

interface RawScheduleSlot {
  id?: number;
  dayOfWeek?: string;
  day?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
  slotType?: string;
  courseId?: number;
  course?: { name?: string } | null;
  doctorId?: number;
  doctor?: { firstName?: string; lastName?: string } | null;
  teachingAssistantId?: string | number;
  teachingAssistant?: { firstName?: string; lastName?: string } | null;
  groupId?: number | null;
  timetableId?: number;
}

interface RawTimetableSlot {
  day?: string;
  dayOfWeek?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
  slotType?: string;
  courseName?: string;
  instructor?: string;
  doctorName?: string;
  courseId?: number;
  doctorId?: number;
  teachingAssistantId?: string | number;
}

interface RawTimetable {
  id: number;
  scheduleData?: {
    slots?: RawTimetableSlot[];
  };
}

interface UseTimetableDataReturn {
  slots: SlotsMap;
  setSlots: React.Dispatch<React.SetStateAction<SlotsMap>>;
  colleges: College[];
  departments: Department[];
  courses: Course[];
  doctors: Doctor[];
  timetableId: number | null;
  loadingColleges: boolean;
  loadingDepts: boolean;
  loadingSlots: boolean;
  loadingCourses: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches and manages all remote data needed by TimetableGrid.
 * Departments are fetched once on mount (scoped to the user's college).
 * Slots, courses, and doctors are re-fetched whenever the active filters change.
 * Every fetch is cancelled via AbortController when filters change or the
 * component unmounts — preventing stale-state updates after navigation.
 */
export function useTimetableData(
  filters: TimetableFilters,
  collegeId: number | string | null | undefined,
  deptId: number | string | null | undefined,
  userRole: string | undefined
): UseTimetableDataReturn {
  const [slots, setSlots] = useState<SlotsMap>({});
  const [colleges, setColleges] = useState<College[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [timetableId, setTimetableId] = useState<number | null>(null);
  const [loadingColleges, setLoadingColleges] = useState(false);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const refetch = useCallback(() => setRefreshCount((c) => c + 1), []);

  // ── Colleges (once on mount) ─────────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();
    setLoadingColleges(true);
    collegeService
      .getColleges()
      .then((res: { success: boolean; data?: unknown }) => {
        if (controller.signal.aborted) return;
        if (res.success) {
          const raw = res.data;
          const arr: College[] = Array.isArray(raw)
            ? (raw as College[])
            : ((raw as { data?: { colleges?: College[] } })?.data?.colleges ??
              (raw as { colleges?: College[] })?.colleges ??
              (raw as { data?: College[] })?.data ??
              []);
          setColleges(arr);
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(String(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingColleges(false);
      });
    return () => controller.abort();
  }, []);

  // ── Departments (once, or when college scope changes) ──────────────────────
  useEffect(() => {
    const controller = new AbortController();
    setLoadingDepts(true);

    const params: Record<string, unknown> = {};
    const effectiveCollegeId = filters.collegeId || collegeId;
    if (effectiveCollegeId) params.collegeId = effectiveCollegeId;

    departmentService
      .getDepartments(params)
      .then((res: { success: boolean; data?: Department[] | null }) => {
        if (controller.signal.aborted) return;
        if (res.success) {
          setDepartments(res.data ?? []);
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(String(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingDepts(false);
      });

    return () => controller.abort();
  }, [filters.collegeId, collegeId]);

  // ── Timetable slots (whenever dept/year/sem filters change) ────────────────
  useEffect(() => {
    if (!filters.departmentId || !filters.academicYear || !filters.semester) return;

    const controller = new AbortController();
    setLoadingSlots(true);
    setError(null);

    Promise.all([
      timetableService.getTimetables({
        departmentId: filters.departmentId,
        academicYear: filters.academicYear,
        semester: filters.semester,
      }),
      schedulesService.getAllWeeklyTimetable({
        departmentId: filters.departmentId,
        year: filters.academicYear,
        semester: filters.semester,
      }),
    ])
      .then(([timetableRes, schedulesRes]) => {
        if (controller.signal.aborted) return;

        // Resolve the timetable document
        const rawTimetables = Array.isArray(timetableRes.data)
          ? (timetableRes.data as RawTimetable[])
          : ((timetableRes.data as { timetables?: RawTimetable[] })?.timetables ??
            (timetableRes.data as { data?: RawTimetable[] })?.data ??
            []);
        const timetable: RawTimetable | undefined = rawTimetables[0];
        setTimetableId(timetable?.id ?? null);

        // Resolve schedule slots from the weekly endpoint
        const rawSchedules = schedulesRes.data as RawScheduleSlot[] | null;
        const slotsArray: RawScheduleSlot[] = Array.isArray(rawSchedules) ? rawSchedules : [];

        if (slotsArray.length > 0) {
          const mapped: SlotsMap = {};
          slotsArray.forEach((slot) => {
            const rawDay = slot.dayOfWeek || slot.day || '';
            const dayFormatted = rawDay
              ? rawDay.charAt(0).toUpperCase() + rawDay.slice(1).toLowerCase()
              : '';
            const key = `${dayFormatted}_${slot.startTime}-${slot.endTime}`;
            mapped[key] = {
              courseName: slot.course?.name || `Course ${slot.courseId}`,
              doctorName:
                (slot.slotType === 'LAB' || slot.slotType === 'SECTION') &&
                slot.teachingAssistant?.firstName
                  ? `${slot.teachingAssistant.firstName} ${slot.teachingAssistant.lastName}`
                  : slot.doctor?.firstName
                  ? `${slot.doctor.firstName} ${slot.doctor.lastName}`
                  : '',
              room: slot.room || '',
              slotType: (slot.slotType as 'LECTURE' | 'LAB' | 'SECTION') || 'LECTURE',
              timetableId: slot.timetableId ?? null,
              courseId: slot.courseId,
              doctorId: slot.doctorId,
              teachingAssistantId: slot.teachingAssistantId as string | undefined,
              groupId: slot.groupId,
              id: slot.id,
            };
          });
          setSlots(mapped);
        } else if (timetable?.scheduleData?.slots && Array.isArray(timetable.scheduleData.slots)) {
          const mapped: SlotsMap = {};
          timetable.scheduleData.slots.forEach((slot: RawTimetableSlot) => {
            const rawDay = slot.day || slot.dayOfWeek || '';
            const dayFormatted = rawDay
              ? rawDay.charAt(0).toUpperCase() + rawDay.slice(1).toLowerCase()
              : '';
            const key = `${dayFormatted}_${slot.startTime}-${slot.endTime}`;
            mapped[key] = {
              courseName: slot.courseName || '',
              doctorName: slot.instructor || slot.doctorName || '',
              room: slot.room || '',
              slotType: (slot.slotType as 'LECTURE' | 'LAB' | 'SECTION') || 'LECTURE',
              timetableId: timetable.id ?? null,
              courseId: slot.courseId,
              doctorId: slot.doctorId,
              teachingAssistantId: slot.teachingAssistantId as string | undefined,
            };
          });
          setSlots(mapped);
        } else {
          setSlots({});
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(String(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingSlots(false);
      });

    return () => controller.abort();
  }, [filters.departmentId, filters.academicYear, filters.semester, refreshCount]);

  // ── Courses & Doctors (whenever the selected department changes) ───────────
  useEffect(() => {
    if (!filters.departmentId) {
      setCourses([]);
      return;
    }

    const controller = new AbortController();
    setLoadingCourses(true);

    Promise.all([
      coursesService.getCourses({ departmentId: filters.departmentId }),
      doctorsService.getDoctors({ limit: 1000 }),
    ])
      .then(([coursesRes, doctorsRes]) => {
        if (controller.signal.aborted) return;
        if (coursesRes.success) {
          const raw = coursesRes.data as unknown;
          const arr: Course[] = Array.isArray(raw)
            ? (raw as Course[])
            : ((raw as { data?: { courses?: Course[] } })?.data?.courses ??
              (raw as { courses?: Course[] })?.courses ??
              (raw as { data?: Course[] })?.data ??
              []);
          setCourses(arr);
        }
        if (doctorsRes.success) {
          const raw = doctorsRes.data as unknown;
          const arr: Doctor[] = Array.isArray(raw)
            ? (raw as Doctor[])
            : ((raw as { doctors?: Doctor[] })?.doctors ??
              (raw as { data?: { doctors?: Doctor[] } })?.data?.doctors ??
              (raw as { data?: Doctor[] })?.data ??
              []);
          setDoctors(arr);
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(String(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingCourses(false);
      });

    return () => controller.abort();
  }, [filters.departmentId]);

  return {
    slots,
    setSlots,
    colleges,
    departments,
    courses,
    doctors,
    timetableId,
    loadingColleges,
    loadingDepts,
    loadingSlots,
    loadingCourses,
    error,
    refetch,
  };
}
