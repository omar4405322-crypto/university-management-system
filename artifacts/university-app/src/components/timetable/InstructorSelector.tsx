import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Loader2 } from 'lucide-react';
import doctorsService from '../../services/doctors.service';
import teachingAssistantsService from '../../services/teachingAssistants.service';

interface InstructorSelectorProps {
  courseId: string | number | undefined;
  slotType: 'LECTURE' | 'LAB' | 'SECTION' | 'SECTION' | string;
  value: string;
  onChange: (value: string) => void;
  isRTL?: boolean;
  disabled?: boolean;
  collegeId?: string | number | null;
  /** Used if no suggestions are found (e.g. general list of doctors/TAs) */
  fallbackOptions?: any[];
  /** Whether the value should be the ID instead of the full name */
  useIdAsValue?: boolean;
}

const FIELD_CLASS =
  'w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all cursor-pointer text-sm';

export default function InstructorSelector({
  courseId,
  slotType,
  value,
  onChange,
  isRTL = false,
  disabled = false,
  collegeId,
  fallbackOptions = [],
  useIdAsValue = false,
}: InstructorSelectorProps) {
  const { t } = useTranslation();
  const [suggestedInstructors, setSuggestedInstructors] = useState<any[]>([]);
  const [loadingInstructors, setLoadingInstructors] = useState(false);

  useEffect(() => {
    const fetchInstructors = async () => {
      if (!courseId) {
        setSuggestedInstructors([]);
        return;
      }
      setLoadingInstructors(true);
      try {
        if (slotType === 'LECTURE') {
          const res = await doctorsService.getSuggestedDoctors(courseId);
          if (res.success) {
            setSuggestedInstructors(res.data || []);
          }
        } else {
          const res = await teachingAssistantsService.getSuggestedTeachingAssistants(courseId);
          if (res.success) {
            setSuggestedInstructors(res.data || []);
          }
        }
      } catch (error) {
        console.error('Failed to fetch suggested instructors', error);
      } finally {
        setLoadingInstructors(false);
      }
    };

    fetchInstructors();
  }, [courseId, slotType]);

  const labelText =
    slotType === 'LECTURE'
      ? t('timetables.instructor', 'Instructor')
      : t('SCHEDULES.teachingAssistant', 'Teaching Assistant');

  const placeholderText =
    slotType === 'LECTURE'
      ? t('timetables.selectProfessor', 'Select Professor')
      : t('SCHEDULES.selectTA', 'Select Teaching Assistant');

  const emptyText =
    slotType === 'LECTURE'
      ? t('timetable.noDoctors', 'No instructors available')
      : t('SCHEDULES.noTAAvailable', 'No TAs available');

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2 mb-1.5">
        <User size={14} className="text-slate-400" />
        {labelText}
        {slotType !== 'LECTURE' && (
          <span className="text-slate-400 font-normal ml-1">({t('common.optional', 'Optional')})</span>
        )}
      </label>
      <div className="relative">
        <User
          size={16}
          className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none`}
        />
        {loadingInstructors ? (
          <div className={`${FIELD_CLASS} ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} opacity-50 flex items-center`}>
            <Loader2 size={14} className="animate-spin mr-2" />
            {t('common.loading', 'Loading...')}
          </div>
        ) : suggestedInstructors.length === 0 && fallbackOptions.length === 0 ? (
          <select disabled className={`${FIELD_CLASS} ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} opacity-50`}>
            <option>{emptyText}</option>
          </select>
        ) : (
          <select
            disabled={disabled}
            className={`${FIELD_CLASS} ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'}`}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            aria-label={placeholderText}
          >
            <option value="">{placeholderText}</option>
            {suggestedInstructors.length > 0 ? (
              <>
                {Object.entries(
                  suggestedInstructors.reduce((acc, inst) => {
                    const group = inst.reason || 'Other';
                    if (!acc[group]) acc[group] = [];
                    acc[group].push(inst);
                    return acc;
                  }, {} as Record<string, any[]>)
                ).map(([group, insts]) => (
                  <optgroup
                    key={group}
                    label={
                      group === 'Previously Taught'
                        ? `✨ ${t('timetable.tier1', group)}`
                        : group === 'Same Department'
                        ? `🏢 ${t('timetable.tier2', group)}`
                        : group === 'Same College'
                        ? `🏫 ${t('timetable.tier3', group)}`
                        : `🌍 ${t('timetable.tier4', group)}`
                    }
                  >
                    {insts.map((inst) => {
                      const name = `${inst.firstName ?? inst.user?.firstName ?? ''} ${
                        inst.lastName ?? inst.user?.lastName ?? ''
                      }`.trim();
                      const val = useIdAsValue ? String(inst.id) : name;
                      return (
                        <option key={inst.id} value={val}>
                          {name}
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
              </>
            ) : (
              fallbackOptions.map((opt) => {
                const isDifferentCollege =
                  opt.department?.collegeId != null &&
                  collegeId != null &&
                  String(opt.department.collegeId) !== String(collegeId);
                const name = `${opt.firstName ?? opt.user?.firstName ?? ''} ${
                  opt.lastName ?? opt.user?.lastName ?? ''
                }`.trim();
                const val = useIdAsValue ? String(opt.id) : name;
                return (
                  <option key={opt.id} value={val}>
                    {name}
                    {isDifferentCollege ? ` ⚠️ (${t('timetable.otherCollege', 'Other college')})` : ''}
                  </option>
                );
              })
            )}
          </select>
        )}
      </div>
    </div>
  );
}
