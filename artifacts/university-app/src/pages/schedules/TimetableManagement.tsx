// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle,
  Building2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Grid,
  List,
  Eye,
  Plus,
  BookOpen,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Table, { TableRow, TableCell, TableHeader, TableBody, TableHead } from '../../components/ui/Table';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import FilterBar from '../../components/ui/FilterBar';
import timetableService from '../../services/timetable.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import useScope from '../../hooks/useScope';
import { PageHeader } from '../../components/ui/PageHeader';
import TimetableModal from './TimetableModal';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';

const TimetableManagement = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { scopeParams, isCollegeAdmin } = useScope();
  const isRTL = i18n.language?.startsWith('ar');
  const navigate = useNavigate();

  // Page background setup
  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.classList.add('bg-slate-50', 'dark:bg-slate-900');
      return () => {
        mainEl.classList.remove('bg-slate-50', 'dark:bg-slate-900');
      };
    }
  }, []);

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timetables, setTimetables] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [_colleges, setColleges] = useState([]);
  const [_departments, setDepartments] = useState([]);

  // Filters & Views
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('LIST');

  // UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTimetable, setEditingTimetable] = useState(null);
  const { showToast } = useToast();

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canManage = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(
        user?.role
  );

  const fetchInitialData = async () => {
    try {
      const collegesRes = await collegeService.getColleges();
      if (collegesRes.success) {
        setColleges(Array.isArray(collegesRes.data) ? collegesRes.data : []);
      }
    } catch (err: any) {
      logger.error('Error fetching colleges:', err);
    }
  };

  const fetchDepartments = async (collegeId) => {
    if (!collegeId) {
      setDepartments([]);
      return;
    }
    try {
      const result = await departmentService.getDepartments({ collegeId });
      if (result.success) {
        setDepartments(Array.isArray(result.data) ? result.data : []);
      }
    } catch (err: any) {
      logger.error('Error fetching departments:', err);
    }
  };

  const fetchTimetables = useCallback(
    async (pageParam = currentPage) => {
      const pageNum = typeof pageParam === 'number' ? pageParam : currentPage;
      try {
        setLoading(true);
        setError(null);
        const params = { ...scopeParams, page: pageNum, limit: 10 };
        if (!isCollegeAdmin) {
          if (selectedCollege) params.collegeId = selectedCollege;
          if (selectedDept) params.departmentId = selectedDept;
        }
        if (selectedYear) params.academicYear = selectedYear;
        if (selectedSemester) params.semester = selectedSemester;
        const result = await timetableService.getTimetables(params);
        if (result.success) {
          const data = result.data;
          setTimetables(
            Array.isArray(data.timetables) ? data.timetables : Array.isArray(data) ? data : []
          );
          if (data.pagination) {
            setCurrentPage(data.pagination.page);
            setTotalPages(data.pagination.totalPages);
            setTotal(data.pagination.total);
          }
        }
      } catch (err: any) {
        logger.error('Error fetching timetables:', err);
        setError(
          err.message ||
            t('common.fetchError', 'Failed to load timetables. Please check your connection.')
        );
      } finally {
        setLoading(false);
      }
    },
    [
      selectedCollege,
      selectedDept,
      selectedYear,
      selectedSemester,
      scopeParams,
      isCollegeAdmin,
      currentPage,
    ]
  );

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchTimetables(1);
    setCurrentPage(1);
  }, [selectedCollege, selectedDept, selectedYear, selectedSemester, scopeParams, isCollegeAdmin]);

  const _handleCollegeChange = (e) => {
    const val = e.target.value;
    setSelectedCollege(val);
    setSelectedDept('');
    fetchDepartments(val);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('timetables.deleteConfirm'))) return;
    try {
      const result = await timetableService.deleteTimetable(id);
      if (result.success) {
        showToast(t('common.deleteSuccess'), 'success');
        fetchTimetables();
      }
    } catch (err: any) {
      showToast(err.message || t('common.deleteError'), 'error');
    }
  };

  const handlePublish = async (id, currentStatus) => {
    try {
      if (currentStatus === 'PUBLISHED') {
        await timetableService.unpublishTimetable(id);
        showToast(t('timetables.unpublished', 'Timetable unpublished'), 'success');
      } else {
        await timetableService.publishTimetable(id);
        showToast(t('timetables.publishSuccess', 'Timetable published'), 'success');
      }
      fetchTimetables();
    } catch (err: any) {
      logger.error(err);
      showToast(t('common.errorOccurred', 'Failed to update status'), 'error');
    }
  };


  const _resetFilters = () => {
    setSelectedCollege('');
    setSelectedDept('');
    setSelectedYear('');
    setSelectedSemester('');
    setSearch('');
    setDepartments([]);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    fetchTimetables(newPage);
  };

  const searchFiltered = (timetables || []).filter(
    (ti) =>
      (ti.title || '').toLowerCase().includes((search || '').toLowerCase()) ||
      (ti.description || '').toLowerCase().includes((search || '').toLowerCase())
  );

  const finalTimetables = searchFiltered.filter(
    (ti) => statusFilter === 'ALL' || ti.status === statusFilter
  );

  // Compute Subtitle Text Properly
  const collegeName = isRTL
    ? (user?.college?.nameAr || user?.managedCollege?.nameAr || user?.college?.name || user?.managedCollege?.name || user?.managedCollegeName || user?.collegeName || '')
    : (user?.college?.name || user?.managedCollege?.name || user?.managedCollegeName || user?.collegeName || '');
  const deptName = isRTL
    ? (user?.department?.nameAr || user?.managedDepartment?.nameAr || user?.department?.name || user?.managedDepartment?.name || '')
    : (user?.department?.name || user?.managedDepartment?.name || '');

  let subtitleText = '';
  if (isSuperAdmin) subtitleText = t('timetables.allColleges');
  else if (user?.role === 'DEPARTMENT_ADMIN')
    subtitleText = `${t('timetables.deptPrefix')} ${deptName}`;
  else subtitleText = `${t('timetables.collegePrefix')} ${collegeName}`;

  // Stats
  const statsAllCount = searchFiltered.length;
  const statsPublishedCount = searchFiltered.filter((t) => t.status === 'PUBLISHED').length;
  const statsDraftCount = searchFiltered.filter((t) => t.status === 'DRAFT').length;

  return (
    <div className="pt-6 section-gap animate-in fade-in duration-700">
      {/* Toast Notification */}
      

      {/* HEADER SECTION */}
      <PageHeader
        title={t('timetables.title')}
        subtitle={subtitleText}
        action={
          canManage
            ? {
                label: t('timetables.create'),
                icon: Plus,
                onClick: () => {
                  setEditingTimetable(null);
                  setIsModalOpen(true);
                },
                className: 'bg-brand-primary-500 hover:bg-brand-primary-600 text-white font-bold rounded-xl px-4 py-2 active:scale-95 transition-all flex items-center gap-2',
              }
            : null
        }
      />

      <div className="w-full space-y-6">
        {/* TOP CONTROLS: Stats Bar, Search, and View Toggle */}
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 md:p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* STATS BAR */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-2xl overflow-x-auto w-full md:w-auto">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`flex flex-col items-center justify-center px-6 py-2 rounded-xl transition-all min-w-[90px] border ${statusFilter === 'ALL' ? 'bg-white dark:bg-slate-700 shadow-sm text-brand-text-main dark:text-white font-black border-slate-200 dark:border-slate-600' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 font-bold border-transparent'}`}
              >
                <span className="text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1 opacity-80">
                  📊 {t('timetables.statsAll')}
                </span>
                <span className="text-xl leading-none">{statsAllCount}</span>
              </button>
              <button
                onClick={() => setStatusFilter('PUBLISHED')}
                className={`flex flex-col items-center justify-center px-6 py-2 rounded-xl transition-all min-w-[90px] border ${statusFilter === 'PUBLISHED' ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 font-black border-green-200 dark:border-green-800' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 font-bold border-transparent'}`}
              >
                <span className="text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1 opacity-80">
                  ✅ {t('timetables.statsPublished')}
                </span>
                <span className="text-xl leading-none">{statsPublishedCount}</span>
              </button>
              <button
                onClick={() => setStatusFilter('DRAFT')}
                className={`flex flex-col items-center justify-center px-6 py-2 rounded-xl transition-all min-w-[90px] border ${statusFilter === 'DRAFT' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 font-black border-amber-200 dark:border-amber-800' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 font-bold border-transparent'}`}
              >
                <span className="text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1 opacity-80">
                  📝 {t('timetables.statsDraft')}
                </span>
                <span className="text-xl leading-none">{statsDraftCount}</span>
              </button>
            </div>

            {/* SEARCH & TOGGLE */}
            <div className="flex items-center gap-3 flex-1 md:justify-end">
              <div className="w-full md:max-w-xs relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('timetables.searchPlaceholder')}
                  className={`w-full h-11 ${isRTL ? 'pr-11 pl-4' : 'pl-11 pr-4'} bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-semibold text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all shadow-sm`}
                />
                <div
                  className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-4' : 'left-4'} text-slate-400 dark:text-slate-500`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </div>
              </div>
              <div className="flex items-center bg-slate-100 dark:bg-slate-900/50 p-1 rounded-2xl border border-transparent">
                <button
                  onClick={() => setViewMode('LIST')}
                  className={`p-2.5 rounded-xl transition-all flex items-center gap-2 text-sm font-bold border ${viewMode === 'LIST' ? 'bg-white dark:bg-slate-700 shadow-sm text-brand-text-main dark:text-white border-slate-200 dark:border-slate-600' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-transparent'}`}
                >
                  <List size={18} />{' '}
                  <span className="hidden sm:inline">{t('timetables.viewListView')}</span>
                </button>
                <button
                  onClick={() => setViewMode('CARD')}
                  className={`p-2.5 rounded-xl transition-all flex items-center gap-2 text-sm font-bold border ${viewMode === 'CARD' ? 'bg-white dark:bg-slate-700 shadow-sm text-brand-text-main dark:text-white border-slate-200 dark:border-slate-600' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-transparent'}`}
                >
                  <Grid size={18} />{' '}
                  <span className="hidden sm:inline">{t('timetables.viewCardView')}</span>
                </button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden p-0 bg-transparent">
          {loading ? (
            <LoadingState message={t('common.loading', 'Fetching institutional schedules...')} />
          ) : error ? (
            <ErrorState message={error} onRetry={fetchTimetables} />
          ) : finalTimetables.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-16 w-16 rounded-full bg-brand-primary-500/10 dark:bg-brand-primary-500/20 flex items-center justify-center mb-5 text-brand-primary-600 dark:text-brand-primary-400 shrink-0">
                <Calendar size={32} />
              </div>
              <h3 className="text-xl font-bold text-brand-text-primary dark:text-brand-text-main tracking-tight mb-2">
                {t('timetables.emptyTitle')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium max-w-xs mx-auto">
                {t('timetables.emptySubtitle')}
              </p>
              {search || statusFilter !== 'ALL' ? (
                <Button
                  variant="ghost"
                  className="mt-6 text-brand-primary-600 font-bold uppercase tracking-widest text-xs"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('ALL');
                  }}
                >
                  {t('common.clearSearch', 'Clear Search')}
                </Button>
              ) : (
                canManage && (
                  <Button
                    variant="primary"
                    className="mt-6 shadow-md shadow-brand-primary-500/10 hover:shadow-lg bg-brand-primary-500 hover:bg-brand-primary-600 text-white font-bold rounded-xl px-5 py-2.5 active:scale-95 transition-all flex items-center gap-2"
                    onClick={() => {
                      setEditingTimetable(null);
                      setIsModalOpen(true);
                    }}
                  >
                    <Plus size={18} />
                    {t('timetables.emptyButton')}
                  </Button>
                )
              )}
            </div>
          ) : viewMode === 'LIST' ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700">
                    <TableHead className="text-start font-semibold text-brand-text-primary dark:text-brand-text-main py-4 px-6">
                      {t('timetables.details')}
                    </TableHead>
                    <TableHead className="text-start font-semibold text-brand-text-primary dark:text-brand-text-main py-4 px-6">
                      {t('timetables.targetCohort')}
                    </TableHead>
                    <TableHead className="text-center font-semibold text-brand-text-primary dark:text-brand-text-main py-4 px-6">
                      {t('timetables.status')}
                    </TableHead>
                    <TableHead className="text-end font-semibold text-brand-text-primary dark:text-brand-text-main py-4 px-6">
                      {t('timetables.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {finalTimetables.map((ti) => {
                    const statusClass = ti.status === 'PUBLISHED'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';

                    return (
                      <TableRow
                        key={ti.id}
                        className="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                      >
                        <TableCell className="text-start py-4 px-6">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-xl bg-brand-primary-500/10 dark:bg-brand-primary-500/20 text-brand-primary-600 dark:text-brand-primary-400 flex items-center justify-center border border-brand-primary-500/20 shadow-inner flex-shrink-0">
                              <Calendar size={24} />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <p className="text-base font-semibold text-brand-text-primary dark:text-brand-text-main tracking-tight truncate max-w-[280px]">
                                {ti.title}
                              </p>
                              {ti.description && (
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 truncate max-w-[280px]">
                                  {ti.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-start py-4 px-6">
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-brand-text-primary dark:text-brand-text-main flex items-center gap-1.5">
                              <Building2 size={14} className="text-slate-400 dark:text-slate-500" />
                              {(isRTL ? ti.department?.nameAr || ti.department?.name : ti.department?.name) || t('common.general', 'General')}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-slate-200/50 dark:border-slate-600/50">
                                {t('auth.year')} {ti.academicYear}
                              </span>
                              <span className="text-slate-400 dark:text-slate-500">•</span>
                              <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-slate-200/50 dark:border-slate-600/50">
                                {t(`schedule.semester${ti.semester}`, `Sem ${ti.semester}`)}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-4 px-6">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${statusClass}`}>
                            {ti.status === 'PUBLISHED'
                              ? t('timetables.published')
                              : t('timetables.draft')}
                          </span>
                        </TableCell>
                        <TableCell className="text-end py-4 px-6">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() =>
                                navigate(
                                  `/schedules/timetable?collegeId=${ti.department?.collegeId || ''}&departmentId=${ti.departmentId}&academicYear=${ti.academicYear}&semester=${ti.semester}`
                                )
                              }
                              className="p-2 text-slate-400 dark:text-slate-500 hover:text-brand-primary-500 dark:hover:text-brand-primary-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all"
                              title={t('timetables.viewDetails')}
                            >
                              <Eye size={18} />
                            </button>
                            {canManage && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingTimetable(ti);
                                    setIsModalOpen(true);
                                  }}
                                  className="p-2 text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all"
                                  title={t('timetables.editBasicInfo')}
                                >
                                  <Edit2 size={18} />
                                </button>
                                <button
                                  onClick={() => handlePublish(ti.id, ti.status)}
                                  className={`p-2 rounded-xl transition-all ${ti.status === 'PUBLISHED' ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20' : 'text-slate-400 dark:text-slate-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                  title={
                                    ti.status === 'PUBLISHED'
                                      ? t('timetables.unpublish', 'Unpublish')
                                      : t('timetables.publish', 'Publish')
                                  }
                                >
                                  <CheckCircle size={18} />
                                </button>
                                {isSuperAdmin && (
                                  <button
                                    onClick={() => handleDelete(ti.id)}
                                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all"
                                    title={t('common.delete')}
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            // CARD VIEW
            <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {finalTimetables.map((ti) => {
                const statusClass = ti.status === 'PUBLISHED'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200/50 dark:border-green-800/30'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200/50 dark:border-amber-800/30';

                return (
                  <div
                    key={ti.id}
                    className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col group relative overflow-hidden"
                  >
                    <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/30 flex-1 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <Calendar size={120} className="text-brand-navy-500" />
                      </div>
                      <div className="relative z-10 text-start">
                        <div className="flex justify-between items-start mb-5">
                          <div className="h-12 w-12 rounded-xl bg-brand-primary-500/10 text-brand-primary-500 flex items-center justify-center border border-brand-primary-500/20 shadow-sm flex-shrink-0">
                            <Calendar size={24} />
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${statusClass}`}>
                            {ti.status === 'PUBLISHED'
                              ? t('timetables.published')
                              : t('timetables.draft')}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-brand-text-primary dark:text-brand-text-main group-hover:text-brand-primary-600 transition-colors leading-tight mb-4 truncate">
                          {ti.title}
                        </h3>

                        <div className="space-y-3">
                          <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            <Building2 size={16} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
                            <span className="truncate">{(isRTL ? ti.department?.nameAr || ti.department?.name : ti.department?.name) || t('common.general', 'General')}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-widest shadow-sm border border-slate-200 dark:border-slate-600">
                              {t('auth.year')} {ti.academicYear}
                            </span>
                            <span className="bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-widest shadow-sm border border-slate-200 dark:border-slate-600 flex items-center gap-1.5">
                              <BookOpen size={14} /> {t(`schedule.semester${ti.semester}`, `Sem ${ti.semester}`)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-800 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-700/50">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          navigate(
                            `/schedules/timetable?collegeId=${ti.department?.collegeId || ''}&departmentId=${ti.departmentId}&academicYear=${ti.academicYear}&semester=${ti.semester}`
                          )
                        }
                        className="flex-1 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                      >
                        <Eye size={16} className="mr-2" /> {t('timetables.viewDetails')}
                      </Button>

                      {canManage && (
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-2xl border border-transparent">
                          <button
                            onClick={() => {
                              setEditingTimetable(ti);
                              setIsModalOpen(true);
                            }}
                            className="p-2 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-white dark:hover:bg-slate-850 rounded-xl transition-all hover:shadow-sm"
                            title={t('timetables.editBasicInfo')}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handlePublish(ti.id, ti.status)}
                            className={`p-2 rounded-xl transition-all hover:bg-white dark:hover:bg-slate-850 ${ti.status === 'PUBLISHED' ? 'text-green-600 hover:border-green-300' : 'text-slate-500 dark:text-slate-400 hover:text-green-600'}`}
                            title={
                              ti.status === 'PUBLISHED'
                                ? t('timetables.unpublish', 'Unpublish')
                                : t('timetables.publish', 'Publish')
                            }
                          >
                            <CheckCircle size={16} />
                          </button>
                          {isSuperAdmin && (
                            <button
                              onClick={() => handleDelete(ti.id)}
                              className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-white dark:hover:bg-slate-850 rounded-xl transition-all hover:shadow-sm"
                              title={t('common.delete')}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && totalPages > 0 && finalTimetables.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-6 mt-4 gap-4 border-t border-slate-100 dark:border-slate-700/50">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {t('common.page', 'Page')}{' '}
                <span className="text-brand-text-main dark:text-white">{currentPage}</span> {t('common.of', 'of')}{' '}
                <span className="text-brand-text-main dark:text-white">{totalPages}</span> •{' '}
                {t('timetables.showing', 'Showing')}{' '}
                <span className="text-brand-text-main dark:text-white">{finalTimetables.length}</span>{' '}
                {t('common.of', 'of')} <span className="text-brand-text-main dark:text-white">{total}</span>{' '}
                {t('timetables.timetables', 'Timetables')}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all"
                >
                  {isRTL ? (
                    <ChevronRight size={16} className="rtl:-scale-x-100" />
                  ) : (
                    <ChevronLeft size={16} className="rtl:-scale-x-100" />
                  )}
                </Button>
                <span className="px-4 py-2 rounded-xl bg-brand-primary-500 text-white text-xs font-bold shadow-md shadow-brand-primary-500/10">
                  {currentPage}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all"
                >
                  {isRTL ? (
                    <ChevronLeft size={16} className="rtl:-scale-x-100" />
                  ) : (
                    <ChevronRight size={16} className="rtl:-scale-x-100" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <TimetableModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          timetable={editingTimetable}
          onSuccess={(createdTimetable) => {
            setIsModalOpen(false);
            fetchTimetables();
            showToast(
              editingTimetable ? t('timetables.saveSuccess') : t('timetables.saveSuccess'),
              'success'
            );
            if (!editingTimetable && createdTimetable) {
              navigate(
                `/schedules/timetable?collegeId=${createdTimetable.department?.collegeId || ''}&departmentId=${createdTimetable.departmentId}&academicYear=${createdTimetable.academicYear}&semester=${createdTimetable.semester}`
              );
            }
          }}
        />
      )}
    </div>
  );
};

export default TimetableManagement;
