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
} from 'lucide-react';
import studentService from '../../services/students.service';
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
import StudentDetails from './StudentDetails';
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
  const { data: students, loading: _loading, error, search, setSearch, page, setPage, total, refetch } = useStudents({ initialSearch: activeView?.search || '', limit: activeView?.pageSize || 10 });
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

  



  const handleExport = async () => {
    try {
      setExporting(true);
            const blob = await (studentService as unknown as Record<string, unknown>).exportStudents();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `students_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast(t('students.exportSuccess'), 'success');
    } catch (_err: any) {
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
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return s.isActive;
    if (statusFilter === 'inactive') return !s.isActive;
    if (statusFilter === 'pending') return false;
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
          className="shadow-xl shadow-brand-brand-green-dark/20 h-12 px-6"
        >
          <Plus size={18} className="mr-2" /> {t('students.addStudent')}
        </Button>
      </div>

      <Card noPadding className="border-l-0 overflow-hidden shadow-soft">
        <FilterBar>
          <div className="relative flex-1 max-w-md">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-muted"
              size={18}
            />
            <Input
              placeholder={t('students.searchPlaceholder')}
              className="pl-11 h-11 bg-brand-bg-page/50 border-transparent focus:bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exporting}
            className="h-11 px-5 border-brand-border hover:bg-brand-bg-page"
          >
            <Download size={14} />
            {exporting ? t('common.loading') : t('common.exportCsv')}
          </Button>
          <button onClick={() => setStatusFilter('all')}>
            <Badge
              variant={statusFilter === 'all' ? 'primary' : 'outline'}
              className="cursor-pointer px-3 py-1"
            >
              {t('students.allStudents')}
            </Badge>
            <Badge
              variant={statusFilter === 'pending' ? 'warning' : 'outline'}
              className="cursor-pointer px-3 py-1"
            >
              {t('students.pending')}
            </Badge>
          </button>
          <button onClick={() => setStatusFilter('inactive')}>
            <Badge
              variant={statusFilter === 'inactive' ? 'danger' : 'outline'}
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
              title={t('students.noStudentsWithFilter')}
              subtitle={
                t('students.noStudentsWithFilterDesc')
              }
              action={{
                label: t('common.clearFilter'),
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
                      <TableCell className="font-black text-brand-navy-500 dark:text-brand-brand-green tracking-widest text-xs uppercase hidden md:table-cell">
                        {student.studentId}
                      </TableCell>
                    )}
                    {activeView.visibleColumns?.includes('fullName') && (
                      <TableCell>
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-2xl bg-brand-primary-50 dark:bg-brand-primary-900/10 flex items-center justify-center text-brand-brand-green-dark font-black shadow-inner ring-1 ring-brand-primary-100/50 dark:ring-brand-primary-900/20 group-hover:scale-110 transition-transform">
                            {student.firstName[0]}
                            {student.lastName[0]}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-brand-text-primary dark:text-brand-text-main tracking-tight group-hover:text-brand-brand-green-dark transition-colors">
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
                        <Badge variant={student.isActive ? 'success' : 'neutral'}>
                          {student.isActive ? t('students.active') : t('students.inactive')}
                        </Badge>
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
                                onPageChange={(newLimit) => updateActiveView({ pageSize: newLimit })}
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
        width="max-w-4xl"
      >
        {activeDrawerId && <StudentDetails studentId={activeDrawerId} isDrawerMode />}
      </Drawer>
    </div>
  );
};

export default StudentsList;
