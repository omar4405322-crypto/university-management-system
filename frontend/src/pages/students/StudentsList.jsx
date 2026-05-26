import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import studentsService from '../../services/students.service';
import AddStudentModal from './AddStudentModal';
import EditStudentModal from './EditStudentModal';
import Card from '../../components/ui/Card';
import Table, { TableRow, TableCell } from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Eye, 
  ChevronLeft, 
  ChevronRight, 
  User,
  Filter,
  MoreVertical,
  GraduationCap,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';

import { useTranslation } from 'react-i18next';

const StudentsList = () => {
  const { t } = useTranslation();
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState([
    { label: t('students.totalStudents'), value: '0', icon: GraduationCap, color: 'blue' },
    { label: t('students.active'), value: '0', icon: CheckCircle, color: 'emerald' },
    { label: t('students.pending'), value: '0', icon: Clock, color: 'amber' },
    { label: t('students.graduated'), value: '0', icon: User, color: 'indigo' },
  ]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchStudents();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [search, page]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const result = await studentsService.getStudents({ search, page, limit: 10 });
      if (result.success) {
        setStudents(result.data.students);
        setTotalPages(result.data.totalPages);
        
        // Update stats from real data
        if (result.data.stats) {
          setStats([
            { label: t('students.totalStudents'), value: result.data.stats.total.toLocaleString(), icon: GraduationCap, color: 'blue' },
            { label: t('students.active'), value: result.data.stats.active.toLocaleString(), icon: CheckCircle, color: 'emerald' },
            { label: t('students.pending'), value: result.data.stats.pending.toLocaleString(), icon: Clock, color: 'amber' },
            { label: t('students.graduated'), value: result.data.stats.inactive.toLocaleString(), icon: User, color: 'indigo' }, // Using inactive as graduated for now or just total-active-pending
          ]);
        }
      } else {
        setStudents([]);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('students.deleteConfirm'))) {
      try {
        const result = await studentsService.deleteStudent(id);
        if (result.success) {
          showToast(t('students.deleteSuccess'), 'success');
          fetchStudents();
        }
      } catch (error) {
        showToast(error.response?.data?.message || t('students.deleteError'), 'error');
      }
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('students.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{t('students.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="flex items-center gap-2">
            <Filter size={18} /> {t('students.filters')}
          </Button>
          <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2">
            <Plus size={18} /> {t('students.addStudent')}
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
                stat.color === 'amber' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' :
                'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
              } group-hover:scale-110 transition-transform`}>
                <stat.icon size={20} />
              </div>
            </div>
            <div className={`absolute -right-2 -bottom-2 h-16 w-16 rounded-full ${
              stat.color === 'blue' ? 'bg-blue-50/50 dark:bg-blue-900/10' :
              stat.color === 'emerald' ? 'bg-emerald-50/50 dark:bg-emerald-900/10' :
              stat.color === 'amber' ? 'bg-amber-50/50 dark:bg-amber-900/10' :
              'bg-indigo-50/50 dark:bg-indigo-900/10'
            } blur-xl`}></div>
          </Card>
        ))}
      </div>

      <Card noPadding>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
            <Badge variant="neutral" className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">{t('students.allStudents')}</Badge>
            <Badge variant="success" className="cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/20">{t('students.active')}</Badge>
            <Badge variant="warning" className="cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/20">{t('students.pending')}</Badge>
            <Badge variant="danger" className="cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/20">{t('students.inactive')}</Badge>
          </div>
        </div>

        <div className="min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600/20 border-t-blue-600"></div>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{t('students.loading')}</p>
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="h-16 w-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4">
                <Search size={32} className="text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">{t('students.noStudents')}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-1">{t('students.noStudentsDesc')}</p>
            </div>
          ) : (
            <>
              <Table headers={[t('students.studentId'), t('students.fullName'), t('auth.email'), t('students.phone'), t('students.enrolledDate'), t('profile.status'), t('common.actions')]}>
                {students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium text-slate-900 dark:text-slate-200">{student.studentId}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {student.user?.profilePicture ? (
                          <img 
                            src={`http://localhost:5000${student.user.profilePicture}`} 
                            alt={`${student.firstName} ${student.lastName}`}
                            className="h-8 w-8 rounded-full object-cover border border-white dark:border-slate-700 ring-2 ring-slate-50 dark:ring-slate-900"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://via.placeholder.com/32';
                            }}
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold text-xs border border-white dark:border-slate-700 ring-2 ring-slate-50 dark:ring-slate-900">
                            {student.firstName?.[0] || ''}{student.lastName?.[0] || ''}
                          </div>
                        )}
                        <span className="font-semibold text-slate-900 dark:text-white">{student.firstName} {student.lastName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">{student.user?.email}</TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">{student.phone || 'N/A'}</TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">
                      {new Date(student.enrolledAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        student.status === 'active' ? 'success' : 
                        student.status === 'inactive' ? 'danger' : 'warning'
                      }>
                        {student.status ? t(`students.${student.status}`) : t('students.active')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => navigate(`/students/${student.id}`)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title={t('students.viewDetails')}
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={() => setEditingStudent(student)}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                          title={t('common.edit')}
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(student.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                          title={t('common.delete')}
                        >
                          <Trash2 size={18} />
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
                    className="h-9 px-3 text-xs flex items-center gap-1"
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={16} /> {t('students.previous')}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-9 px-3 text-xs flex items-center gap-1"
                    disabled={page === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  >
                    {t('students.next')} <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Modals */}
      <AddStudentModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          setShowAddModal(false);
          showToast(t('students.addSuccess'), 'success');
          fetchStudents();
        }}
      />

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
    </div>
  );
};

export default StudentsList;
