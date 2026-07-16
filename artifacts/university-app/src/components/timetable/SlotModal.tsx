import React, { useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, User, MapPin, Plus, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import type { Course, Doctor, SlotDialog, SlotEntry } from '../../types/timetable.types';
import InstructorSelector from './InstructorSelector';

type SlotType = 'LECTURE' | 'LAB' | 'SECTION';

export interface SlotFormValues {
  courseName: string;
  doctorName: string;
  room: string;
  slotType: SlotType;
}

interface SlotModalProps {
  isOpen: boolean;
  /** Non-null means we are editing an existing slot (edit mode). Null means add mode. */
  dialogContext: SlotDialog | null;
  form: SlotFormValues;
  courses: Course[];
  doctors: Doctor[];
  loadingCourses: boolean;
  collegeId: number | string | null | undefined;
  isRTL: boolean;
  onChange: (next: SlotFormValues) => void;
  onClose: () => void;
  onSubmit: () => void;
}

const SESSION_TYPES: SlotType[] = ['LECTURE', 'LAB', 'SECTION'];

const FIELD_CLASS =
  'w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all cursor-pointer text-sm';

/**
 * Combined Add / Edit slot modal.
 * The title switches automatically based on whether form.courseName is already populated.
 * All labels are sourced from i18n via t(). Uses the shared Modal and Button UI components.
 * The course selector auto-fills the doctor field when a course with an assigned doctor is chosen.
 */
export default function SlotModal({
  isOpen,
  dialogContext,
  form,
  courses,
  doctors,
  loadingCourses,
  collegeId,
  isRTL,
  onChange,
  onClose,
  onSubmit,
}: SlotModalProps) {
  const { t } = useTranslation();

  const isEditing = Boolean(form.courseName && dialogContext);
  
  const selectedCourse = courses.find((c) => c.name === form.courseName);

  const handleCourseChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const course = courses.find((c) => c.name === e.target.value);
      onChange({
        ...form,
        courseName: e.target.value,
        doctorName: form.doctorName,
      });
    },
    [courses, form, onChange]
  );

  const title = isEditing
    ? t('common.edit', 'Edit Slot')
    : t('timetable.addSlot', 'Add Class Slot');

  const subtitle = dialogContext
    ? `${t(`days.${dialogContext.day.toLowerCase()}`, dialogContext.day)} • ${dialogContext.slot}`
    : undefined;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} subtitle={subtitle} size="sm">
      <div className="space-y-4 pt-2">
        {/* Course */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2 mb-1.5">
            <BookOpen size={14} className="text-slate-400" />
            {t('courses.course', 'Course')} *
          </label>
          <select
            className={FIELD_CLASS}
            value={form.courseName}
            onChange={handleCourseChange}
            aria-label={t('schedule.selectCourse', 'Select Course')}
          >
            <option value="">
              {loadingCourses
                ? t('common.loading', 'Loading...')
                : t('schedule.selectCourse', 'Select Course')}
            </option>
            {courses.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name} — {c.courseCode}
              </option>
            ))}
          </select>
        </div>

        {/* Instructor / TA */}
        <InstructorSelector
          courseId={selectedCourse?.id}
          slotType={form.slotType}
          value={form.doctorName}
          onChange={(val) => onChange({ ...form, doctorName: val })}
          isRTL={isRTL}
          collegeId={collegeId}
          fallbackOptions={doctors}
        />

        {/* Room */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2 mb-1.5">
            <MapPin size={14} className="text-slate-400" />
            {t('timetables.room', 'Room / Hall')} *
          </label>
          <div className="relative">
            <MapPin
              size={16}
              className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none`}
            />
            <input
              className={`${FIELD_CLASS} ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'}`}
              placeholder={t('schedule.roomPlaceholder', 'e.g. A101')}
              value={form.room}
              onChange={(e) => onChange({ ...form, room: e.target.value })}
              aria-label={t('timetables.room', 'Room')}
            />
          </div>
        </div>

        {/* Session type toggle */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2 mb-1.5">
            {t('schedule.slotType', 'Session Type')}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {SESSION_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onChange({ ...form, slotType: type })}
                aria-pressed={form.slotType === type}
                className={`h-10 text-xs font-black uppercase tracking-wider rounded-xl transition-all border ${
                  form.slotType === type
                    ? 'bg-brand-primary-500 text-white border-brand-primary-500 shadow-md shadow-brand-primary-500/20'
                    : 'bg-white dark:bg-slate-850 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {t(`schedule.${type.toLowerCase()}`, type)}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button type="button" variant="ghost" className="flex-1 rounded-xl text-xs font-semibold" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button 
            type="button"
            className="flex-[2] bg-brand-primary-500 hover:bg-brand-primary-600 active:scale-95 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2" 
            onClick={onSubmit}
          >
            {!isEditing && <Plus size={15} />}
            {isEditing ? t('common.save', 'Save') : t('timetable.addSlot', 'Add Slot')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
