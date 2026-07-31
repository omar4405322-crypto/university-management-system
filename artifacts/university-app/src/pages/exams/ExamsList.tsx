// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import examsService from '../../services/exams.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import useScope from '../../hooks/useScope';
import {
  Plus,
  Calendar,
  Clock,
  MapPin,
  Trash2,
  Eye,
  Loader2,
  FileText,
  CalendarCheck,
  CheckCircle2,
  Timer,
  ArrowUpDown,
  Play,
  GraduationCap,
} from 'lucide-react';
import Table, { TableRow, TableCell, TableHeader, TableHead, TableBody } from '../../components/ui/Table';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/button';
import { TimeRange } from '../../components/ui/TimeRange';
import FilterBar from '../../components/ui/FilterBar';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import { useToast } from '../../context/ToastContext';
import AddExamModal from './AddExamModal';
import { getExamStatus, getDaysUntil, getExamLabel, getTypeBadgeConfig, getExamTimeWindowStatus } from './examUtils';

// ── Main ExamsList Component ──────────────────────────────────────────────────
const ExamsList = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');
  const { user } = useAuth();
  const { scopeParams } = useScope();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user?.role || '');

  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Page background
  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.classList.add('bg-slate-50', 'dark:bg-slate-900');
    }
    return () => {
      if (mainEl) mainEl.classList.remove('bg-slate-50', 'dark:bg-slate-900');
    };
  }, []);

  // Fetch exams
  const fetchExams = async () => {
    try {
      setLoading(true);
      const params: any = { ...scopeParams };
      if (typeFilter !== 'ALL') params.type = typeFilter;

      const result = await examsService.getExams(params);
      if (result.success) {
        setExams(Array.isArray(result.data) ? result.data : result.data?.exams || []);
      }
    } catch (_err) {
      showToast(t('exams.loadError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, [typeFilter, scopeParams]);

  // Delete handler
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      const result = await examsService.deleteExam(deleteTarget.id);
      if (result.success) {
        showToast(t('exams.deleteSuccess'), 'success');
        setDeleteTarget(null);
        fetchExams();
      }
    } catch (_err) {
      showToast(t('exams.deleteError'), 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Computed stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = exams.length;
    let upcoming = 0;
    let today = 0;
    let completed = 0;
    exams.forEach((exam) => {
      const s = getExamStatus(exam);
      if (s === 'UPCOMING') upcoming++;
      else if (s === 'TODAY') today++;
      else completed++;
    });
    return { total, upcoming, today, completed };
  }, [exams]);

  // ── Filtered + sorted exams ─────────────────────────────────────────────────
  const displayExams = useMemo(() => {
    let list = [...exams];

    // Search filter
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter(
        (e) =>
          (e.course?.name || '').toLowerCase().includes(term) ||
          (e.course?.courseCode || '').toLowerCase().includes(term) ||
          (e.room || '').toLowerCase().includes(term)
      );
    }

    // Status filter - By default ('ALL'), show active/upcoming/today exams, as completed exams are archived in /record
    if (statusFilter === 'ALL') {
      list = list.filter((e) => getExamStatus(e) !== 'COMPLETED');
    } else {
      list = list.filter((e) => getExamStatus(e) === statusFilter);
    }

    // Sort
    list.sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return sortOrder === 'asc' ? da - db : db - da;
    });

    return list;
  }, [exams, search, statusFilter, sortOrder]);

  // ── Status badge renderer ───────────────────────────────────────────────────
  const renderStatusBadge = (exam: any) => {
    const status = getExamStatus(exam);
    const days = getDaysUntil(exam.date);

    if (status === 'TODAY') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          {t('exams.today')}
        </span>
      );
    }
    if (status === 'UPCOMING') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          <Timer className="w-3 h-3" />
          {days === 1 ? t('exams.inDay') : t('exams.inDays', { count: days })}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <CheckCircle2 className="w-3 h-3" />
        {t('exams.ended')}
      </span>
    );
  };

  // ── Type badge renderer ─────────────────────────────────────────────────────
  const renderTypeBadge = (type: string) => {
    const c = getTypeBadgeConfig(type, t);
    return <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${c.bg} ${c.text}`}>{c.label}</span>;
  };

  // ── Filter select class ─────────────────────────────────────────────────────
  const FILTER_SELECT =
    'h-10 px-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all cursor-pointer flex-shrink-0';

  return (
    <div className="section-gap animate-page">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <PageHeader
        title={t('exams.title')}
        subtitle={t('exams.subtitle')}
        action={
          isAdmin
            ? {
                label: t('exams.addExam'),
                onClick: () => setIsModalOpen(true),
                icon: Plus,
                className:
                  '!bg-brand-primary-500 !text-white !rounded-lg hover:!bg-brand-primary-600 hover:!scale-[1.02] active:!scale-[0.98] transition-all duration-200 border-none shadow-none',
              }
            : undefined
        }
      />

      {/* ── Archive Notice Banner ────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 shadow-sm">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="p-2.5 bg-indigo-500/15 rounded-xl text-indigo-600 dark:text-indigo-400">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-brand-text-primary dark:text-white">
              {t('exams.archivedInfoTitle') || 'أرشيف الامتحانات المنتهية'}
            </p>
            <p className="text-xs text-brand-text-secondary dark:text-slate-400">
              {t('exams.archivedInfoNotice') || 'تنتقل جميع الامتحانات المنتهية تلقائياً بعد انتهاء وقتها إلى السجل الأكاديمي للأرشفة الدائمة.'}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/record')}
          className="text-xs font-bold gap-2 rounded-xl border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/15 transition-all flex-shrink-0"
        >
          <span>{t('exams.goToRecord') || 'الذهاب إلى السجل الأكاديمي'}</span>
        </Button>
      </div>

      {/* ── Stats Row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
        {/* Total */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <div className="rounded-2xl p-3 bg-brand-primary-500/10 text-brand-primary-600 flex-shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-brand-text-secondary dark:text-slate-400 truncate">
              {t('exams.totalCount')}
            </span>
            <span className="text-2xl font-black text-brand-text-primary dark:text-white">{stats.total}</span>
          </div>
        </div>

        {/* Upcoming */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <div className="rounded-2xl p-3 bg-blue-500/10 text-blue-600 flex-shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-brand-text-secondary dark:text-slate-400 truncate">
              {t('exams.upcomingCount')}
            </span>
            <span className="text-2xl font-black text-brand-text-primary dark:text-white">{stats.upcoming}</span>
          </div>
        </div>

        {/* Today */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 relative overflow-hidden">
          {stats.today > 0 && (
            <div className="absolute top-0 start-0 w-full h-1 bg-gradient-to-r from-amber-400 to-amber-500 animate-pulse" />
          )}
          <div className="rounded-2xl p-3 bg-amber-500/10 text-amber-600 flex-shrink-0">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-brand-text-secondary dark:text-slate-400 truncate">
              {t('exams.todayCount')}
            </span>
            <span className="text-2xl font-black text-brand-text-primary dark:text-white">{stats.today}</span>
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <div className="rounded-2xl p-3 bg-slate-500/10 text-slate-500 flex-shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-brand-text-secondary dark:text-slate-400 truncate">
              {t('exams.completedCount')}
            </span>
            <span className="text-2xl font-black text-brand-text-primary dark:text-white">{stats.completed}</span>
          </div>
        </div>
      </div>

      {/* ── Filter Bar ───────────────────────────────────────────────────── */}
      <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-0 mb-6 overflow-hidden">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('exams.searchPlaceholder')}
          onClear={search || typeFilter !== 'ALL' || statusFilter !== 'ALL' ? () => { setSearch(''); setTypeFilter('ALL'); setStatusFilter('ALL'); } : undefined}
        >
          {/* Type filter */}
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={FILTER_SELECT}>
            <option value="ALL">{t('exams.filterAll')}</option>
            <option value="MIDTERM">{t('exams.filterMidterm')}</option>
            <option value="FINAL">{t('exams.filterFinal')}</option>
            <option value="QUIZ">{t('exams.filterQuiz')}</option>
          </select>

          {/* Status filter */}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={FILTER_SELECT}>
            <option value="ALL">{t('exams.allStatuses')}</option>
            <option value="UPCOMING">{t('exams.statusUpcoming')}</option>
            <option value="TODAY">{t('exams.statusToday')}</option>
            <option value="COMPLETED">{t('exams.statusCompleted')}</option>
          </select>

          {/* Sort toggle */}
          <button
            onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            className="h-10 px-3 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-brand-text-main hover:bg-slate-200 dark:hover:bg-slate-600 transition-all flex items-center gap-1.5 flex-shrink-0"
            title={sortOrder === 'asc' ? t('exams.sortDateAsc') : t('exams.sortDateDesc')}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sortOrder === 'asc' ? t('exams.sortDateAsc') : t('exams.sortDateDesc')}
          </button>
        </FilterBar>
      </Card>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-80 gap-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <Loader2 className="animate-spin text-brand-primary-500" size={44} />
          <p className="text-sm font-semibold text-brand-text-secondary dark:text-slate-400">{t('exams.fetching')}</p>
        </div>
      ) : displayExams.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-8">
          <EmptyState
            icon={<Calendar size={48} />}
            title={t('exams.noExams')}
            subtitle={t('exams.noExamsSubtitle')}
            action={
              isAdmin
                ? { label: t('exams.addExam'), onClick: () => setIsModalOpen(true) }
                : null
            }
          />
        </div>
      ) : (
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700">
                <TableRow>
                  <TableHead className="text-start p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t('exams.examColumn')}
                  </TableHead>
                  <TableHead className="text-center p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t('exams.typeColumn')}
                  </TableHead>
                  <TableHead className="text-start p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t('exams.courseColumn')}
                  </TableHead>
                  <TableHead className="text-center p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t('exams.dateTimeColumn')}
                  </TableHead>
                  <TableHead className="text-center p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t('exams.roomColumn')}
                  </TableHead>
                  <TableHead className="text-center p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t('exams.statusColumn')}
                  </TableHead>
                  <TableHead className="text-end p-4 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 pe-6">
                    {t('exams.actionsColumn')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayExams.map((exam) => {
                  const status = getExamStatus(exam);
                  return (
                    <TableRow
                      key={exam.id}
                      className={`border-b border-slate-100 dark:border-slate-700/50 last:border-b-0 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/60 cursor-pointer ${
                        status === 'TODAY'
                          ? 'bg-amber-50/40 dark:bg-amber-950/10 border-s-2 border-s-amber-400'
                          : status === 'COMPLETED'
                          ? 'opacity-70'
                          : ''
                      }`}
                      onClick={() => navigate(`/exams/${exam.id}`)}
                    >
                      {/* Exam Name */}
                      <TableCell className="p-4 text-start">
                        <div className="font-semibold text-brand-text-primary dark:text-white text-sm">
                          {getExamLabel(exam, t)}
                        </div>
                        <div className="text-xs text-brand-text-secondary dark:text-slate-400 mt-0.5">
                          {exam.course?.name}
                        </div>
                      </TableCell>

                      {/* Type Badge */}
                      <TableCell className="p-4 text-center">{renderTypeBadge(exam.type)}</TableCell>

                      {/* Course Code */}
                      <TableCell className="p-4 text-start">
                        <span className="font-bold text-brand-text-primary dark:text-white text-sm">
                          {exam.course?.courseCode}
                        </span>
                      </TableCell>

                      {/* Date & Time */}
                      <TableCell className="p-4 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-sm font-semibold text-brand-text-primary dark:text-white flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {new Date(exam.date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          <span className="text-xs text-brand-text-secondary dark:text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <TimeRange start={exam.startTime} end={exam.endTime} />
                          </span>
                        </div>
                      </TableCell>

                      {/* Room */}
                      <TableCell className="p-4 text-center">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-text-primary dark:text-white">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {exam.room || t('exams.tba')}
                        </span>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="p-4 text-center">{renderStatusBadge(exam)}</TableCell>

                      {/* Actions */}
                      <TableCell className="p-4 text-end pe-6">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          {user?.role === 'STUDENT' ? (
                            (() => {
                              const twStatus = getExamTimeWindowStatus(exam);
                              if (twStatus === 'NOT_STARTED') {
                                return (
                                  <Button
                                    size="sm"
                                    onClick={() => navigate(`/exams/${exam.id}`)}
                                    className="!bg-slate-100 dark:!bg-slate-700 !text-slate-500 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 border-none shrink-0"
                                  >
                                    <Clock className="w-3.5 h-3.5" />
                                    {t('exams.btnNotStarted', { time: exam.startTime })}
                                  </Button>
                                );
                              }
                              if (twStatus === 'EXPIRED') {
                                return (
                                  <Button
                                    size="sm"
                                    onClick={() => navigate(`/exams/${exam.id}`)}
                                    className="!bg-rose-50 dark:!bg-rose-950/40 !text-rose-600 dark:!text-rose-400 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 border-none shrink-0"
                                  >
                                    <Clock className="w-3.5 h-3.5 text-rose-500" />
                                    {t('exams.btnExpired')}
                                  </Button>
                                );
                              }
                              return (
                                <Button
                                  size="sm"
                                  onClick={() => navigate(`/exams/${exam.id}`)}
                                  className="!bg-brand-primary-500 hover:!bg-brand-primary-600 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-sm border-none shrink-0"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                  {t('exams.btnStartExam')}
                                </Button>
                              );
                            })()
                          ) : (
                            <button
                              onClick={() => navigate(`/exams/${exam.id}`)}
                              className="p-2 rounded-xl text-brand-primary-600 hover:bg-brand-primary-500/10 transition-all"
                              title={t('common.view')}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          {isSuperAdmin && (
                            <button
                              onClick={() =>
                                setDeleteTarget({
                                  id: exam.id,
                                  name: `${getExamLabel(exam.type, t)} — ${exam.course?.courseCode || ''}`,
                                })
                              }
                              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
                              title={t('common.delete')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        itemName={deleteTarget?.name}
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
      />

      <AddExamModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={() => { fetchExams(); showToast(t('exams.createSuccess'), 'success'); }} />
    </div>
  );
};

export default ExamsList;
