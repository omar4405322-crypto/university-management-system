// @ts-nocheck
import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import departmentService from '../../services/department.service';
import collegeService from '../../services/college.service';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { useDepartments } from '../../hooks/useDepartments';
import { PageHeader } from '../../components/ui/PageHeader';
import Card, { StatCard } from '../../components/ui/card';
import Button from '../../components/ui/button';
import Badge from '../../components/ui/Badge';
import Drawer from '../../components/ui/Drawer';
import { EmptyState } from '../../components/ui/EmptyState';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import AddDepartmentModal from './AddDepartmentModal';
import EditDepartmentModal from './EditDepartmentModal';
import Table, {
  TableRow,
  TableCell,
  TableHeader,
  TableHead,
  TableBody,
} from '../../components/ui/Table';
import {
  Layers,
  Building2,
  Building,
  Users,
  BookOpen,
  GraduationCap,
  Search,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Loader2,
  X,
  LayoutGrid,
  List,
  Eye,
  ExternalLink,
  ChevronRight,
  Filter,
  CheckSquare,
  Square,
  MinusSquare,
} from 'lucide-react';
import BulkActionToolbar from '../../components/ui/BulkActionToolbar';
import { downloadCsv } from '../../utils/exportCsv';
import { logger } from '../../lib/logger';

const DepartmentDetails = React.lazy(() => import('./DepartmentDetails'));

