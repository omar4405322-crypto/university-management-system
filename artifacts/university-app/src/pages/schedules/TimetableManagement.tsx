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
import Table, { TableRow, TableCell } from '../../components/ui/Table';
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
  const collegeName =
    user?.college?.name ||
    user?.managedCollege?.name ||
    user?.managedCollegeName ||
    user?.collegeName ||
    '';
  const deptName = user?.department?.name || user?.managedDepartment?.name || '';

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
    <div className="section-gap animate-in fade-in duration-700">
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
              }
            : null
        }
      />

      <div className="w-full space-y-6">
        {/* TOP CONTROLS: Stats Bar, Search, and View Toggle */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-brand-bg-page/50 p-4 rounded-3xl border border-brand-border shadow-sm">
          {/* STATS BAR */}
          <div className="flex items-center gap-2 bg-brand-navy-500/5 p-1 rounded-2xl overflow-x-auto w-full md:w-auto">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`flex flex-col items-center justify-center px-6 py-2.5 rounded-xl transition-all min-w-[90px] ${statusFilter === 'ALL' ? 'bg-white shadow-sm text-brand-text-main font-black border border-brand-border/50' : 'text-brand-text-sub hover:bg-brand-navy-500/5 font-bold border border-transparent'}`}
            >
              <span className="text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1 opacity-80">
                📊 {t('timetables.statsAll')}
              </span>
              <span className="text-xl leading-none">{statsAllCount}</span>
            </button>
            <button
              onClick={() => setStatusFilter('PUBLISHED')}
              className={`flex flex-col items-center justify-center px-6 py-2.5 rounded-xl transition-all min-w-[90px] ${statusFilter === 'PUBLISHED' ? 'bg-brand-green/10 text-brand-green font-black border border-brand-green/20' : 'text-brand-text-sub hover:bg-brand-navy-500/5 font-bold border border-transparent'}`}
            >
              <span className="text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1 opacity-80">
                ✅ {t('timetables.statsPublished')}
              </span>
              <span className="text-xl leading-none">{statsPublishedCount}</span>
            </button>
            <button
              onClick={() => setStatusFilter('DRAFT')}
              className={`flex flex-col items-center justify-center px-6 py-2.5 rounded-xl transition-all min-w-[90px] ${statusFilter === 'DRAFT' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black border border-amber-500/20' : 'text-brand-text-sub hover:bg-brand-navy-500/5 font-bold border border-transparent'}`}
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
                className={`w-full h-12 ${isRTL ? 'pr-11 pl-4' : 'pl-11 pr-4'} bg-white border border-brand-border rounded-2xl text-sm font-bold text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-600/20 focus:border-brand-primary-600 transition-all shadow-sm`}
              />
              <div
                className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-4' : 'left-4'} text-brand-text-muted`}
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
            <div className="flex items-center bg-brand-navy-500/5 p-1 rounded-2xl">
              <button
                onClick={() => setViewMode('LIST')}
                className={`p-2.5 rounded-xl transition-all flex items-center gap-2 text-sm font-bold ${viewMode === 'LIST' ? 'bg-white shadow-sm text-brand-text-main border border-brand-border/50' : 'text-brand-text-sub hover:bg-brand-navy-500/5 border border-transparent'}`}
              >
                <List size={18} />{' '}
                <span className="hidden sm:inline">{t('timetables.viewListView')}</span>
              </button>
              <button
                onClick={() => setViewMode('CARD')}
                className={`p-2.5 rounded-xl transition-all flex items-center gap-2 text-sm font-bold ${viewMode === 'CARD' ? 'bg-white shadow-sm text-brand-text-main border border-brand-border/50' : 'text-brand-text-sub hover:bg-brand-navy-500/5 border border-transparent'}`}
              >
                <Grid size={18} />{' '}
                <span className="hidden sm:inline">{t('timetables.viewCardView')}</span>
              </button>
            </div>
          </div>
        </div>

        <Card noPadding className="border-0 shadow-none bg-transparent">
          {loading ? (
            <LoadingState message={t('common.loading', 'Fetching institutional schedules...')} />
          ) : error ? (
            <ErrorState message={error} onRetry={fetchTimetables} />
          ) : finalTimetables.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-3xl border border-dashed border-brand-border">
              <div className="h-24 w-24 rounded-full bg-brand-navy-500/5 flex items-center justify-center mb-6 border border-brand-border">
                <Calendar size={48} className="text-brand-text-muted opacity-50" />
              </div>
              <h3 className="text-2xl font-black text-brand-text-main tracking-tight">
                {t('timetables.emptyTitle')}
              </h3>
              <p className="text-sm text-brand-text-sub max-w-sm mx-auto mt-2 font-bold leading-relaxed">
                {t('timetables.emptySubtitle')}
              </p>
              {search || statusFilter !== 'ALL' ? (
                <Button
                  variant="ghost"
                  className="mt-6 text-brand-green font-black uppercase tracking-widest text-xs"
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
                    className="mt-8 shadow-xl shadow-brand-primary-600/20 px-8 rounded-2xl"
                    onClick={() => {
                      setEditingTimetable(null);
                      setIsModalOpen(true);
                    }}
                  >
                    <Plus size={18} className="mr-2" />
                    {t('timetables.emptyButton')}
                  </Button>
                )
              )}
            </div>
          ) : viewMode === 'LIST' ? (
            <div className="bg-white rounded-3xl border border-brand-border overflow-hidden shadow-sm">
              <Table
                headers={[
                  t('timetables.details'),
                  t('timetables.targetCohort'),
                  t('timetables.status'),
                  t('timetables.actions'),
                ]}
              >
                {finalTimetables.map((ti) => (
                  <TableRow
                    key={ti.id}
                    className="group hover:bg-brand-navy-500/5 transition-colors duration-300"
                  >
                    <TableCell>
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-brand-navy-500/5 text-brand-navy-500 flex items-center justify-center border border-brand-border group-hover:bg-brand-navy-500 group-hover:text-white transition-all duration-300">
                          <Calendar size={24} />
                        </div>
                        <div>
                          <p className="text-base font-black text-brand-text-main group-hover:text-brand-primary-600 transition-colors">
                            {ti.title}
                          </p>
                          {ti.description && (
                            <p className="text-[11px] font-bold text-brand-text-muted mt-1 line-clamp-1 max-w-[280px]">
                              {ti.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <p className="text-[12px] font-black text-brand-text-main flex items-center gap-1.5">
                          <Building2 size={14} className="text-brand-text-muted" />
                          {ti.department?.name || t('common.general', 'General')}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="bg-brand-navy-500/5 text-brand-text-sub px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-brand-border/50">
                            {t('auth.year')} {ti.academicYear}
                          </span>
                          <span className="text-brand-text-muted">•</span>
                          <span className="bg-brand-navy-500/5 text-brand-text-sub px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-brand-border/50">
                            {t('timetables.semester')} {ti.semester}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-start">
                        <span
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[11px] uppercase tracking-widest border ${ti.status === 'PUBLISHED' ? 'bg-brand-green/10 text-brand-green border-brand-green/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'}`}
                        >
                          {ti.status === 'PUBLISHED' ? (
                            <CheckCircle size={14} />
                          ) : (
                            <AlertCircle size={14} />
                          )}
                          {ti.status === 'PUBLISHED'
                            ? t('timetables.published')
                            : t('timetables.draft')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            navigate(
                              `/schedules/timetable?dept=${ti.departmentId}&year=${ti.academicYear}&sem=${ti.semester}`
                            )
                          }
                          className="p-2 text-brand-text-muted hover:text-brand-primary-600 hover:bg-brand-primary-50 rounded-xl transition-all"
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
                              className="p-2 text-brand-text-muted hover:text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:bg-amber-900/20 rounded-xl transition-all"
                              title={t('timetables.editBasicInfo')}
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={() => handlePublish(ti.id, ti.status)}
                              className={`p-2 rounded-xl transition-all ${ti.status === 'PUBLISHED' ? 'text-brand-green hover:bg-brand-green/10' : 'text-brand-text-muted hover:text-brand-green hover:bg-brand-green/10'}`}
                              title={
                                ti.status === 'PUBLISHED'
                                  ? t('timetables.unpublish', 'Unpublish')
                                  : t('timetables.publish', 'Publish')
                              }
                            >
                              {ti.status === 'PUBLISHED' ? (
                                <CheckCircle size={18} />
                              ) : (
                                <CheckCircle size={18} />
                              )}
                            </button>
                            {isSuperAdmin && (
                              <button
                                onClick={() => handleDelete(ti.id)}
                                className="p-2 text-brand-text-muted hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
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
                ))}
              </Table>
            </div>
          ) : (
            // CARD VIEW
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {finalTimetables.map((ti) => (
                <div
                  key={ti.id}
                  className="bg-white rounded-3xl border border-brand-border overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col group relative"
                >
                  <div className="p-6 border-b border-brand-border/50 bg-brand-bg-page/50 flex-1 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                      <Calendar size={120} className="text-brand-navy-500" />
                    </div>
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-5">
                        <div className="h-12 w-12 rounded-2xl bg-white text-brand-navy-500 flex items-center justify-center shadow-sm border border-brand-border">
                          <Calendar size={24} />
                        </div>
                        <span
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-black text-[10px] uppercase tracking-widest border shadow-sm ${ti.status === 'PUBLISHED' ? 'bg-brand-green/10 text-brand-green border-brand-green/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'}`}
                        >
                          {ti.status === 'PUBLISHED' ? (
                            <CheckCircle size={12} />
                          ) : (
                            <AlertCircle size={12} />
                          )}
                          {ti.status === 'PUBLISHED'
                            ? t('timetables.published')
                            : t('timetables.draft')}
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-brand-text-main group-hover:text-brand-primary-600 transition-colors leading-tight mb-4">
                        {ti.title}
                      </h3>

                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-sm font-bold text-brand-text-sub">
                          <Building2 size={16} className="text-brand-text-muted" />
                          {ti.department?.name || t('common.general', 'General')}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="bg-white text-brand-text-sub px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest shadow-sm border border-brand-border">
                            {t('auth.year')} {ti.academicYear}
                          </span>
                          <span className="bg-white text-brand-text-sub px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest shadow-sm border border-brand-border flex items-center gap-1.5">
                            <BookOpen size={14} /> {t('timetables.semester')} {ti.semester}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-white flex items-center justify-between gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        navigate(
                          `/schedules/timetable?dept=${ti.departmentId}&year=${ti.academicYear}&sem=${ti.semester}`
                        )
                      }
                      className="flex-1 rounded-xl font-black shadow-sm"
                    >
                      <Eye size={16} className="mr-2" /> {t('timetables.viewDetails')}
                    </Button>

                    {canManage && (
                      <div className="flex items-center gap-2 bg-brand-navy-500/5 p-1 rounded-2xl">
                        <button
                          onClick={() => {
                            setEditingTimetable(ti);
                            setIsModalOpen(true);
                          }}
                          className="p-2 text-brand-text-muted hover:text-amber-600 dark:text-amber-400 hover:bg-white rounded-xl transition-all border border-transparent hover:border-amber-200 hover:shadow-sm"
                          title={t('timetables.editBasicInfo')}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handlePublish(ti.id, ti.status)}
                          className={`p-2 rounded-xl transition-all border border-transparent hover:shadow-sm hover:bg-white ${ti.status === 'PUBLISHED' ? 'text-brand-green hover:border-brand-green/30' : 'text-brand-text-muted hover:text-brand-green hover:border-brand-green/30'}`}
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
                            className="p-2 text-brand-text-muted hover:text-red-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-red-200 hover:shadow-sm"
                            title={t('common.delete')}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && totalPages > 0 && finalTimetables.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-6 mt-4 gap-4">
              <p className="text-xs font-bold text-brand-text-sub uppercase tracking-wide">
                {t('common.page', 'Page')}{' '}
                <span className="text-brand-text-main">{currentPage}</span> {t('common.of', 'of')}{' '}
                <span className="text-brand-text-main">{totalPages}</span> •{' '}
                {t('timetables.showing', 'Showing')}{' '}
                <span className="text-brand-text-main">{finalTimetables.length}</span>{' '}
                {t('common.of', 'of')} <span className="text-brand-text-main">{total}</span>{' '}
                {t('timetables.timetables', 'Timetables')}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="flex items-center gap-1 text-xs font-black uppercase tracking-widest bg-white shadow-sm border border-brand-border hover:bg-brand-navy-500/5"
                >
                  {isRTL ? (
                    <ChevronRight size={16} className="rtl:-scale-x-100" />
                  ) : (
                    <ChevronLeft size={16} className="rtl:-scale-x-100" />
                  )}
                </Button>
                <span className="px-5 py-2.5 rounded-xl bg-brand-primary-600 text-white text-xs font-black shadow-md shadow-brand-primary-600/20">
                  {currentPage}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="flex items-center gap-1 text-xs font-black uppercase tracking-widest bg-white shadow-sm border border-brand-border hover:bg-brand-navy-500/5"
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
                `/schedules/timetable?dept=${createdTimetable.departmentId}&year=${createdTimetable.academicYear}&sem=${createdTimetable.semester}`
              );
            }
          }}
        />
      )}
    </div>
  );
};

export default TimetableManagement;
