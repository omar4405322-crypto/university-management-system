import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Loader2 } from 'lucide-react';
import doctorsService from '../../services/doctors.service';
import teachingAssistantsService from '../../services/teachingAssistants.service';
import SearchableSelect, { SelectOption } from '../ui/SearchableSelect';

interface InstructorSelectorProps {
  courseId: string | number | undefined;
  slotType: 'LECTURE' | 'LAB' | string;
  value: string;
  onChange: (value: string, label?: string) => void;
  isRTL?: boolean;
  disabled?: boolean;
  collegeId?: string | number | null;
  /** Used if no suggestions are found (e.g. general list of doctors/TAs) */
  fallbackOptions?: any[];
  /** Whether the value should be the ID instead of the full name */
  useIdAsValue?: boolean;
}

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

  const placeholderText =
    slotType === 'LECTURE'
      ? t('timetables.selectProfessor', 'Select Professor / Doctor')
      : t('schedules.selectTA', 'Select Teaching Assistant');

  const emptyText =
    slotType === 'LECTURE'
      ? t('timetable.noDoctors', 'No instructors available')
      : t('schedules.noTAAvailable', 'No TAs available');

  const options: SelectOption[] = useMemo(() => {
    // When courseId is present, the backend suggested endpoint is the authoritative scope check
    if (courseId) {
      if (suggestedInstructors.length > 0) {
        return suggestedInstructors.map((inst) => {
          const name = `${inst.firstName ?? inst.user?.firstName ?? ''} ${
            inst.lastName ?? inst.user?.lastName ?? ''
          }`.trim();
          const val = useIdAsValue ? String(inst.id) : name;
          const groupKey = inst.reason || 'Other';
          const groupLabel =
            groupKey === 'Previously Taught'
              ? `✨ ${t('timetable.tier1', groupKey)}`
              : `🏢 ${t('timetable.tier2', 'Same Department')}`;

          return {
            value: val,
            label: name,
            group: groupLabel,
            sublabel: inst.specialization || inst.title || inst.department || ''
          };
        });
      }
      // If course is selected but no instructors are in scope, return empty (no out-of-scope fallback)
      return [];
    }

    // Fallback when no course is selected yet
    return [];
  }, [courseId, suggestedInstructors, useIdAsValue, t]);

  if (loadingInstructors) {
    return (
      <div className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-400 text-sm flex items-center gap-2 opacity-60">
        <Loader2 size={16} className="animate-spin text-brand-primary-500" />
        <span>{t('common.loading', 'Loading...')}</span>
      </div>
    );
  }

  return (
    <SearchableSelect
      options={options}
      value={value}
      onChange={(nextValue) => {
        const selected = options.find((option) => option.value === nextValue);
        onChange(nextValue, selected?.label);
      }}
      placeholder={placeholderText}
      searchPlaceholder={t('common.searchPlaceholder', 'Search...')}
      emptyText={emptyText}
      disabled={disabled || !courseId}
      isRTL={isRTL}
      icon={<User size={16} />}
    />
  );
}
