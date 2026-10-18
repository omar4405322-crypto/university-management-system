import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { WizardSlotForm, WizardStep, SlotType } from './types';
import Step1CourseGroup from './Step1CourseGroup';
import Step2Instructor from './Step2Instructor';
import Step3TimeRoom from './Step3TimeRoom';
import Step4ReviewConflict from './Step4ReviewConflict';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import Button from '../../ui/button';

export interface PlacementWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Existing slot data when editing. If null/undefined, wizard is in create mode. */
  initialSlot?: {
    id?: number | string;
    courseId?: number | string;
    courseName?: string;
    departmentId?: number | string;
    collegeId?: number | string;
    academicYear?: number | string;
    year?: number | string;
    semester?: number | string;
    slotType?: string;
    groupId?: number | string | null;
    groupName?: string;
    doctorId?: number | string | null;
    doctorName?: string;
    teachingAssistantId?: number | string | null;
    teachingAssistantName?: string;
    dayOfWeek?: string;
    day?: string;
    startTime?: string;
    endTime?: string;
    roomId?: number | string | null;
    room?: string | null;
    timetableId?: number | string | null;
  } | null;
  defaultDepartmentId?: number | string;
  defaultCollegeId?: number | string;
  defaultYear?: number | string;
  defaultSemester?: number | string;
  defaultDay?: string;
  defaultSlotTime?: string; // e.g. "09:00-11:00"
  slotTypeSelectId?: string;
  /** When called from sync-grid UI, saving draft slot to local state */
  onSaveDraft?: (slot: WizardSlotForm) => boolean | { success: boolean; message?: string } | void;
}

