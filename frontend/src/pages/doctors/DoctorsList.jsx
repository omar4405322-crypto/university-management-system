import React, { useState, useEffect } from 'react';
import doctorsService from '../../services/doctors.service';
import AddDoctorModal from './AddDoctorModal';
import EditDoctorModal from './EditDoctorModal';
import Card from '../../components/ui/Card';
import Table, { TableRow, TableCell } from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import { useTranslation } from 'react-i18next';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  User,
  Users,
  BookOpen,
  Briefcase,
  Filter,
  AlertCircle,
  CheckCircle,
  MoreVertical
} from 'lucide-react';

const DoctorsList = () => {
  const { t } = useTranslation();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [toast, setToast] = useState(null);

  const stats = [
    { label: t('doctors.totalFaculty'), value: '420', icon: Users, color: 'blue' },
    { label: t('doctors.activeProfessors'), value: '385', icon: CheckCircle, color: 'emerald' },
    { label: t('doctors.totalCourses'), value: '1,240', icon: BookOpen, color: 'indigo' },
    { label: t('doctors.researchProjects'), value: '64', icon: Briefcase, color: 'amber' },
  ];

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const result = await doctorsService.getDoctors({ search, page, limit: 10 });
      if (result.success) {
        setDoctors(result.data.doctors);
        setTotalPages(result.data.totalPages);
      } else {
        // Fallback dummy data for demo
        setDoctors([
          { id: '1', doctorId: 'DOC-2026-001', firstName: 'Dr. Sarah', lastName: 'Wilson', user: { email: 'sarah.wilson@univ.edu' }, specialty: 'Computer Science', _count: { courses: 4 }, status: 'active' },
          { id: '2', doctorId: 'DOC-2026-002', firstName: 'Dr. James', lastName: 'Miller', user: { email: 'james.miller@univ.edu' }, specialty: 'Mathematics', _count: { courses: 3 }, status: 'active' },
          { id: '3', doctorId: 'DOC-2026-003', firstName: 'Dr. Elena', lastName: 'Rodriguez', user: { email: 'elena.r@univ.edu' }, specialty: 'Physics', _count: { courses: 2 }, status: 'on-leave' },
          { id: '4', doctorId: 'DOC-2026-004', firstName: 'Dr. Robert', lastName: 'Chen', user: { email: 'r.chen@univ.edu' }, specialty: 'Artificial Intelligence', _count: { courses: 5 }, status: 'active' },
          { id: '5', doctorId: 'DOC-2026-005', firstName: 'Dr. Maria', lastName: 'Garcia', user: { email: 'm.garcia@univ.edu' }, specialty: 'Data Science', _count: { courses: 3 }, status: 'inactive' },
        ]);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
      // Fallback dummy data
      setDoctors([
        { id: '1', doctorId: 'DOC-2026-001', firstName: 'Dr. Sarah', lastName: 'Wilson', user: { email: 'sarah.wilson@univ.edu' }, specialty: 'Computer Science', _count: { courses: 4 }, status: 'active' },
        { id: '2', doctorId: 'DOC-2026-002', firstName: 'Dr. James', lastName: 'Miller', user: { email: 'james.miller@univ.edu' }, specialty: 'Mathematics', _count: { courses: 3 }, status: 'active' },
        { id: '3', doctorId: 'DOC-2026-003', firstName: 'Dr. Elena', lastName: 'Rodriguez', user: { email: 'elena.r@univ.edu' }, specialty: 'Physics', _count: { courses: 2 }, status: 'on-leave' },
        { id: '4', doctorId: 'DOC-2026-004', firstName: 'Dr. Robert', lastName: 'Chen', user: { email: 'r.chen@univ.edu' }, specialty: 'Artificial Intelligence', _count: { courses: 5 }, status: 'active' },
        { id: '5', doctorId: 'DOC-2026-005', firstName: 'Dr. Maria', lastName: 'Garcia', user: { email: 'm.garcia@univ.edu' }, specialty: 'Data Science', _count: { courses: 3 }, status: 'inactive' },
      ]);
    } finally {
      setLoading(false);
    }
  };

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

  const handleDelete = async (id) => {
    if (window.confirm(t('doctors.deleteConfirm'))) {
      try {
        const result = await doctorsService.deleteDoctor(id);
        if (result.success) {
          showToast(t('doctors.deleteSuccess'), 'success');
          fetchDoctors();
        }
      } catch (error) {
        showToast(error.response?.data?.message || t('doctors.deleteError'), 'error');
      }
    }
  };

  const handleEdit = (doctor) => {
    setSelectedDoctor(doctor);
    setIsEditModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-20 right-4 z-50 p-4 rounded-xl shadow-xl text-white transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`}>
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('doctors.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{t('doctors.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="flex items-center gap-2">
            <Filter size={18} /> {t('students.filters')}
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2">
            <Plus size={18} /> {t('doctors.addDoctor')}
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={i} className="relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
                <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</h3>
              </div>
              <div className={`rounded-xl p-3 ${
                stat.color === 'blue' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' :
                stat.color === 'emerald' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' :
                stat.color === 'indigo' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' :
                'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
              } group-hover:scale-110 transition-transform`}>
                <stat.icon size={20} />
              </div>
            </div>
            <div className={`absolute -right-2 -bottom-2 h-16 w-16 rounded-full ${
              stat.color === 'blue' ? 'bg-blue-500/10' :
              stat.color === 'emerald' ? 'bg-emerald-500/10' :
              stat.color === 'indigo' ? 'bg-indigo-500/10' :
              'bg-amber-500/10'
            } blur-xl`}></div>
          </Card>
        ))}
      </div>

      <Card noPadding>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Input 
              placeholder={t('students.searchPlaceholder')} 
              className="pl-10 h-10 w-full"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
            <Badge variant="neutral" className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">{t('doctors.allFaculty')}</Badge>
            <Badge variant="success" className="cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/30">{t('students.active')}</Badge>
            <Badge variant="warning" className="cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30">{t('doctors.onLeave')}</Badge>
            <Badge variant="danger" className="cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/30">{t('students.inactive')}</Badge>
          </div>
        </div>

        <div className="min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600/20 border-t-blue-600"></div>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{t('doctors.loading')}</p>
            </div>
          ) : doctors.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="h-16 w-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4">
                <Search size={32} className="text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">{t('doctors.noDoctors')}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-1">{t('doctors.noDoctorsDesc')}</p>
            </div>
          ) : (
            <>
              <Table headers={[t('doctors.doctorId'), t('students.fullName'), t('profile.email'), t('doctors.specialty'), t('doctors.courses'), t('profile.status'), t('common.actions')]}>
                {doctors.map((doctor) => (
                  <TableRow key={doctor.id}>
                    <TableCell className="font-medium text-slate-900 dark:text-slate-200">{doctor.doctorId}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold text-xs border border-white dark:border-slate-700 ring-2 ring-slate-50 dark:ring-slate-900">
                          {doctor.firstName[0]}{doctor.lastName[0]}
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-white">{doctor.firstName} {doctor.lastName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">{doctor.user?.email}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                        {doctor.specialty || t('students.notProvided')}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400 font-medium">
                      {doctor._count?.courses || 0}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        doctor.status === 'active' ? 'success' : 
                        doctor.status === 'inactive' ? 'danger' : 'warning'
                      }>
                        {doctor.status ? t(`students.${doctor.status}`) : t('students.active')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleEdit(doctor)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(doctor.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </Table>
              
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t('students.showingPage')} <span className="font-semibold text-slate-900 dark:text-white">{page}</span> {t('students.of')} <span className="font-semibold text-slate-900 dark:text-white">{totalPages}</span>
                </p>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="h-8 w-8 p-0 flex items-center justify-center"
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={page === totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="h-8 w-8 p-0 flex items-center justify-center"
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Modals */}
      <AddDoctorModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={() => {
          setIsAddModalOpen(false);
          showToast(t('doctors.addSuccess'), 'success');
          fetchDoctors();
        }}
      />

      {selectedDoctor && (
        <EditDoctorModal 
          isOpen={isEditModalOpen} 
          doctor={selectedDoctor}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedDoctor(null);
          }} 
          onSuccess={() => {
            setIsEditModalOpen(false);
            setSelectedDoctor(null);
            showToast(t('doctors.updateSuccess'), 'success');
            fetchDoctors();
          }}
        />
      )}
    </div>
  );
};

export default DoctorsList;