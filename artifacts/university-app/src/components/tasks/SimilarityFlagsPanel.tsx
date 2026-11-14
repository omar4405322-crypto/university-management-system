import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Check,
  FileText,
  Loader2,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import Badge from '../ui/badge';
import Button from '../ui/button';
import { EmptyState } from '../ui/EmptyState';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import submissionSimilarityService, {
  type DecideSimilarityFlagPayload,
  type SimilarityFlagDecision,
  type SimilaritySideDTO,
  type SubmissionSimilarityFlagItem,
} from '../../services/submissionSimilarity.service';

export const MAX_SIMILARITY_NOTE_LENGTH = 1000;

type StatusFilter = 'ALL' | 'PENDING' | 'CONFIRMED' | 'DISMISSED';

const STATUS_FILTERS: readonly StatusFilter[] = [
  'ALL',
  'PENDING',
  'CONFIRMED',
  'DISMISSED',
] as const;

export interface SimilarityFlagsPanelProps {
  taskId: number | string;
  flags: SubmissionSimilarityFlagItem[];
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  onRefreshFlags: () => Promise<void>;
  onFlagUpdated: (updated: SubmissionSimilarityFlagItem) => void;
}

function formatLocaleDateTime(iso: string | null | undefined, language: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const locale = language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US-u-nu-latn';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    numberingSystem: 'latn',
  }).format(date);
}

