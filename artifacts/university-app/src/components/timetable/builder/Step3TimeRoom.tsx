import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Clock, AlertCircle } from 'lucide-react';
import { WizardSlotForm } from './types';
import RoomSelector from './RoomSelector';

export interface Step3TimeRoomProps {
  form: WizardSlotForm;
  onChange: (fields: Partial<WizardSlotForm>) => void;
  userRole?: string;
  isRTL?: boolean;
}

const DAYS_OF_WEEK = [
  { value: 'SUNDAY', labelEn: 'Sunday', labelAr: 'الأحد' },
  { value: 'MONDAY', labelEn: 'Monday', labelAr: 'الاثنين' },
  { value: 'TUESDAY', labelEn: 'Tuesday', labelAr: 'الثلاثاء' },
  { value: 'WEDNESDAY', labelEn: 'Wednesday', labelAr: 'الأربعاء' },
  { value: 'THURSDAY', labelEn: 'Thursday', labelAr: 'الخميس' },
  { value: 'SATURDAY', labelEn: 'Saturday', labelAr: 'السبت' },
];

export const Step3TimeRoom: React.FC<Step3TimeRoomProps> = ({
  form,
  onChange,
  userRole,
  isRTL = false,
}) => {
  const { t } = useTranslation();

  // Validate that endTime is strictly after startTime (free time inputs, no fixed presets)
  const timeValidationError = useMemo(() => {
    if (!form.startTime || !form.endTime) return null;
    if (form.endTime <= form.startTime) {
      return t('schedules.timeEndAfterStart', 'End time must be after start time');
    }
    return null;
  }, [form.startTime, form.endTime, t]);

  const hasTimeError = Boolean(timeValidationError);

  return (
    <div className="space-y-4">
      {/* Day Selection */}
      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
          <Calendar size={14} className="text-brand-primary-500" />
          <span>{t('schedules.dayOfWeek', 'Day of Week')} *</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DAYS_OF_WEEK.map((day) => {
            const isSelected = form.dayOfWeek?.toUpperCase() === day.value;
            return (
              <button
                key={day.value}
                data-day={day.value}
                type="button"
                onClick={() => onChange({ dayOfWeek: day.value })}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
                  isSelected
                    ? 'bg-brand-primary-500 border-brand-primary-500 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750'
                }`}
              >
                {isRTL ? day.labelAr : day.labelEn}
              </button>
            );
          })}
        </div>
      </div>

      {/* Free Start and End Time Inputs */}
      <div className="p-3.5 bg-slate-50/70 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Clock size={14} className="text-brand-primary-500" />
          <span>{t('schedules.timeDuration', 'Session Timing (Free Inputs)')}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="wizard-start-time"
              className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1"
            >
              {t('schedules.startTime', 'Start Time')} *
            </label>
            <input
              id="wizard-start-time"
              type="time"
              value={form.startTime}
              aria-invalid={hasTimeError}
              aria-describedby={hasTimeError ? 'time-validation-error' : undefined}
              onChange={(e) => onChange({ startTime: e.target.value })}
              className={`w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-850 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all ${
                hasTimeError
                  ? 'border-rose-500 focus:ring-rose-500/20 focus:border-rose-500'
                  : 'border-slate-200 dark:border-slate-700 focus:ring-brand-primary-500/20 focus:border-brand-primary-500'
              }`}
            />
          </div>

          <div>
            <label
              htmlFor="wizard-end-time"
              className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1"
            >
              {t('schedules.endTime', 'End Time')} *
            </label>
            <input
              id="wizard-end-time"
              type="time"
              value={form.endTime}
              aria-invalid={hasTimeError}
              aria-describedby={hasTimeError ? 'time-validation-error' : undefined}
              onChange={(e) => onChange({ endTime: e.target.value })}
              className={`w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-850 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all ${
                hasTimeError
                  ? 'border-rose-500 focus:ring-rose-500/20 focus:border-rose-500'
                  : 'border-slate-200 dark:border-slate-700 focus:ring-brand-primary-500/20 focus:border-brand-primary-500'
              }`}
            />
          </div>
        </div>

        {/* Inline Time Validation Alert */}
        {hasTimeError && (
          <div
            id="time-validation-error"
            role="alert"
            className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-semibold"
          >
            <AlertCircle size={14} className="shrink-0" />
            <span>{timeValidationError}</span>
          </div>
        )}
      </div>

      {/* Room Directory Selector */}
      <div className="p-3.5 bg-slate-50/70 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-700">
        <RoomSelector
          value={form.roomId}
          roomName={form.roomName}
          legacyRoomName={form.legacyRoomName}
          onChange={(roomId, roomName) => onChange({ roomId, roomName })}
          role={userRole}
          isRTL={isRTL}
        />
      </div>
    </div>
  );
};

export default Step3TimeRoom;
