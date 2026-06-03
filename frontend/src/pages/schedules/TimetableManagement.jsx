import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, 
  Edit2, 
  Trash2, 
  Loader2,
  AlertCircle,
  CheckCircle,
  Building2,
  FileText
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Table, { TableRow, TableCell, ActionMenu } from '../../components/ui/Table';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import FilterBar from '../../components/ui/FilterBar';
import timetableService from '../../services/timetable.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/ui/PageHeader';
import TimetableModal from './TimetableModal';

const TimetableManagement = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timetables, setTimetables] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  
  // Filters
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [search, setSearch] = useState('');
  
  // UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTimetable, setEditingTimetable] = useState(null);
  const [toast, setToast] = useState(null);

  const canManage = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user?.role);

  const fetchInitialData = async () => {
    try {
      const collegesRes = await collegeService.getColleges();
      if (collegesRes.success) {
        setColleges(Array.isArray(collegesRes.data) ? collegesRes.data : []);
      }
    } catch (err) {
      console.error('Error fetching colleges:', err);
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
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  const fetchTimetables = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        collegeId: selectedCollege || undefined,
        departmentId: selectedDept || undefined,
        academicYear: selectedYear || undefined,
        semester: selectedSemester || undefined
      };
      const result = await timetableService.getTimetables(params);
      if (result.success) {
        setTimetables(Array.isArray(result.data) ? result.data : []);
      }
    } catch (err) {
      console.error('Error fetching timetables:', err);
      setError(err.message || 'Failed to load timetables. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [selectedCollege, selectedDept, selectedYear, selectedSemester]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchTimetables();
  }, [fetchTimetables]);

  const handleCollegeChange = (e) => {
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
    } catch (err) {
      showToast(err.message || t('common.deleteError'), 'error');
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const resetFilters = () => {
    setSelectedCollege('');
    setSelectedDept('');
    setSelectedYear('');
    setSelectedSemester('');
    setSearch('');
    setDepartments([]);
  };

  const filteredTimetables = (timetables || []).filter(ti => 
    (ti.title || '').toLowerCase().includes((search || '').toLowerCase()) || 
    (ti.description || '').toLowerCase().includes((search || '').toLowerCase())
  );

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
        title={t('timetables.title')}
        subtitle={t('timetables.subtitle')}
        action={canManage ? {
          label: t('timetables.create'),
          onClick: () => {
            setEditingTimetable(null);
            setIsModalOpen(true);
          }
        } : null}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-5 gap-5 xl:gap-6">
        <div className="lg:col-span-1 space-y-6">
        </div>
        <div className="lg:col-span-3 xl:col-span-4">
          <Card noPadding className="border-l-0 overflow-hidden shadow-sm">
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder={t('common.search')}
            />

            {loading ? (
              <LoadingState message="Fetching institutional schedules..." />
            ) : error ? (
              <ErrorState message={error} onRetry={fetchTimetables} />
            ) : filteredTimetables.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center border-dashed">
                <div className="h-20 w-20 rounded-3xl bg-brand-navy/5 flex items-center justify-center mb-6 border-2 border-dashed border-brand-border">
                  <FileText size={40} className="text-brand-text-muted" />
                </div>
                <h3 className="text-xl font-black text-brand-text-main tracking-tight uppercase italic">{t('common.noData')}</h3>
                <p className="text-sm text-brand-text-sub max-w-xs mx-auto mt-2 font-bold">{t('timetables.noSlots')}</p>
                {search && (
                  <Button 
                    variant="ghost" 
                    className="mt-6 text-brand-green font-black uppercase tracking-widest text-xs"
                    onClick={() => setSearch('')}
                  >
                    Clear Search
                  </Button>
                )}
              </div>
            ) : (
              <Table headers={[t('timetables.details'), t('timetables.targetCohort'), t('finance.status'), t('common.actions')]}>
                {filteredTimetables.map((ti) => (
                  <TableRow key={ti.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-4">
                        <div className="h-11 w-11 rounded-2xl bg-brand-navy/5 text-brand-navy flex items-center justify-center border border-brand-border group-hover:bg-brand-navy group-hover:text-white transition-all duration-300">
                          <Calendar size={22} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-brand-text-main group-hover:text-brand-green transition-colors">{ti.title}</p>
                          <p className="text-[10px] font-bold text-brand-text-muted uppercase tracking-tight mt-0.5 line-clamp-1 max-w-[250px]">
                            {ti.description || 'No additional details'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="info" className="font-black text-[9px] uppercase tracking-widest">{t('auth.year')} {ti.academicYear}</Badge>
                          <Badge variant="neutral" className="font-black text-[9px] uppercase tracking-widest">{t('timetables.semester')} {ti.semester}</Badge>
                        </div>
                        <p className="text-[10px] font-black text-brand-text-sub uppercase tracking-tight flex items-center gap-1">
                          <Building2 size={10} /> {ti.department?.name || 'General'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center">
                        <Badge variant={ti.status === 'PUBLISHED' ? 'success' : 'warning'} className="font-black uppercase tracking-widest text-[9px]">
                          {ti.status === 'PUBLISHED' ? t('timetables.published') : t('timetables.draft')}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ActionMenu actions={[
                        { label: t('common.edit'), icon: Edit2, variant: 'edit', onClick: () => { setEditingTimetable(ti); setIsModalOpen(true); } },
                        { label: t('common.delete'), icon: Trash2, variant: 'delete', onClick: () => handleDelete(ti.id) },
                      ]} />
                    </TableCell>
                  </TableRow>
                ))}
              </Table>
            )}
          </Card>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <TimetableModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          timetable={editingTimetable}
          onSuccess={() => {
            setIsModalOpen(false);
            fetchTimetables();
            showToast(editingTimetable ? t('timetables.saveSuccess') : t('timetables.saveSuccess'), 'success');
          }}
        />
      )}
    </div>
  );
};

export default TimetableManagement;
