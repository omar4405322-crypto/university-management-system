import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckSquare,
  AlertCircle,
  RotateCcw,
  Calendar,
  BookOpen,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import enrollmentService from '../../services/enrollment.service';
import {
  formatGradeNumber,
  mapMyGradesError,
  resolveComponentDisplay,
  resolveCourseTotalsDisplay,
  groupMyGradesByTerm,
} from '../../utils/gradebook.utils';
import type { StudentCourseGradeItem } from '../../types/gradebook';
import Button from '../../components/ui/button';
import Badge from '../../components/ui/badge';
import LoadingState from '../../components/ui/LoadingState';

const MyGradesPage: React.FC = () => {
  const { t } = useTranslation();

  const [loading, setLoading] = useState<boolean>(true);
  const [items, setItems] = useState<StudentCourseGradeItem[]>([]);
  const [pageError, setPageError] = useState<{
    status?: number;
    titleKey: string;
    descKey: string;
  } | null>(null);

  const fetchingRef = useRef<boolean>(false);

  const fetchMyGrades = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setPageError(null);

    try {
      const res = await enrollmentService.getMyGrades();

      if (!res.success) {
        const status = res.status;
        const descKey = mapMyGradesError(res.message, status);
        let titleKey = 'myGrades.errors.genericTitle';
        if (status === 401 || descKey === 'myGrades.errors.unauthorized') {
          titleKey = 'myGrades.errors.unauthorizedTitle';
        } else if (status === 403 || descKey === 'myGrades.errors.forbidden') {
          titleKey = 'myGrades.errors.forbiddenTitle';
        } else if (status === 404 || descKey === 'myGrades.errors.studentNotFound') {
          titleKey = 'myGrades.errors.studentNotFoundTitle';
        }

        setPageError({
          status,
          titleKey,
          descKey,
        });
        setItems([]);
        return;
      }

      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err: unknown) {
      const descKey = mapMyGradesError(err);
      setPageError({
        titleKey: 'myGrades.errors.genericTitle',
        descKey,
      });
      setItems([]);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyGrades();
  }, [fetchMyGrades]);

  const termGroups = useMemo(() => groupMyGradesByTerm(items), [items]);

  const isEmpty = useMemo(() => items.length === 0, [items]);

  if (pageError) {
    return (
      <div
        data-my-grades-error="true"
        data-error-status={pageError.status ?? 'unknown'}
        className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300"
      >
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
          <AlertCircle size={32} />
        </div>
        <h2
          data-error-title="true"
          className="text-xl sm:text-2xl font-black text-brand-text-primary dark:text-brand-text-main mb-2"
        >
          {t(pageError.titleKey)}
        </h2>
        <p
          data-error-description="true"
          className="text-sm text-brand-text-secondary dark:text-brand-text-sub max-w-md mb-6 font-medium"
        >
          {t(pageError.descKey)}
        </p>
        <Button
          type="button"
          data-retry-button="true"
          onClick={fetchMyGrades}
          variant="default"
          size="default"
          className="rounded-xl flex items-center gap-2"
        >
          <RotateCcw size={16} />
          <span>{t('myGrades.retry')}</span>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div data-my-grades-loading="true" className="min-h-[60vh] flex items-center justify-center">
        <LoadingState message={t('common.loading', 'Loading...')} />
      </div>
    );
  }

  return (
    <div
      data-my-grades-page="true"
      className="space-y-6 max-w-full overflow-hidden animate-in fade-in duration-300 pb-12"
    >
      {/* Page Title Header (No KPI Header) */}
      <div className="border-b border-brand-border/60 pb-5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="p-2 rounded-xl bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400 shrink-0">
            <CheckSquare size={20} />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-brand-text-primary dark:text-brand-text-main truncate">
              {t('myGrades.title')}
            </h1>
            <p className="text-xs text-brand-text-secondary dark:text-brand-text-sub font-medium mt-0.5 truncate">
              {t('myGrades.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {isEmpty ? (
        <div
          data-my-grades-empty="true"
          className="bg-surface-card rounded-2xl border border-brand-border p-8 sm:p-12 text-center space-y-3"
        >
          <div className="w-12 h-12 rounded-2xl bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400 flex items-center justify-center mx-auto">
            <BookOpen size={24} />
          </div>
          <h2 className="text-base sm:text-lg font-black text-brand-text-primary dark:text-brand-text-main">
            {t('myGrades.emptyTitle')}
          </h2>
          <p className="text-xs sm:text-sm text-brand-text-sub max-w-md mx-auto font-medium">
            {t('myGrades.emptyDesc')}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {termGroups.map((group) => (
            <section
              key={group.termKey}
              data-term-group="true"
              data-term-id={group.termId ?? ''}
              className="space-y-4"
            >
              {group.termName && (
                <div className="flex items-center gap-2 px-1">
                  <Calendar size={16} className="text-brand-primary-500 shrink-0" />
                  <h2
                    data-term-name="true"
                    className="text-sm sm:text-base font-black text-brand-text-primary dark:text-brand-text-main"
                  >
                    {group.termName}
                  </h2>
                </div>
              )}

              <div className="space-y-4">
                {group.courses.map((courseItem) => {
                  const totals = resolveCourseTotalsDisplay(courseItem);
                  const hasPassMark =
                    courseItem.passMark !== null &&
                    courseItem.passMark !== undefined &&
                    Number.isFinite(courseItem.passMark);

                  return (
                    <article
                      key={courseItem.enrollmentId}
                      data-course-card="true"
                      data-enrollment-id={courseItem.enrollmentId}
                      data-course-id={courseItem.courseId}
                      className="bg-surface-card rounded-2xl border border-brand-border shadow-xs overflow-hidden"
                    >
                      {/* Course Card Header */}
                      <div className="p-4 sm:p-5 border-b border-brand-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-subtle/30">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {courseItem.course?.code && (
                              <Badge
                                variant="primary"
                                data-course-code="true"
                                className="text-xs font-bold uppercase shrink-0"
                              >
                                {courseItem.course.code}
                              </Badge>
                            )}
                            <h3
                              data-course-name="true"
                              className="text-sm sm:text-base font-black text-brand-text-primary dark:text-brand-text-main break-words"
                            >
                              {courseItem.course?.name}
                            </h3>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-brand-text-sub shrink-0">
                          {courseItem.course?.credits !== undefined &&
                            courseItem.course?.credits !== null && (
                              <span
                                data-course-credits="true"
                                className="px-2.5 py-1 rounded-lg bg-surface-card border border-brand-border/80"
                              >
                                {t('myGrades.creditsLabel')}:{' '}
                                <span className="font-mono text-brand-text-primary dark:text-brand-text-main">
                                  {formatGradeNumber(courseItem.course.credits)}
                                </span>
                              </span>
                            )}
                          {hasPassMark && (
                            <span
                              data-course-passmark="true"
                              className="px-2.5 py-1 rounded-lg bg-surface-card border border-brand-border/80"
                            >
                              {t('myGrades.passMarkLabel')}:{' '}
                              <span className="font-mono text-brand-text-primary dark:text-brand-text-main">
                                {formatGradeNumber(courseItem.passMark)}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Components Table or Empty Structure State */}
                      {courseItem.components && courseItem.components.length > 0 ? (
                        <div className="w-full overflow-hidden">
                          <table
                            data-components-table="true"
                            className="w-full table-fixed border-collapse text-start"
                          >
                            <thead className="bg-surface-subtle/50 border-b border-brand-border/60">
                              <tr>
                                <th
                                  scope="col"
                                  className="w-[52%] px-3 sm:px-5 py-2.5 text-[11px] font-black text-brand-text-sub uppercase tracking-wider text-start"
                                >
                                  {t('myGrades.columns.component')}
                                </th>
                                <th
                                  scope="col"
                                  className="w-[20%] px-2 sm:px-4 py-2.5 text-[11px] font-black text-brand-text-sub uppercase tracking-wider text-start"
                                >
                                  {t('myGrades.columns.maxPoints')}
                                </th>
                                <th
                                  scope="col"
                                  className="w-[28%] px-3 sm:px-5 py-2.5 text-[11px] font-black text-brand-text-sub uppercase tracking-wider text-end"
                                >
                                  {t('myGrades.columns.score')}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-border/40">
                              {courseItem.components.map((comp) => {
                                const display = resolveComponentDisplay(comp);

                                return (
                                  <tr
                                    key={comp.componentId}
                                    data-component-row="true"
                                    data-component-id={comp.componentId}
                                    className="hover:bg-surface-subtle/30 transition-colors"
                                  >
                                    <td className="px-3 sm:px-5 py-3 text-xs align-middle break-words">
                                      <div className="font-bold text-brand-text-primary dark:text-brand-text-main break-words">
                                        <span data-component-name="true">{comp.name}</span>
                                        {comp.nameAr && comp.nameAr !== comp.name && (
                                          <span
                                            data-component-name-ar="true"
                                            className="block text-[11px] font-medium text-brand-text-sub mt-0.5"
                                          >
                                            {comp.nameAr}
                                          </span>
                                        )}
                                      </div>
                                      <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-surface-subtle text-[10px] font-semibold text-brand-text-sub">
                                        {t(`myGrades.sources.${comp.source}`)}
                                      </span>
                                    </td>

                                    <td
                                      data-component-max-points="true"
                                      className="px-2 sm:px-4 py-3 text-xs font-mono font-bold text-brand-text-sub align-middle"
                                    >
                                      {display.maxPointsText}
                                    </td>

                                    <td
                                      data-component-result="true"
                                      className="px-3 sm:px-5 py-3 text-xs align-middle text-end"
                                    >
                                      {display.state === 'PUBLISHED_SCORE' && (
                                        <span
                                          data-component-score="true"
                                          className="font-mono font-black text-brand-text-primary dark:text-brand-text-main"
                                        >
                                          {display.scoreText}
                                        </span>
                                      )}
                                      {display.state === 'ABSENT' && (
                                        <span
                                          data-component-absent="true"
                                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                                        >
                                          {t('myGrades.absent')}
                                        </span>
                                      )}
                                      {display.state === 'PENDING' && (
                                        <span
                                          data-component-pending="true"
                                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                                        >
                                          <Clock size={11} className="shrink-0" />
                                          <span>{t('myGrades.pendingPublication')}</span>
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div
                          data-course-no-components="true"
                          className="p-6 text-center text-xs font-semibold text-brand-text-sub bg-surface-subtle/10 flex items-center justify-center gap-2"
                        >
                          <Clock size={14} className="shrink-0 text-amber-500/80" />
                          <span>{t('myGrades.noComponentsYet')}</span>
                        </div>
                      )}

                      {/* Course Totals & Outcome Footer */}
                      <div className="p-4 sm:p-5 border-t border-brand-border/60 bg-surface-subtle/20">
                        {totals.isComplete ? (
                          <div
                            data-course-totals-complete="true"
                            className="flex flex-wrap items-center justify-between gap-3"
                          >
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="px-3 py-1.5 rounded-xl bg-surface-card border border-brand-border text-xs font-bold text-brand-text-sub">
                                <span>{t('myGrades.totalLabel')}: </span>
                                <span
                                  data-course-total="true"
                                  className="font-mono font-black text-brand-text-primary dark:text-brand-text-main"
                                >
                                  {totals.totalPointsText}
                                </span>
                              </div>
                              <div className="px-3 py-1.5 rounded-xl bg-surface-card border border-brand-border text-xs font-bold text-brand-text-sub">
                                <span>{t('myGrades.percentageLabel')}: </span>
                                <span
                                  data-course-percentage="true"
                                  className="font-mono font-black text-brand-text-primary dark:text-brand-text-main"
                                >
                                  {totals.percentageText}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-brand-text-sub">
                                {t('myGrades.statusLabel')}:
                              </span>
                              <span
                                data-course-status="true"
                                data-status-value={totals.status ?? ''}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${
                                  totals.status === 'COMPLETED'
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                    : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                                }`}
                              >
                                {totals.status === 'COMPLETED' ? (
                                  <CheckCircle2 size={13} className="shrink-0" />
                                ) : (
                                  <XCircle size={13} className="shrink-0" />
                                )}
                                <span>{totals.statusKey ? t(totals.statusKey) : ''}</span>
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div
                            data-course-totals-pending="true"
                            className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300"
                          >
                            <Clock size={14} className="shrink-0" />
                            <span>{t('myGrades.totalsPending')}</span>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyGradesPage;