function formatSimilarityPercent(score: number): string {
  const num = Number.isFinite(score) ? score * 100 : 0;
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(num)}%`;
}

function formatThresholdValue(threshold: number): string {
  const num = Number.isFinite(threshold) ? threshold : 0;
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
  }).format(num);
}

function getStatusBadgeMeta(status: string): {
  variant: 'warning' | 'success' | 'neutral';
  labelKey: string;
} {
  if (status === 'CONFIRMED') {
    return { variant: 'success', labelKey: 'tasks.similarityFlags.statusConfirmed' };
  }
  if (status === 'DISMISSED') {
    return { variant: 'neutral', labelKey: 'tasks.similarityFlags.statusDismissed' };
  }
  return { variant: 'warning', labelKey: 'tasks.similarityFlags.statusPending' };
}

function SubmissionSideCard({
  label,
  side,
  language,
  t,
}: {
  label: string;
  side: SimilaritySideDTO;
  language: string;
  t: (key: string) => string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-brand-border bg-surface-subtle p-3 space-y-1.5 text-start">
      <div className="text-[11px] font-bold text-brand-text-muted">{label}</div>
      <div className="text-sm font-bold text-brand-text-primary dark:text-brand-text-main break-words [overflow-wrap:anywhere]">
        {side.studentName}
      </div>
      <div className="text-xs text-brand-text-secondary flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>{t('tasks.similarityFlags.studentIdLabel')}:</span>
        <bdi dir="ltr" className="font-mono text-xs tabular-nums break-all">
          {side.studentId}
        </bdi>
      </div>
      <div className="text-xs text-brand-text-secondary flex items-start gap-1.5 min-w-0">
        <FileText size={14} className="shrink-0 mt-0.5 text-brand-primary-500" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="sr-only">{t('tasks.similarityFlags.fileNameLabel')}: </span>
          <bdi dir="ltr" className="font-medium break-all">
            {side.fileName || t('tasks.similarityFlags.noFileName')}
          </bdi>
        </span>
      </div>
      <div className="text-[11px] text-brand-text-muted tabular-nums">
        {t('tasks.similarityFlags.submittedAtLabel')}: {formatLocaleDateTime(side.submittedAt, language)}
      </div>
    </div>
  );
}

export const SimilarityFlagsPanel: React.FC<SimilarityFlagsPanelProps> = ({
  taskId,
  flags,
  loading,
  loadError,
  onRetry,
  onRefreshFlags,
  onFlagUpdated,
}) => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [inFlightMap, setInFlightMap] = useState<Record<string, SimilarityFlagDecision>>({});
  const [conflictAlert, setConflictAlert] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  const inFlightRef = useRef<Set<string>>(new Set());
  const isMountedRef = useRef(true);
  const panelHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const headingRefs = useRef<Record<string, HTMLHeadingElement | null>>({});

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setStatusFilter('ALL');
    setDraftNotes({});
    setCardErrors({});
    setConflictAlert(null);
    setLiveAnnouncement('');
  }, [taskId]);

  const filteredFlags = useMemo(() => {
    if (statusFilter === 'ALL') return flags;
    return flags.filter((flag) => flag.status === statusFilter);
  }, [flags, statusFilter]);

  const handleDecide = useCallback(
    async (flag: SubmissionSimilarityFlagItem, decision: SimilarityFlagDecision) => {
      if (inFlightRef.current.has(flag.id)) return;
      inFlightRef.current.add(flag.id);

      setInFlightMap((prev) => ({ ...prev, [flag.id]: decision }));
      setCardErrors((prev) => {
        if (!prev[flag.id]) return prev;
        const next = { ...prev };
        delete next[flag.id];
        return next;
      });
      setConflictAlert(null);

      const trimmedNote = (draftNotes[flag.id] ?? '').trim();
      const payload: DecideSimilarityFlagPayload = trimmedNote
        ? { decision, note: trimmedNote }
        : { decision };

      try {
        const res = await submissionSimilarityService.decideFlag(
          taskId,
          flag.id,
          payload
        );
        if (!isMountedRef.current) return;

        if (res.success && res.data) {
          onFlagUpdated(res.data);
          setDraftNotes((prev) => {
            const next = { ...prev };
            delete next[flag.id];
            return next;
          });
          toast.success(
            decision === 'CONFIRMED'
              ? t('tasks.similarityFlags.confirmSuccess')
              : t('tasks.similarityFlags.dismissSuccess')
          );
          setLiveAnnouncement(
            t(
              decision === 'CONFIRMED'
                ? 'tasks.similarityFlags.announcedConfirmed'
                : 'tasks.similarityFlags.announcedDismissed',
              {
                studentA: flag.submissionA.studentName,
                studentB: flag.submissionB.studentName,
              }
            )
          );
          window.requestAnimationFrame(() => {
            if (!isMountedRef.current) return;
            const target = headingRefs.current[flag.id] || panelHeadingRef.current;
            target?.focus();
          });
        } else if (res.status === 409) {
          setConflictAlert(res.message || t('errors.conflict'));
          await onRefreshFlags();
        } else {
          setCardErrors((prev) => ({
            ...prev,
            [flag.id]: res.message || t('tasks.similarityFlags.decideError'),
          }));
        }
      } finally {
        inFlightRef.current.delete(flag.id);
        if (isMountedRef.current) {
          setInFlightMap((prev) => {
            const next = { ...prev };
            delete next[flag.id];
            return next;
          });
        }
      }
    },
    [draftNotes, onFlagUpdated, onRefreshFlags, t, taskId, toast]
  );

  const filterLabelKeyMap: Record<StatusFilter, string> = {
    ALL: 'tasks.similarityFlags.filterAll',
    PENDING: 'tasks.similarityFlags.filterPending',
    CONFIRMED: 'tasks.similarityFlags.filterConfirmed',
    DISMISSED: 'tasks.similarityFlags.filterDismissed',
  };

  return (
    <section
      data-testid="similarity-flags-panel"
      aria-busy={loading}
      className="space-y-4 min-w-0"
    >
      <div
        role="status"
        aria-live="polite"
        data-testid="similarity-flags-live-region"
        className="sr-only"
      >
        {liveAnnouncement}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0 text-start">
          <h3
            ref={panelHeadingRef}
            tabIndex={-1}
            className="text-sm font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2 outline-none"
          >
            <ShieldAlert size={16} className="text-amber-500 shrink-0" aria-hidden="true" />
            <span>{t('tasks.similarityFlags.panelTitle')}</span>
          </h3>
          <p className="text-xs text-brand-text-secondary mt-0.5">
            {t('tasks.similarityFlags.panelSubtitle')}
          </p>
        </div>

        {!loading && !loadError && (
          <div
            role="group"
            aria-label={t('tasks.similarityFlags.filterLabel')}
            className="flex flex-wrap items-center gap-1.5"
          >
            {STATUS_FILTERS.map((filterValue) => {
              const active = statusFilter === filterValue;
              return (
                <button
                  key={filterValue}
                  type="button"
                  data-testid={`similarity-filter-${filterValue}`}
                  aria-pressed={active}
                  onClick={() => setStatusFilter(filterValue)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    active
                      ? 'bg-brand-primary-600 text-white border-brand-primary-600'
                      : 'bg-brand-bg-card text-brand-text-secondary border-brand-border hover:bg-surface-subtle'
                  }`}
                >
                  {t(filterLabelKeyMap[filterValue])}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {conflictAlert && (
        <div
          role="alert"
          data-testid="similarity-flags-conflict-alert"
          className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-200 text-start"
        >
          <AlertCircle size={15} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span className="break-words min-w-0 flex-1">{conflictAlert}</span>
        </div>
      )}

      {loading ? (
        <div
          data-testid="similarity-flags-loading"
          className="py-12 flex flex-col items-center justify-center gap-3"
        >
          <Loader2 className="animate-spin text-brand-primary-500" size={32} aria-hidden="true" />
          <p className="text-xs font-medium text-brand-text-secondary">
            {t('tasks.similarityFlags.loading')}
          </p>
        </div>
      ) : loadError ? (
        <div
          role="alert"
          data-testid="similarity-flags-load-error"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-xs text-rose-700 dark:text-rose-300 text-start"
        >
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span className="break-words min-w-0">{loadError}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="similarity-flags-retry-button"
            onClick={onRetry}
            className="text-xs font-semibold shrink-0 cursor-pointer"
          >
            <RefreshCw size={13} aria-hidden="true" />
            <span>{t('common.retry')}</span>
          </Button>
        </div>
      ) : flags.length === 0 ? (
        <div data-testid="similarity-flags-empty">
          <EmptyState
            title={t('tasks.similarityFlags.emptyTitle')}
            subtitle={t('tasks.similarityFlags.emptyDesc')}
            icon={<ShieldAlert size={36} />}
          />
        </div>
      ) : filteredFlags.length === 0 ? (
        <div data-testid="similarity-flags-filter-empty">
          <EmptyState
            title={t('tasks.similarityFlags.filterEmpty')}
            subtitle=""
            icon={<ShieldAlert size={36} />}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFlags.map((flag) => {
            const badgeMeta = getStatusBadgeMeta(flag.status);
            const activeDecision = inFlightMap[flag.id];
            const isInFlight = Boolean(activeDecision);
            const draft = draftNotes[flag.id] ?? '';
            const cardError = cardErrors[flag.id];
            const noteInputId = `similarity-note-${flag.id}`;
            const isPending = flag.status === 'PENDING';

            return (
              <article
                key={flag.id}
                data-testid={`similarity-flag-card-${flag.id}`}
                className="rounded-2xl border border-brand-border bg-brand-bg-card p-4 space-y-3 min-w-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 text-start">
                    <h4
                      ref={(el) => {
                        headingRefs.current[flag.id] = el;
                      }}
                      tabIndex={-1}
                      data-testid={`similarity-flag-heading-${flag.id}`}
                      className="text-sm font-bold text-brand-text-primary dark:text-brand-text-main break-words [overflow-wrap:anywhere] outline-none"
                    >
                      {t('tasks.similarityFlags.cardHeading', {
                        studentA: flag.submissionA.studentName,
                        studentB: flag.submissionB.studentName,
                      })}
                    </h4>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-brand-text-secondary">
                      <span>
                        {t('tasks.similarityFlags.similarityScoreLabel')}:{' '}
                        <span
                          data-testid={`similarity-flag-score-${flag.id}`}
                          className="font-bold text-brand-text-primary dark:text-brand-text-main tabular-nums"
                        >
                          <bdi dir="ltr">{formatSimilarityPercent(flag.similarityScore)}</bdi>
                        </span>
                      </span>
                      <span>
                        {t('tasks.similarityFlags.thresholdLabel')}:{' '}
                        <span
                          data-testid={`similarity-flag-threshold-${flag.id}`}
                          className="font-bold text-brand-text-primary dark:text-brand-text-main tabular-nums"
                        >
                          <bdi dir="ltr">{formatThresholdValue(flag.thresholdUsed)}</bdi>
                        </span>
                      </span>
                    </div>
                  </div>

                  <Badge
                    variant={badgeMeta.variant}
                    data-testid={`similarity-flag-status-${flag.id}`}
                    className="shrink-0"
                  >
                    {t(badgeMeta.labelKey)}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-w-0">
                  <SubmissionSideCard
                    label={t('tasks.similarityFlags.submissionALabel')}
                    side={flag.submissionA}
                    language={language}
                    t={t}
                  />
                  <SubmissionSideCard
                    label={t('tasks.similarityFlags.submissionBLabel')}
                    side={flag.submissionB}
                    language={language}
                    t={t}
                  />
                </div>

                {!isPending && (flag.reviewedAt || flag.reviewNote) && (
                  <div className="rounded-xl border border-brand-border bg-surface-subtle px-3 py-2 text-xs space-y-1 text-start">
                    {flag.reviewedAt && (
                      <div className="text-brand-text-muted tabular-nums">
                        {t('tasks.similarityFlags.reviewedAtLabel')}:{' '}
                        {formatLocaleDateTime(flag.reviewedAt, language)}
                      </div>
                    )}
                    {flag.reviewNote && (
                      <div className="text-brand-text-primary dark:text-brand-text-main break-words [overflow-wrap:anywhere]">
                        <span className="font-semibold text-brand-text-secondary">
                          {t('tasks.similarityFlags.savedNoteLabel')}:{' '}
                        </span>
                        {flag.reviewNote}
                      </div>
                    )}
                  </div>
                )}

                {isPending && (
                  <div className="pt-2 border-t border-brand-border space-y-2.5">
                    <div className="space-y-1 text-start">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor={noteInputId}
                          className="text-xs font-semibold text-brand-text-secondary"
                        >
                          {t('tasks.similarityFlags.reviewNoteLabel')}
                        </label>
                        <span
                          data-testid={`similarity-note-counter-${flag.id}`}
                          className="text-[11px] text-brand-text-muted tabular-nums shrink-0"
                        >
                          {t('tasks.similarityFlags.noteCounter', {
                            count: draft.length,
                            max: MAX_SIMILARITY_NOTE_LENGTH,
                          })}
                        </span>
                      </div>
                      <textarea
                        id={noteInputId}
                        rows={2}
                        maxLength={MAX_SIMILARITY_NOTE_LENGTH}
                        disabled={isInFlight}
                        value={draft}
                        onChange={(e) => {
                          const nextVal = e.target.value;
                          setDraftNotes((prev) => ({ ...prev, [flag.id]: nextVal }));
                        }}
                        placeholder={t('tasks.similarityFlags.reviewNotePlaceholder')}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-brand-border bg-surface-subtle text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500 disabled:opacity-50"
                      />
                    </div>

                    {cardError && (
                      <div
                        role="alert"
                        data-testid={`similarity-card-error-${flag.id}`}
                        className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 text-start"
                      >
                        <AlertCircle size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
                        <span className="break-words min-w-0 flex-1">{cardError}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isInFlight}
                        data-testid={`similarity-dismiss-${flag.id}`}
                        onClick={() => void handleDecide(flag, 'DISMISSED')}
                        className="text-xs font-bold cursor-pointer"
                      >
                        {activeDecision === 'DISMISSED' ? (
                          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <X size={14} aria-hidden="true" />
                        )}
                        <span>
                          {activeDecision === 'DISMISSED'
                            ? t('tasks.similarityFlags.dismissing')
                            : t('tasks.similarityFlags.dismissButton')}
                        </span>
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        disabled={isInFlight}
                        data-testid={`similarity-confirm-${flag.id}`}
                        onClick={() => void handleDecide(flag, 'CONFIRMED')}
                        className="text-xs font-bold bg-brand-primary-600 hover:bg-brand-primary-700 text-white cursor-pointer"
                      >
                        {activeDecision === 'CONFIRMED' ? (
                          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <Check size={14} aria-hidden="true" />
                        )}
                        <span>
                          {activeDecision === 'CONFIRMED'
                            ? t('tasks.similarityFlags.confirming')
                            : t('tasks.similarityFlags.confirmButton')}
                        </span>
                      </Button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default SimilarityFlagsPanel;
