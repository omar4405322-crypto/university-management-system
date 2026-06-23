import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, User, MapPin, Plus } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import type { Course, Doctor, SlotDialog, SlotEntry } from '../../types/timetable.types';

type SessionType = 'LECTURE' | 'LAB' | 'SEMINAR';

export interface SlotFormValues {
  courseName: string;
  doctorName: string;
  room: string;
  sessionType: SessionType;
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

const SESSION_TYPES: SessionType[] = ['LECTURE', 'LAB', 'SEMINAR'];

const FIELD_CLASS =
  'w-full h-11 bg-brand-bg-page/50 border border-brand-border rounded-xl text-sm font-bold text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all cursor-pointer';

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

  const handleCourseChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const course = courses.find((c) => c.name === e.target.value);
      onChange({
        ...form,
        courseName: e.target.value,
        doctorName: course?.doctor
          ? `${course.doctor.firstName ?? ''} ${course.doctor.lastName ?? ''}`.trim()
          : form.doctorName,
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
          <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest ml-1 flex items-center gap-1">
            <BookOpen size={11} />
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

        {/* Doctor */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest ml-1 flex items-center gap-1">
            <User size={11} />
            {t('timetables.instructor', 'Instructor')}
          </label>
          <div className="relative">
            <User
              size={16}
              className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none`}
            />
            {doctors.length === 0 ? (
              <select
                disabled
                className={`${FIELD_CLASS} ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} opacity-50`}
              >
                <option>{t('timetable.noDoctors', 'No professors registered')}</option>
              </select>
            ) : (
              <select
                className={`${FIELD_CLASS} ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'}`}
                value={form.doctorName}
                onChange={(e) => onChange({ ...form, doctorName: e.target.value })}
                aria-label={t('timetables.selectProfessor', 'Select Professor')}
              >
                <option value="">{t('timetables.selectProfessor', 'Select Professor')}</option>
                {doctors.map((doc) => {
                  const isDifferentCollege =
                    doc.department?.collegeId != null &&
                    String(doc.department.collegeId) !== String(collegeId);
                  const docName = `${doc.firstName ?? ''} ${doc.lastName ?? ''}`.trim();
                  return (
                    <option key={doc.id} value={docName}>
                      {docName}
                      {isDifferentCollege
                        ? ` ⚠️ (${t('timetable.otherCollege', 'Other college')})`
                        : ''}
                    </option>
                  );
                })}
              </select>
            )}
          </div>
        </div>

        {/* Room */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest ml-1 flex items-center gap-1">
            <MapPin size={11} />
            {t('timetables.room', 'Room / Hall')} *
          </label>
          <div className="relative">
            <MapPin
              size={16}
              className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none`}
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
          <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest ml-1">
            {t('schedule.sessionType', 'Session Type')}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {SESSION_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onChange({ ...form, sessionType: type })}
                aria-pressed={form.sessionType === type}
                className={`h-10 text-xs font-black uppercase tracking-wider rounded-xl transition-all border ${
                  form.sessionType === type
                    ? 'bg-brand-primary-500 text-white border-brand-primary-500 shadow-md shadow-brand-primary-500/20'
                    : 'bg-brand-bg-page/50 text-brand-text-secondary border-brand-border hover:bg-brand-navy/5'
                }`}
              >
                {t(`schedule.${type.toLowerCase()}`, type)}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-4 border-t border-brand-border">
          <Button variant="ghost" size="sm" onClick={onClose} className="flex-1">
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button variant="success" size="sm" onClick={onSubmit} className="flex-[2]">
            <Plus size={15} className={isRTL ? 'ml-1' : 'mr-1'} />
            {isEditing ? t('common.save', 'Save') : t('timetable.addSlot', 'Add Slot')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
