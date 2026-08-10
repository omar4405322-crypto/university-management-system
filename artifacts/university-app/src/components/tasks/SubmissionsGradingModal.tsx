import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Loader2,
  Search,
} from 'lucide-react';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import Button from '../ui/button';
import taskService, {
  SubmissionsStatus,
} from '../../services/task.service';
import { EmptyState } from '../ui/EmptyState';

type StudentT = {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  year: number;
};

type SubmissionT = {
  id: number;
  studentId: number;
  fileUrl: string | null;
  score: number | null;
  submittedAt: string;
  notes: string | null;
  feedback: string | null;
};

type SubmissionRowT = {
  key: string;
  student: StudentT;
  submission: SubmissionT | null;
  isSubmitted: boolean;
  isGraded: boolean;
  isLate: boolean;
  notSubmitted: boolean;
};

type PaginationT = {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
};

type SummaryT = {
  totalEnrolled: number;
  submitted: number;
  graded: number;
  ungraded: number;
  late: number;
  notSubmitted: number;
};

export type SubmissionsGradingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  task: {
    id: number | string;
    title: string;
    maxScore: number;
    dueDate?: string | Date;
    course?: { id?: number | string; name?: string; year?: number | null } | null;
  } | null;
  onGradeSaved?: (updatedSubmission: unknown) => void;
};

const STATUS_OPTIONS: { value: SubmissionsStatus; labelKey: string; badgeVariant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' }[] = [
  { value: 'ALL', labelKey: 'tasks.statusAll', badgeVariant: 'default' },
  { value: 'SUBMITTED', labelKey: 'tasks.statusSubmitted', badgeVariant: 'info' },
  { value: 'GRADED', labelKey: 'tasks.statusGraded', badgeVariant: 'success' },
  { value: 'UNGRADED', labelKey: 'tasks.statusUngraded', badgeVariant: 'warning' },
  { value: 'LATE', labelKey: 'tasks.statusLate', badgeVariant: 'danger' },
  { value: 'NOT_SUBMITTED', labelKey: 'tasks.statusNotSubmitted', badgeVariant: 'neutral' },
];

const PER_PAGE_OPTIONS = [25, 50, 100];

const formatDate = (d: string | Date | null | undefined): string => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleString();
  } catch {
    return '';
  }
};

function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ---------- Per-row component: isolated local state prevents parent-object setState re-render explosion ----------
type SubmissionRowProps = {
  row: SubmissionRowT;
  maxScore: number;
  taskId: number | string;
  onGradeSaved: (submissionId: number, updated: unknown) => void;
};

