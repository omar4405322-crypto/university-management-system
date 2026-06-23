import { useState, useEffect } from 'react';
import departmentService from '../services/department.service';
import coursesService from '../services/courses.service';
import doctorsService from '../services/doctors.service';
import timetableService from '../services/timetable.service';
import schedulesService from '../services/schedules.service';
import teachingAssistantsService from '../services/teachingAssistants.service';
import type {
  TimetableFilters,
  SlotsMap,
  Department,
  Course,
  Doctor,
} from '../types/timetable.types';

export interface TeachingAssistant {
  id: number;
  userId: number;
  departmentId: number | null;
  specialization: string | null;
  user: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

interface UseTimetableDataReturn {
  slots: SlotsMap;
  setSlots: React.Dispatch<React.SetStateAction<SlotsMap>>;
  departments: Department[];
  courses: Course[];
  doctors: Doctor[];
  teachingAssistants: TeachingAssistant[];
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
  deptId: number | string | null | undefined,
  userRole: string | undefined
): UseTimetableDataReturn {
  const [slots, setSlots] = useState<SlotsMap>({});
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [teachingAssistants, setTeachingAssistants] = useState<TeachingAssistant[]>([]);
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
    if (!filters.departmentId || !filters.academicYear || !filters.semester) {
      setSlots({});
      setTimetableId(null);
      return;
    }

    const controller = new AbortController();
    setLoadingSlots(true);
    setError(null);

    Promise.all([
      timetableService.getTimetables({
        departmentId: filters.departmentId,
        academicYear: filters.academicYear,
        semester: filters.semester,
      }),
      schedulesService.getSchedules({
        departmentId: filters.departmentId,
        year: filters.academicYear,
        semester: filters.semester,
      }),
    ])
      .then(
        ([timetableRes, schedulesRes]: [any, any]) => {
          if (controller.signal.aborted) return;

          const mapped: SlotsMap = {};
          let tId: number | null = null;

          // 1. Populate from timetable draft
          const timetable = timetableRes.data?.timetables?.[0];
          if (timetable?.scheduleData?.slots) {
            tId = timetable.id;
            timetable.scheduleData.slots.forEach((slot: any) => {
              const key = `${slot.day}_${slot.startTime}-${slot.endTime}`;
              mapped[key] = {
                courseName: slot.courseName,
                doctorName: slot.instructor,
                room: slot.room,
                sessionType: (slot.sessionType as 'LECTURE' | 'LAB' | 'SEMINAR') ?? 'LECTURE',
                assistantName: slot.assistantName,
                timetableId: timetable.id,
              };
            });
          }

          // 2. Populate / overwrite from existing schedules in database
          const schedules = schedulesRes.success && Array.isArray(schedulesRes.data)
            ? schedulesRes.data
            : (schedulesRes.data?.schedules ?? schedulesRes.data ?? []);

          if (Array.isArray(schedules)) {
            schedules.forEach((schedule: any) => {
              if (schedule.dayOfWeek && schedule.startTime && schedule.endTime) {
                const key = `${schedule.dayOfWeek}_${schedule.startTime}-${schedule.endTime}`;
                mapped[key] = {
                  courseName: schedule.course?.name || '',
                  doctorName: schedule.course?.doctor 
                    ? `${schedule.course.doctor.firstName} ${schedule.course.doctor.lastName}`.trim()
                    : '',
                  room: schedule.room || '',
                  sessionType: schedule.sessionType || 'LECTURE',
                  assistantName: schedule.assistant?.user?.email?.split('@')[0] || schedule.assistant?.specialization || '',
                  timetableId: tId,
                };
              }
            });
          }

          setSlots(mapped);
          setTimetableId(tId);
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
      teachingAssistantsService.getTeachingAssistants()
    ])
      .then(
        ([coursesRes, doctorsRes, tasRes]: [
          { success: boolean; data?: unknown },
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
          if (tasRes.success) {
            const raw = tasRes.data;
            const arr: TeachingAssistant[] = Array.isArray(raw)
              ? (raw as TeachingAssistant[])
              : ((raw as { teachingAssistants?: TeachingAssistant[] })?.teachingAssistants ??
                (raw as { data?: { teachingAssistants?: TeachingAssistant[] } })?.data?.teachingAssistants ??
                (raw as { data?: TeachingAssistant[] })?.data ??
                []);
            setTeachingAssistants(arr);
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
    teachingAssistants,
    timetableId,
    loadingDepts,
    loadingSlots,
    loadingCourses,
    error,
  };
}
