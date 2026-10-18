import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Calendar,
  Clock,
  MapPin,
  BookOpen,
  User,
  Users,
  GraduationCap,
  ShieldAlert,
  AlertCircle,
} from 'lucide-react';
import { WizardSlotForm, ScheduleConflict, ResolvedTerm, ResolvedRoom } from './types';
import { parseCheckConflictResponse, formatConflictMessage } from './builderUtils';
import schedulesService from '../../../services/schedules.service';
import Button from '../../ui/button';
import Badge from '../../ui/badge';

export interface Step4ReviewConflictProps {
  form: WizardSlotForm;
  slotId?: number | string | null;
  onCommitSuccess: () => void;
  onCancel: () => void;
  isRTL?: boolean;
  onSaveDraft?: (slot: WizardSlotForm) => boolean | { success: boolean; message?: string } | void;
}

export const Step4ReviewConflict: React.FC<Step4ReviewConflictProps> = ({
  form,
  slotId,
  onCommitSuccess,
  onCancel,
  isRTL = false,
  onSaveDraft,
}) => {
  const { t } = useTranslation();
  const isEditing = Boolean(slotId);

  const [checkingConflict, setCheckingConflict] = useState(false);
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [resolvedTerm, setResolvedTerm] = useState<ResolvedTerm | null>(null);
  const [resolvedRoom, setResolvedRoom] = useState<ResolvedRoom | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  const [isCommitting, setIsCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  // Live conflict checking on mount or when parameters change
  const performConflictCheck = useCallback(async () => {
    setCheckingConflict(true);
    setCheckError(null);
    try {
      const payload: Record<string, unknown> = {
        dayOfWeek: form.dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        courseId: form.courseId ? Number(form.courseId) : undefined,
        courseName: form.courseName || undefined,
        departmentId: form.departmentId ? Number(form.departmentId) : undefined,
        academicYear: form.academicYear ? Number(form.academicYear) : undefined,
        semester: form.semester ? Number(form.semester) : undefined,
        slotType: form.slotType,
        groupId: form.groupId ? Number(form.groupId) : undefined,
        roomId: form.roomId ? Number(form.roomId) : undefined,
        room: form.roomName || form.legacyRoomName || undefined,
        excludeSlotId: slotId ? Number(slotId) : undefined,
      };

      if (form.slotType === 'LECTURE') {
        if (form.doctorId) payload.doctorId = Number(form.doctorId);
        if (form.doctorName) payload.doctorName = form.doctorName;
      } else {
        if (form.teachingAssistantId) payload.teachingAssistantId = form.teachingAssistantId;
        if (form.teachingAssistantName) payload.taName = form.teachingAssistantName;
      }

      const res = await schedulesService.checkConflict(payload);
      if (res.success) {
        const parsed = parseCheckConflictResponse(res);
        setConflicts(parsed.conflicts);
        if (parsed.resolvedTerm) setResolvedTerm(parsed.resolvedTerm);
        if (parsed.resolvedRoom) setResolvedRoom(parsed.resolvedRoom);
      } else {
        setConflicts([]);
      }
    } catch (err: unknown) {
      setCheckError(t('schedules.checkConflictFailed', 'Unable to check live conflicts'));
    } finally {
      setCheckingConflict(false);
    }
  }, [form, slotId, t]);

  useEffect(() => {
    performConflictCheck();
  }, [performConflictCheck]);

  // Commit via onSaveDraft (draft mode) or createSchedule (POST) / updateSchedule (PUT)
  const handleCommit = async () => {
    setIsCommitting(true);
    setCommitError(null);

    try {
      if (onSaveDraft) {
        const res = onSaveDraft(form);
        if (res === false || (typeof res === 'object' && res && !res.success)) {
          const errorMsg =
            typeof res === 'object' && res.message
              ? res.message
              : isRTL
              ? 'تعذر حفظ الحصة لوجود تعارض في الجدول المحلي'
              : 'Cannot save slot due to local timetable conflict';
          setCommitError(errorMsg);
          setIsCommitting(false);
          return;
        }
        onCommitSuccess();
        return;
      }

      const payload: Record<string, unknown> = {
        courseId: Number(form.courseId),
        slotType: form.slotType,
        dayOfWeek: form.dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        room: form.roomName || form.legacyRoomName || null,
        roomId: form.roomId || null,
        termId: resolvedTerm?.id || undefined,
        groupId: form.groupId ? Number(form.groupId) : null,
        timetableId: form.timetableId || undefined,
      };

      if (form.slotType === 'LECTURE') {
        payload.doctorId = form.doctorId ? Number(form.doctorId) : null;
        payload.teachingAssistantId = null;
      } else {
        payload.teachingAssistantId = form.teachingAssistantId ? String(form.teachingAssistantId) : null;
        payload.doctorId = null;
      }

      let res;
      if (isEditing && slotId) {
        res = await schedulesService.updateSchedule(String(slotId), payload);
      } else {
        res = await schedulesService.createSchedule(payload);
      }

      if (res.success) {
        onCommitSuccess();
      } else {
        setCommitError(res.message || t('schedules.placementFailed', 'Failed to save schedule placement'));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('schedules.placementFailed', 'Failed to save schedule placement');
      setCommitError(msg);
    } finally {
      setIsCommitting(false);
    }
  };

  const getConflictBadgeVariant = (type: string) => {
    switch (type) {
      case 'ROOM_OCCUPIED':
      case 'ROOM_INACTIVE':
        return 'danger';
      case 'DOCTOR_BUSY':
      case 'TA_BUSY':
        return 'warning';
      case 'GROUP_CONFLICT':
        return 'warning';
      case 'PAST_TERM_LOCKED':
      case 'NO_ACTIVE_TERM':
        return 'danger';
      default:
        return 'danger';
    }
  };

  const isLegacyRoom = Boolean(!form.roomId && (form.legacyRoomName || form.roomName));

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <div className="p-4 bg-slate-50/80 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2.5">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-brand-primary-500" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
              {form.courseName || t('schedules.unnamedCourse', 'Course Placement Summary')}
            </span>
          </div>
          <Badge variant={form.slotType === 'LECTURE' ? 'primary' : 'warning'} className="text-[10px] uppercase font-bold">
            {form.slotType === 'LECTURE' ? t('schedules.lecture', 'Lecture') : t('schedules.lab', 'Lab')}
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Calendar size={11} />
              {t('schedules.day', 'Day')}
            </span>
            <div className="font-semibold text-slate-700 dark:text-slate-200">{form.dayOfWeek}</div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Clock size={11} />
              {t('schedules.time', 'Timing')}
            </span>
            <div className="font-semibold text-slate-700 dark:text-slate-200">
              {form.startTime} - {form.endTime}
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <MapPin size={11} />
              {t('schedules.room', 'Hall')}
            </span>
            <div className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
              <span>{form.roomName || form.legacyRoomName || t('schedules.tbaRoom', 'TBA')}</span>
              {isLegacyRoom && (
                <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-bold">
                  Legacy
                </span>
              )}
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <User size={11} />
              {form.slotType === 'LECTURE' ? t('schedules.doctor', 'Doctor') : t('schedules.ta', 'Assistant')}
            </span>
            <div className="font-semibold text-slate-700 dark:text-slate-200">
              {form.slotType === 'LECTURE'
                ? form.doctorName || t('schedules.tbaDoctor', 'Unassigned Doctor')
                : form.teachingAssistantName || t('schedules.tbaTA', 'Unassigned TA')}
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Users size={11} />
              {t('schedules.group', 'Group')}
            </span>
            <div className="font-semibold text-slate-700 dark:text-slate-200">
              {form.groupName || t('schedules.allStudents', 'All Students')}
            </div>
          </div>

          {resolvedTerm && (
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <GraduationCap size={11} />
                {t('schedules.term', 'Academic Term')}
              </span>
              <div className="font-semibold text-slate-700 dark:text-slate-200">{resolvedTerm.name}</div>
            </div>
          )}
        </div>
      </div>

      {/* Live Conflict Checking Section */}
      <div className="p-4 rounded-2xl border transition-all space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <ShieldAlert size={15} className="text-brand-primary-500" />
            <span>{t('schedules.conflictAuditTitle', 'Automated Placement Audit')}</span>
          </div>
          {checkingConflict && (
            <div className="flex items-center gap-1.5 text-xs text-brand-primary-600 font-semibold">
              <Loader2 size={13} className="animate-spin" />
              <span>{t('schedules.checkingConflicts', 'Checking conflicts...')}</span>
            </div>
          )}
        </div>

        {checkError && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2" role="alert">
            <AlertCircle size={15} className="shrink-0 text-amber-600" />
            <span>{checkError}</span>
          </div>
        )}

        {!checkingConflict && conflicts.length === 0 && !checkError && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2.5 text-emerald-800 dark:text-emerald-200 text-xs font-bold">
            <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              {isRTL
                ? 'لا توجد أي تعارضات — هذه الفترة والقاعة والمحاضر متاحون وجاهزون للتثبيت.'
                : 'No conflicts detected — room, faculty, and student group are clear for placement.'}
            </span>
          </div>
        )}

        {conflicts.length > 0 && (
          <div className="space-y-2">
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-800 dark:text-rose-200 text-xs font-bold" role="alert">
              <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
              <span>
                {t(
                  'schedules.conflictsDetectedCount',
                  `Found ${conflicts.length} conflict(s). Please review before placement.`
                )}
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {conflicts.map((conf, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-rose-200 dark:border-rose-900/60 shadow-2xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                      {conf.type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 font-medium">
                    {formatConflictMessage(conf, Boolean(isRTL))}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Commit Error */}
      {commitError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2" role="alert">
          <AlertCircle size={15} className="shrink-0 text-rose-600" />
          <span>{commitError}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/60">
        <Button
          id="wizard-cancel-btn"
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isCommitting}
          className="text-xs font-bold px-4 py-2"
        >
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          id="wizard-commit-btn"
          data-testid={onSaveDraft ? 'wizard-commit-btn wizard-save-draft-btn' : 'wizard-commit-btn'}
          type="button"
          size="sm"
          onClick={handleCommit}
          disabled={isCommitting || checkingConflict}
          className="text-xs font-bold px-5 py-2 bg-brand-primary-600 hover:bg-brand-primary-700 text-white flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          {isCommitting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>{t('schedules.committing', 'Saving placement...')}</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={14} />
              <span>
                {onSaveDraft
                  ? (isRTL ? 'إضافة الحصة للمسودة' : 'Add Class Slot (Save)')
                  : isEditing
                  ? t('schedules.confirmUpdate', 'Update Schedule Slot')
                  : t('schedules.confirmCreate', 'Confirm Placement')}
              </span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default Step4ReviewConflict;