export const PlacementWizardModal: React.FC<PlacementWizardModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialSlot,
  defaultDepartmentId,
  defaultCollegeId,
  defaultYear,
  defaultSemester,
  defaultDay,
  defaultSlotTime,
  slotTypeSelectId = 'schedule-slot-type-select',
  onSaveDraft,
}) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();

  const isEditing = Boolean(initialSlot?.id);

  // Parse default times
  const parsedTimeParts = (defaultSlotTime || '09:00-11:00').split('-');
  const initialStartTime = initialSlot?.startTime || parsedTimeParts[0] || '09:00';
  const initialEndTime = initialSlot?.endTime || parsedTimeParts[1] || '11:00';

  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  const [form, setForm] = useState<WizardSlotForm>({
    departmentId: String(initialSlot?.departmentId || defaultDepartmentId || user?.managedDepartmentId || user?.departmentId || ''),
    collegeId: String(initialSlot?.collegeId || defaultCollegeId || user?.managedCollegeId || user?.collegeId || ''),
    academicYear: String(initialSlot?.academicYear || initialSlot?.year || defaultYear || '1'),
    semester: String(initialSlot?.semester || defaultSemester || '1'),
    courseId: String(initialSlot?.courseId || ''),
    courseName: initialSlot?.courseName || '',
    slotType: (initialSlot?.slotType === 'LAB' ? 'LAB' : 'LECTURE') as SlotType,
    groupId: initialSlot?.groupId ? String(initialSlot.groupId) : '',
    groupName: initialSlot?.groupName || '',
    doctorId: initialSlot?.doctorId ? String(initialSlot.doctorId) : '',
    doctorName: initialSlot?.doctorName || '',
    teachingAssistantId: initialSlot?.teachingAssistantId ? String(initialSlot.teachingAssistantId) : '',
    teachingAssistantName: initialSlot?.teachingAssistantName || '',
    dayOfWeek: (initialSlot?.dayOfWeek || initialSlot?.day || defaultDay || 'MONDAY').toUpperCase(),
    startTime: initialStartTime,
    endTime: initialEndTime,
    roomId: initialSlot?.roomId ? Number(initialSlot.roomId) : null,
    roomName: initialSlot?.room || '',
    legacyRoomName: !initialSlot?.roomId && initialSlot?.room ? initialSlot.room : null,
    timetableId: initialSlot?.timetableId ? Number(initialSlot.timetableId) : null,
  });

  const lastInitialSlotKeyRef = useRef<string>('');

  // Re-sync form only if initialSlot identity actually changes
  useEffect(() => {
    if (initialSlot) {
      const slotIdentity = `${initialSlot.id || ''}:${initialSlot.day || initialSlot.dayOfWeek || ''}:${initialSlot.startTime || ''}:${initialSlot.courseId || ''}`;
      if (lastInitialSlotKeyRef.current !== slotIdentity) {
        lastInitialSlotKeyRef.current = slotIdentity;
        const times = (defaultSlotTime || '09:00-11:00').split('-');
        setForm({
          departmentId: String(initialSlot.departmentId || defaultDepartmentId || user?.managedDepartmentId || user?.departmentId || ''),
          collegeId: String(initialSlot.collegeId || defaultCollegeId || user?.managedCollegeId || user?.collegeId || ''),
          academicYear: String(initialSlot.academicYear || initialSlot.year || defaultYear || '1'),
          semester: String(initialSlot.semester || defaultSemester || '1'),
          courseId: String(initialSlot.courseId || ''),
          courseName: initialSlot.courseName || '',
          slotType: (initialSlot.slotType === 'LAB' ? 'LAB' : 'LECTURE') as SlotType,
          groupId: initialSlot.groupId ? String(initialSlot.groupId) : '',
          groupName: initialSlot.groupName || '',
          doctorId: initialSlot.doctorId ? String(initialSlot.doctorId) : '',
          doctorName: initialSlot.doctorName || '',
          teachingAssistantId: initialSlot.teachingAssistantId ? String(initialSlot.teachingAssistantId) : '',
          teachingAssistantName: initialSlot.teachingAssistantName || '',
          dayOfWeek: (initialSlot.dayOfWeek || initialSlot.day || defaultDay || 'MONDAY').toUpperCase(),
          startTime: initialSlot.startTime || times[0] || '09:00',
          endTime: initialSlot.endTime || times[1] || '11:00',
          roomId: initialSlot.roomId ? Number(initialSlot.roomId) : null,
          roomName: initialSlot.room || '',
          legacyRoomName: !initialSlot.roomId && initialSlot.room ? initialSlot.room : null,
          timetableId: initialSlot.timetableId ? Number(initialSlot.timetableId) : null,
        });
        setCurrentStep(1);
      }
    }
  }, [initialSlot, defaultDepartmentId, defaultCollegeId, defaultYear, defaultSemester, defaultDay, defaultSlotTime, user]);

  const updateForm = useCallback((fields: Partial<WizardSlotForm>) => {
    setForm((prev) => ({ ...prev, ...fields }));
  }, []);

  // Step validation guards
  const isStep1Valid = Boolean(
    form.departmentId &&
    form.academicYear &&
    form.semester &&
    form.courseId &&
    form.slotType
  );

  const isStep2Valid =
    form.slotType === 'LECTURE'
      ? Boolean(form.doctorId)
      : Boolean(form.teachingAssistantId);

  const isStep3Valid = Boolean(
    form.dayOfWeek &&
    form.startTime &&
    form.endTime &&
    form.endTime > form.startTime &&
    (form.roomId !== null || form.roomName || form.legacyRoomName)
  );

  const canGoNext =
    (currentStep === 1 && isStep1Valid) ||
    (currentStep === 2 && isStep2Valid) ||
    (currentStep === 3 && isStep3Valid);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="placement-wizard-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200/90 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <h2 id="placement-wizard-title" className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400">
                <BookOpen size={18} />
              </span>
              {isEditing
                ? t('schedules.editSessionModalTitle', 'Edit Schedule Session')
                : t('schedules.placementWizardTitle', 'Timetable Placement Wizard')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('schedules.wizardStepSubtitle', 'Step {{step}} of 4: {{name}}', {
                step: currentStep,
                name:
                  currentStep === 1
                    ? t('schedules.step1Title', 'Course & Group')
                    : currentStep === 2
                    ? t('schedules.step2Title', 'Instructor Assignment')
                    : currentStep === 3
                    ? t('schedules.step3Title', 'Timing & Hall')
                    : t('schedules.step4Title', 'Review & Placement'),
              })}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-150 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* 4-Step Visual Stepper Bar */}
        <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-1/2 -translate-y-1/2 start-4 sm:start-6 end-4 sm:end-6 h-0.5 bg-slate-200 dark:bg-slate-800 -z-0" />
            {[
              { num: 1, label: t('schedules.step1Short', 'Course'), icon: BookOpen },
              { num: 2, label: t('schedules.step2Short', 'Staff'), icon: User },
              { num: 3, label: t('schedules.step3Short', 'Time & Hall'), icon: Clock },
              { num: 4, label: t('schedules.step4Short', 'Review'), icon: CheckCircle2 },
            ].map((s) => {
              const isPast = currentStep > s.num;
              const isCurrent = currentStep === s.num;
              return (
                <div key={s.num} className="flex flex-col items-center gap-1 relative z-10">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                      isCurrent
                        ? 'bg-brand-primary-500 text-white ring-4 ring-brand-primary-500/20'
                        : isPast
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {isPast ? <CheckCircle2 size={14} /> : s.num}
                  </div>
                  <span
                    className={`text-[10px] font-bold ${
                      isCurrent
                        ? 'text-brand-primary-600 dark:text-brand-primary-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Wizard Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {currentStep === 1 && (
            <Step1CourseGroup
              form={form}
              onChange={updateForm}
              userRole={user?.role}
              userDepartmentId={user?.managedDepartmentId || user?.departmentId}
              userCollegeId={user?.managedCollegeId || user?.collegeId}
              slotTypeSelectId={slotTypeSelectId}
              isRTL={isRTL}
            />
          )}

          {currentStep === 2 && (
            <Step2Instructor
              form={form}
              onChange={updateForm}
              isRTL={isRTL}
            />
          )}

          {currentStep === 3 && (
            <Step3TimeRoom
              form={form}
              onChange={updateForm}
              userRole={user?.role}
              isRTL={isRTL}
            />
          )}

          {currentStep === 4 && (
            <Step4ReviewConflict
              form={form}
              slotId={initialSlot?.id}
              onSaveDraft={onSaveDraft}
              onCommitSuccess={() => {
                if (!onSaveDraft) {
                  onSuccess();
                }
                onClose();
              }}
              onCancel={onClose}
              isRTL={isRTL}
            />
          )}
        </div>

        {/* Wizard Navigation Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-3.5 border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <Button
            id="wizard-prev-btn"
            type="button"
            variant="outline"
            size="sm"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((prev) => (prev > 1 ? ((prev - 1) as WizardStep) : prev))}
            className="text-xs font-bold px-4 py-2 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            {isRTL ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            <span>{t('common.previous', 'Previous')}</span>
          </Button>

          <div className="flex items-center gap-2">
            {currentStep < 4 ? (
              <Button
                id="wizard-next-btn"
                type="button"
                size="sm"
                disabled={!canGoNext}
                onClick={() => setCurrentStep((prev) => (prev < 4 ? ((prev + 1) as WizardStep) : prev))}
                className="text-xs font-bold px-5 py-2 bg-brand-primary-600 hover:bg-brand-primary-700 text-white flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-40"
              >
                <span>{t('common.next', 'Next')}</span>
                {isRTL ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlacementWizardModal;
