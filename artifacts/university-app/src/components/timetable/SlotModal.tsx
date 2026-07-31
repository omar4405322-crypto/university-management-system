import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  User,
  MapPin,
  Plus,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Users,
  Sparkles,
} from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/button';
import type { Course, Doctor, SlotDialog } from '../../types/timetable.types';
import InstructorSelector from './InstructorSelector';
import SearchableSelect from '../ui/SearchableSelect';
import schedulesService from '../../services/schedules.service';

type SlotType = 'LECTURE' | 'LAB' | 'SECTION';

export interface SlotFormValues {
  courseName: string;
  doctorName: string;
  room: string;
  slotType: SlotType;
  groupName?: string;
  dayOfWeek?: string;
  startTime?: string;
  endTime?: string;
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

const SESSION_TYPES: SlotType[] = ['LECTURE', 'SECTION', 'LAB'];
const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

const FIELD_CLASS =
  'w-full px-4 py-2.5 rounded-xl border border-brand-border bg-white dark:bg-slate-850 text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all cursor-pointer text-sm disabled:opacity-60 disabled:cursor-not-allowed';

const SECTION_CARD_CLASS =
  'p-4 rounded-2xl bg-surface-subtle/50 dark:bg-slate-850/60 border border-brand-border/80 space-y-3';

/**
 * Combined Add / Edit slot modal designed with premium glassmorphic aesthetics.
 * Features grouped section cards, course searchable select, student group picker, session type, day, time range, room, doctor, and live conflict checking.
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

  const [checkingConflict, setCheckingConflict] = useState(false);
  const [conflicts, setConflicts] = useState<
    Array<{ type: string; messageAr: string; messageEn: string; conflictingSlot?: any }>
  >([]);

  // Time slot values
  const slotDay = form.dayOfWeek || dialogContext?.day || 'Monday';
  const timeParts = (dialogContext?.slot || '09:00-11:00').split('-');
  const slotStart = form.startTime || timeParts[0] || '09:00';
  const slotEnd = form.endTime || timeParts[1] || '11:00';

  useEffect(() => {
    if (!dialogContext || (!form.courseName && !form.doctorName && !form.room)) {
      setConflicts([]);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingConflict(true);
      try {
        const res = await schedulesService.checkConflict({
          dayOfWeek: slotDay,
          startTime: slotStart,
          endTime: slotEnd,
          room: form.room,
          doctorName: form.doctorName,
          courseName: form.courseName,
          slotType: form.slotType,
        });

        const conflictData = (res as any).data?.conflicts || (res as any).conflicts || [];
        setConflicts(conflictData);
      } catch (err) {
        console.error('Conflict check error:', err);
      } finally {
        setCheckingConflict(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [dialogContext, form.courseName, form.doctorName, form.room, form.slotType, slotDay, slotStart, slotEnd]);

  const courseOptions = useMemo(() => {
    return courses.map((c: any) => ({
      value: c.name,
      label: `${c.name} ${c.courseCode ? `(${c.courseCode})` : ''}`,
      sublabel: c.department?.name ? `${c.department.name} • ${t('common.year', 'Year')} ${c.year || 1}` : '',
    }));
  }, [courses, t]);

  const title = (
    <div className="flex items-center gap-2.5">
      <div className="p-2 rounded-xl bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400">
        <Sparkles size={18} />
      </div>
      <span>{isEditing ? t('common.edit', 'تعديل الحصة الدراسية') : t('timetable.addSlot', 'إضافة حصة دراسية جديدة')}</span>
    </div>
  );

  const subtitle = dialogContext ? (
    <span className="text-xs text-brand-text-muted font-medium flex items-center gap-1.5 mt-1">
      <Calendar size={13} className="text-brand-primary-500 shrink-0" />
      {t(`days.${slotDay.toLowerCase()}`, slotDay)} • {slotStart} - {slotEnd}
    </span>
  ) : undefined;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} subtitle={subtitle} size="md">
      <div className="space-y-4 pt-1">
        {/* ── Section 1: Course & Group Details ── */}
        <div className={SECTION_CARD_CLASS}>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
              <BookOpen size={14} className="text-brand-primary-500" />
              {t('courses.course', 'المقرر الدراسي')} *
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
              placeholder={loadingCourses ? t('common.loading', 'جاري التحميل...') : t('schedule.selectCourse', 'اختر المقرر الدراسي...')}
              searchPlaceholder={t('common.searchCoursePlaceholder', 'ابحث برمز أو اسم المقرر...')}
              disabled={loadingCourses}
              isRTL={isRTL}
              icon={<BookOpen size={16} />}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
              <Users size={14} className="text-brand-primary-500" />
              {t('common.group', 'المجموعة / الشعبة')}
              <span className="text-[10px] font-normal text-brand-text-muted ml-1">
                ({t('schedule.groupOptional', 'اختياري — فارغ = جميع الطلاب')})
              </span>
            </label>
            <select
              className={FIELD_CLASS}
              value={form.groupName || ''}
              onChange={(e) => onChange({ ...form, groupName: e.target.value })}
            >
              <option value="">{t('schedule.allStudents', '📢 جميع الطلاب (دفعة عامة)')}</option>
              <option value="Group A">{t('schedule.groupA', 'المجموعة أ (Group A)')}</option>
              <option value="Group B">{t('schedule.groupB', 'المجموعة ب (Group B)')}</option>
              <option value="Section 1">{t('schedule.sec1', 'سكشن 1')}</option>
              <option value="Section 2">{t('schedule.sec2', 'سكشن 2')}</option>
              <option value="Section 3">{t('schedule.sec3', 'سكشن 3')}</option>
            </select>
          </div>
        </div>

        {/* ── Section 2: Session Type, Day & Times ── */}
        <div className={SECTION_CARD_CLASS}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
                <BookOpen size={14} className="text-brand-primary-500" />
                {t('schedule.slotType', 'نوع الجلسة')}
              </label>
              <select
                className={FIELD_CLASS}
                value={form.slotType}
                onChange={(e) => onChange({ ...form, slotType: e.target.value as SlotType })}
              >
                {SESSION_TYPES.map((st) => (
                  <option key={st} value={st}>
                    {st === 'LECTURE' ? 'محاضرة (LECTURE)' : st === 'SECTION' ? 'سكشن (SECTION)' : 'معمل (LAB)'}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
                <Calendar size={14} className="text-brand-primary-500" />
                {t('timetables.day', 'اليوم')}
              </label>
              <select
                className={FIELD_CLASS}
                value={slotDay}
                onChange={(e) => onChange({ ...form, dayOfWeek: e.target.value })}
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {t(`days.${d.toLowerCase()}`, d)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
                <Clock size={14} className="text-brand-primary-500" />
                {t('timetables.startTime', 'وقت البدء')}
              </label>
              <input
                type="time"
                className={FIELD_CLASS}
                value={slotStart}
                onChange={(e) => onChange({ ...form, startTime: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
                <Clock size={14} className="text-brand-primary-500" />
                {t('timetables.endTime', 'وقت الانتهاء')}
              </label>
              <input
                type="time"
                className={FIELD_CLASS}
                value={slotEnd}
                onChange={(e) => onChange({ ...form, endTime: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* ── Section 3: Room & Instructor ── */}
        <div className={SECTION_CARD_CLASS}>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
              <MapPin size={14} className="text-brand-primary-500" />
              {t('timetables.room', 'القاعة / المدرج / الغرفة')} *
            </label>
            <div className="relative">
              <MapPin
                size={16}
                className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none`}
              />
              <input
                className={`${FIELD_CLASS} ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'}`}
                placeholder={t('schedule.roomPlaceholder', 'مثال: قاعة 302, معمل الحاسب 1')}
                value={form.room}
                onChange={(e) => onChange({ ...form, room: e.target.value })}
                aria-label={t('timetables.room', 'Room')}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
              <User size={14} className="text-brand-primary-500" />
              {form.slotType === 'LECTURE' ? 'المحاضر / الدكتور' : 'المعيد / المدرس المساعد'}
            </label>
            <InstructorSelector
              courseId={selectedCourse?.id}
              slotType={form.slotType}
              value={form.doctorName}
              onChange={(val) => onChange({ ...form, doctorName: val })}
              isRTL={isRTL}
              collegeId={collegeId}
              fallbackOptions={doctors}
            />
          </div>
        </div>

        {/* ── Real-time Conflict Alert Display ── */}
        {checkingConflict ? (
          <div className="p-3.5 bg-brand-primary-500/5 dark:bg-brand-primary-500/10 rounded-2xl border border-brand-primary-500/20 flex items-center gap-2.5 text-xs text-brand-primary-600 dark:text-brand-primary-400 animate-pulse">
            <Loader2 size={16} className="animate-spin text-brand-primary-500 shrink-0" />
            <span className="font-medium">جاري التحقق من التوافق وعدم وجود تعارضات بالقاعات والمحاضرين...</span>
          </div>
        ) : conflicts.length > 0 ? (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-2xl space-y-2 text-xs animate-in fade-in duration-200 shadow-soft">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold">
              <AlertTriangle size={18} className="shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{t('timetable.conflictWarning', 'تنبيه: تم اكتشاف تعارض في الجداول!')}</span>
            </div>
            <ul className="space-y-1.5 list-disc list-inside text-rose-700/90 dark:text-rose-300 font-medium">
              {conflicts.map((c, i) => (
                <li key={i} className="leading-relaxed">
                  {isRTL ? c.messageAr : c.messageEn}
                </li>
              ))}
            </ul>
          </div>
        ) : form.courseName && (form.doctorName || form.room) ? (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium shadow-soft">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>لا يوجد أي تعارض - الوقت والقاعة والمحاضر متاحون بنجاح!</span>
          </div>
        ) : null}

        {/* ── Actions ── */}
        <div className="flex items-center gap-3 pt-3">
          <Button type="button" variant="ghost" className="flex-1 rounded-xl text-xs font-bold py-3" onClick={onClose}>
            {t('common.cancel', 'إلغاء')}
          </Button>
          <Button
            type="button"
            className="flex-[2] bg-brand-primary-500 hover:bg-brand-primary-600 active:scale-95 text-white text-xs font-black py-3 px-5 rounded-xl shadow-lg shadow-brand-primary-500/20 transition-all flex items-center justify-center gap-2"
            onClick={onSubmit}
          >
            {!isEditing && <Plus size={16} />}
            {isEditing ? t('common.save', 'حفظ التغييرات') : t('timetable.addSlot', 'إضافة الحصة')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
