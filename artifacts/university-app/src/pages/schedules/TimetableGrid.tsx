import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Loader2, ChevronRight, ChevronLeft, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useScope from '../../hooks/useScope';
import { useTimetableData } from '../../hooks/useTimetableData';
import TimetableFiltersBar from '../../components/timetable/TimetableFiltersBar';
import TimeSlotCell from '../../components/timetable/TimeSlotCell';
import { PlacementWizardModal, type WizardSlotForm } from '../../components/timetable/builder';
import ScheduleHeader from '../../components/timetable/ScheduleHeader';
import { OverrideModal } from '../../components/timetable/OverrideModal';
import { SkeletonTable } from '../../components/ui/skeleton';
import { TimeRange } from '../../components/ui/TimeRange';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import timetableService from '../../services/timetable.service';
import schedulesService from '../../services/schedules.service';
import teachingAssistantsService from '../../services/teachingAssistants.service';
import roomsService, { Room } from '../../services/rooms.service';
import { notifyScheduleChange, subscribeToScheduleChanges } from '../../utils/scheduleSync';
import type { TimetableFilters, SlotsMap, Day } from '../../types/timetable.types';
import type { SlotEntry } from '../../types/timetable.types';
import { generateTimeSlots } from '../../utils/scheduleConfig';

export interface SlotFormValues {
  courseName: string;
  courseId?: number;
  doctorName: string;
  doctorId?: number;
  teachingAssistantId?: string;
  room: string;
  roomId?: number | null;
  slotType: 'LECTURE' | 'LAB';
  groupName?: string;
  dayOfWeek?: string;
  startTime?: string;
  endTime?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const DAYS: Day[] = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

const EMPTY_FORM: SlotFormValues = {
  courseName: '',
  doctorName: '',
  room: '',
  slotType: 'LECTURE',
};

interface TimetableGridProps {
  showHeader?: boolean;
}

export default function TimetableGrid({ showHeader = true }: TimetableGridProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { scopeParams, isCollegeAdmin } = useScope();
  const isRTL = i18n.language?.startsWith('ar');
  const [searchParams, setSearchParams] = useSearchParams();
  const [timeSlots, setTimeSlots] = useState<string[]>(generateTimeSlots);
  const [slotToDelete, setSlotToDelete] = useState<{ day: string; slot: string; slotData?: SlotEntry } | null>(null);

  React.useEffect(() => {
    const handleConfigChange = () => {
      setTimeSlots(generateTimeSlots());
    };
    window.addEventListener('scheduleConfigChanged', handleConfigChange);
    return () => window.removeEventListener('scheduleConfigChanged', handleConfigChange);
  }, []);

  const getQueryParam = (keys: string[], fallback = '') => {
    for (const key of keys) {
      const val = searchParams.get(key);
      if (val) return val;
    }
    return fallback;
  };

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<TimetableFilters>({
    collegeId: getQueryParam(['collegeId', 'college']),
    departmentId: getQueryParam(['departmentId', 'dept']),
    academicYear: getQueryParam(['academicYear', 'year'], '1'),
    semester: getQueryParam(['semester', 'sem'], '1'),
  });

  React.useEffect(() => {
    const col = searchParams.get('collegeId') || searchParams.get('college');
    const dept = searchParams.get('departmentId') || searchParams.get('dept');
    const yr = searchParams.get('academicYear') || searchParams.get('year');
    const sem = searchParams.get('semester') || searchParams.get('sem');

    setFilters((prev) => ({
      collegeId: col !== null && col !== undefined ? col : prev.collegeId,
      departmentId: dept !== null && dept !== undefined ? dept : prev.departmentId,
      academicYear: yr ?? prev.academicYear ?? '1',
      semester: sem ?? prev.semester ?? '1',
    }));
  }, [searchParams]);

  const handleFilterChange = useCallback(
    (nextFilters: TimetableFilters) => {
      setFilters(nextFilters);
      const newParams: Record<string, string> = {};
      if (nextFilters.collegeId) newParams.collegeId = nextFilters.collegeId;
      if (nextFilters.departmentId) newParams.departmentId = nextFilters.departmentId;
      if (nextFilters.academicYear) newParams.academicYear = nextFilters.academicYear;
      if (nextFilters.semester) newParams.semester = nextFilters.semester;
      setSearchParams(newParams, { replace: true });
    },
    [setSearchParams]
  );

  // ── Dialog state ─────────────────────────────────────────────────────────────
  const [dialog, setDialog] = useState<{ day: Day; slot: string } | null>(null);
  const [form, setForm] = useState<SlotFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideEntry, setOverrideEntry] = useState<SlotEntry | null>(null);
  const [selectedDay, setSelectedDay] = useState<Day>(DAYS[0]);
  const [auditingConflicts, setAuditingConflicts] = useState(false);
  const [auditReport, setAuditReport] = useState<
    Array<{ key: string; day: string; slot: string; course: string; messageAr: string; messageEn: string }> | null
  >(null);

