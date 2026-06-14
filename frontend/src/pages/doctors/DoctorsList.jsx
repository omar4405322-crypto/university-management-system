// FIXED: Phase 7 — empty state, CSV export, delete confirm modal
import React, { useState, useEffect } from 'react';
import doctorsService from '../../services/doctors.service';
import AddDoctorModal from './AddDoctorModal';
import EditDoctorModal from './EditDoctorModal';
import { PageHeader } from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Table, { TableRow, TableCell, ActionMenu } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import FilterBar from '../../components/ui/FilterBar';
import Pagination from '../../components/ui/Pagination';
import { EmptyState } from '../../components/ui/EmptyState';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import Button from '../../components/ui/Button';
import { downloadCsv } from '../../utils/exportCsv';
import DoctorAvatar from '../../components/DoctorAvatar';
import { useTranslation } from 'react-i18next';
import { 
  Users,
  BookOpen,
  Briefcase,
  AlertCircle,
  CheckCircle,
  Loader2,
  Edit2,
  Trash2,
  Download,
  KeyRound,
  Eye
} from 'lucide-react';
import ResetPasswordModal from '../../components/ui/ResetPasswordModal';
import { useNavigate } from 'react-router-dom';

const DoctorsList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [resetPasswordDoctor, setResetPasswordDoctor] = useState(null);
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [stats, setStats] = useState([
    { label: t('doctors.totalFaculty'), value: '0', icon: Users, color: 'navy' },
    { label: t('doctors.activeProfessors'), value: '0', icon: CheckCircle, color: 'green' },
    { label: t('doctors.totalCourses'), value: '0', icon: BookOpen, color: 'navy' },
    { label: t('doctors.researchProjects'), value: '0', icon: Briefcase, color: 'yellow' },
  ]);

  const fetchStats = async () => {
    try {
      const result = await doctorsService.getStats();
      if (result.success && result.data) {
        const d = result.data;
        setStats([
          { label: t('doctors.totalFaculty'), value: (d.totalFaculty ?? 0).toLocaleString(), icon: Users, color: 'navy' },
          { label: t('doctors.activeProfessors'), value: (d.activeProfessors ?? 0).toLocaleString(), icon: CheckCircle, color: 'green' },
          { label: t('doctors.totalCourses'), value: (d.totalCourses ?? 0).toLocaleString(), icon: BookOpen, color: 'navy' },
          { label: t('doctors.researchProjects'), value: (d.researchProjects ?? 0).toLocaleString(), icon: Briefcase, color: 'yellow' },
        ]);
      }
    } catch (error) {
      console.error('Error fetching doctor stats:', error);
    }
  };

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const scope = require('../../hooks/useScope').default ? require('../../hooks/useScope').default() : null;
      const params = { search, page, limit: 10, ...scope?.scopeParams };
      const result = await doctorsService.getDoctors(params);
      if (result.success) {
        const doctorsArray = Array.isArray(result.data) 
          ? result.data 
          : Array.isArray(result.data?.doctors) 
            ? result.data.doctors 
            : Array.isArray(result.data?.data) 
              ? result.data.data 
              : [];
        setDoctors(doctorsArray);
        setTotalPages(result.data?.pagination?.totalPages || result.data?.totalPages || 1);
      } else {
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchDoctors();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [search, page]);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const result = await doctorsService.getDoctors({ search, page: 1, limit: 5000 });
      const list = result.data?.doctors || [];
      downloadCsv(
        `faculty-${new Date().toISOString().slice(0, 10)}.csv`,
        [t('doctors.doctorId'), t('students.fullName'), t('doctors.specialty'), t('auth.email')],
        list.map((d) => [
          d.doctorId,
          `${d.firstName} ${d.lastName}`,
          d.specialty || '',
          d.user?.email || '',
        ])
      );
      showToast(t('common.exportSuccess'), 'success');
    } catch {
      showToast(t('common.exportError'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      const result = await doctorsService.deleteDoctor(deleteTarget.id);
      if (result.success) {
        showToast(t('doctors.deleteSuccess'), 'success');
        setDeleteTarget(null);
        fetchDoctors();
        fetchStats();
      }
    } catch (error) {
      showToast(error.response?.data?.message || t('doctors.deleteError'), 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEdit = (doctor) => {
    setSelectedDoctor(doctor);
    setIsEditModalOpen(true);
  };

  return (
    <div className="section-gap animate-page">
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
        title={t('doctors.title')}
        subtitle={t('doctors.subtitle')}
        action={{
          label: t('doctors.addDoctor'),
          onClick: () => setIsAddModalOpen(true)
        }}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => (
          <Card key={i} noPadding className="group hover:-translate-y-1 transition-all duration-300 border-none shadow-soft overflow-hidden">
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
          searchPlaceholder={t('doctors.searchPlaceholder')}
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
          <Badge variant="primary" className="cursor-pointer px-3 py-1">{t('doctors.allFaculty')}</Badge>
          <Badge variant="success" className="cursor-pointer px-3 py-1">{t('students.active')}</Badge>
          <Badge variant="warning" className="cursor-pointer px-3 py-1">{t('doctors.onLeave')}</Badge>
          <Badge variant="danger" className="cursor-pointer px-3 py-1">{t('students.inactive')}</Badge>
        </FilterBar>

        <div className="min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 className="animate-spin text-brand-primary-500" size={40} />
              <p className="label-stat">{t('doctors.loading')}</p>
            </div>
          ) : !Array.isArray(doctors) || doctors.length === 0 ? (
            <EmptyState
              icon={<Users size={40} />}
              title={search ? t('doctors.noSearchResults') : t('doctors.noDoctors')}
              subtitle={search ? t('doctors.noSearchResultsDesc') : t('doctors.noDoctorsDesc')}
              action={
                search
                  ? { label: t('common.clearSearch'), onClick: () => setSearch('') }
                  : { label: t('doctors.addFirstDoctor'), onClick: () => setIsAddModalOpen(true) }
              }
            />
          ) : (
            <>
              <Table headers={[t('doctors.doctorId'), t('students.fullName'), t('profile.email'), t('doctors.specialty'), t('doctors.courses'), t('profile.status'), t('common.actions')]}>
                {(Array.isArray(doctors) ? doctors : []).map((doctor) => (
                  <TableRow key={doctor.id}>
                    <TableCell className="font-black text-brand-navy-500 dark:text-brand-primary-400 tracking-widest text-xs uppercase hidden md:table-cell">{doctor.doctorId}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-4">
                        <DoctorAvatar
                          name={`${doctor.firstName || ''} ${doctor.lastName || ''}`.trim()}
                          imageUrl={doctor.user?.profilePicture}
                          size="table"
                          className="shadow-inner ring-1 ring-brand-primary-100/50 dark:ring-brand-primary-900/20 group-hover:scale-110 transition-transform"
                        />
                        <span className="font-black text-brand-text-primary dark:text-brand-text-main tracking-tight group-hover:text-brand-primary-500 transition-colors">{doctor.firstName} {doctor.lastName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-brand-text-secondary font-bold text-xs hidden md:table-cell">{doctor.user?.email}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="inline-flex items-center px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest bg-brand-primary-50 dark:bg-brand-primary-900/10 text-brand-primary-500 border border-brand-primary-100/50 dark:border-brand-primary-900/20">
                        {doctor.specialty || t('students.notProvided')}
                      </span>
                    </TableCell>
                    <TableCell className="text-brand-text-primary dark:text-brand-text-main font-black text-sm hidden md:table-cell">
                      {doctor._count?.courses || 0}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        doctor.status === 'active' ? 'success' : 
                        doctor.status === 'inactive' ? 'neutral' : 'warning'
                      }>
                        {doctor.status ? t(`students.${doctor.status}`) : t('students.active')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ActionMenu actions={[
                        { label: t('common.view'), icon: Eye, variant: 'view', onClick: () => navigate(`/doctors/${doctor.id}`) },
                        { label: t('common.edit'), icon: Edit2, variant: 'edit', onClick: () => handleEdit(doctor) },
                        { label: 'Reset Password', icon: KeyRound, variant: 'edit', onClick: () => setResetPasswordDoctor(doctor) },
                        {
                          label: t('common.delete'),
                          icon: Trash2,
                          variant: 'delete',
                          onClick: () => setDeleteTarget({
                            id: doctor.id,
                            name: `${doctor.firstName} ${doctor.lastName}`,
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

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        itemName={deleteTarget?.name}
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
      />

      {/* Modals */}
      <AddDoctorModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={() => {
          setIsAddModalOpen(false);
          showToast(t('doctors.createSuccess'), 'success');
          fetchDoctors();
          fetchStats();
        }}
      />

      {isEditModalOpen && (
        <EditDoctorModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedDoctor(null);
          }}
          doctor={selectedDoctor}
          onSuccess={() => {
            setIsEditModalOpen(false);
            setSelectedDoctor(null);
            showToast(t('doctors.updateSuccess'), 'success');
            fetchDoctors();
            fetchStats();
          }}
        />
      )}

      <ResetPasswordModal 
        isOpen={!!resetPasswordDoctor} 
        onClose={() => setResetPasswordDoctor(null)} 
        person={resetPasswordDoctor} 
        type="doctor" 
      />
    </div>
  );
};

export default DoctorsList;