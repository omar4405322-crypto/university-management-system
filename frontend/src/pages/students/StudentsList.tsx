// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useStudents } from '../../hooks/useStudents';
import { useDebounce } from '../../hooks/useDebounce';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Table, { TableRow, TableCell, ActionMenu } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import {
  Users,
  Search,
  Plus,
  Download,
  Eye,
  Edit2,
  Trash2,
  UserX,
  UserCheck,
  Filter,
  KeyRound,
  Loader2,
} from 'lucide-react';
import studentService from '../../services/students.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import useScope from '../../hooks/useScope';
import AddStudentModal from './AddStudentModal';
import EditStudentModal from './EditStudentModal';
import ResetPasswordModal from '../../components/ui/ResetPasswordModal';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import FilterBar from '../../components/ui/FilterBar';
import Pagination from '../../components/ui/Pagination';
import ErrorState from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import Checkbox from '../../components/ui/Checkbox';
import BulkActionToolbar from '../../components/ui/BulkActionToolbar';
import Drawer from '../../components/ui/Drawer';
import ViewManager from '../../components/ui/ViewManager';
import ColumnPicker, { ColumnDef } from '../../components/ui/ColumnPicker';
import { useSavedViews, SavedView } from '../../hooks/useSavedViews';
import { useToast } from '../../context/ToastContext';

const defaultView: SavedView = {
  id: 'default',
  name: 'Default View',
  isDefault: true,
  filters: { status: 'all' },
  search: '',
  visibleColumns: ['studentId', 'fullName', 'email', 'phone', 'enrolledDate', 'status'],
  density: 'comfortable',
  pageSize: 10,
};

