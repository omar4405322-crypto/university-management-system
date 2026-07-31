import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useScope from '../../hooks/useScope';
import { useTimetableData } from '../../hooks/useTimetableData';
import TimetableFiltersBar from '../../components/timetable/TimetableFiltersBar';
import TimeSlotCell from '../../components/timetable/TimeSlotCell';
import SlotModal from '../../components/timetable/SlotModal';
import { OverrideModal } from '../../components/timetable/OverrideModal';
import { SkeletonTable } from '../../components/ui/skeleton';
import { TimeRange } from '../../components/ui/TimeRange';
import timetableService from '../../services/timetable.service';
import schedulesService from '../../services/schedules.service';
import { notifyScheduleChange, subscribeToScheduleChanges } from '../../utils/scheduleSync';
import type { TimetableFilters, SlotsMap, Day } from '../../types/timetable.types';
import type { SlotEntry } from '../../types/timetable.types';
import { generateTimeSlots } from '../../utils/scheduleConfig';
import type { SlotFormValues } from '../../components/timetable/SlotModal';

// ── Constants ──────────────────────────────────────────────────────────────────
const DAYS: Day[] = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

const EMPTY_FORM: SlotFormValues = {
  courseName: '',
  doctorName: '',
  room: '',
  slotType: 'LECTURE',
};

