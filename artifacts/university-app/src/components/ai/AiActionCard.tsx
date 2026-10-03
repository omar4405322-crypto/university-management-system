import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FileCheck,
  Info,
  Loader2,
  Send,
  Users,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import {
  confirmActionProposal,
  cancelActionProposal,
  getActionProposal,
  type AIActionProposalItem,
  type AIActionStatus,
} from '../../services/ai.service';

interface AiActionCardProps {
  proposal: AIActionProposalItem;
  onProposalUpdated?: (updated: AIActionProposalItem) => void;
}

export function AiActionCard({ proposal, onProposalUpdated }: AiActionCardProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const [currentProposal, setCurrentProposal] = useState<AIActionProposalItem>(proposal);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check if expired client-side
  const isClientExpired =
    currentProposal.status === 'PROPOSED' &&
    new Date(currentProposal.expiresAt).getTime() <= Date.now();

  const effectiveStatus: AIActionStatus = isClientExpired ? 'EXPIRED' : currentProposal.status;

  const handleConfirm = async () => {
    if (effectiveStatus !== 'PROPOSED' || isConfirming || isCanceling) return;

    setIsConfirming(true);
    setErrorMessage(null);

    try {
      const result = await confirmActionProposal(currentProposal.id);
      const updated: AIActionProposalItem = {
        ...currentProposal,
        status: 'SUCCEEDED',
        confirmedAt: new Date().toISOString(),
        executedAt: result.executedAt || new Date().toISOString(),
        executionResult: result.executionResult,
      };
      setCurrentProposal(updated);
      onProposalUpdated?.(updated);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || t('aiAssistant.unavailable');
      setErrorMessage(msg);
      // Refresh proposal from server to catch stale/expired transitions
      try {
        const fresh = await getActionProposal(currentProposal.id);
        setCurrentProposal(fresh);
        onProposalUpdated?.(fresh);
      } catch {
        // Keep existing error
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = async () => {
    if (effectiveStatus !== 'PROPOSED' || isConfirming || isCanceling) return;

    setIsCanceling(true);
    setErrorMessage(null);

    try {
      const result = await cancelActionProposal(currentProposal.id);
      const updated: AIActionProposalItem = {
        ...currentProposal,
        status: 'CANCELED',
        canceledAt: new Date().toISOString(),
      };
      setCurrentProposal(updated);
      onProposalUpdated?.(updated);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || t('aiAssistant.unavailable');
      setErrorMessage(msg);
    } finally {
      setIsCanceling(false);
    }
  };

  const preview = currentProposal.previewData || {};
  const isTask = currentProposal.actionType === 'CREATE_TASK';
  const isAnnouncement = currentProposal.actionType === 'CREATE_ANNOUNCEMENT';
  const isNotification = currentProposal.actionType === 'MARK_NOTIFICATION_READ';

  const actionTitle = isRTL
    ? (currentProposal.humanReadableSummaryAr || currentProposal.humanReadableSummary)
    : currentProposal.humanReadableSummary;

  return (
    <div
      role="region"
      aria-label={t('aiAssistant.action.needsConfirmation', 'AI Action Proposal')}
      className={`relative mt-3 rounded-xl border p-4 sm:p-5 text-sm transition-all duration-200 shadow-xs ${
        effectiveStatus === 'SUCCEEDED'
          ? 'border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/20'
          : effectiveStatus === 'CANCELED'
          ? 'border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 opacity-80'
          : effectiveStatus === 'EXPIRED'
          ? 'border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/20'
          : effectiveStatus === 'STALE'
          ? 'border-rose-500/40 bg-rose-500/5 dark:bg-rose-950/20'
          : effectiveStatus === 'FAILED'
          ? 'border-red-500/40 bg-red-500/5 dark:bg-red-950/20'
          : 'border-brand-primary-500/40 bg-brand-bg-main/80 dark:bg-brand-bg-elevated'
      }`}
    >
      {/* Header & Status Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400">
            {isTask ? (
              <FileCheck size={16} aria-hidden="true" />
            ) : isAnnouncement ? (
              <Send size={16} aria-hidden="true" />
            ) : (
              <Info size={16} aria-hidden="true" />
            )}
          </span>
          <span className="font-bold text-brand-text-main text-xs sm:text-sm">
            {isTask
              ? t('aiAssistant.action.actionTypes.CREATE_TASK', 'Create Course Assignment')
              : isAnnouncement
              ? t('aiAssistant.action.actionTypes.CREATE_ANNOUNCEMENT', 'Broadcast Scoped Announcement')
              : t('aiAssistant.action.actionTypes.MARK_NOTIFICATION_READ', 'Mark Notification as Read')}
          </span>
        </div>

        {/* Status Badge */}
        <div>
          {effectiveStatus === 'PROPOSED' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <Clock size={12} aria-hidden="true" />
              {t('aiAssistant.action.needsConfirmation', 'Needs Confirmation')}
            </span>
          )}
          {effectiveStatus === 'EXECUTING' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400 animate-pulse">
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              {t('aiAssistant.action.statusExecuting', 'Executing action...')}
            </span>
          )}
          {effectiveStatus === 'SUCCEEDED' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 size={12} aria-hidden="true" />
              {t('aiAssistant.action.statusSucceeded', 'Action Executed Successfully')}
            </span>
          )}
          {effectiveStatus === 'CANCELED' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-500/15 px-2.5 py-0.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
              <XCircle size={12} aria-hidden="true" />
              {t('aiAssistant.action.statusCanceled', 'Action Canceled')}
            </span>
          )}
          {effectiveStatus === 'EXPIRED' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <Clock size={12} aria-hidden="true" />
              {t('aiAssistant.action.statusExpired', 'Proposal Expired')}
            </span>
          )}
          {effectiveStatus === 'STALE' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
              <AlertTriangle size={12} aria-hidden="true" />
              {t('aiAssistant.action.statusStale', 'Action Stale — Review Required')}
            </span>
          )}
          {effectiveStatus === 'FAILED' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">
              <AlertCircle size={12} aria-hidden="true" />
              {t('aiAssistant.action.statusFailed', 'Execution Failed')}
            </span>
          )}
        </div>
      </div>

      {/* Structured Details Preview */}
      <div className="mt-3 space-y-2 text-xs sm:text-sm">
        <p className="font-semibold text-brand-text-main leading-relaxed">{actionTitle}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
          {preview.target && (
            <div className="rounded-lg bg-brand-bg-elevated/70 p-2.5 border border-brand-border/40">
              <span className="text-brand-text-sub block font-medium">
                {t('aiAssistant.action.targetLabel', 'Target')}:
              </span>
              <span className="font-semibold text-brand-text-main mt-0.5 block">{String(preview.target)}</span>
            </div>
          )}

          {preview.deadlineCairo && (
            <div className="rounded-lg bg-brand-bg-elevated/70 p-2.5 border border-brand-border/40">
              <div className="flex items-center gap-1 text-brand-text-sub font-medium">
                <Calendar size={13} aria-hidden="true" />
                <span>{t('aiAssistant.action.deadlineLabel', 'Deadline')}:</span>
              </div>
              <span className="font-semibold text-brand-text-main mt-0.5 block">
                {String(preview.deadlineCairo)}
              </span>
            </div>
          )}

          {preview.recipientsCount !== undefined && (
            <div className="rounded-lg bg-brand-bg-elevated/70 p-2.5 border border-brand-border/40">
              <div className="flex items-center gap-1 text-brand-text-sub font-medium">
                <Users size={13} aria-hidden="true" />
                <span>{t('aiAssistant.action.recipientsLabel', 'Recipients')}:</span>
              </div>
              <span className="font-semibold text-brand-text-main mt-0.5 block">
                {String(preview.recipientsCount)} {isRTL ? 'طالب مسجل' : 'enrolled students'}
              </span>
            </div>
          )}

          {preview.maxScore !== undefined && (
            <div className="rounded-lg bg-brand-bg-elevated/70 p-2.5 border border-brand-border/40">
              <span className="text-brand-text-sub block font-medium">
                {t('aiAssistant.action.maxScoreLabel', 'Max Score')}:
              </span>
              <span className="font-semibold text-brand-text-main mt-0.5 block">
                {String(preview.maxScore)} {isRTL ? 'درجة' : 'points'}
              </span>
            </div>
          )}
        </div>

        {preview.description && (
          <div className="rounded-lg bg-brand-bg-elevated/50 p-2.5 border border-brand-border/30 text-xs text-brand-text-sub">
            <span className="font-medium text-brand-text-main block mb-0.5">
              {t('aiAssistant.action.descriptionLabel', 'Description')}:
            </span>
            <p className="whitespace-pre-wrap">{String(preview.description)}</p>
          </div>
        )}

        {/* Side Effect Notice Banner */}
        {preview.sideEffect && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300 border border-amber-500/20">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <div>
              <span className="font-bold block">
                {t('aiAssistant.action.sideEffectWarning', 'Side Effect Notice')}:
              </span>
              <p className="mt-0.5 leading-normal">
                {isRTL && preview.sideEffectAr ? String(preview.sideEffectAr) : String(preview.sideEffect)}
              </p>
            </div>
          </div>
        )}

        {/* Failure reason if stale/failed */}
        {currentProposal.failureReason && (
          <div className="flex items-start gap-2 rounded-lg bg-red-500/10 p-2.5 text-xs text-red-700 dark:text-red-300 border border-red-500/20">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
            <div>
              <span className="font-semibold">{currentProposal.failureReason}</span>
            </div>
          </div>
        )}

        {/* Inline Error on confirm/cancel */}
        {errorMessage && (
          <div className="rounded-lg bg-red-500/10 p-2.5 text-xs text-red-700 dark:text-red-300 border border-red-500/20">
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Action Footer (Only active in PROPOSED state) */}
      {effectiveStatus === 'PROPOSED' && (
        <div className="mt-4 pt-3 border-t border-brand-border/60">
          <p className="text-[11px] text-brand-text-muted mb-3">
            {t(
              'aiAssistant.action.explicitConfirmationNotice',
              'Explicit human confirmation required. Chat text messages cannot execute this action.'
            )}
          </p>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isCanceling || isConfirming}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-border bg-transparent px-3.5 py-2 text-xs font-semibold text-brand-text-sub transition-colors hover:bg-brand-bg-elevated hover:text-brand-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-500 disabled:opacity-50 cursor-pointer"
            >
              {isCanceling && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
              <span>{isCanceling ? t('aiAssistant.action.canceling', 'Canceling...') : t('aiAssistant.action.cancel', 'Cancel Action')}</span>
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={isConfirming || isCanceling}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-brand-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-500 disabled:opacity-50 cursor-pointer"
            >
              {isConfirming ? (
                <>
                  <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                  <span>{t('aiAssistant.action.confirming', 'Executing...')}</span>
                </>
              ) : (
                <>
                  <Check size={14} aria-hidden="true" />
                  <span>{t('aiAssistant.action.confirm', 'Confirm & Execute')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Completion timestamp when succeeded */}
      {effectiveStatus === 'SUCCEEDED' && currentProposal.executedAt && (
        <div className="mt-3 pt-2 border-t border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300">
          <span>{isRTL ? 'تم الإنجاز في: ' : 'Completed at: '}</span>
          <span className="font-medium">
            {new Date(currentProposal.executedAt).toLocaleString(isRTL ? 'ar-EG' : 'en-US')}
          </span>
        </div>
      )}
    </div>
  );
}
