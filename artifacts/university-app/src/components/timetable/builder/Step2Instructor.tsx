import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { User, CheckCircle2, AlertTriangle, ShieldCheck, ShieldAlert, Loader2, Search } from 'lucide-react';
import { WizardSlotForm } from './types';
import { evaluateTAApproval } from './builderUtils';
import doctorsService from '../../../services/doctors.service';
import teachingAssistantsService from '../../../services/teachingAssistants.service';
import taApprovalsService, { TACrossDepartmentApproval } from '../../../services/taApprovals.service';
import Badge from '../../ui/badge';
import type { Doctor } from '../../../types/timetable.types';

export interface Step2InstructorProps {
  form: WizardSlotForm;
  onChange: (fields: Partial<WizardSlotForm>) => void;
  isRTL?: boolean;
}

interface TAItem {
  id: number | string;
  firstName?: string;
  lastName?: string;
  name?: string;
  departmentId?: number;
  department?: { id: number; name: string };
}

export const Step2Instructor: React.FC<Step2InstructorProps> = ({
  form,
  onChange,
  isRTL = false,
}) => {
  const { t } = useTranslation();
  const isLecture = form.slotType === 'LECTURE';

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [teachingAssistants, setTeachingAssistants] = useState<TAItem[]>([]);
  const [approvals, setApprovals] = useState<TACrossDepartmentApproval[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Fetch doctors if LECTURE
  useEffect(() => {
    if (!isLecture) return;
    let mounted = true;
    setLoading(true);
    doctorsService
      .getDoctors({ departmentId: form.departmentId || undefined })
      .then((res) => {
        if (mounted && res.success && res.data) {
          const list = Array.isArray(res.data) ? res.data : (res.data as any).doctors || [];
          setDoctors(list);
        }
        if (mounted) setLoading(false);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [isLecture, form.departmentId]);

  // Fetch TAs and cross-department approvals if LAB
  useEffect(() => {
    if (isLecture) return;
    let mounted = true;
    setLoading(true);

    Promise.all([
      teachingAssistantsService.getTeachingAssistants(),
      taApprovalsService.getApprovals(),
    ])
      .then(([tasRes, appRes]) => {
        if (mounted) {
          if (tasRes.success && tasRes.data) {
            const list = Array.isArray(tasRes.data) ? tasRes.data : (tasRes.data as any).teachingAssistants || [];
            setTeachingAssistants(list);
          }
          if (appRes.success && appRes.data) {
            const appList = Array.isArray(appRes.data) ? appRes.data : (appRes.data as any).approvals || [];
            setApprovals(appList);
          }
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isLecture]);

  // Filtered doctors
  const filteredDoctors = useMemo(() => {
    if (!search.trim()) return doctors;
    const q = search.toLowerCase();
    return doctors.filter((doc) => {
      const full = `${doc.firstName || ''} ${doc.lastName || ''}`.toLowerCase();
      return full.includes(q);
    });
  }, [doctors, search]);

  // Filtered and evaluated TAs
  const evaluatedTAs = useMemo(() => {
    const courseDeptId = Number(form.departmentId);
    return teachingAssistants.map((ta) => {
      const evaluation = evaluateTAApproval(ta, form.courseId, courseDeptId, approvals);
      const fullName = ta.name || `${ta.firstName || ''} ${ta.lastName || ''}`.trim();

      return {
        ...ta,
        fullName,
        isCrossDepartment: evaluation.isCrossDepartment,
        isApproved: evaluation.isApproved,
        isDisabled: evaluation.isDisabled,
        approvalReason: evaluation.approvalReason,
      };
    });
  }, [teachingAssistants, form.departmentId, form.courseId, approvals]);

  const filteredTAs = useMemo(() => {
    if (!search.trim()) return evaluatedTAs;
    const q = search.toLowerCase();
    return evaluatedTAs.filter((ta) => ta.fullName.toLowerCase().includes(q));
  }, [evaluatedTAs, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <User size={15} className="text-brand-primary-500" />
            {isLecture
              ? t('schedules.assignDoctor', 'Assign Course Doctor (Faculty)')
              : t('schedules.assignTA', 'Assign Lab Teaching Assistant')}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {isLecture
              ? t('schedules.doctorSelectDesc', 'Lectures must be assigned to an authorized course doctor.')
              : t('schedules.taSelectDesc', 'Practical labs must be assigned to a teaching assistant.')}
          </p>
        </div>
        <Badge variant={isLecture ? 'primary' : 'warning'} className="text-[10px] uppercase font-bold">
          {isLecture ? t('schedules.lecture', 'Lecture') : t('schedules.lab', 'Lab')}
        </Badge>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            isLecture
              ? t('schedules.searchDoctorPlaceholder', 'Search doctors by name...')
              : t('schedules.searchTAPlaceholder', 'Search teaching assistants...')
          }
          className="w-full ps-9 pe-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500"
        />
      </div>

      {/* Instructor List */}
      <div className="max-h-60 overflow-y-auto space-y-2 rounded-xl border border-slate-200 dark:border-slate-700 p-2 bg-slate-50/50 dark:bg-slate-900/40">
        {loading ? (
          <div className="p-6 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 size={15} className="animate-spin text-brand-primary-500" />
            <span>{t('common.loading', 'Loading instructors...')}</span>
          </div>
        ) : isLecture ? (
          filteredDoctors.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">
              {t('schedules.noDoctorsFound', 'No doctors available for this department')}
            </div>
          ) : (
            filteredDoctors.map((doc) => {
              const fullName = `${doc.firstName || ''} ${doc.lastName || ''}`.trim();
              const isSelected = String(form.doctorId) === String(doc.id);
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() =>
                    onChange({
                      doctorId: String(doc.id),
                      doctorName: fullName,
                    })
                  }
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs text-start transition-all cursor-pointer ${
                    isSelected
                      ? 'border-brand-primary-500 bg-brand-primary-50/80 dark:bg-brand-primary-950/40 text-brand-primary-900 dark:text-brand-primary-100 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0 ${
                        isSelected
                          ? 'bg-brand-primary-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {fullName[0] || 'D'}
                    </div>
                    <div className="truncate">
                      <div className="font-bold truncate">{fullName}</div>
                      <div className="text-[10px] text-slate-400">
                        {(doc as any).title || t('schedules.doctorRole', 'Faculty Member')}
                      </div>
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 size={16} className="text-brand-primary-600 shrink-0" />}
                </button>
              );
            })
          )
        ) : filteredTAs.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500">
            {t('schedules.noTAsFound', 'No teaching assistants found')}
          </div>
        ) : (
          filteredTAs.map((ta) => {
            const isSelected = String(form.teachingAssistantId) === String(ta.id);
            return (
              <button
                key={ta.id}
                type="button"
                disabled={ta.isDisabled}
                className={`w-full text-start p-3 rounded-xl border transition-all ${
                  ta.isDisabled
                    ? 'border-slate-200 dark:border-slate-700/60 bg-slate-100/60 dark:bg-slate-800/40 opacity-70 cursor-not-allowed'
                    : isSelected
                    ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 shadow-xs cursor-pointer'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 cursor-pointer'
                }`}
                onClick={() => {
                  if (!ta.isDisabled) {
                    onChange({
                      teachingAssistantId: String(ta.id),
                      teachingAssistantName: ta.fullName,
                    });
                  }
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0 ${
                        isSelected
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {ta.fullName[0] || 'T'}
                    </div>
                    <div className="truncate">
                      <div className="font-bold text-xs truncate flex items-center gap-1.5">
                        <span>{ta.fullName}</span>
                        {ta.isCrossDepartment && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                            {t('schedules.crossDeptBadge', 'Cross-Dept')}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {ta.department?.name || t('schedules.taRole', 'Teaching Assistant')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {ta.isCrossDepartment ? (
                      ta.isApproved ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                          <ShieldCheck size={12} />
                          <span>{t('schedules.approved', 'Approved')}</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md">
                          <ShieldAlert size={12} />
                          <span>{t('schedules.unapproved', 'Not Approved')}</span>
                        </span>
                      )
                    ) : null}
                    {isSelected && <CheckCircle2 size={16} className="text-amber-600 shrink-0" />}
                  </div>
                </div>

                {/* Unapproved explanation */}
                {ta.isDisabled && (
                  <div className="mt-2 text-[10px] text-rose-600 dark:text-rose-400 flex items-center gap-1 font-semibold">
                    <AlertTriangle size={12} className="shrink-0" />
                    <span>
                      {t(
                        'schedules.crossDepartmentApprovalRequired',
                        'Disabled: Cross-department teaching requires approved status from College Admin.'
                      )}
                    </span>
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Step2Instructor;
