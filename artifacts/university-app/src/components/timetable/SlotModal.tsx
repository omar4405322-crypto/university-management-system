import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, User, MapPin, Plus, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { TimeRange } from '../ui/TimeRange';
import type { Course, Doctor, SlotDialog, SlotEntry } from '../../types/timetable.types';
import InstructorSelector from './InstructorSelector';
import SearchableSelect from '../ui/SearchableSelect';

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
 * Sourced with SearchableSelect for course filtering.
 */
export default function SlotModal({
  isOpen,
  dialogContext,
  form,
  courses = [],
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

  const courseOptions = useMemo(() => {
    return courses.map((c) => ({
      value: c.name,
      label: `${c.name} ${c.courseCode ? `(${c.courseCode})` : ''}`,
      sublabel: c.department?.name || ''
    }));
  }, [courses]);

  const title = isEditing
    ? t('common.edit', 'Edit Slot')
    : t('timetable.addSlot', 'Add Class Slot');

  const subtitle = dialogContext ? (
    <span>
      {t(`days.${dialogContext.day.toLowerCase()}`, dialogContext.day)} • {' '}
      {(() => {
        const [s, e] = dialogContext.slot.split('-');
        return s && e ? <TimeRange start={s} end={e} /> : dialogContext.slot;
      })()}
    </span>
  ) : undefined;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} subtitle={subtitle} size="sm">
      <div className="space-y-4 pt-2">
        {/* Course Searchable Select */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2 mb-1.5">
            <BookOpen size={14} className="text-slate-400" />
            {t('courses.course', 'Course')} *
          </label>
          <SearchableSelect
            options={courseOptions}
            value={form.courseName}
            onChange={(val) => {
              onChange({
                ...form,
                courseName: val,
                doctorName: form.doctorName,
              });
            }}
            placeholder={loadingCourses ? t('common.loading', 'Loading...') : t('schedule.selectCourse', 'Select Course')}
            searchPlaceholder={t('common.searchCoursePlaceholder', 'Search course by code or name...')}
            disabled={loadingCourses}
            isRTL={isRTL}
            icon={<BookOpen size={16} />}
          />
        </div>

        {/* Instructor / TA Searchable Selector */}
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
