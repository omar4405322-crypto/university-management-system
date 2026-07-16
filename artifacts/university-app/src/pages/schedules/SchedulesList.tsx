// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  MapPin,
  BookOpen,
  Loader2,
  AlertCircle,
  CheckCircle,
  Edit2,
  Trash2,
  Plus,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Table, {
  TableRow,
  TableCell,
  ActionMenu,
  TableHeader,
  TableBody,
  TableHead,
} from '../../components/ui/Table';
import FilterBar from '../../components/ui/FilterBar';
import schedulesService from '../../services/schedules.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import coursesService from '../../services/courses.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import useScope from '../../hooks/useScope';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import ScheduleModal from './ScheduleModal';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';

const SchedulesList = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const { scopeParams, isCollegeAdmin } = useScope();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.classList.add('bg-slate-50', 'dark:bg-slate-900');
      return () => {
        mainEl.classList.remove('bg-slate-50', 'dark:bg-slate-900');
      };
    }
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);

  // Filters
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [search, setSearch] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const { showToast } = useToast();

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
    const canManage = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);

  useEffect(() => {
    const collegeId = searchParams.get('collegeId');
    const departmentId = searchParams.get('departmentId');

    if (collegeId) {
      setSelectedCollege(String(collegeId));
      fetchDepartments(collegeId);
    }

    if (departmentId) {
      setSelectedDept(String(departmentId));
      if (!collegeId) {
        departmentService
          .getDepartmentById(departmentId)
          .then((res) => {
            if (res.success && res.data?.collegeId) {
              setSelectedCollege(String(res.data.collegeId));
              fetchDepartments(res.data.collegeId);
            }
          })
          .catch(() => {});
      }
    }

    fetchInitialData();
  }, [searchParams]);

  useEffect(() => {
    fetchSchedules();
  }, [selectedCollege, selectedDept, selectedYear, selectedSemester, scopeParams]);

  const fetchInitialData = async () => {
    try {
      const [collegesRes, coursesRes] = await Promise.all([
        collegeService.getColleges(),
        coursesService.getCourses(),
      ]);

      if (collegesRes.success) {
        const arr = Array.isArray(collegesRes.data)
          ? collegesRes.data
          : collegesRes.data?.data?.colleges ||
            collegesRes.data?.colleges ||
            collegesRes.data?.data ||
            [];
        setColleges(arr);
      }
      if (coursesRes.success) {
        const arr = Array.isArray(coursesRes.data)
          ? coursesRes.data
          : coursesRes.data?.data?.courses ||
            coursesRes.data?.courses ||
            coursesRes.data?.data ||
            [];
        setCourses(arr);
      }
    } catch (error: any) {
      logger.error('Error fetching initial data:', error);
    }
  };

  const fetchDepartments = async (collegeId) => {
    try {
      const result = await departmentService.getDepartments({ collegeId });
      if (result.success) {
        const arr = Array.isArray(result.data)
          ? result.data
          : result.data?.data?.departments || result.data?.departments || result.data?.data || [];
        setDepartments(arr);
      }
    } catch (error: any) {
      logger.error('Error fetching departments:', error);
    }
  };

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { ...scopeParams };
      if (!isCollegeAdmin) {
        if (selectedCollege) params.collegeId = selectedCollege;
        if (selectedDept) params.departmentId = selectedDept;
      }
      if (selectedYear) params.year = selectedYear;
      if (selectedSemester) params.semester = selectedSemester;

      const result = await schedulesService.getSchedules(params);
      if (result.success) {
        const arr = Array.isArray(result.data)
          ? result.data
          : result.data?.data?.schedules || result.data?.schedules || result.data?.data || [];
        setSchedules(arr);
      }
    } catch (err: any) {
      logger.error('Error fetching schedules:', err);
      setError(err.message || t('common.fetchError', 'Error fetching schedules'));
      showToast(t('common.fetchError', 'Error fetching schedules'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCollegeChange = async (collegeId) => {
    setSelectedCollege(collegeId);
    setSelectedDept('');
    if (collegeId) {
      fetchDepartments(collegeId);
    } else {
      setDepartments([]);
    }
  };

  const handleDelete = async (id) => {
    if (
      window.confirm(t('SCHEDULES.deleteConfirm', 'Are you sure you want to delete this schedule?'))
    ) {
      try {
        const result = await schedulesService.deleteSchedule(id);
        if (result.success) {
          showToast(t('common.deleteSuccess', 'Schedule deleted successfully'), 'success');
          fetchSchedules();
        }
      } catch (_error) {
        showToast(t('common.deleteError', 'Error deleting schedule'), 'error');
      }
    }
  };


  const scopeLabel = useMemo(() => {
    const college = colleges.find((c) => String(c.id) === String(selectedCollege));
    const dept = departments.find((d) => String(d.id) === String(selectedDept));
    if (dept) return dept.name;
    if (college) return college.name;
    return null;
  }, [colleges, departments, selectedCollege, selectedDept]);

  const filteredSchedules = (schedules || []).filter((s) => {
    const course = s.course || {};
    const groupName = s.group?.name || '';
    const term = (search || '').toLowerCase();
    return (
      (course.name || '').toLowerCase().includes(term) ||
      (course.courseCode || '').toLowerCase().includes(term) ||
      groupName.toLowerCase().includes(term) ||
      (s.room && s.room.toLowerCase().includes(term))
    );
  });

  return (
    <div className="section-gap animate-page">
      {/* Toast Notification */}
      

      <PageHeader
        title={t('SCHEDULES.TITLE', 'Schedules Management')}
        subtitle={t('SCHEDULES.SUBTITLE', 'Manage university timetables and class assignments.')}
        action={
          canManage
            ? {
                label: t('SCHEDULES.CREATE', 'Create Schedule'),
                icon: Plus,
                onClick: () => {
                  setEditingSchedule(null);
                  setIsModalOpen(true);
                },
                className: 'bg-brand-primary-500 hover:bg-brand-primary-600 text-white rounded-xl active:scale-95 transition-all',
              }
            : null
        }
        extraActions={
          <button
            onClick={() => navigate(`/schedules/timetable?collegeId=${selectedCollege}&departmentId=${selectedDept}&academicYear=${selectedYear}&semester=${selectedSemester}`)}
            className="flex items-center gap-2 px-6 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-brand-text-primary dark:text-brand-text-main rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-sm"
          >
            <Calendar size={20} />
            {t('SCHEDULES.VIEW_AS_GRID', 'عرض كشبكة')}
          </button>
        }
      />

      <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden p-0 mb-6">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('SCHEDULES.searchPlaceholder', 'Search by course or room...')}
        >
          {!isCollegeAdmin && (
            <>
              <select
                value={selectedCollege}
                onChange={(e) => handleCollegeChange(e.target.value)}
                className="h-10 px-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all cursor-pointer flex-shrink-0"
              >
                <option value="">{t('common.allColleges', 'All Colleges')}</option>
                {colleges.map((c) => (
                  <option key={c.id} value={c.id}>
                    {isRTL ? c.nameAr || c.name : c.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                disabled={!selectedCollege}
                className="h-10 px-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all cursor-pointer flex-shrink-0 disabled:opacity-50"
              >
                <option value="">{t('common.allDepartments', 'All Departments')}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {isRTL ? d.nameAr || d.name : d.name}
                  </option>
                ))}
              </select>
            </>
          )}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="h-10 px-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all cursor-pointer flex-shrink-0"
          >
            <option value="">{t('common.allYears', 'All Years')}</option>
            {[1, 2, 3, 4, 5].map((y) => (
              <option key={y} value={y.toString()}>
                {t('common.year', 'Year')} {y}
              </option>
            ))}
          </select>
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="h-10 px-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-brand-text-primary dark:text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 transition-all cursor-pointer flex-shrink-0"
          >
            <option value="">{t('schedule.allSemesters', 'All Semesters')}</option>
            <option value="1">{t('schedule.semester1', 'Semester 1')}</option>
            <option value="2">{t('schedule.semester2', 'Semester 2')}</option>
            <option value="3">{t('schedule.semester3', 'Summer Semester')}</option>
          </select>
        </FilterBar>
      </Card>

      <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden p-4 md:p-6">
        <div className="min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 className="animate-spin text-brand-primary-600" size={40} />
              <p className="label-stat">{t('common.loading', 'Loading schedules...')}</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-96 text-center p-8">
              <div className="w-24 h-24 rounded-[2.5rem] bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center mb-6 border-2 border-dashed border-rose-200 dark:border-rose-700">
                <AlertCircle size={48} className="text-rose-500" />
              </div>
              <h3 className="text-2xl font-black text-brand-text-primary dark:text-brand-text-main tracking-tight uppercase mb-2">
                {t('common.errorOccurred', 'An error occurred')}
              </h3>
              <p className="text-brand-text-secondary font-bold max-w-xs mx-auto mb-4">{error}</p>
              <button
                type="button"
                onClick={fetchSchedules}
                className="px-6 py-3 rounded-2xl bg-brand-primary-600 text-white font-black text-xs uppercase tracking-widest hover:opacity-90 transition-opacity"
              >
                {t('common.retry', 'Retry')}
              </button>
            </div>
          ) : filteredSchedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-full bg-brand-primary-500/10 dark:bg-brand-primary-500/20 flex items-center justify-center mb-5 text-brand-primary-600 dark:text-brand-primary-400 shrink-0">
                <Calendar size={32} />
              </div>
              <h3 className="text-xl font-bold text-brand-text-primary dark:text-brand-text-main tracking-tight mb-2">
                {t('SCHEDULES.EMPTY_TITLE', 'No schedules yet')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium max-w-xs mx-auto">
                {t(
                  'SCHEDULES.EMPTY_DESC',
                  'There are no class schedules for this selection. Create one to get started.'
                )}
              </p>
              {canManage && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingSchedule(null);
                    setIsModalOpen(true);
                  }}
                  className="mt-6 px-5 py-2.5 bg-brand-primary-500 hover:bg-brand-primary-600 text-white text-xs font-semibold rounded-xl active:scale-95 transition-all shadow-md shadow-brand-primary-500/10 hover:shadow-lg"
                >
                  {t('SCHEDULES.CREATE', 'Create Schedule')}
                </button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/40">
                  <TableHead className="text-start font-semibold text-brand-text-primary dark:text-brand-text-main py-4 px-4">
                    {t('courses.course', 'Course')}
                  </TableHead>
                  <TableHead className="text-center font-semibold text-brand-text-primary dark:text-brand-text-main py-4 px-4">
                    {t('timetables.day', 'Time Slot')}
                  </TableHead>
                  <TableHead className="text-center font-semibold text-brand-text-primary dark:text-brand-text-main py-4 px-4">
                    {t('timetables.room', 'Room')}
                  </TableHead>
                  <TableHead className="text-start font-semibold text-brand-text-primary dark:text-brand-text-main py-4 px-4">
                    {t('SCHEDULES.slotType', 'Session Type')} / {t('auth.doctor', 'Doctor')}
                  </TableHead>
                  <TableHead className="text-end font-semibold text-brand-text-primary dark:text-brand-text-main py-4 px-4">
                    {t('common.actions', 'Actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredSchedules.map((schedule) => (
                  <TableRow
                    key={schedule.id}
                    className="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <TableCell className="text-start py-4 px-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-brand-primary-500/10 dark:bg-brand-primary-500/20 flex items-center justify-center text-brand-primary-600 dark:text-brand-primary-400 font-semibold shadow-inner">
                          <BookOpen size={20} />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-brand-text-primary dark:text-brand-text-main tracking-tight">
                            {schedule.course?.name} {schedule.group ? `- ${schedule.group.name}` : ''}
                          </span>
                          <span className="text-[10px] font-bold uppercase text-brand-primary-600 dark:text-brand-primary-400 tracking-wider mt-0.5">
                            {schedule.course?.courseCode}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-4 px-4">
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-xs font-semibold text-brand-text-primary dark:text-brand-text-main uppercase tracking-widest">
                          {t(`days.${(schedule.dayOfWeek || '').toLowerCase()}`, schedule.dayOfWeek)}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase mt-0.5" dir="ltr">
                          {schedule.startTime} - {schedule.endTime}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-4 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-brand-yellow/10 flex items-center justify-center text-brand-yellow shrink-0">
                          <MapPin size={14} />
                        </div>
                        <span className="text-xs font-medium text-brand-text-primary dark:text-brand-text-main uppercase tracking-widest">
                          {schedule.room || t('common.tba', 'TBA')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-start py-4 px-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-brand-text-primary dark:text-brand-text-main uppercase tracking-tight truncate max-w-[180px]">
                          {schedule.slotType || 'LECTURE'}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                          {schedule.doctor?.firstName ? `Dr. ${schedule.doctor.firstName} ${schedule.doctor.lastName}` : t('common.staff', 'Staff')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-end py-4 px-4">
                      <ActionMenu
                        actions={[
                          {
                            label: t('common.edit', 'Edit'),
                            icon: Edit2,
                            variant: 'edit',
                            onClick: () => {
                              setEditingSchedule(schedule);
                              setIsModalOpen(true);
                            },
                          },
                          ...(isSuperAdmin
                            ? [
                                {
                                  label: t('common.delete', 'Delete'),
                                  icon: Trash2,
                                  variant: 'delete',
                                  onClick: () => handleDelete(schedule.id),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      <ScheduleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        schedule={editingSchedule}
        courses={courses}
        onSuccess={() => {
          setIsModalOpen(false);
          fetchSchedules();
          showToast(
            editingSchedule
              ? t('SCHEDULES.updateSuccess', 'Schedule updated successfully')
              : t('SCHEDULES.createSuccess', 'Schedule created successfully'),
            'success'
          );
        }}
      />
    </div>
  );
};

export default SchedulesList;