const DepartmentsList: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlCollegeId = searchParams.get('collegeId') || '';

  const isCollegeAdmin = user?.role === 'COLLEGE_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canManage = isSuperAdmin || isCollegeAdmin;

  // Determine effective college ID (scoped college admin or URL query param)
  const defaultCollegeId =
    isCollegeAdmin && user?.managedCollegeId
      ? String(user.managedCollegeId)
      : urlCollegeId || '';

  const [colleges, setColleges] = useState<any[]>([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>(defaultCollegeId);
  const [sortBy, setSortBy] = useState<'name' | 'students' | 'courses' | 'faculty'>('name');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const {
    data: departments,
    loading,
    search,
    setSearch,
    refetch: fetchDepartments,
  } = useDepartments({
    initialSearch: '',
    limit: 100,
    collegeId: selectedCollegeId || undefined,
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string | number; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [activeDrawerId, setActiveDrawerId] = useState<string | null>(null);

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);

  // Sync URL changes
  useEffect(() => {
    if (isCollegeAdmin && user?.managedCollegeId) {
      setSelectedCollegeId(String(user.managedCollegeId));
    } else if (urlCollegeId) {
      setSelectedCollegeId(urlCollegeId);
    }
  }, [urlCollegeId, isCollegeAdmin, user?.managedCollegeId]);

  // Fetch colleges list for filtering and modals
  useEffect(() => {
    const fetchColleges = async () => {
      try {
        const result = await collegeService.getColleges();
        if (result.success) {
          setColleges(Array.isArray(result.data) ? result.data : result.data?.colleges || []);
        }
      } catch (error: any) {
        logger.error('Error fetching colleges:', error);
      }
    };
    fetchColleges();
  }, []);

  const handleEdit = (dept: any) => {
    setSelectedDepartment(dept);
    setIsEditModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      const result = await departmentService.deleteDepartment(deleteTarget.id);
      if (result.success) {
        showToast(t('departments.deleteSuccess', 'تم حذف القسم بنجاح'), 'success');
        setDeleteTarget(null);
        fetchDepartments();
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || t('departments.deleteError', 'خطأ في حذف القسم'), 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filter departments locally based on search and college
  const filteredDepartments = useMemo(() => {
    const list = Array.isArray(departments) ? departments : [];
    return list.filter((dept: any) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (dept.name && dept.name.toLowerCase().includes(q)) ||
        (dept.nameAr && dept.nameAr.toLowerCase().includes(q)) ||
        (dept.college?.name && dept.college.name.toLowerCase().includes(q)) ||
        (dept.college?.nameAr && dept.college.nameAr.toLowerCase().includes(q));

      const matchesCollege = selectedCollegeId ? String(dept.collegeId) === selectedCollegeId : true;
      return matchesSearch && matchesCollege;
    });
  }, [departments, search, selectedCollegeId]);

  // Sort departments
  const sortedDepartments = useMemo(() => {
    return [...filteredDepartments].sort((a: any, b: any) => {
      if (sortBy === 'students') {
        return (b._count?.students ?? 0) - (a._count?.students ?? 0);
      }
      if (sortBy === 'courses') {
        return (b._count?.courses ?? 0) - (a._count?.courses ?? 0);
      }
      if (sortBy === 'faculty') {
        return (b._count?.doctors ?? 0) - (a._count?.doctors ?? 0);
      }
      const nameA = isRTL ? a.nameAr || a.name || '' : a.name || a.nameAr || '';
      const nameB = isRTL ? b.nameAr || b.name || '' : b.name || b.nameAr || '';
      return nameA.localeCompare(nameB, isRTL ? 'ar' : 'en');
    });
  }, [filteredDepartments, sortBy, isRTL]);

  // Selection Logic
  const allFilteredIds = useMemo(() => sortedDepartments.map((d: any) => d.id), [sortedDepartments]);
  const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));
  const isSomeSelected = allFilteredIds.some((id) => selectedIds.has(id)) && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allFilteredIds));
    }
  };

  const handleToggleSelect = (id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkClear = () => setSelectedIds(new Set());

  const handleBulkExport = () => {
    const selectedList = sortedDepartments.filter((d: any) => selectedIds.has(d.id));
    if (!selectedList.length) return;
    const exportData = selectedList.map((d: any) => ({
      ID: d.id,
      Code: d.code || 'N/A',
      NameAr: d.nameAr || d.name,
      NameEn: d.name || d.nameAr,
      College: d.college?.nameAr || d.college?.name || 'N/A',
      StudentsCount: d._count?.students || d.studentCount || 0,
      CoursesCount: d._count?.courses || d.coursesCount || 0,
      FacultyCount: d._count?.doctors || d.facultyCount || 0,
    }));
    downloadCsv(exportData, `departments_selected_${new Date().toISOString().split('T')[0]}.csv`);
    showToast(t('departments.exportSuccess', 'تم تصدير الأقسام المحددة بنجاح'), 'success');
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map((id) => departmentService.deleteDepartment(id)));
      showToast(t('departments.bulkDeleteSuccess', 'تم حذف الأقسام المحددة بنجاح'), 'success');
      setSelectedIds(new Set());
      setBulkDeleteModalOpen(false);
      fetchDepartments();
    } catch (error: any) {
      showToast(error.response?.data?.message || t('departments.deleteError', 'خطأ في حذف بعض الأقسام'), 'error');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Compute summary stats for the Executive Ribbon
  const totalDepts = Array.isArray(departments) ? departments.length : 0;
  const totalStudents = useMemo(() => {
    return (Array.isArray(departments) ? departments : []).reduce(
      (acc: number, d: any) => acc + (d._count?.students ?? 0),
      0
    );
  }, [departments]);
  const totalCourses = useMemo(() => {
    return (Array.isArray(departments) ? departments : []).reduce(
      (acc: number, d: any) => acc + (d._count?.courses ?? 0),
      0
    );
  }, [departments]);

  const hasActiveFilters = Boolean(search || selectedCollegeId || sortBy !== 'name');

  const handleClearFilters = () => {
    setSearch('');
    if (!isCollegeAdmin) {
      setSelectedCollegeId('');
      setSearchParams({});
    }
    setSortBy('name');
  };

  return (
    <div className="section-gap animate-page pt-4">
      {/* ========================================================================= */}
      {/* PAGE HEADER                                                               */}
      {/* ========================================================================= */}
      <PageHeader
        title={t('departments.title', 'أقسام الجامعة')}
        subtitle={t('departments.subtitle', 'إدارة الأقسام الأكاديمية في مختلف الكليات.')}
        action={
          canManage
            ? {
                label: t('departments.addDept', 'إضافة قسم'),
                onClick: () => setIsAddModalOpen(true),
                icon: Plus,
                className:
                  'bg-brand-primary-500 hover:bg-brand-primary-600 text-white font-bold rounded-xl active:scale-95 transition-all flex items-center gap-2 px-4 py-2 shadow-xs cursor-pointer',
              }
            : undefined
        }
      />

      {/* ========================================================================= */}
      {/* 1. EXECUTIVE 4-METRIC RIBBON                                              */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard
          compact
          title={t('departments.totalDepartments', 'إجمالي الأقسام')}
          value={totalDepts}
          icon={Layers}
          color="primary"
        />

        <StatCard
          compact
          title={t('departments.affiliatedColleges', 'الكليات التابعة')}
          value={colleges.length}
          icon={Building2}
          color="emerald"
        />

        <StatCard
          compact
          title={t('departments.enrolledStudents', 'الطلاب المقيدون')}
          value={totalStudents}
          icon={Users}
          color="blue"
        />

        <StatCard
          compact
          title={t('departments.totalCourses', 'المقررات الدراسية')}
          value={totalCourses}
          icon={BookOpen}
          color="amber"
        />
      </div>

      {/* ========================================================================= */}
      {/* 2. UNIFIED FILTER & ACTION TOOLBAR                                        */}
      {/* ========================================================================= */}
      <div className="p-2.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs flex flex-wrap items-center justify-between gap-2.5 mb-6">
        {/* Left Side: Search, College Select, Sort Select */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={15}
              className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(
                'departments.searchPlaceholder',
                'البحث باسم القسم، الكود، أو الكلية...'
              )}
              className="w-full h-9 ps-9 pe-8 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1.5 focus:ring-brand-primary-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                title={t('common.clear', 'مسح')}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* College Filter (Visible for Super Admin / All Roles if not scoped) */}
          {!isCollegeAdmin && (
            <select
              value={selectedCollegeId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCollegeId(val);
                if (val) {
                  setSearchParams({ collegeId: val });
                } else {
                  setSearchParams({});
                }
              }}
              className="h-9 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer font-medium"
            >
              <option value="">{t('departments.allColleges', 'جميع الكليات')}</option>
              {Array.isArray(colleges) &&
                colleges.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {isRTL ? c.nameAr || c.name : c.name}
                  </option>
                ))}
            </select>
          )}

          {/* Sort Select */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="h-9 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-brand-primary-500 cursor-pointer font-medium"
          >
            <option value="name">{t('departments.sortByName', 'ترتيب: الاسم')}</option>
            <option value="students">{t('departments.sortByStudents', 'ترتيب: الأكثر طلاباً')}</option>
            <option value="courses">{t('departments.sortByCourses', 'ترتيب: الأكثر مقررات')}</option>
            <option value="faculty">{t('departments.sortByFaculty', 'ترتيب: الكادر الأكاديمي')}</option>
          </select>

          {/* Select All Button */}
          {canManage && sortedDepartments.length > 0 && (
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className={`h-9 px-3 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                isAllSelected
                  ? 'bg-brand-primary-500 text-white border-brand-primary-500 shadow-xs'
                  : isSomeSelected
                  ? 'bg-brand-primary-50 dark:bg-brand-primary-950/40 text-brand-primary-700 dark:text-brand-primary-300 border-brand-primary-300'
                  : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
              }`}
              title={isAllSelected ? t('common.deselectAll', 'إلغاء تحديد الكل') : t('common.selectAll', 'تحديد الكل')}
            >
              {isAllSelected ? (
                <CheckSquare size={14} />
              ) : isSomeSelected ? (
                <MinusSquare size={14} />
              ) : (
                <Square size={14} />
              )}
              <span>
                {isAllSelected
                  ? t('common.deselectAll', 'إلغاء تحديد الكل')
                  : t('common.selectAll', 'تحديد الكل')}
              </span>
            </button>
          )}

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-9 px-3 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl font-bold cursor-pointer transition-colors"
            >
              <X size={13} className="me-1" />
              {isRTL ? 'مسح الفلاتر' : 'Clear Filters'}
            </Button>
          )}
        </div>

        {/* Right Side: Result Count & View Mode Switcher */}
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2.5 py-1.5 rounded-xl">
            {t('departments.showingCount', { count: sortedDepartments.length })}
          </span>

          <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-800 text-brand-primary-600 dark:text-brand-primary-400 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
              title={t('departments.viewGrid', 'عرض بطاقات')}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-800 text-brand-primary-600 dark:text-brand-primary-400 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
              title={t('departments.viewTable', 'عرض جدول')}
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. CONTENT AREA: LOADING / EMPTY / GRID / TABLE                            */}
      {/* ========================================================================= */}
      {loading ? (
        <div className="flex flex-col justify-center items-center h-80 gap-3">
          <Loader2 className="animate-spin text-brand-primary-600" size={42} />
          <p className="text-xs text-slate-400 font-semibold">{t('common.loading', 'جاري التحميل...')}</p>
        </div>
      ) : sortedDepartments.length === 0 ? (
        <EmptyState
          icon={<Layers size={44} className="text-slate-400" />}
          title={t('departments.noDepts', 'لم يتم العثور على أقسام تطابق معاييرك.')}
          subtitle={t('departments.noDeptsDesc', 'حاول ضبط البحث أو الفلاتر للعثور على ما تبحث عنه.')}
          action={
            canManage
              ? {
                  label: t('departments.addDept', 'إضافة قسم'),
                  onClick: () => setIsAddModalOpen(true),
                }
              : null
          }
        />
      ) : viewMode === 'grid' ? (
        /* ================= GRID VIEW ================= */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedDepartments.map((dept: any) => {
            const collegeName = isRTL
              ? dept.college?.nameAr || dept.college?.name || ''
              : dept.college?.name || dept.college?.nameAr || '';

            const studentCount = dept._count?.students ?? 0;
            const courseCount = dept._count?.courses ?? 0;
            const doctorCount = dept._count?.doctors ?? 0;

            const isSelected = selectedIds.has(dept.id);

            return (
              <Card
                key={dept.id}
                noPadding
                onClick={() => setActiveDrawerId(String(dept.id))}
                className={`group relative rounded-2xl border shadow-2xs hover:shadow-md hover:-translate-y-1 transition-all duration-200 overflow-hidden flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'border-brand-primary-500 ring-2 ring-brand-primary-500/20 bg-brand-primary-500/[0.02] dark:bg-brand-primary-500/[0.04]'
                    : 'border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-800 hover:border-brand-primary-500/40'
                }`}
              >
                <div className="p-6">
                  {/* Top Bar: Icon + College Badge + Admin Actions */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      {canManage && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleToggleSelect(dept.id)}
                            className="text-slate-400 hover:text-brand-primary-600 focus:outline-none transition-colors p-0.5 cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare size={18} className="text-brand-primary-600" />
                            ) : (
                              <Square size={18} />
                            )}
                          </button>
                        </div>
                      )}
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-primary-500/10 to-brand-primary-600/20 text-brand-primary-600 dark:text-brand-primary-400 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                        <Layers size={22} />
                      </div>
                      <div className="flex flex-col">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-600/40 w-fit max-w-[200px] truncate">
                          <Building size={11} className="shrink-0 text-slate-400" />
                          <span className="truncate">{collegeName}</span>
                        </span>
                      </div>
                    </div>

                    {/* Admin Actions */}
                    {canManage && (
                      <div
                        className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleEdit(dept)}
                          title={t('common.edit', 'تعديل')}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors cursor-pointer"
                        >
                          <Edit2 size={15} />
                        </button>
                        {isSuperAdmin && (
                          <button
                            onClick={() =>
                              setDeleteTarget({
                                id: dept.id,
                                name: isRTL ? dept.nameAr || dept.name : dept.name,
                              })
                            }
                            title={t('common.delete', 'حذف')}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-colors cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Department Names */}
                  <div className="mb-4">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white leading-snug group-hover:text-brand-primary-600 dark:group-hover:text-brand-primary-400 transition-colors">
                      {isRTL ? dept.nameAr || dept.name : dept.name}
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-400 font-medium mt-0.5 truncate">
                      {isRTL ? dept.name : dept.nameAr || ''}
                    </p>
                  </div>

                  {/* 3-Metric Interactive Ribbon */}
                  <div
                    className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/60 my-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Students Link */}
                    <Link
                      to={`/students?departmentId=${dept.id}`}
                      className="flex flex-col items-center p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-all group/stat text-center"
                      title={t('departments.students', 'الطلاب')}
                    >
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 group-hover/stat:text-blue-600 dark:group-hover/stat:text-blue-400">
                        <Users size={12} />
                        <span>{t('departments.students', 'الطلاب')}</span>
                      </div>
                      <span className="text-base font-black text-slate-900 dark:text-white mt-0.5 font-mono group-hover/stat:text-blue-600 dark:group-hover/stat:text-blue-400">
                        {studentCount}
                      </span>
                    </Link>

                    {/* Courses Link */}
                    <Link
                      to={`/courses?departmentId=${dept.id}`}
                      className="flex flex-col items-center p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-all group/stat text-center border-x border-slate-200/60 dark:border-slate-700/60"
                      title={t('departments.courses', 'المقررات')}
                    >
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 group-hover/stat:text-emerald-600 dark:group-hover/stat:text-emerald-400">
                        <BookOpen size={12} />
                        <span>{t('departments.courses', 'المقررات')}</span>
                      </div>
                      <span className="text-base font-black text-slate-900 dark:text-white mt-0.5 font-mono group-hover/stat:text-emerald-600 dark:group-hover/stat:text-emerald-400">
                        {courseCount}
                      </span>
                    </Link>

                    {/* Faculty Members */}
                    <div className="flex flex-col items-center p-1.5 text-center">
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        <GraduationCap size={12} />
                        <span>{t('departments.doctors', 'الكادر')}</span>
                      </div>
                      <span className="text-base font-black text-slate-900 dark:text-white mt-0.5 font-mono">
                        {doctorCount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div
                  className="px-5 py-3 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveDrawerId(String(dept.id))}
                    className="flex-1 text-xs font-bold text-brand-primary-600 dark:text-brand-primary-400 hover:bg-brand-primary-50 dark:hover:bg-brand-primary-950/40 rounded-xl py-1.5 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Eye size={14} />
                    <span>{t('departments.viewDetails', 'عرض التفاصيل')}</span>
                  </Button>

                  <button
                    onClick={() => navigate(`/courses?departmentId=${dept.id}`)}
                    className="p-2 text-slate-500 hover:text-brand-primary-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                    title={t('departments.manageCurriculum', 'المقررات الدراسية')}
                  >
                    <BookOpen size={15} />
                  </button>

                  <button
                    onClick={() =>
                      navigate(
                        `/schedules/timetable?departmentId=${dept.id}&collegeId=${dept.collegeId || ''}`
                      )
                    }
                    className="p-2 text-slate-500 hover:text-brand-primary-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                    title={t('departments.schedules', 'الجدول الدراسي')}
                  >
                    <Calendar size={15} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* ================= TABLE VIEW ================= */
        <Card noPadding className="rounded-2xl border border-slate-200/90 dark:border-slate-700 overflow-hidden shadow-2xs">
          <Table>
            <TableHeader>
              <TableRow>
                {canManage && (
                  <TableHead className="w-12 text-center p-3">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-slate-400 hover:text-brand-primary-600 focus:outline-none transition-colors p-1"
                      title={isAllSelected ? t('common.deselectAll', 'إلغاء تحديد الكل') : t('common.selectAll', 'تحديد الكل')}
                    >
                      {isAllSelected ? (
                        <CheckSquare size={16} className="text-brand-primary-600" />
                      ) : isSomeSelected ? (
                        <MinusSquare size={16} className="text-brand-primary-600" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </TableHead>
                )}
                <TableHead>{t('departments.department', 'القسم')}</TableHead>
                <TableHead>{t('departments.homeCollege', 'الكلية التابعة')}</TableHead>
                <TableHead className="text-center">{t('departments.students', 'الطلاب')}</TableHead>
                <TableHead className="text-center">{t('departments.courses', 'المقررات')}</TableHead>
                <TableHead className="text-center">{t('departments.doctors', 'هيئة التدريس')}</TableHead>
                <TableHead className="text-end">{t('departments.actions', 'الإجراءات')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedDepartments.map((dept: any) => {
                const collegeName = isRTL
                  ? dept.college?.nameAr || dept.college?.name || ''
                  : dept.college?.name || dept.college?.nameAr || '';
                const isSelected = selectedIds.has(dept.id);

                return (
                  <TableRow
                    key={dept.id}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer ${
                      isSelected ? 'bg-brand-primary-500/[0.04] dark:bg-brand-primary-500/[0.08]' : ''
                    }`}
                    onClick={() => setActiveDrawerId(String(dept.id))}
                  >
                    {canManage && (
                      <TableCell className="w-12 text-center p-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(dept.id)}
                          className="text-slate-400 hover:text-brand-primary-600 focus:outline-none transition-colors p-1"
                        >
                          {isSelected ? (
                            <CheckSquare size={16} className="text-brand-primary-600" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </TableCell>
                    )}

                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400 flex items-center justify-center shrink-0">
                          <Layers size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                            {isRTL ? dept.nameAr || dept.name : dept.name}
                          </p>
                          <p className="text-xs text-slate-400 font-medium mt-0.5">
                            {isRTL ? dept.name : dept.nameAr || ''}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-600/40">
                        <Building size={12} className="text-slate-400" />
                        {collegeName}
                      </span>
                    </TableCell>

                    <TableCell className="text-center">
                      <Link
                        to={`/students?departmentId=${dept.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs font-black text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <Users size={13} />
                        <span>{dept._count?.students ?? 0}</span>
                      </Link>
                    </TableCell>

                    <TableCell className="text-center">
                      <Link
                        to={`/courses?departmentId=${dept.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs font-black text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        <BookOpen size={13} />
                        <span>{dept._count?.courses ?? 0}</span>
                      </Link>
                    </TableCell>

                    <TableCell className="text-center font-black text-slate-700 dark:text-slate-300 text-xs">
                      {dept._count?.doctors ?? 0}
                    </TableCell>

                    <TableCell className="text-end" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setActiveDrawerId(String(dept.id))}
                          className="p-1.5 text-slate-500 hover:text-brand-primary-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          title={t('departments.viewDetails', 'عرض التفاصيل')}
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => navigate(`/courses?departmentId=${dept.id}`)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                          title={t('departments.manageCurriculum', 'المقررات الدراسية')}
                        >
                          <BookOpen size={15} />
                        </button>
                        <button
                          onClick={() =>
                            navigate(
                              `/schedules/timetable?departmentId=${dept.id}&collegeId=${dept.collegeId || ''}`
                            )
                          }
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors"
                          title={t('departments.schedules', 'الجدول الدراسي')}
                        >
                          <Calendar size={15} />
                        </button>

                        {canManage && (
                          <>
                            <button
                              onClick={() => handleEdit(dept)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
                              title={t('common.edit', 'تعديل')}
                            >
                              <Edit2 size={15} />
                            </button>
                            {isSuperAdmin && (
                              <button
                                onClick={() =>
                                  setDeleteTarget({
                                    id: dept.id,
                                    name: isRTL ? dept.nameAr || dept.name : dept.name,
                                  })
                                }
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                                title={t('common.delete', 'حذف')}
                              >
                                <Trash2 size={15} />
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
        </Card>
      )}

      {/* ========================================================================= */}
      {/* 4. MODALS & DRAWER                                                        */}
      {/* ========================================================================= */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        itemName={deleteTarget?.name}
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
      />

      {/* Floating Bulk Action Toolbar */}
      {canManage && (
        <BulkActionToolbar
          selectedCount={selectedIds.size}
          onClear={handleBulkClear}
          onExport={handleBulkExport}
          onDelete={isSuperAdmin ? () => setBulkDeleteModalOpen(true) : undefined}
        />
      )}

      {/* Batch Deletion Modal */}
      <ConfirmDeleteModal
        isOpen={bulkDeleteModalOpen}
        itemName={`${selectedIds.size} ${t('departments.title', 'أقسام')}`}
        onClose={() => !isBulkDeleting && setBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        loading={isBulkDeleting}
      />

      <AddDepartmentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        colleges={colleges}
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchDepartments();
          showToast(t('departments.createSuccess', 'تم إنشاء القسم بنجاح'), 'success');
        }}
      />

      {isEditModalOpen && (
        <EditDepartmentModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedDepartment(null);
          }}
          department={selectedDepartment}
          colleges={colleges}
          onSuccess={() => {
            setIsEditModalOpen(false);
            setSelectedDepartment(null);
            fetchDepartments();
            showToast(t('departments.updateSuccess', 'تم تحديث القسم بنجاح'), 'success');
          }}
        />
      )}

      <Drawer
        isOpen={Boolean(activeDrawerId)}
        onClose={() => setActiveDrawerId(null)}
        width="max-w-4xl"
      >
        {activeDrawerId && (
          <Suspense
            fallback={
              <div className="flex justify-center items-center p-16">
                <Loader2 className="animate-spin text-brand-primary-600" size={36} />
              </div>
            }
          >
            <DepartmentDetails departmentId={activeDrawerId} isDrawerMode />
          </Suspense>
        )}
      </Drawer>
    </div>
  );
};

export default DepartmentsList;
