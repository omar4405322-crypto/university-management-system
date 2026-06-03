// FIXED: Phase 5 Add Student modal; Phase 7 empty state, CSV export, delete confirm modal
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import studentsService from '../../services/students.service';
import { PageHeader } from '../../components/ui/PageHeader';
import AddStudentModal from './AddStudentModal';
import EditStudentModal from './EditStudentModal';
import Card from '../../components/ui/Card';
import Table, { TableRow, TableCell, ActionMenu } from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import FilterBar from '../../components/ui/FilterBar';
import Pagination from '../../components/ui/Pagination';
import { EmptyState } from '../../components/ui/EmptyState';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import { downloadCsv } from '../../utils/exportCsv';
import { 
  Users,
  Download,
  User,
  GraduationCap,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  Edit2,
  Trash2,
  UserCheck,
  UserX
} from 'lucide-react';

import { useTranslation } from 'react-i18next';

const StudentsList = () => {
  const { t } = useTranslation();
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState([
    { label: t('students.totalStudents'), value: '0', icon: GraduationCap, color: 'navy' },
    { label: t('students.active'), value: '0', icon: CheckCircle, color: 'green' },
    { label: t('students.pending'), value: '0', icon: Clock, color: 'yellow' },
    { label: t('students.inactive'), value: '0', icon: User, color: 'navy' },
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await studentsService.getStudents({ search, page, limit: 10 });
      if (result.success) {
        setStudents(result.data.students);
        setTotalPages(
          result.data.totalPages
            ?? result.data.pagination?.totalPages
            ?? 1
        );
        
        if (result.data.stats) {
          const s = result.data.stats;
          setStats([
            { label: t('students.totalStudents'), value: (s.total || 0).toLocaleString(), icon: GraduationCap, color: 'navy' },
            { label: t('students.active'), value: (s.active || 0).toLocaleString(), icon: CheckCircle, color: 'green' },
            { label: t('students.pending'), value: (s.pending || 0).toLocaleString(), icon: Clock, color: 'yellow' },
            { label: t('students.inactive'), value: (s.inactive || 0).toLocaleString(), icon: User, color: 'navy' },
          ]);
        }
      } else {
        setStudents([]);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Error fetching students:', err);
      setError(err.message || 'Unable to retrieve student data. Please try again.');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [search, page, t]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchStudents();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [fetchStudents]);

  const handleToggleStatus = async (student) => {
    try {
      const result = await studentsService.toggleStatus(student.id);
      if (result.success) {
        showToast(
          result.message || (student.isActive ? t('students.deactivateSuccess') : t('students.activateSuccess')),
          'success'
        );
        fetchStudents();
      }
    } catch (err) {
      showToast(err.response?.data?.message || t('students.statusError'), 'error');
    }
  };

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const result = await studentsService.getStudents({ search, page: 1, limit: 5000 });
      const rows = (result.data?.students || []).map((s) => [
        s.studentId,
        `${s.firstName} ${s.lastName}`,
        s.user?.email || '',
        s.phone || '',
        s.year,
        s.isActive ? t('students.active') : t('students.inactive'),
      ]);
      downloadCsv(
        `students-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          t('students.studentId'),
          t('students.fullName'),
          t('auth.email'),
          t('students.phone'),
          t('auth.year'),
          t('profile.status'),
        ],
        rows
      );
      showToast(t('common.exportSuccess'), 'success');
    } catch (err) {
      showToast(t('common.exportError'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      const result = await studentsService.deleteStudent(deleteTarget.id);
      if (result.success) {
        showToast(t('students.deleteSuccess'), 'success');
        setDeleteTarget(null);
        fetchStudents();
      }
    } catch (err) {
      showToast(err.message || t('students.deleteError'), 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="section-gap animate-in fade-in duration-700">
      {/* Toast Notification */}
      {toast && (
        <div className={`${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      {/* FIXED: Move action button next to title */}
      <PageHeader 
        title={t('students.title')}
        subtitle={t('students.subtitle')}
        action={{
          label: t('students.addStudent'),
          onClick: () => setShowAddModal(true)
        }}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => (
          <Card key={i} noPadding className="group hover:-translate-y-1 transition-all duration-300">
            <div className="p-6 flex items-center justify-between">
              <div>
                <p className="label-stat mb-1">{stat.label}</p>
                <h3 className="m-0 text-3xl font-black text-brand-text-primary dark:text-brand-text-main tracking-tightest">{stat.value}</h3>
              </div>
              <div className={`rounded-[1.25rem] p-3.5 transition-all duration-500 shadow-inner ${
                stat.color === 'navy' ? 'bg-brand-navy-50 text-brand-navy-500 group-hover:bg-brand-navy-500 group-hover:text-white' :
                stat.color === 'green' ? 'bg-brand-primary-50 text-brand-primary-500 group-hover:bg-brand-primary-500 group-hover:text-white' :
                'bg-brand-accent-yellow/10 text-brand-accent-yellow group-hover:bg-brand-accent-yellow group-hover:text-white'
              }`}>
                <stat.icon size={28} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card noPadding className="border-none shadow-soft overflow-hidden">
        <FilterBar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          searchPlaceholder={t('students.searchPlaceholder')}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={handleExportCsv}
            className="text-[10px] font-black uppercase tracking-widest gap-2"
          >
            <Download size={14} />
            {exporting ? t('common.loading') : t('common.exportCsv')}
          </Button>
          <Badge variant="primary" className="cursor-pointer px-3 py-1">{t('students.allStudents')}</Badge>
          <Badge variant="success" className="cursor-pointer px-3 py-1">{t('students.active')}</Badge>
          <Badge variant="warning" className="cursor-pointer px-3 py-1">{t('students.pending')}</Badge>
          <Badge variant="danger" className="cursor-pointer px-3 py-1">{t('students.inactive')}</Badge>
        </FilterBar>

        <div className="min-h-[400px]">
          {loading && students.length === 0 ? (
            <LoadingState message="Synchronizing student records..." />
          ) : error ? (
            <div className="p-8">
              <ErrorState message={error} onRetry={fetchStudents} />
            </div>
          ) : students.length === 0 ? (
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
          ) : (
            <>
              <Table headers={[t('students.studentId'), t('students.fullName'), t('auth.email'), t('students.phone'), t('students.enrolledDate'), t('profile.status'), t('common.actions')]}>
                {students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-black text-brand-navy-500 dark:text-brand-primary-400 tracking-widest text-xs uppercase">{student.studentId}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-2xl bg-brand-primary-50 dark:bg-brand-primary-900/10 flex items-center justify-center text-brand-primary-500 font-black shadow-inner ring-1 ring-brand-primary-100/50 dark:ring-brand-primary-900/20 group-hover:scale-110 transition-transform">
                          {student.firstName[0]}{student.lastName[0]}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black text-brand-text-primary dark:text-brand-text-main tracking-tight group-hover:text-brand-primary-500 transition-colors">{student.firstName} {student.lastName}</span>
                          <span className="text-[10px] font-black uppercase text-brand-text-muted tracking-wider">{t(`STUDENTS.YEAR${student.year}`, `Year ${student.year}`)}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-brand-text-secondary font-bold text-xs">{student.user?.email}</TableCell>
                    <TableCell className="text-brand-text-secondary font-bold text-xs">
                      {student.phone?.trim() ? student.phone : t('students.phoneNotSpecified')}
                    </TableCell>
                    <TableCell className="text-brand-text-secondary font-bold text-xs">
                      {new Date(student.enrolledAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.isActive ? 'success' : 'neutral'}>
                        {student.isActive ? t('students.active') : t('students.inactive')}
                      </Badge>
                    </TableCell>
                  <TableCell>
                    <ActionMenu actions={[
                      { label: t('common.view'), icon: Eye, variant: 'view', onClick: () => navigate(`/students/${student.id}`) },
                      { label: t('common.edit'), icon: Edit2, variant: 'edit', onClick: () => setEditingStudent(student) },
                      {
                        label: student.isActive ? t('students.deactivate') : t('students.activate'),
                        icon: student.isActive ? UserX : UserCheck,
                        variant: student.isActive ? 'delete' : 'edit',
                        onClick: () => handleToggleStatus(student),
                      },
                      {
                        label: t('common.delete'),
                        icon: Trash2,
                        variant: 'delete',
                        onClick: () => setDeleteTarget({
                          id: student.id,
                          name: `${student.firstName} ${student.lastName}`,
                        }),
                      },
                    ]} />
                  </TableCell>
                  </TableRow>
                ))}
              </Table>

              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </>
          )}
        </div>
      </Card>

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
          student={editingStudent}
          onClose={() => setEditingStudent(null)} 
          onSuccess={() => {
            setEditingStudent(null);
            showToast(t('students.updateSuccess'), 'success');
            fetchStudents();
          }}
        />
      )}
    </div>
  );
};

export default StudentsList;
