import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import taskService from '../../services/task.service';
import coursesService from '../../services/courses.service';
import { TimelineEventItem } from './TimelineEventItem';
import { TimelineFilterBar } from './TimelineFilterBar';
import { Loader2, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import Button from '../ui/button';
import type { ApiResponse } from '../../types/models';

interface TimelineFeedProps {
  taskId?: number | string;
  courseId?: number | string;
  fetcher?: (params: any) => Promise<ApiResponse<any>>;
  emptyMessage?: string;
}

export const TimelineFeed: React.FC<TimelineFeedProps> = ({
  taskId,
  courseId,
  fetcher,
  emptyMessage,
}) => {
  const { t } = useTranslation();
  const [events, setEvents] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedEventType, setSelectedEventType] = useState<string>('ALL');

  const fetchTimeline = useCallback(
    async (cursor?: number | null, isInitial: boolean = false) => {
      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      try {
        const params: any = { limit: 10 };
        if (cursor) params.cursor = cursor;
        if (selectedSeverity !== 'ALL') params.severity = selectedSeverity;
        if (selectedEventType !== 'ALL') params.eventType = selectedEventType;

        let res: ApiResponse<any>;
        if (fetcher) {
          res = await fetcher(params);
        } else if (courseId) {
          res = await coursesService.getCourseTimeline(courseId, params);
        } else if (taskId) {
          res = await taskService.getTaskTimeline(taskId, params);
        } else {
          throw new Error('No target ID or fetcher provided for timeline');
        }

        if (res.success && res.data) {
          const newEvents = res.data.events || [];
          setEvents((prev) => (isInitial ? newEvents : [...prev, ...newEvents]));
          setNextCursor(res.data.pagination?.nextCursor ?? null);
          setHasMore(Boolean(res.data.pagination?.hasMore));
        } else {
          setError(res.message || t('timeline.loadError', 'Failed to load activity timeline.'));
        }
      } catch (err: any) {
        setError(
          err.response?.data?.message || t('timeline.loadError', 'Unable to retrieve activity timeline.')
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [taskId, courseId, fetcher, selectedSeverity, selectedEventType, t]
  );

  // Initial fetch or filter change
  useEffect(() => {
    fetchTimeline(null, true);
  }, [fetchTimeline]);

  const handleLoadMore = () => {
    if (hasMore && nextCursor && !loadingMore) {
      fetchTimeline(nextCursor, false);
    }
  };

  return (
    <div className="space-y-4 pt-1">
      {/* Filter Toolbar */}
      <TimelineFilterBar
        selectedSeverity={selectedSeverity}
        selectedEventType={selectedEventType}
        onSeverityChange={(sev) => setSelectedSeverity(sev)}
        onEventTypeChange={(evt) => setSelectedEventType(evt)}
      />

      {/* Initial Loading Skeleton */}
      {loading ? (
        <div className="space-y-4 py-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 rounded-2xl bg-surface-subtle dark:bg-slate-800/40 border border-brand-border animate-pulse space-y-3"
            >
              <div className="flex justify-between items-center">
                <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded-md" />
                <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded-md" />
              </div>
              <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-700 rounded-md" />
            </div>
          ))}
        </div>
      ) : error ? (
        /* Error State */
        <div className="text-center py-10 px-4 border-2 border-dashed border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/10 rounded-2xl space-y-3">
          <AlertCircle size={36} className="mx-auto text-rose-500" />
          <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
            {error}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => fetchTimeline(null, true)}
            className="text-xs font-bold gap-1.5 mx-auto"
          >
            <RefreshCw size={14} /> {t('timeline.retry', 'Retry Loading')}
          </Button>
        </div>
      ) : events.length === 0 ? (
        /* Empty State */
        <div className="text-center py-12 px-4 border-2 border-dashed border-brand-border rounded-2xl space-y-3">
          <Clock size={40} className="mx-auto text-brand-text-muted opacity-40" />
          <h4 className="text-sm font-bold text-brand-text-secondary">
            {t('timeline.noHistoryTitle', 'No Activity History')}
          </h4>
          <p className="text-xs text-brand-text-muted max-w-sm mx-auto">
            {emptyMessage || t('timeline.noHistoryDesc', 'No administrative history recorded for this target yet.')}
          </p>
        </div>
      ) : (
        /* Timeline Feed Stream */
        <div className="pt-2">
          {events.map((evt) => (
            <TimelineEventItem key={evt.id} event={evt} />
          ))}

          {/* Pagination Load More Button */}
          {hasMore && (
            <div className="pt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-6 py-2.5 text-xs font-bold gap-2 shadow-sm border-brand-border"
              >
                {loadingMore ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {t('timeline.loadingMore', 'Loading More History...')}
                  </>
                ) : (
                  t('timeline.loadMore', 'Load More History')
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