  const handleEditOverride = useCallback((entry: SlotEntry) => {
    setOverrideEntry(entry);
    setOverrideModalOpen(true);
  }, []);

  // ── Scope helpers & Permissions ─────────────────────────────────────────────
  const canManage = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user?.role || '');
  const collegeId = user?.managedCollegeId ?? user?.collegeId ?? (scopeParams?.collegeId as string | number | undefined);
  const deptId = user?.managedDepartmentId ?? user?.departmentId ?? (scopeParams?.departmentId as string | number | undefined);
  const isDeptAdminLocked = user?.role === 'DEPARTMENT_ADMIN';

  // ── Remote data ──────────────────────────────────────────────────────────────
  const {
    slots,
    setSlots,
    colleges,
    loadingColleges,
    departments,
    courses,
    doctors,
    timetableId,
    loadingDepts,
    loadingSlots,
    loadingCourses,
    refetch,
  } = useTimetableData(filters, collegeId, deptId, user?.role);

  // ── Admin Grid Filters (T3) ──────────────────────────────────────────────────
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedTAId, setSelectedTAId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');

  const [teachingAssistants, setTeachingAssistants] = useState<any[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  React.useEffect(() => {
    teachingAssistantsService
      .getTeachingAssistants({ limit: 100, ...scopeParams })
      .then((res: any) => {
        const arr = res?.data?.teachingAssistants || (Array.isArray(res?.data) ? res.data : []);
        setTeachingAssistants(arr);
      })
      .catch(() => {});

    roomsService
      .getRooms({ limit: 100 })
      .then((res: any) => {
        const arr = res?.data?.rooms || (Array.isArray(res?.data) ? res.data : []);
        setRooms(arr);
      })
      .catch(() => {});
  }, [scopeParams]);

  // Filtered slots according to doctor, TA, room (OD-50: Term filter removed from TimetableGrid)
  const filteredGridSlots = useMemo(() => {
    if (!selectedDoctorId && !selectedTAId && !selectedRoomId) {
      return slots;
    }
    const filtered: SlotsMap = {};
    for (const [key, slot] of Object.entries(slots)) {
      if (selectedDoctorId && String(slot.doctorId) !== String(selectedDoctorId)) continue;
      if (selectedTAId && String(slot.teachingAssistantId) !== String(selectedTAId)) continue;
      if (selectedRoomId) {
        const roomObj = rooms.find((r) => String(r.id) === String(selectedRoomId));
        if (roomObj && slot.room !== roomObj.name && String((slot as any).roomId) !== String(selectedRoomId)) {
          continue;
        }
      }
      filtered[key] = slot;
    }
    return filtered;
  }, [slots, selectedDoctorId, selectedTAId, selectedRoomId, rooms]);

  // Real-time synchronization subscription from Tables Management page
  React.useEffect(() => {
    const unsubscribe = subscribeToScheduleChanges(() => {
      refetch();
    });
    return unsubscribe;
  }, [refetch]);

  // ── Toast helper ─────────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Stable slot handlers ───────────────────────
  const handleOpenAdd = useCallback((day: Day, slot: string) => {
    setForm(EMPTY_FORM);
    setDialog({ day, slot });
  }, []);

  const handleOpenEdit = useCallback(
    (day: string, slot: string) => {
      const key = `${day}_${slot}`;
      const existing = slots[key];
      if (existing) {
        setForm({
          courseName: existing.courseName,
          courseId: existing.courseId,
          doctorName: existing.doctorName,
          doctorId: existing.doctorId,
          teachingAssistantId: existing.teachingAssistantId,
          room: existing.room,
          slotType: existing.slotType,
        });
        setDialog({ day: day as Day, slot });
      }
    },
    [slots]
  );

  const handleDeleteSlot = useCallback(
    (day: string, slot: string) => {
      const existing = slots[`${day}_${slot}`];
      setSlotToDelete({ day, slot, slotData: existing });
    },
    [slots]
  );

  const confirmDeleteSlot = useCallback(() => {
    if (!slotToDelete) return;
    const { day, slot, slotData } = slotToDelete;
    setSlots((prev) => {
      const next: SlotsMap = { ...prev };
      delete next[`${day}_${slot}`];
      return next;
    });
    setHasUnsavedChanges(true);
    setSlotToDelete(null);
    showToast(
      isRTL
        ? `تم حذف الحصة (${slotData?.courseName || ''}) من جدول الشعبة بنجاح (مسودة غير محفوظة)`
        : `Class session (${slotData?.courseName || ''}) removed from section schedule (unsaved draft)`,
      'success'
    );
  }, [slotToDelete, isRTL, showToast, setSlots]);

  // ── Save slot to local map ───────────────────────────────────────────────────
  const handleSaveSlot = useCallback(
    (draft?: WizardSlotForm) => {
      const targetCourseName = draft?.courseName || form.courseName;
      if (!targetCourseName || !dialog) return false;
      const key = `${dialog.day}_${dialog.slot}`;

      // 1. Check if course is already scheduled on the same day
      const sameCourseConflict = Object.entries(slots).find(
        ([k, v]) => k !== key && k.startsWith(`${dialog.day}_`) && v.courseName === targetCourseName
      );
      if (sameCourseConflict) {
        showToast(
          isRTL
            ? `المادة "${targetCourseName}" مجدولة بالفعل في هذا اليوم`
            : `Course "${targetCourseName}" is already scheduled on this day`,
          'error'
        );
        return false;
      }

      // 2. Check if doctor is already scheduled on the same time slot in local timetable
      const targetDoctorName = draft ? draft.doctorName : form.doctorName;
      if (targetDoctorName) {
        const sameDoctorConflict = Object.entries(slots).find(
          ([k, v]) => k !== key && k.endsWith(`_${dialog.slot}`) && v.doctorName === targetDoctorName
        );
        if (sameDoctorConflict) {
          showToast(
            isRTL
              ? `المحاضر "${targetDoctorName}" محجوز بالفعل في هذا الوقت`
              : `Instructor "${targetDoctorName}" is already booked for this slot`,
            'error'
          );
          return false;
        }
      }

      // 3. Check if room is occupied in local timetable at the same time slot
      const targetRoom = draft ? (draft.roomName || draft.legacyRoomName || '') : form.room;
      if (targetRoom) {
        const sameRoomConflict = Object.entries(slots).find(
          ([k, v]) => k !== key && k.endsWith(`_${dialog.slot}`) && v.room && v.room.toLowerCase() === targetRoom.toLowerCase()
        );
        if (sameRoomConflict) {
          showToast(
            isRTL
              ? `القاعة "${targetRoom}" محجوزة بالفعل في هذه الفترة`
              : `Room "${targetRoom}" is already reserved for this slot`,
            'error'
          );
          return false;
        }
      }

      const newSlot: SlotEntry = draft
        ? {
            courseName: draft.courseName,
            courseId: draft.courseId ? Number(draft.courseId) : undefined,
            doctorName: draft.doctorName,
            doctorId: draft.doctorId ? Number(draft.doctorId) : undefined,
            teachingAssistantId: draft.teachingAssistantId || undefined,
            room: draft.roomName || draft.legacyRoomName || '',
            roomId: draft.roomId || undefined,
            slotType: draft.slotType,
            timetableId: timetableId ?? null,
          }
        : { ...form, timetableId: timetableId ?? null };

      setSlots((prev) => ({
        ...prev,
        [key]: newSlot,
      }));
      setHasUnsavedChanges(true);
      setDialog(null);
      showToast(
        isRTL
          ? 'تمت إضافة الحصة للمسودة 📝 — انقر على "حفظ ومزامنة الجدول" لتثبيتها'
          : 'Slot added to draft 📝 — click "Save & Sync Timetable" to persist to database',
        'success'
      );
      return true;
    },
    [form, dialog, slots, timetableId, showToast, setSlots, isRTL]
  );

  // ── Audit Conflicts across the entire grid ───────────────────────────────────
  const handleAuditConflicts = useCallback(async () => {
    const entries = Object.entries(slots);
    if (entries.length === 0) {
      showToast(t('timetables.emptyGridAudit', 'timetables.emptyGridAudit'), 'error');
      return;
    }

    setAuditingConflicts(true);
    const foundConflicts: Array<{ key: string; day: string; slot: string; course: string; messageAr: string; messageEn: string }> = [];

    try {
      for (const [key, val] of entries) {
        const [day, time] = key.split('_');
        const [startTime, endTime] = (time || '').split('-');
        if (!day || !startTime || !endTime || !val.courseName) continue;

        const res = await schedulesService.checkConflict({
          dayOfWeek: day,
          startTime,
          endTime,
          room: val.room,
          doctorName: val.doctorName,
          courseName: val.courseName,
          slotType: val.slotType,
          departmentId: filters.departmentId,
          academicYear: filters.academicYear,
          semester: filters.semester,
        });

        const resData = res.data as { conflicts?: Array<{ messageAr?: string; messageEn?: string }> } | null;
        const list = resData?.conflicts || [];
        if (list.length > 0) {
          list.forEach((c: any) => {
            foundConflicts.push({
              key,
              day,
              slot: time,
              course: val.courseName,
              messageAr: c.messageAr,
              messageEn: c.messageEn,
            });
          });
        }
      }

      if (foundConflicts.length === 0) {
        showToast(
          t('timetables.noConflictsFound', 'timetables.noConflictsFound'),
          'success'
        );
        setAuditReport(null);
      } else {
        setAuditReport(foundConflicts);
      }
    } catch (err) {
      console.error('Audit error:', err);
      showToast(t('common.errorOccurred', 'An error occurred'), 'error');
    } finally {
      setAuditingConflicts(false);
    }
  }, [slots, filters, showToast, t]);

  // ── Persist timetable to backend & Sync to Tables Management ──────────────
  const handleSaveTimetable = useCallback(async () => {
    if (!filters.departmentId || !filters.academicYear || !filters.semester) {
      showToast(
        t('timetables.selectRequired', 'Please select department, year, and semester'),
        'error'
      );
      return;
    }

    setSaving(true);
    try {
      const slotsArray = Object.entries(slots).map(([key, val]) => {
        const [day, time] = key.split('_');
        const [startTime, endTime] = time.split('-');
        return {
          day,
          startTime,
          endTime,
          courseName: val.courseName,
          courseId: val.courseId,
          instructor: val.doctorName,
          doctorId: val.doctorId,
          teachingAssistantId: val.teachingAssistantId,
          room: val.room,
          slotType: val.slotType,
        };
      });
      const dept = departments.find((d) => String(d.id) === filters.departmentId);
      const effectiveCollegeId = dept?.collegeId ?? collegeId;
      const payload = {
        collegeId: Number(effectiveCollegeId),
        departmentId: Number(filters.departmentId),
        academicYear: Number(filters.academicYear),
        semester: Number(filters.semester),
        title: `${t('timetables.title', 'Timetable')} - ${t('common.year', 'Year')} ${filters.academicYear} - ${t('timetables.semester', 'Semester')} ${filters.semester}`,
        scheduleData: { slots: slotsArray },
      };

      if (timetableId) {
        await timetableService.updateTimetable(String(timetableId), payload);
      } else {
        await timetableService.createTimetable(payload);
      }

      const syncRes = (await schedulesService.syncGrid({
        collegeId: Number(effectiveCollegeId),
        departmentId: Number(filters.departmentId),
        academicYear: Number(filters.academicYear),
        semester: Number(filters.semester),
        slots: slotsArray,
      })) as any;
      notifyScheduleChange();
      setHasUnsavedChanges(false);

      const skippedCount = syncRes?.data?.skippedCount ?? 0;
      if (skippedCount > 0) {
        const skippedDetails = syncRes?.data?.skippedSlots
          ?.map((s: any) => `${s.courseName}: ${s.reason}`)
          .slice(0, 3)
          .join('; ');
        showToast(
          isRTL
            ? `تحذير: تم استبعاد ${skippedCount} حصة غير مطابقة للنطاق: ${skippedDetails || 'بيانات غير مكتملة'} ⚠️`
            : `Warning: ${skippedCount} slot(s) skipped/dropped: ${skippedDetails || 'incomplete data'} ⚠️`,
          'error'
        );
      } else {
        showToast(isRTL ? 'تم حفظ ومزامنة الجدول بنجاح ✅' : 'Timetable saved & synced successfully ✅', 'success');
      }
    } catch (err) {
      console.error('Save error', err);
      showToast(t('common.errorOccurred', 'Error saving timetable'), 'error');
    } finally {
      setSaving(false);
    }
  }, [filters, slots, departments, collegeId, timetableId, showToast, t, isRTL]);

  const safeDepts = Array.isArray(departments) ? departments : [];
  const safeColleges = Array.isArray(colleges) ? colleges : [];
  const selectedDeptObj = safeDepts.find((d) => String(d.id) === String(filters.departmentId));
  const selectedCollegeObj = safeColleges.find((c) => String(c.id) === String(filters.collegeId || selectedDeptObj?.collegeId));

  const pageTitle = selectedDeptObj
    ? (isRTL ? `جدول ${selectedDeptObj.nameAr || selectedDeptObj.name}` : `${selectedDeptObj.name} Timetable`)
    : t('timetables.title', 'Department Timetable');

  const pageSubtitle = selectedCollegeObj
    ? `${isRTL ? selectedCollegeObj.nameAr || selectedCollegeObj.name : selectedCollegeObj.name} • ${t('timetables.subtitle', 'Manage weekly department class schedules')}`
    : t('timetables.subtitle', 'Manage weekly department class schedules');

  return (
    <div className="section-gap animate-in fade-in duration-500">
      {/* Page Header when rendered standalone */}
      {showHeader && (
        <ScheduleHeader
          title={pageTitle}
          subtitle={pageSubtitle}
          canManage={canManage}
          onManage={() => navigate('/schedules-management')}
          onRefresh={refetch}
          isRefreshing={loadingSlots}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={toast.type === 'error' ? 'toast-error' : 'toast-success'}>
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Unsaved changes banner */}
      {hasUnsavedChanges && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 rounded-2xl shadow-sm text-amber-700 dark:text-amber-300 text-xs font-semibold animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              {isRTL
                ? 'لديك تعديلات غير محفوظة على الجدول! انقر على "حفظ ومزامنة الجدول" لتثبيت التغييرات في النظام.'
                : 'You have unsaved changes on the grid! Click "Save & Sync Timetable" to persist them to the database.'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSaveTimetable}
            disabled={saving}
            className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-all shadow-sm flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin shrink-0" />}
            <span>{saving ? (isRTL ? 'جارٍ الحفظ...' : 'Saving...') : (isRTL ? 'حفظ ومزامنة الآن' : 'Save & Sync Now')}</span>
          </button>
        </div>
      )}

      {/* Filter bar */}
      <TimetableFiltersBar
        filters={filters}
        colleges={colleges}
        loadingColleges={loadingColleges}
        isCollegeAdmin={isCollegeAdmin}
        departments={departments}
        loadingDepts={loadingDepts}
        isDeptAdminLocked={isDeptAdminLocked}
        saving={saving}
        loadingSlots={loadingSlots}
        auditingConflicts={auditingConflicts}
        canManage={canManage}
        onChange={handleFilterChange}
        onSave={handleSaveTimetable}
        onAuditConflicts={handleAuditConflicts}
      />

      {/* Admin Filters Bar (T3) */}
      {canManage && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 bg-brand-bg-card border border-brand-border rounded-xl mb-3 text-xs">
          <span className="font-bold text-brand-text-muted">{t('common.filters', 'Admin Filters')}:</span>

          {/* Doctor filter */}
          <select
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            className="h-8 px-2.5 bg-brand-bg-subtle border border-brand-border rounded-lg text-brand-text-primary text-xs cursor-pointer"
            aria-label={isRTL ? 'Filter by Doctor (تصفية حسب الدكتور)' : 'Filter by Doctor'}
          >
            <option value="">{isRTL ? 'كل أعضاء هيئة التدريس' : 'All Doctors'}</option>
            {doctors.map((doc: any) => (
              <option key={doc.id} value={doc.id}>
                {doc.firstName} {doc.lastName}
              </option>
            ))}
          </select>

          {/* TA filter */}
          <select
            value={selectedTAId}
            onChange={(e) => setSelectedTAId(e.target.value)}
            className="h-8 px-2.5 bg-brand-bg-subtle border border-brand-border rounded-lg text-brand-text-primary text-xs cursor-pointer"
            aria-label={isRTL ? 'Filter by Teaching Assistant (تصفية حسب المعيد)' : 'Filter by Teaching Assistant'}
          >
            <option value="">{isRTL ? 'كل المعيدين' : 'All Teaching Assistants'}</option>
            {teachingAssistants.map((ta: any) => (
              <option key={ta.id} value={ta.id}>
                {ta.firstName} {ta.lastName}
              </option>
            ))}
          </select>

          {/* Room filter */}
          <select
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
            className="h-8 px-2.5 bg-brand-bg-subtle border border-brand-border rounded-lg text-brand-text-primary text-xs cursor-pointer"
            aria-label={isRTL ? 'Filter by Room (تصفية حسب القاعة)' : 'Filter by Room'}
          >
            <option value="">{isRTL ? 'كل القاعات' : 'All Rooms'}</option>
            {rooms.map((r: any) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          {(selectedDoctorId || selectedTAId || selectedRoomId) && (
            <button
              type="button"
              onClick={() => {
                setSelectedDoctorId('');
                setSelectedTAId('');
                setSelectedRoomId('');
              }}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 cursor-pointer"
            >
              {t('common.clear', 'Clear')}
            </button>
          )}
        </div>
      )}

      {/* Master Timetable Grid */}
      <div className="bg-brand-bg-card border border-brand-border rounded-2xl shadow-soft overflow-hidden relative">
        {loadingSlots && (
          <div className="absolute inset-0 bg-brand-bg-card/70 backdrop-blur-sm z-10 flex items-center justify-center">
            <Loader2 size={40} className="animate-spin text-brand-primary-500" />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse border-0">
            <caption className="sr-only">
              {t('tables.caption.timetableGrid', 'Weekly academic timetable schedule grid')}
            </caption>
            <thead>
              <tr className="bg-surface-subtle border-b border-brand-border">
                <th
                  scope="col"
                  className={`w-32 p-4 font-black uppercase text-xs tracking-widest text-brand-text-muted border-e border-brand-border text-start`}
                >
                  {t('timetables.startTime', 'Time')}
                </th>
                {DAYS.map((day) => (
                  <th
                    key={day}
                    scope="col"
                    className="p-4 text-center font-black uppercase text-xs tracking-widest text-brand-text-muted border-e border-brand-border last:border-e-0"
                  >
                    {t(`days.${day.toLowerCase()}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {timeSlots.map((slot) => (
                <tr key={slot} className="hover:bg-brand-bg-card/50 transition-colors">
                  <th scope="row" className="p-3 font-bold text-xs text-brand-text-muted border-e border-brand-border align-middle bg-surface-subtle/30 text-center">
                    {(() => {
                      const [start, end] = slot.split('-');
                      return start && end ? <TimeRange start={start} end={end} /> : slot;
                    })()}
                  </th>
                  {DAYS.map((day) => {
                    const key = `${day}_${slot}`;
                    const entry = filteredGridSlots[key];
                    return (
                      <td key={key} className="p-2 border-e border-brand-border last:border-e-0 align-top">
                        <TimeSlotCell
                          day={day}
                          slot={slot}
                          entry={entry}
                          canEdit={canManage}
                          onAdd={() => handleOpenAdd(day as Day, slot)}
                          onEdit={handleOpenEdit}
                          onDelete={handleDeleteSlot}
                          onEditOverride={handleEditOverride}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile view */}
      <div className="md:hidden space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {DAYS.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${selectedDay === day
                  ? 'bg-brand-primary-500 text-white shadow-md'
                  : 'bg-brand-bg-card border border-brand-border text-brand-text-muted'
                }`}
            >
              {t(`days.${day.toLowerCase()}`)}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {loadingSlots && (
            <div className="p-8 flex justify-center">
              <Loader2 size={32} className="animate-spin text-brand-primary-500" />
            </div>
          )}
          {timeSlots.map((slot) => {
            const key = `${selectedDay}_${slot}`;
            const entry = filteredGridSlots[key];
            return (
              <div key={slot} className="bg-brand-bg-card border border-brand-border rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-center border-b border-brand-border/50 pb-2">
                  <span className="text-xs font-black text-brand-text-muted">{slot}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-primary-600">
                    {t(`days.${selectedDay.toLowerCase()}`)}
                  </span>
                </div>
                <TimeSlotCell
                  day={selectedDay}
                  slot={slot}
                  entry={entry}
                  canEdit={canManage}
                  onAdd={() => handleOpenAdd(selectedDay as Day, slot)}
                  onEdit={handleOpenEdit}
                  onDelete={handleDeleteSlot}
                  onEditOverride={handleEditOverride}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Placement Wizard Modal */}
      {dialog && (
        <PlacementWizardModal
          isOpen={Boolean(dialog)}
          initialSlot={{
            courseName: form.courseName,
            courseId: form.courseId,
            doctorName: form.doctorName,
            doctorId: form.doctorId,
            teachingAssistantId: form.teachingAssistantId,
            room: form.room,
            roomId: form.roomId,
            slotType: form.slotType,
            day: dialog.day,
            dayOfWeek: dialog.day,
            startTime: form.startTime || dialog.slot?.split('-')[0] || '09:00',
            endTime: form.endTime || dialog.slot?.split('-')[1] || '11:00',
            departmentId: filters.departmentId,
            collegeId: filters.collegeId,
            academicYear: filters.academicYear,
            semester: filters.semester,
            timetableId: timetableId ?? undefined,
          }}
          defaultDepartmentId={filters.departmentId}
          defaultCollegeId={filters.collegeId}
          defaultYear={filters.academicYear}
          defaultSemester={filters.semester}
          defaultDay={dialog.day}
          defaultSlotTime={dialog.slot}
          slotTypeSelectId="slot-type"
          onSaveDraft={(draft) => handleSaveSlot(draft)}
          onClose={() => setDialog(null)}
          onSuccess={() => {
            setDialog(null);
            refetch();
            notifyScheduleChange();
            showToast(
              isRTL ? 'تم حفظ الحصة بنجاح' : 'Schedule slot placed successfully',
              'success'
            );
          }}
        />
      )}

      {overrideEntry && (
        <OverrideModal
          isOpen={overrideModalOpen}
          onClose={() => {
            setOverrideModalOpen(false);
            setOverrideEntry(null);
          }}
          entry={overrideEntry}
          onSuccess={() => {
            notifyScheduleChange();
            refetch();
          }}
        />
      )}

      {/* Audit Report Modal */}
      {auditReport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
                <AlertCircle size={20} />
                <h3 className="text-base">{isRTL ? 'تقرير فحص التعارضات في الجدول' : 'Timetable Conflict Audit Report'}</h3>
              </div>
              <button
                onClick={() => setAuditReport(null)}
                aria-label={t('common.close', 'Close')}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-brand-text-muted">
              {isRTL ? (
                <>تم اكتشاف <strong className="text-rose-600 dark:text-rose-400 font-black">{auditReport.length}</strong> تعارض دراسي يحتاج إلى مراجعة قبل الاعتماد:</>
              ) : (
                <>Detected <strong className="text-rose-600 dark:text-rose-400 font-black">{auditReport.length}</strong> scheduling conflict(s) requiring review:</>
              )}
            </p>

            <div className="max-h-64 overflow-y-auto space-y-2.5 pe-1">
              {auditReport.map((item, idx) => (
                <div key={idx} className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl space-y-1 text-xs">
                  <div className="flex justify-between items-center text-rose-800 dark:text-rose-300 font-bold">
                    <span>{t(`days.${item.day.toLowerCase()}`, item.day)} • {item.slot}</span>
                    <span className="bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200 px-2 py-0.5 rounded text-[10px]">{item.course}</span>
                  </div>
                  <p className="text-rose-700 dark:text-rose-300 leading-relaxed font-medium">
                    {isRTL ? item.messageAr : item.messageEn}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-brand-border">
              <button
                onClick={() => setAuditReport(null)}
                className="px-5 py-2 bg-brand-primary-500 hover:bg-brand-primary-600 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
              >
                {t('common.close', isRTL ? 'إغلاق' : 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slot Deletion Confirmation Modal to Prevent Accidental Loss */}
      <ConfirmDeleteModal
        isOpen={Boolean(slotToDelete)}
        itemName={slotToDelete?.slotData?.courseName ? `${slotToDelete.slotData.courseName} (${slotToDelete.day} ${slotToDelete.slot})` : ''}
        onClose={() => setSlotToDelete(null)}
        onConfirm={confirmDeleteSlot}
        title={isRTL ? 'تأكيد حذف الحصة من جدول الشعبة' : 'Confirm Remove Class Session'}
        confirmLabel={isRTL ? 'حذف الحصة' : 'Remove Session'}
        message={
          isRTL
            ? `هل أنت متأكد من حذف الحصة الدراسية لمقرر "${slotToDelete?.slotData?.courseName || ''}" (${slotToDelete?.slotData?.doctorName ? 'المحاضر: ' + slotToDelete.slotData.doctorName + ' - ' : ''}القاعة: ${slotToDelete?.slotData?.room || 'غير محددة'}) يوم ${slotToDelete?.day || ''} الفترة ${slotToDelete?.slot || ''} من جدول هذه الشعبة؟ لن يتمكن الطلاب من رؤيتها بعد الحفظ.`
            : `Are you sure you want to remove the class session for "${slotToDelete?.slotData?.courseName || ''}" (${slotToDelete?.slotData?.doctorName ? 'Instructor: ' + slotToDelete.slotData.doctorName + ' - ' : ''}Room: ${slotToDelete?.slotData?.room || 'Unassigned'}) on ${slotToDelete?.day || ''} slot ${slotToDelete?.slot || ''} from this section timetable?`
        }
      />
    </div>
  );
}
