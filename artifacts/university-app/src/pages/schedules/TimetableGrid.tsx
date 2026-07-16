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
import timetableService from '../../services/timetable.service';
import type { TimetableFilters, SlotsMap, Day } from '../../types/timetable.types';
import type { SlotEntry } from '../../types/timetable.types';
import type { SlotFormValues } from '../../components/timetable/SlotModal';

// ── Constants ──────────────────────────────────────────────────────────────────
const DAYS: Day[] = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const TIME_SLOTS = ['08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00'];

const EMPTY_FORM: SlotFormValues = {
  courseName: '',
  doctorName: '',
  room: '',
  slotType: 'LECTURE',
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
  const { scopeParams, isCollegeAdmin } = useScope();
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
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideEntry, setOverrideEntry] = useState<SlotEntry | null>(null);
  const [selectedDay, setSelectedDay] = useState<Day>(DAYS[0]);

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
        colleges={colleges}
        loadingColleges={loadingColleges}
        isCollegeAdmin={isCollegeAdmin}
        departments={departments}
        loadingDepts={loadingDepts}
        isDeptAdminLocked={isDeptAdminLocked}
        saving={saving}
        loadingSlots={loadingSlots}
        onChange={setFilters}
        onSave={handleSaveTimetable}
      />

      {/* Grid */}
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
                    {t(`days.${day.toLowerCase()}`, day)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map((slot) => (
                <tr
                  key={slot}
                  className="border-b border-brand-border last:border-b-0 hover:bg-surface-subtle/30 transition-colors"
                >
                  <td
                    className={`p-4 font-black text-xs text-brand-text-primary border-r border-brand-border ${isRTL ? 'text-right' : 'text-left'}`}
                  >
                    {slot}
                  </td>
                  {DAYS.map((day) => {
                    const key = `${day}_${slot}`;
                    return (
                      <td
                        key={key}
                        className="p-3 border-r border-brand-border last:border-r-0 min-h-[100px] align-top"
                      >
                        <TimeSlotCell
                          entry={slots[key] ?? null}
                          day={day}
                          slot={slot}
                          canEdit={Boolean(filters.departmentId)}
                          onAdd={() => handleOpenAdd(day, slot)}
                          onDelete={handleDeleteSlot}
                          onEdit={handleOpenEdit}
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
        {/* Mobile Day Selector Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar" dir={isRTL ? 'rtl' : 'ltr'}>
          {DAYS.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm ${
                selectedDay === day
                  ? 'bg-brand-primary-600 text-white shadow-brand-primary-600/20'
                  : 'bg-surface-subtle text-brand-text-secondary hover:bg-brand-primary-600/10 border border-brand-border'
              }`}
            >
              {t(`days.${day.toLowerCase()}`, day)}
            </button>
          ))}
        </div>

        {/* Time slots cards */}
        <div className="space-y-3 relative min-h-[200px]">
          {loadingSlots && (
            <div className="absolute inset-0 bg-brand-bg-page/70 backdrop-blur-sm z-10 flex items-center justify-center">
              <Loader2 size={32} className="animate-spin text-brand-primary-500" />
            </div>
          )}
          {TIME_SLOTS.map((slot) => {
            const key = `${selectedDay}_${slot}`;
            return (
              <div key={slot} className="bg-brand-bg-card border border-brand-border rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-center border-b border-brand-border/40 pb-2">
                  <span className="text-xs font-black text-brand-primary-600 tracking-wider">
                    {slot}
                  </span>
                  <span className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest">
                    {t(`days.${selectedDay.toLowerCase()}`, selectedDay)}
                  </span>
                </div>
                <div>
                  <TimeSlotCell
                    entry={slots[key] ?? null}
                    day={selectedDay}
                    slot={slot}
                    canEdit={Boolean(filters.departmentId)}
                    onAdd={() => handleOpenAdd(selectedDay, slot)}
                    onDelete={handleDeleteSlot}
                    onEdit={handleOpenEdit}
                    onEditOverride={handleEditOverride}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add / Edit dialog */}
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
      <OverrideModal
        isOpen={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        entry={overrideEntry}
        onSuccess={() => window.location.reload()}
      />
    </div>
  );
}
