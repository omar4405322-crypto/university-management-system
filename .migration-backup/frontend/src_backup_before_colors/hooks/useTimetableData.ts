import React, { useState, useEffect } from 'react';
import departmentService from '../services/department.service';
import coursesService from '../services/courses.service';
import doctorsService from '../services/doctors.service';
import timetableService from '../services/timetable.service';
import type {
  TimetableFilters,
  SlotsMap,
  Department,
  Course,
  Doctor,
} from '../types/timetable.types';

interface UseTimetableDataReturn {
  slots: SlotsMap;
  setSlots: React.Dispatch<React.SetStateAction<SlotsMap>>;
  departments: Department[];
  courses: Course[];
  doctors: Doctor[];
  timetableId: number | null;
  loadingDepts: boolean;
  loadingSlots: boolean;
  loadingCourses: boolean;
  error: string | null;
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
  _deptId: number | string | null | undefined,
  _userRole: string | undefined
): UseTimetableDataReturn {
  const [slots, setSlots] = useState<SlotsMap>({});
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [timetableId, setTimetableId] = useState<number | null>(null);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Departments (once, or when college scope changes) ──────────────────────
  useEffect(() => {
    const controller = new AbortController();
    setLoadingDepts(true);

    const params: Record<string, unknown> = {};
    if (collegeId) params.collegeId = collegeId;

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
  }, [collegeId]);

  // ── Timetable slots (whenever dept/year/sem filters change) ────────────────
  useEffect(() => {
    if (!filters.departmentId || !filters.academicYear || !filters.semester) return;

    const controller = new AbortController();
    setLoadingSlots(true);
    setError(null);

    timetableService
      .getTimetables({
        departmentId: filters.departmentId,
        academicYear: filters.academicYear,
        semester: filters.semester,
      })
      .then(
        (res: {
          data?: {
            timetables?: Array<{
              id: number;
              scheduleData: {
                slots: Array<{
                  day: string;
                  startTime: string;
                  endTime: string;
                  courseName: string;
                  instructor: string;
                  room: string;
                  sessionType?: string;
                }>;
              } | null;
            }>;
          } | null;
        }) => {
          if (controller.signal.aborted) return;
          const timetable = res.data?.timetables?.[0];
          if (timetable?.scheduleData?.slots) {
            const mapped: SlotsMap = {};
            timetable.scheduleData.slots.forEach((slot) => {
              const key = `${slot.day}_${slot.startTime}-${slot.endTime}`;
              mapped[key] = {
                courseName: slot.courseName,
                doctorName: slot.instructor,
                room: slot.room,
                sessionType: (slot.sessionType as 'LECTURE' | 'LAB' | 'SEMINAR') ?? 'LECTURE',
                timetableId: timetable.id,
              };
            });
            setSlots(mapped);
            setTimetableId(timetable.id);
          } else {
            setSlots({});
            setTimetableId(null);
          }
        }
      )
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(String(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingSlots(false);
      });

    return () => controller.abort();
  }, [filters.departmentId, filters.academicYear, filters.semester]);

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
    departments,
    courses,
    doctors,
    timetableId,
    loadingDepts,
    loadingSlots,
    loadingCourses,
    error,
  };
}
