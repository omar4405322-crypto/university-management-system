import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle, Loader2, Clock, X, Trash2, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useScope from '../../hooks/useScope';
import { useTimetableData } from '../../hooks/useTimetableData';
import TimetableFiltersBar from '../../components/timetable/TimetableFiltersBar';
import TimeSlotCell from '../../components/timetable/TimeSlotCell';
import SlotModal from '../../components/timetable/SlotModal';
import timetableService from '../../services/timetable.service';
import type { TimetableFilters, SlotsMap, Day } from '../../types/timetable.types';
import type { SlotFormValues } from '../../components/timetable/SlotModal';

// ── Constants ──────────────────────────────────────────────────────────────────
const DAYS: Day[] = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

const EMPTY_FORM: SlotFormValues = {
  courseName: '',
  doctorName: '',
  room: '',
  sessionType: 'LECTURE',
  assistantName: '',
};

// ── Component ──────────────────────────────────────────────────────────────────
/**
 * TimetableGrid — orchestrator component.
 * All data fetching lives in useTimetableData; all cell rendering in TimeSlotCell;
 * the filter bar in TimetableFiltersBar; the add/edit dialog in SlotModal.
 * This component's job is wiring them together and handling save/delete logic.
 */
export default function TimetableGrid() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { scopeParams } = useScope();
  const isRTL = i18n.language?.startsWith('ar');
  const [searchParams] = useSearchParams();

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<TimetableFilters>({
    departmentId: searchParams.get('dept') ?? '',
    academicYear: searchParams.get('year') ?? '1',
    semester: searchParams.get('sem') ?? '1',
  });

  // ── Dialog state ─────────────────────────────────────────────────────────────
  const [dialog, setDialog] = useState<{ day: Day; slot: string } | null>(null);
  const [form, setForm] = useState<SlotFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [isEditingTimes, setIsEditingTimes] = useState(false);
  const [customTimeSlots, setCustomTimeSlots] = useState<{start: string; end: string}[]>(() => {
    const saved = localStorage.getItem('customTimeSlots_v2');
    return saved ? JSON.parse(saved) : [
      { start: '09:00', end: '10:30' },
      { start: '10:30', end: '12:00' },
      { start: '12:00', end: '13:30' },
      { start: '13:30', end: '15:00' },
      { start: '15:00', end: '16:30' },
    ];
  });

  React.useEffect(() => {
    localStorage.setItem('customTimeSlots_v2', JSON.stringify(customTimeSlots));
  }, [customTimeSlots]);

  // ── Scope helpers ────────────────────────────────────────────────────────────
  const collegeId = user?.managedCollegeId ?? user?.collegeId ?? scopeParams?.collegeId;
  const deptId = user?.managedDepartmentId ?? user?.departmentId ?? scopeParams?.departmentId;
  const isDeptAdminLocked = user?.role === 'DEPARTMENT_ADMIN';

  // ── Remote data ──────────────────────────────────────────────────────────────
  const {
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
  } = useTimetableData(filters, collegeId, deptId, user?.role);

  // ── Toast helper ─────────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Stable slot handlers (passed into memoized cells) ───────────────────────
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
          sessionType: existing.sessionType,
          assistantName: existing.assistantName || '',
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
    // Warn if same course is already on this day in a different time slot
    const conflict = Object.entries(slots).find(
      ([k, v]) => k !== key && k.startsWith(`${dialog.day}_`) && v.courseName === form.courseName
    );
    if (conflict) {
      showToast(
        t('timetables.duplicateError', `Course "${form.courseName}" already scheduled on this day`),
        'error'
      );
      return;
    }
    setSlots((prev) => ({
      ...prev,
      [key]: { ...form, timetableId: timetableId ?? null },
    }));
    setDialog(null);
  }, [form, dialog, slots, timetableId, showToast, t, setSlots]);

  // ── Persist timetable to backend ─────────────────────────────────────────────
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
          instructor: val.doctorName,
          room: val.room,
          sessionType: val.sessionType,
          assistantName: val.assistantName,
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
        await timetableService.updateTimetable(timetableId.toString(), payload);
      } else {
        await timetableService.createTimetable(payload);
      }
      showToast(t('timetables.saveSuccess', 'Timetable saved successfully ✅'), 'success');
    } catch {
      showToast(t('common.errorOccurred', 'Error saving timetable'), 'error');
    } finally {
      setSaving(false);
    }
  }, [filters, slots, departments, collegeId, timetableId, showToast, t]);

  // ── Return ───────────────────────────────────────────────────────────────────
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
        departments={departments}
        loadingDepts={loadingDepts}
        isDeptAdminLocked={isDeptAdminLocked}
        saving={saving}
        loadingSlots={loadingSlots}
        onChange={setFilters}
        onSave={handleSaveTimetable}
        extraActions={
          user?.role === 'SUPER_ADMIN' ? (
            <button
              onClick={() => setIsEditingTimes(true)}
              className="print:hidden h-10 px-4 border border-brand-primary-500 text-brand-primary-500 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-primary-50 transition-all flex items-center gap-2"
            >
              <Clock size={14} />
              {isRTL ? 'تعديل أوقات الجدول' : 'Edit Time Slots'}
            </button>
          ) : undefined
        }
      />

      {/* Grid */}
      <div className="bg-brand-bg-card border border-brand-border rounded-2xl shadow-soft overflow-hidden relative">
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
                    {t(`days.${day.toLowerCase()}`, day)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customTimeSlots.map((slot, index) => {
                const slotStr = `${slot.start}-${slot.end}`;
                return (
                <tr
                  key={index}
                  className="border-b border-brand-border last:border-b-0 hover:bg-surface-subtle/30 transition-colors"
                >
                  <td
                    className={`p-4 font-black text-xs text-brand-text-primary border-r border-brand-border ${isRTL ? 'text-right' : 'text-left'}`}
                  >
                    {slotStr}
                  </td>
                  {DAYS.map((day) => {
                    const key = `${day}_${slotStr}`;
                    return (
                      <td
                        key={key}
                        className="p-3 border-r border-brand-border last:border-r-0 min-h-[100px] align-top"
                      >
                        <TimeSlotCell
                          entry={slots[key] ?? null}
                          day={day}
                          slot={slotStr}
                          canEdit={Boolean(filters.departmentId)}
                          onAdd={() => handleOpenAdd(day, slotStr)}
                          onDelete={handleDeleteSlot}
                          onEdit={handleOpenEdit}
                        />
                      </td>
                    );
                  })}
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit dialog */}
      <SlotModal
        isOpen={Boolean(dialog)}
        dialogContext={dialog}
        form={form}
        courses={courses}
        doctors={doctors}
        teachingAssistants={teachingAssistants}
        loadingCourses={loadingCourses}
        collegeId={collegeId}
        isRTL={isRTL}
        onChange={setForm}
        onClose={() => setDialog(null)}
        onSubmit={handleSaveSlot}
      />

      {/* Time Slots Modal */}
      {isEditingTimes && user?.role === 'SUPER_ADMIN' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-brand-bg-card rounded-2xl p-6 w-full max-w-md shadow-2xl border border-brand-border">
            
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-brand-text-primary text-lg">
                {isRTL ? 'تعديل أوقات الجدول' : 'Edit Time Slots'}
              </h3>
              <button onClick={() => setIsEditingTimes(false)} className="text-brand-text-muted hover:text-brand-primary-500">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              {customTimeSlots.map((slot, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-xs font-black text-brand-text-muted w-6">{index + 1}</span>
                  <input
                    type="time"
                    value={slot.start}
                    onChange={(e) => {
                      const updated = [...customTimeSlots];
                      updated[index] = { ...updated[index], start: e.target.value };
                      setCustomTimeSlots(updated);
                    }}
                    className="flex-1 h-10 px-3 bg-surface-subtle border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-primary-500/20"
                  />
                  <span className="text-xs text-brand-text-muted font-black">→</span>
                  <input
                    type="time"
                    value={slot.end}
                    onChange={(e) => {
                      const updated = [...customTimeSlots];
                      updated[index] = { ...updated[index], end: e.target.value };
                      setCustomTimeSlots(updated);
                    }}
                    className="flex-1 h-10 px-3 bg-surface-subtle border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-primary-500/20"
                  />
                  <button
                    onClick={() => setCustomTimeSlots(customTimeSlots.filter((_, i) => i !== index))}
                    className="text-red-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setCustomTimeSlots([...customTimeSlots, { start: '18:00', end: '20:00' }])}
              className="mt-4 w-full h-10 border-2 border-dashed border-brand-primary-300 rounded-xl text-xs font-black text-brand-primary-500 hover:bg-brand-primary-50 transition-all"
            >
              + {isRTL ? 'إضافة فترة زمنية' : 'Add Time Slot'}
            </button>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsEditingTimes(false)}
                className="flex-1 h-10 bg-brand-primary-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-primary-600 transition-colors"
              >
                {isRTL ? 'حفظ' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setCustomTimeSlots([
                    { start: '09:00', end: '10:30' },
                    { start: '10:30', end: '12:00' },
                    { start: '12:00', end: '13:30' },
                    { start: '13:30', end: '15:00' },
                    { start: '15:00', end: '16:30' }
                  ]);
                  setIsEditingTimes(false);
                }}
                className="h-10 px-4 border border-brand-border rounded-xl text-xs font-black text-brand-text-muted hover:bg-surface-subtle transition-all"
              >
                {isRTL ? 'إعادة تعيين' : 'Reset'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
