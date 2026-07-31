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
      .then((res: { success: boolean; data?: College[] | { data?: { colleges?: College[] }, colleges?: College[] } | null }) => {
        if (controller.signal.aborted) return;
        if (res.success) {
          const raw = res.data;
          const arr: College[] = Array.isArray(raw)
            ? raw
            : (raw as any)?.data?.colleges ?? (raw as any)?.colleges ?? (raw as any)?.data ?? [];
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
      schedulesService.getWeeklyTimetable({
        departmentId: filters.departmentId,
        year: filters.academicYear,
        semester: filters.semester,
      })
    ])
      .then(([timetableRes, schedulesRes]: any) => {
        if (controller.signal.aborted) return;
        
        const rawTimetables = Array.isArray(timetableRes.data)
          ? timetableRes.data
          : timetableRes.data?.timetables ?? timetableRes.data?.data ?? [];
        const timetable = rawTimetables[0];
        setTimetableId(timetable?.id ?? null);
        
        const slotsArray = Array.isArray(schedulesRes.data?.data)
          ? schedulesRes.data.data
          : Array.isArray(schedulesRes.data)
          ? schedulesRes.data
          : [];
        if (slotsArray.length > 0) {
          const mapped: SlotsMap = {};
          slotsArray.forEach((slot: any) => {
            const rawDay = slot.dayOfWeek || slot.day || '';
            const dayFormatted = rawDay ? rawDay.charAt(0).toUpperCase() + rawDay.slice(1).toLowerCase() : '';
            const key = `${dayFormatted}_${slot.startTime}-${slot.endTime}`;
            mapped[key] = {
              courseName: slot.course?.name || `Course ${slot.courseId}`,
              doctorName:
                (slot.slotType === 'LAB' || slot.slotType === 'SECTION') && slot.teachingAssistant?.firstName
                  ? `${slot.teachingAssistant.firstName} ${slot.teachingAssistant.lastName}`
                  : slot.doctor?.firstName
                  ? `${slot.doctor.firstName} ${slot.doctor.lastName}`
                  : '',
              room: slot.room || '',
              slotType: slot.slotType || 'LECTURE',
              timetableId: slot.timetableId,
              courseId: slot.courseId,
              doctorId: slot.doctorId,
              groupId: slot.groupId,
              id: slot.id
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
      .then(
        ([coursesRes, doctorsRes]: [
          { success: boolean; data?: unknown },
          { success: boolean; data?: unknown },
        ]) => {
          if (controller.signal.aborted) return;
          if (coursesRes.success) {
            const raw = coursesRes.data;
            const arr: Course[] = Array.isArray(raw)
              ? (raw as Course[])
              : ((raw as { data?: { courses?: Course[] }; courses?: Course[] })?.data?.courses ??
                (raw as { courses?: Course[] })?.courses ??
                (raw as { data?: Course[] })?.data ??
                []);
            setCourses(arr);
          }
          if (doctorsRes.success) {
            const raw = doctorsRes.data;
            const arr: Doctor[] = Array.isArray(raw)
              ? (raw as Doctor[])
              : ((raw as { doctors?: Doctor[] })?.doctors ??
                (raw as { data?: { doctors?: Doctor[] } })?.data?.doctors ??
                (raw as { data?: Doctor[] })?.data ??
                []);
            setDoctors(arr);
          }
        }
      )
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