export default function TimetableGrid() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { scopeParams, isCollegeAdmin } = useScope();
  const isRTL = i18n.language?.startsWith('ar');
  const [searchParams, setSearchParams] = useSearchParams();
  const [timeSlots, setTimeSlots] = useState<string[]>(generateTimeSlots);

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

  // ── Scope helpers ────────────────────────────────────────────────────────────
  const collegeId = user?.managedCollegeId ?? user?.collegeId ?? scopeParams?.collegeId;
  const deptId = user?.managedDepartmentId ?? user?.departmentId ?? scopeParams?.departmentId;
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
          doctorName: existing.doctorName,
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
      if (!window.confirm(t('timetables.deleteConfirm', 'Delete this class slot?'))) return;

      setSlots((prev) => {
        const next: SlotsMap = { ...prev };
        delete next[`${day}_${slot}`];
        return next;
      });
    },
    [t, setSlots]
  );

  // ── Save slot to local map ───────────────────────────────────────────────────
  const handleSaveSlot = useCallback(() => {
    if (!form.courseName || !dialog) return;
    const key = `${dialog.day}_${dialog.slot}`;

    // 1. Check if course is already scheduled on the same day
    const sameCourseConflict = Object.entries(slots).find(
      ([k, v]) => k !== key && k.startsWith(`${dialog.day}_`) && v.courseName === form.courseName
    );
    if (sameCourseConflict) {
      showToast(
        t('timetables.duplicateError', `المادة "${form.courseName}" مجدولة بالفعل في هذا اليوم`),
        'error'
      );
      return;
    }

    // 2. Check if doctor is already scheduled on the same time slot in local timetable
    if (form.doctorName) {
      const sameDoctorConflict = Object.entries(slots).find(
        ([k, v]) => k !== key && k.endsWith(`_${dialog.slot}`) && v.doctorName === form.doctorName
      );
      if (sameDoctorConflict) {
        showToast(
          t('timetables.doctorLocalConflict', `المحاضر "${form.doctorName}" محجوز بالفعل في هذا الوقت`),
          'error'
        );
        return;
      }
    }

    // 3. Check if room is occupied in local timetable at the same time slot
    if (form.room) {
      const sameRoomConflict = Object.entries(slots).find(
        ([k, v]) => k !== key && k.endsWith(`_${dialog.slot}`) && v.room.toLowerCase() === form.room.toLowerCase()
      );
      if (sameRoomConflict) {
        showToast(
          t('timetables.roomLocalConflict', `القاعة "${form.room}" محجوزة بالفعل في هذه الفترة`),
          'error'
        );
        return;
      }
    }

    setSlots((prev) => ({
      ...prev,
      [key]: { ...form, timetableId: timetableId ?? null },
    }));

    setDialog(null);
  }, [form, dialog, slots, timetableId, showToast, t, setSlots]);

  // ── Audit Conflicts across the entire grid ───────────────────────────────────
  const handleAuditConflicts = useCallback(async () => {
    const entries = Object.entries(slots);
    if (entries.length === 0) {
      showToast(t('timetables.emptyGridAudit', 'لا توجد حصص مضافة في الجدول لفحصها'), 'error');
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

        const list = (res as any).data?.conflicts || (res as any).conflicts || [];
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
          t('timetables.noConflictsFound', 'رائع! تم فحص كامل الجدول ولا يوجد أي تعارض بالقاعات أو المحاضرين ✅'),
          'success'
        );
        setAuditReport(null);
      } else {
        setAuditReport(foundConflicts);
      }
    } catch (err) {
      console.error('Audit error:', err);
      showToast(t('common.errorOccurred', 'حدث خطأ أثناء فحص التعارضات'), 'error');
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

    // Ask user if they want to sync directly to Master Schedule (Tables Management)
    const shouldSyncToMaster = window.confirm(
      t(
        'timetables.syncConfirmPrompt',
        'تطبيق وتزامن التغييرات مع إدارة الجداول (الجدول الرئيسي)؟\n\n• موافق (OK): تطبيق وتزامن متبادل مع صفحة إدارة الجداول.\n• إلغاء (Cancel): الحفظ في شبكة الجداول فقط.'
      )
    );

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
          instructor: val.doctorName,
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

      if (shouldSyncToMaster) {
        await schedulesService.syncGrid({
          collegeId: Number(effectiveCollegeId),
          departmentId: Number(filters.departmentId),
          academicYear: Number(filters.academicYear),
          semester: Number(filters.semester),
          slots: slotsArray,
        });
        notifyScheduleChange();
        showToast(
          t('timetables.syncSuccess', 'تم حفظ الجدول وتزامنه بنجاح مع إدارة الجداول ✅'),
          'success'
        );
      } else {
        showToast(t('timetables.saveSuccess', 'Timetable saved successfully ✅'), 'success');
      }
    } catch (err) {
      console.error('Save error', err);
      showToast(t('common.errorOccurred', 'Error saving timetable'), 'error');
    } finally {
      setSaving(false);
    }
  }, [filters, slots, departments, collegeId, timetableId, showToast, t]);

  return (
    <div className="section-gap animate-in fade-in duration-500">
      {/* Toast */}
      {toast && (
        <div className={toast.type === 'error' ? 'toast-error' : 'toast-success'}>
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
            <span className="font-medium">{toast.message}</span>
          </div>
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
        onChange={handleFilterChange}
        onSave={handleSaveTimetable}
        onAuditConflicts={handleAuditConflicts}
      />

      {/* Desktop view */}
      <div className="hidden md:block bg-brand-bg-card border border-brand-border rounded-2xl shadow-soft overflow-hidden relative">
        {loadingSlots && (
          <div className="absolute inset-0 bg-brand-bg-card/70 backdrop-blur-sm z-10 flex items-center justify-center">
            <Loader2 size={40} className="animate-spin text-brand-primary-500" />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse border-0">
            <thead>
              <tr className="bg-surface-subtle border-b border-brand-border">
                <th
                  className={`w-32 p-4 font-black uppercase text-xs tracking-widest text-brand-text-muted border-r border-brand-border ${isRTL ? 'text-right' : 'text-left'}`}
                >
                  {t('timetables.startTime', 'Time')}
                </th>
                {DAYS.map((day) => (
                  <th
                    key={day}
                    className="p-4 text-center font-black uppercase text-xs tracking-widest text-brand-text-muted border-r border-brand-border last:border-r-0"
                  >
                    {t(`days.${day.toLowerCase()}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {timeSlots.map((slot) => (
                <tr key={slot} className="hover:bg-brand-bg-card/50 transition-colors">
                  <td className="p-3 font-bold text-xs text-brand-text-muted border-r border-brand-border align-middle bg-surface-subtle/30 text-center">
                    {(() => {
                      const [start, end] = slot.split('-');
                      return start && end ? <TimeRange start={start} end={end} /> : slot;
                    })()}
                  </td>
                  {DAYS.map((day) => {
                    const key = `${day}_${slot}`;
                    const entry = slots[key];
                    return (
                      <td key={key} className="p-2 border-r border-brand-border last:border-r-0 align-top">
                        <TimeSlotCell
                          day={day}
                          slot={slot}
                          entry={entry}
                          canEdit={true}
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
            const entry = slots[key];
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
                  canEdit={true}
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

      {/* Modal Dialog */}
      {dialog && (
        <SlotModal
          isOpen={Boolean(dialog)}
          dialogContext={dialog}
          form={form}
          courses={courses}
          doctors={doctors}
          loadingCourses={loadingCourses}
          collegeId={collegeId}
          isRTL={isRTL}
          onChange={setForm}
          onClose={() => setDialog(null)}
          onSubmit={handleSaveSlot}
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
                <h3 className="text-base">تقرير فحص التعارضات في الجدول</h3>
              </div>
              <button
                onClick={() => setAuditReport(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-brand-text-muted">
              تم اكتشاف <strong className="text-rose-600 dark:text-rose-400 font-black">{auditReport.length}</strong> تعارض دراسي يحتاج إلى مراجعة قبل الاعتماد:
            </p>

            <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1">
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
                className="px-5 py-2 bg-brand-primary-500 hover:bg-brand-primary-600 text-white font-bold text-xs rounded-xl shadow transition-all"
              >
                فهمت، سأقوم بالتعديل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