const SubmissionRow = memo(function SubmissionRowImpl({
  row,
  maxScore,
  taskId,
  onGradeSaved,
}: SubmissionRowProps) {
  const { t } = useTranslation();
  const sub = row.submission;
  const [score, setScore] = useState<string>(
    sub && sub.score != null ? String(sub.score) : ''
  );
  const [feedback, setFeedback] = useState<string>(sub?.feedback ?? '');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<boolean>(!!(sub && sub.score != null));

  // Keep row controlled state in sync if the row's submission changes externally
  useEffect(() => {
    setScore(sub && sub.score != null ? String(sub.score) : '');
    setFeedback(sub?.feedback ?? '');
    setLastSaved(!!(sub && sub.score != null));
  }, [sub?.id, sub?.score, sub?.feedback]);

  const parsedScore = score ? parseFloat(score) : NaN;
  const scoreError =
    !Number.isNaN(parsedScore) && parsedScore > maxScore
      ? t('tasks.scoreExceedsMax', { maxScore })
      : undefined;

  const canSave =
    row.isSubmitted &&
    !saving &&
    !scoreError &&
    !(lastSaved && score === String(sub?.score ?? '') && feedback === (sub?.feedback ?? ''));

  const handleSave = useCallback(async () => {
    if (!row.submission || saving || scoreError) return;
    setSaving(true);
    try {
      const res = await taskService.gradeSubmission(
        taskId,
        row.submission.id,
        {
          score: Number.isNaN(parsedScore) ? 0 : parsedScore,
          feedback: feedback || null,
        }
      );
      if (res?.success && res?.data) {
        setLastSaved(true);
        onGradeSaved(row.submission!.id, res.data);
      }
    } finally {
      setSaving(false);
    }
  }, [row.submission, saving, scoreError, taskId, parsedScore, feedback, onGradeSaved]);

  let statusBadgeVariant: 'success' | 'warning' | 'neutral' | 'danger' | 'info' = 'neutral';
  let statusBadgeLabel = '';
  if (row.notSubmitted) {
    statusBadgeVariant = 'neutral';
    statusBadgeLabel = t('tasks.statusNotSubmitted');
  } else if (row.isGraded) {
    statusBadgeVariant = 'success';
    statusBadgeLabel = t('tasks.statusGraded', {
      score: sub?.score ?? 0,
      maxScore,
    });
  } else if (row.isLate) {
    statusBadgeVariant = 'danger';
    statusBadgeLabel = t('tasks.statusLate');
  } else {
    statusBadgeVariant = 'warning';
    statusBadgeLabel = t('tasks.notGradedYet');
  }

  return (
    <div className="py-4 flex flex-col lg:flex-row lg:items-start justify-between gap-4">
      <div className="lg:max-w-[40%]">
        <h4 className="font-bold text-sm text-brand-text-primary dark:text-brand-text-main">
          {row.student.firstName} {row.student.lastName} ({row.student.studentId})
        </h4>
        <p className="text-[10px] text-brand-text-muted mt-0.5">
          {t('tasks.studyYearN', { n: row.student.year })}
          {row.isSubmitted && sub ? (
            <>
              {' · '}
              {t('tasks.submittedAt', { date: formatDate(sub.submittedAt) })}
            </>
          ) : row.notSubmitted ? (
            <>
              {' · '}
              <span className="text-rose-500 font-bold">{t('tasks.statusNotSubmitted')}</span>
            </>
          ) : null}
        </p>
        {sub?.notes && (
          <p className="text-xs text-brand-text-sub mt-2">{sub.notes}</p>
        )}
        {sub?.fileUrl && (
          <a
            href={sub.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-brand-primary-500 hover:underline font-bold inline-flex items-center gap-1 mt-2"
          >
            <FileUp size={14} /> {t('tasks.uploadedFile')}
          </a>
        )}
      </div>

      <div className="flex-1 lg:pl-4 lg:border-l lg:border-brand-border space-y-3">
        {row.notSubmitted ? (
          <div className="rounded-xl border border-dashed border-brand-border bg-surface-subtle px-4 py-3 text-center">
            <p className="text-xs font-bold text-brand-text-muted">
              {t('tasks.statusNotSubmitted')}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-brand-text-muted mb-1">
                  {t('tasks.grade')} (0 - {maxScore})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={maxScore}
                    step={0.01}
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    disabled={saving}
                    className={`w-full px-3 py-2 text-sm rounded-xl border ${
                      scoreError
                        ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/20 focus:ring-rose-400'
                        : 'border-brand-border bg-brand-bg-card focus:ring-brand-primary-500'
                    } focus:outline-none focus:ring-2`}
                    placeholder={`0 / ${maxScore}`}
                  />
                </div>
                {scoreError && (
                  <p className="mt-1 text-[10px] font-bold text-rose-600 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {scoreError}
                  </p>
                )}
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-brand-text-muted mb-1">
                    {t('tasks.statusSubmitted')}
                  </label>
                  <Badge
                    variant={statusBadgeVariant as any}
                    className="text-[10px] w-full justify-center"
                  >
                    {statusBadgeLabel}
                  </Badge>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-brand-text-muted mb-1">
                {t('tasks.feedback')}
              </label>
              <textarea
                rows={2}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                disabled={saving}
                className="w-full px-3 py-2 text-xs rounded-xl border border-brand-border bg-brand-bg-card focus:ring-2 focus:ring-brand-primary-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={!canSave}
                className="text-[10px] font-black uppercase tracking-widest py-2 px-4 shadow-md shadow-brand-primary-500/20"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <CheckCircle size={14} />
                )}
                {saving ? t('common.loading') : t('tasks.saveGrade')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

// ---------- Main shared modal ----------
const SubmissionsGradingModal: React.FC<SubmissionsGradingModalProps> = ({
  isOpen,
  onClose,
  task,
  onGradeSaved,
}) => {
  const { t } = useTranslation();

  // Filter state (kept inside modal, resets on task change)
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [status, setStatus] = useState<SubmissionsStatus>('ALL');
  const [studentYear, setStudentYear] = useState<number | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(25);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<SubmissionRowT[]>([]);
  const [pagination, setPagination] = useState<PaginationT | null>(null);
  const [summary, setSummary] = useState<SummaryT | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset to page 1 + apply defaultCourseYear when task changes or modal opens
  useEffect(() => {
    if (isOpen && task) {
      setPage(1);
      setSearchInput('');
      setStatus('ALL');
      setLimit(25);
      // Default study year filter to the course's own year (Item 4 Option A requirement)
      setStudentYear(task.course?.year ?? 'ALL');
    }
  }, [isOpen, task?.id, task?.course?.year]);

  const fetchData = useCallback(async () => {
    if (!task) return;
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { page, limit, status };
      if (debouncedSearch) params.search = debouncedSearch;
      if (studentYear !== 'ALL') params.studentYear = Number(studentYear);
      const res = await taskService.getTaskSubmissions(task.id, params as any);
      if (res?.success && res?.data) {
        setRows(res.data.rows ?? []);
        setPagination(res.data.pagination ?? null);
        setSummary(res.data.summary ?? null);
      } else {
        setRows([]);
        setPagination(null);
        setSummary(null);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load submissions');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [task?.id, page, limit, status, debouncedSearch, studentYear]);

  useEffect(() => {
    if (isOpen && task) fetchData();
  }, [isOpen, task?.id, fetchData]);

  const handleGradeSavedInRow = useCallback(
    (submissionId: number, updated: unknown) => {
      // Update local row to reflect saved state so badge updates immediately
      setRows((prev) =>
        prev.map((r) => {
          if (r.submission && r.submission.id === submissionId) {
            const mergedSub = { ...r.submission, ...(updated as object) };
            return {
              ...r,
              submission: mergedSub as SubmissionT,
              isGraded:
                (mergedSub as SubmissionT).score != null ? true : r.isGraded,
            };
          }
          return r;
        })
      );
      onGradeSaved?.(updated);
      // Update summary counters incrementally: if this was a newly graded submission, bump graded + reduce ungraded
      setSummary((prevS) => {
        if (!prevS) return prevS;
        const wasUngradedBefore = prevS.graded < (prevS.submitted || 0);
        if (!wasUngradedBefore) return prevS;
        return {
          ...prevS,
          graded: Math.min(prevS.submitted, prevS.graded + 1),
          ungraded: Math.max(0, prevS.ungraded - 1),
        };
      });
    },
    [onGradeSaved]
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (!pagination) return;
      const clamped = Math.min(
        Math.max(1, nextPage),
        pagination.totalPages
      );
      if (clamped !== page) setPage(clamped);
    },
    [page, pagination]
  );

  const handleLimitChange = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  }, []);

  const maxScore = task?.maxScore ?? 100;
  const totalPages = pagination?.totalPages ?? 1;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      title={
        task ? `${t('tasks.gradeSubmissions')} — ${task.title}` : t('tasks.gradeSubmissions')
      }
      subtitle={
        task?.course?.name
          ? `${task.course.name} · ${t('tasks.maxPoints')}: ${maxScore}`
          : task ? `${t('tasks.maxPoints')}: ${maxScore}` : undefined
      }
    >
      {/* Summary bar */}
      {summary && (
        <div className="mb-4 p-4 rounded-2xl bg-surface-subtle dark:bg-slate-800/50 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { labelKey: 'common.enrolled', count: summary.totalEnrolled, color: 'text-brand-navy-500' },
            { labelKey: 'tasks.statusSubmitted', count: summary.submitted, color: 'text-sky-600' },
            { labelKey: 'tasks.statusGraded', count: summary.graded, color: 'text-emerald-600' },
            { labelKey: 'tasks.statusUngraded', count: summary.ungraded, color: 'text-amber-600' },
            { labelKey: 'tasks.statusLate', count: summary.late, color: 'text-rose-600' },
            { labelKey: 'tasks.statusNotSubmitted', count: summary.notSubmitted, color: 'text-slate-500' },
          ].map(({ labelKey, count, color }) => (
            <div key={labelKey} className="flex flex-col">
              <span className={`text-xl font-black ${color}`}>{count}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted">
                {t(labelKey)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Filters bar */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-muted"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            placeholder={t('tasks.searchSubmissions')}
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-brand-border bg-brand-bg-card focus:outline-none focus:ring-2 focus:ring-brand-primary-500"
          />
        </div>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as SubmissionsStatus);
            setPage(1);
          }}
          className="px-3 py-2.5 text-sm rounded-xl border border-brand-border bg-brand-bg-card focus:outline-none focus:ring-2 focus:ring-brand-primary-500"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.labelKey)}
            </option>
          ))}
        </select>

        <select
          value={String(studentYear)}
          onChange={(e) => {
            setStudentYear(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value));
            setPage(1);
          }}
          className="px-3 py-2.5 text-sm rounded-xl border border-brand-border bg-brand-bg-card focus:outline-none focus:ring-2 focus:ring-brand-primary-500"
          title={t('tasks.studyYear')}
        >
          <option value="ALL">{t('tasks.studyYearAll')}</option>
          {[1, 2, 3, 4, 5, 6].map((y) => (
            <option key={y} value={y}>
              {t('tasks.studyYearN', { n: y })}
            </option>
          ))}
        </select>

        <select
          value={limit}
          onChange={(e) => handleLimitChange(Number(e.target.value))}
          className="px-3 py-2.5 text-sm rounded-xl border border-brand-border bg-brand-bg-card focus:outline-none focus:ring-2 focus:ring-brand-primary-500 min-w-[110px]"
        >
          {PER_PAGE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} / {t('tasks.perPage')}
            </option>
          ))}
        </select>
      </div>

      {/* Rows list */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-brand-primary-500" size={36} />
          <p className="label-stat">{t('common.loading')}</p>
        </div>
      ) : error ? (
        <div className="py-10 text-center text-sm text-rose-600 font-bold">{error}</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={t('tasks.noSubmissions')}
          subtitle=""
          icon={<AlertCircle size={40} />}
        />
      ) : (
        <div className="divide-y divide-brand-border">
          {rows.map((row) => (
            <SubmissionRow
              key={row.key}
              row={row}
              maxScore={maxScore}
              taskId={task!.id}
              onGradeSaved={handleGradeSavedInRow}
            />
          ))}
        </div>
      )}

      {/* Pagination controls */}
      {pagination && !loading && pagination.totalCount > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs font-bold text-brand-text-secondary">
            {t('tasks.pagination', {
              page: pagination.page,
              totalPages: pagination.totalPages,
              totalCount: pagination.totalCount,
            })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
              className="py-1.5 px-2"
            >
              <ChevronLeft size={16} />
            </Button>
            <div className="text-xs font-bold text-brand-text-secondary min-w-[80px] text-center">
              {pagination.page} / {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
              className="py-1.5 px-2"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default SubmissionsGradingModal;