const StudentsList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { scopeParams, isCollegeAdmin } = useScope();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  
  
  const [exporting, setExporting] = useState(false);
  
  const { views, activeView, activeViewId, setActiveViewId, saveView, deleteView, setDefaultView, updateActiveView } = useSavedViews('students_views', defaultView);
  const { data: students, loading: _loading, error, search, setSearch, page, setPage, total, stats, refetch } = useStudents({ initialSearch: activeView?.search || '', limit: activeView?.pageSize || 10 });
  const limit = activeView?.pageSize || 10;
  const totalPages = Math.ceil(total / limit);
  const totalRecords = total;
  const fetchStudents = refetch;

  
  
  const [statusFilter, setStatusFilter] = useState(activeView.filters?.status || 'all');
  
  
  
  useEffect(() => {
    setSearch(activeView.search || '');
    setStatusFilter(activeView.filters?.status || 'all');
    setPage(1); // Reset page on view change
  }, [activeViewId]);

  // Update view when local state changes
  useEffect(() => {
    updateActiveView({
      search,
      filters: { ...activeView.filters, status: statusFilter },
      pageSize: limit,
    });
  }, [search, statusFilter, limit]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [resetPasswordStudent, setResetPasswordStudent] = useState(null);
  const { showToast } = useToast();
  const [activeDrawerId, setActiveDrawerId] = useState<string | null>(null);
  const [colleges, setColleges] = useState<any[]>([]);
  const [collegeFilter, setCollegeFilter] = useState('all');
  const [departments, setDepartments] = useState<any[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');

  const showCollegeFilter = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const showDeptFilter = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'COLLEGE_ADMIN';

  useEffect(() => {
    if (showCollegeFilter) {
      const fetchColleges = async () => {
        try {
          const res = await collegeService.getColleges();
          if (res.success) {
            setColleges(res.data || []);
          }
        } catch (err) {
          console.error(err);
        }
      };
      fetchColleges();
    }
  }, [user, showCollegeFilter]);

  useEffect(() => {
    if (showDeptFilter) {
      const fetchDepartments = async () => {
        try {
          let params: Record<string, unknown> = {};
          if (user?.role === 'COLLEGE_ADMIN') {
            const collegeId = user?.managedCollegeId || user?.collegeId;
            if (collegeId) {
              params.collegeId = collegeId;
            }
          }
          const res = await departmentService.getDepartments(params);
          if (res.success) {
            setDepartments(res.data || []);
          }
        } catch (err) {
          console.error(err);
        }
      };
      fetchDepartments();
    }
  }, [user, showDeptFilter]);

  const filteredDepartmentsDropdown = React.useMemo(() => {
    if (user?.role === 'COLLEGE_ADMIN') {
      return departments;
    }
    if (collegeFilter && collegeFilter !== 'all') {
      return departments.filter(d => d.collegeId?.toString() === collegeFilter);
    }
    return departments;
  }, [departments, collegeFilter, user]);

  



  const handleExport = () => {
    try {
      setExporting(true);
      
      const headers = [
        "رقم الطالب",
        "الاسم الكامل",
        "البريد الإلكتروني",
        "الهاتف",
        "الحالة",
        "السنة الدراسية",
        "تاريخ التسجيل"
      ];

      const rows = filteredStudents.map(student => {
        const studentId = student.studentId || '';
        const fullName = `${student.firstName} ${student.lastName}`;
        const email = student.user?.email || '';
        const phone = student.phone || '';
        const status = student.isActive 
          ? t('students.active') 
          : (student.status === 'pending' ? t('students.pending') : t('students.inactive'));
        const year = t(`STUDENTS.YEAR${student.year}`, `Year ${student.year}`);
        const enrolledDate = new Date(student.enrolledAt).toLocaleDateString();

        return [
          studentId,
          fullName,
          email,
          phone,
          status,
          year,
          enrolledDate
        ];
      });

      const csvContent = "\uFEFF" + [
        headers.join(","),
        ...rows.map(e => e.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `students_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      showToast(t('students.exportSuccess'), 'success');
    } catch (err) {
      console.error(err);
      showToast(t('students.exportError'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleToggleStatus = async (student) => {
    try {
      const result = await studentService.updateStudent(student.id, {
        isActive: !student.isActive,
      });
      if (result.success) {
        showToast(
          student.isActive ? t('students.deactivated') : t('students.activated'),
          'success'
        );
        fetchStudents();
      }
    } catch (_err: any) {
      showToast(t('common.error'), 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      const result = await studentService.deleteStudent(deleteTarget.id);
      if (result.success) {
        showToast(t('students.deleteSuccess'), 'success');
        setDeleteTarget(null);
        fetchStudents();
      }
    } catch (_err: any) {
      showToast(t('common.error'), 'error');
    } finally {
      setDeleteLoading(false);
    }
  };


  const filteredStudents = (Array.isArray(students) ? students : []).filter((s) => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'active' && !s.isActive) return false;
      if (statusFilter === 'inactive' && s.isActive) return false;
      if (statusFilter === 'pending' && s.status !== 'pending') return false;
    }
    
    if (showCollegeFilter && collegeFilter !== 'all') {
      const selectedCollege = colleges.find(c => c.id.toString() === collegeFilter);
      if (selectedCollege) {
        if (s.department?.college?.name !== selectedCollege.name) return false;
      }
    }

    if (showDeptFilter && departmentFilter !== 'all') {
      const studentDeptId = s.department?.id || s.departmentId;
      if (studentDeptId?.toString() !== departmentFilter) return false;
    }

    if (yearFilter !== 'all') {
      if (s.year?.toString() !== yearFilter) return false;
    }

    return true;
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const newIds = new Set(selectedIds);
      filteredStudents.forEach((s) => newIds.add(s.id));
      setSelectedIds(Array.from(newIds));
    } else {
      const visibleIds = filteredStudents.map((s) => s.id);
      setSelectedIds(selectedIds.filter((id) => !visibleIds.includes(id)));
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulkClear = () => setSelectedIds([]);
  const handleBulkExport = () => {
    showToast(t('common.exporting', 'Exporting selected...'), 'success');
  };
  const handleBulkDelete = () => {
    showToast(t('common.deleted', 'Deleted selected records'), 'success');
    setSelectedIds([]);
  };
  const handleBulkStatusChange = () => {
    showToast(t('common.statusChanged', 'Status changed for selected records'), 'success');
    setSelectedIds([]);
  };

  const visibleIds = filteredStudents.map((s) => s.id);
  const isAllVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  return (
    <div className="section-gap animate-in fade-in duration-700">
      

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-brand-text-primary tracking-tight">
            {t('students.title')}
          </h1>
          <p className="text-brand-text-muted font-bold mt-1 uppercase tracking-widest text-xs">
            {t('students.subtitle')}
          </p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="shadow-xl shadow-brand-green-dark/20 h-12 px-6"
        >
          <Plus size={18} className="mr-2" /> {t('students.addStudent')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: t('students.totalStudents', 'إجمالي الطلاب'), value: stats?.total || 0, icon: Users, color: 'navy' },
          { label: t('students.active', 'نشطون'), value: stats?.active || 0, icon: UserCheck, color: 'green' },
          { label: t('students.pending', 'معلقون'), value: stats?.pending || 0, icon: Filter, color: 'yellow' },
          { label: t('students.inactive', 'غير نشطون'), value: stats?.inactive || 0, icon: UserX, color: 'red' },
        ].map((stat, i) => (
          <Card key={i} noPadding className="group hover:-translate-y-1 transition-all duration-300 border-none shadow-soft overflow-hidden">
            <div className="p-6 flex items-center justify-between">
              <div>
                <p className="label-stat mb-1">{stat.label}</p>
                <h3 className="m-0 text-3xl font-black text-brand-text-primary dark:text-brand-text-main tracking-tightest">{stat.value}</h3>
              </div>
              <div className={`rounded-[1.25rem] p-3.5 transition-all duration-500 shadow-inner ${
                stat.color === 'navy' ? 'bg-brand-navy-50 text-brand-navy-500 group-hover:bg-brand-navy-500 group-hover:text-white' :
                stat.color === 'green' ? 'bg-brand-primary-50 text-brand-primary-500 group-hover:bg-brand-primary-500 group-hover:text-white' :
                stat.color === 'yellow' ? 'bg-brand-accent-yellow/10 text-brand-accent-yellow group-hover:bg-brand-accent-yellow group-hover:text-white' :
                'bg-red-50 text-red-500 group-hover:bg-red-500 group-hover:text-white'
              }`}>
                <stat.icon size={28} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card noPadding className="border-l-0 overflow-hidden shadow-soft">
        <FilterBar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          searchPlaceholder={t('students.searchPlaceholder')}
        >
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exporting}
            className="h-10 px-5 border-brand-border hover:bg-brand-bg-page gap-2 text-xs font-bold"
          >
            <Download size={14} />
            {exporting ? t('common.loading') : t('common.exportCsv')}
          </Button>

          {/* College Dropdown */}
          {showCollegeFilter && (
            <select
              value={collegeFilter}
              onChange={(e) => { setCollegeFilter(e.target.value); setDepartmentFilter('all'); setPage(1); }}
              className="h-10 px-3 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border rounded-xl text-sm text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 cursor-pointer"
            >
              <option value="all">{t('common.allColleges', 'كل الكليات')}</option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id.toString()}>
                  {c.nameAr || c.name}
                </option>
              ))}
            </select>
          )}

          {/* Department Dropdown */}
          {showDeptFilter && (
            <select
              value={departmentFilter}
              onChange={(e) => { setDepartmentFilter(e.target.value); setPage(1); }}
              className="h-10 px-3 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border rounded-xl text-sm text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 cursor-pointer"
            >
              <option value="all">{t('common.allDepartments', 'كل الأقسام')}</option>
              {filteredDepartmentsDropdown.map((d) => (
                <option key={d.id} value={d.id.toString()}>
                  {d.nameAr || d.name}
                </option>
              ))}
            </select>
          )}

          {/* Year Dropdown */}
          <select
            value={yearFilter}
            onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}
            className="h-10 px-3 bg-brand-bg-card dark:bg-brand-bg-elevated border border-brand-border rounded-xl text-sm text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 cursor-pointer"
          >
            <option value="all">{t('common.allYears', 'كل السنوات')}</option>
            <option value="1">{t('students.year1', 'السنة الأولى') || 'السنة الأولى'}</option>
            <option value="2">{t('students.year2', 'السنة الثانية') || 'السنة الثانية'}</option>
            <option value="3">{t('students.year3', 'السنة الثالثة') || 'السنة الثالثة'}</option>
            <option value="4">{t('students.year4', 'السنة الرابعة') || 'السنة الرابعة'}</option>
          </select>

          <button type="button" onClick={() => setStatusFilter('all')}>
            <Badge
              variant={statusFilter === 'all' ? 'primary' : 'neutral'}
              className="cursor-pointer px-3 py-1"
            >
              {t('students.allStudents')}
            </Badge>
          </button>
          <button type="button" onClick={() => setStatusFilter('active')}>
            <Badge
              variant={statusFilter === 'active' ? 'success' : 'neutral'}
              className="cursor-pointer px-3 py-1"
            >
              {t('students.active')}
            </Badge>
          </button>
          <button type="button" onClick={() => setStatusFilter('pending')}>
            <Badge
              variant={statusFilter === 'pending' ? 'warning' : 'neutral'}
              className="cursor-pointer px-3 py-1"
            >
              {t('students.pending')}
            </Badge>
          </button>
          <button type="button" onClick={() => setStatusFilter('inactive')}>
            <Badge
              variant={statusFilter === 'inactive' ? 'danger' : 'neutral'}
              className="cursor-pointer px-3 py-1"
            >
              {t('students.inactive')}
            </Badge>
          </button>
        </FilterBar>

        <div className="min-h-[400px]">
          {error ? (
            <div className="p-8">
              <ErrorState message={error} onRetry={fetchStudents} />
            </div>
          ) : !Array.isArray(students) || students.length === 0 ? (
            <EmptyState
              icon={<Users size={40} />}
              title={search ? t('students.noSearchResults') : t('students.noStudents')}
              subtitle={search ? t('students.noSearchResultsDesc') : t('students.noStudentsDesc')}
              action={
                search
                  ? { label: t('common.clearSearch'), onClick: () => setSearch('') }
                  : { label: t('students.addFirstStudent'), onClick: () => setShowAddModal(true) }
              }
            />
          ) : filteredStudents.length === 0 ? (
            <EmptyState
              icon={<Users size={40} />}
              title={t('students.noStudentsWithFilter') || 'لا يوجد طلاب بهذا الفلتر'}
              subtitle={
                t('students.noStudentsWithFilterDesc') || 'حاول تغيير الفلتر لعرض المزيد من النتائج'
              }
              action={{
                label: t('common.clearFilter') || 'مسح الفلتر',
                onClick: () => setStatusFilter('all'),
              }}
            />
          ) : (
            <>
              <Table
                headers={[
                  <Checkbox
                    key="selectAll"
                    checked={isAllVisibleSelected}
                    onChange={handleSelectAll}
                  />,
                  ...(activeView.visibleColumns?.includes('studentId') ? [t('students.studentId')] : []),
                  ...(activeView.visibleColumns?.includes('fullName') ? [t('students.fullName')] : []),
                  ...(activeView.visibleColumns?.includes('email') ? [t('auth.email')] : []),
                  ...(activeView.visibleColumns?.includes('phone') ? [t('students.phone')] : []),
                  ...(activeView.visibleColumns?.includes('enrolledDate') ? [t('students.enrolledDate')] : []),
                  ...(activeView.visibleColumns?.includes('status') ? [t('profile.status')] : []),
                  t('common.actions'),
                ]}
              >
                {filteredStudents.map((student) => {
                  const isSelected = selectedIds.includes(student.id);
                  return (
                    <TableRow key={student.id} isSelected={isSelected}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onChange={() => handleSelectOne(student.id)}
                        />
                      </TableCell>
                      {activeView.visibleColumns?.includes('studentId') && (
                        <TableCell className="font-black text-brand-navy-500 dark:text-brand-green tracking-widest text-xs uppercase hidden md:table-cell">
                          {student.studentId}
                        </TableCell>
                      )}
                      {activeView.visibleColumns?.includes('fullName') && (
                        <TableCell>
                          <div className="flex items-center gap-4 cursor-pointer" onClick={() => setActiveDrawerId(student.id)}>
                            <div className="w-11 h-11 rounded-2xl bg-brand-primary-50 dark:bg-brand-primary-900/10 flex items-center justify-center text-brand-green-dark font-black shadow-inner ring-1 ring-brand-primary-100/50 dark:ring-brand-primary-900/20 group-hover:scale-110 transition-transform">
                              {student.user?.profilePicture ? (
                                <img src={student.user.profilePicture} alt="" className="w-full h-full rounded-2xl object-cover" />
                              ) : (
                                `${student.firstName[0]}${student.lastName[0]}`
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-black text-brand-text-primary dark:text-brand-text-main tracking-tight group-hover:text-brand-green-dark transition-colors">
                                {student.firstName} {student.lastName}
                              </span>
                              <span className="text-[10px] font-black uppercase text-brand-text-muted tracking-wider">
                                {t(`STUDENTS.YEAR${student.year}`, `Year ${student.year}`)}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                      )}
                      {activeView.visibleColumns?.includes('email') && (
                        <TableCell className="text-brand-text-secondary font-bold text-xs hidden md:table-cell">
                          {student.user?.email}
                        </TableCell>
                      )}
                      {activeView.visibleColumns?.includes('phone') && (
                        <TableCell className="text-brand-text-secondary font-bold text-xs hidden md:table-cell">
                          {student.phone?.trim() ? student.phone : t('students.phoneNotSpecified')}
                        </TableCell>
                      )}
                      {activeView.visibleColumns?.includes('enrolledDate') && (
                        <TableCell className="text-brand-text-secondary font-bold text-xs hidden md:table-cell">
                          {new Date(student.enrolledAt).toLocaleDateString()}
                        </TableCell>
                      )}
                      {activeView.visibleColumns?.includes('status') && (
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider ${
                            student.isActive
                              ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                              : student.status === 'pending'
                                ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
                                : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                          }`}>
                            {student.isActive ? t('students.active') : student.status === 'pending' ? t('students.pending') : t('students.inactive')}
                          </span>
                        </TableCell>
                      )}
                      <TableCell>
                        <ActionMenu
                          actions={[
                            {
                              label: t('common.view'),
                              icon: Eye,
                              variant: 'view',
                              onClick: () => setActiveDrawerId(student.id),
                            },
                            {
                              label: t('common.edit'),
                              icon: Edit2,
                              variant: 'edit',
                              onClick: () => setEditingStudent(student),
                            },
                            {
                              label: 'Reset Password',
                              icon: KeyRound,
                              variant: 'edit',
                              onClick: () => setResetPasswordStudent(student),
                            },
                            {
                              label: student.isActive
                                ? t('students.deactivate')
                                : t('students.activate'),
                              icon: student.isActive ? UserX : UserCheck,
                              variant: student.isActive ? 'delete' : 'edit',
                              onClick: () => handleToggleStatus(student),
                            },
                            ...(isSuperAdmin
                              ? [
                                  {
                                    label: t('common.delete'),
                                    icon: Trash2,
                                    variant: 'delete',
                                    onClick: () =>
                                      setDeleteTarget({
                                        id: student.id,
                                        name: `${student.firstName} ${student.lastName}`,
                                      }),
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </Table>

              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                total={totalRecords}
                pageSize={limit}
                onPageSizeChange={(newLimit) => {
                  updateActiveView({ pageSize: newLimit });
                  setPage(1);
                }}
              />
            </>
          )}
        </div>
      </Card>

      <BulkActionToolbar
        selectedCount={selectedIds.length}
        onClear={handleBulkClear}
        onExport={handleBulkExport}
        onDelete={handleBulkDelete}
        onStatusChange={handleBulkStatusChange}
      />

      {/* Modals */}
      {showAddModal && (
        <AddStudentModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            showToast(t('students.addSuccess'), 'success');
            fetchStudents();
          }}
        />
      )}

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        itemName={deleteTarget?.name}
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
      />

      {editingStudent && (
        <EditStudentModal
          isOpen={!!editingStudent}
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSuccess={() => {
            setEditingStudent(null);
            showToast(t('students.updateSuccess'), 'success');
            fetchStudents();
          }}
        />
      )}

      <ResetPasswordModal
        isOpen={!!resetPasswordStudent}
        onClose={() => setResetPasswordStudent(null)}
        person={resetPasswordStudent}
        type="student"
      />

      <Drawer
        isOpen={Boolean(activeDrawerId)}
        onClose={() => setActiveDrawerId(null)}
        width="max-w-md"
        title={t('students.requestDetails', 'تفاصيل الطالب')}
      >
        {activeDrawerId && (
          <StudentQuickView
            studentId={activeDrawerId}
            onClose={() => setActiveDrawerId(null)}
          />
        )}
      </Drawer>
    </div>
  );
};

const InfoItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="space-y-1">
    <p className="text-xs font-bold text-brand-text-secondary dark:text-brand-text-muted uppercase tracking-wider">
      {label}
    </p>
    <div className="text-base text-brand-text-primary dark:text-brand-text-main font-semibold">
      {value}
    </div>
  </div>
);

interface StudentQuickViewProps {
  studentId: string;
  onClose: () => void;
}

const StudentQuickView: React.FC<StudentQuickViewProps> = ({ studentId, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const res = await studentService.getStudentById(studentId);
        if (res.success) {
          setStudent(res.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="animate-spin text-brand-primary-500" size={32} />
        <p className="text-sm font-bold text-brand-text-muted">{t('common.loading')}</p>
      </div>
    );
  }

  if (!student) return null;

  return (
    <div className="flex flex-col gap-6 text-start">
      {/* Profile Header */}
      <div className="flex items-center gap-4 border-b border-brand-border dark:border-brand-border/40 pb-5">
        <div className="w-16 h-16 rounded-2xl bg-brand-primary-50 dark:bg-brand-primary-900/10 flex items-center justify-center text-brand-primary-500 text-xl font-black shadow-inner ring-1 ring-brand-primary-100/50">
          {student.user?.profilePicture ? (
            <img src={student.user.profilePicture} alt="" className="w-full h-full rounded-2xl object-cover" />
          ) : (
            `${student.firstName[0]}${student.lastName[0]}`
          )}
        </div>
        <div className="flex flex-col">
          <h3 className="text-xl font-black text-brand-text-primary dark:text-brand-text-main">
            {student.firstName} {student.lastName}
          </h3>
          <span className="text-xs font-mono font-black tracking-widest text-brand-navy-500 dark:text-brand-green mt-0.5">
            {student.studentId}
          </span>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <InfoItem label={t('auth.college', 'الكلية')} value={student.department?.college?.nameAr || student.department?.college?.name} />
        <InfoItem label={t('auth.department', 'القسم')} value={student.department?.nameAr || student.department?.name} />
        <InfoItem label={t('auth.year', 'السنة الدراسية')} value={t(`STUDENTS.YEAR${student.year}`, `Year ${student.year}`)} />
        <InfoItem label={t('profile.status', 'الحالة')} value={
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider ${
            student.isActive
              ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
              : student.status === 'pending'
                ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
                : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
          }`}>
            {student.isActive ? t('students.active') : student.status === 'pending' ? t('students.pending') : t('students.inactive')}
          </span>
        } />
        <div className="md:col-span-2">
          <InfoItem label={t('profile.email', 'البريد الإلكتروني')} value={student.user?.email} />
        </div>
        <InfoItem label={t('profile.phone', 'رقم الهاتف')} value={student.phone || t('students.phoneNotSpecified')} />
        <InfoItem label={t('students.enrolledDate', 'تاريخ التسجيل')} value={new Date(student.enrolledAt).toLocaleDateString()} />
      </div>

      {/* Footer Action */}
      <div className="mt-8 border-t border-brand-border dark:border-brand-border/40 pt-5 flex justify-end">
        <Button onClick={() => {
          onClose();
          navigate(`/students/${student.id}`);
        }} className="w-full sm:w-auto px-6">
          {t('colleges.viewDetails', 'عرض الملف الكامل')}
        </Button>
      </div>
    </div>
  );
};

export default StudentsList;
