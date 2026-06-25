// @ts-nocheck
// FIXED: Missing PageHeader import caused blank page; query-param scope header and safe filters - Phase 1
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
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Table, { TableRow, TableCell, ActionMenu } from '../../components/ui/Table';
import FilterBar from '../../components/ui/FilterBar';
import schedulesService from '../../services/schedules.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import coursesService from '../../services/courses.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import useScope from '../../hooks/useScope';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import ScheduleModal from './ScheduleModal';
import { Select } from '../../components/ui/Select';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';

const SchedulesList = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { scopeParams, isCollegeAdmin } = useScope();
  const [searchParams] = useSearchParams();
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
    const term = (search || '').toLowerCase();
    return (
      (course.name || '').toLowerCase().includes(term) ||
      (course.courseCode || '').toLowerCase().includes(term) ||
      (s.room && s.room.toLowerCase().includes(term))
    );
  });

  return (
    <div className="section-gap animate-page">
      {/* Toast Notification */}
      

      <PageHeader
        title={
          scopeLabel
            ? `${t('SCHEDULES.TITLE', 'Schedules Management')} — ${scopeLabel}`
            : t('SCHEDULES.TITLE', 'Schedules Management')
        }
        subtitle={t('SCHEDULES.SUBTITLE', 'Manage university timetables and class assignments.')}
        action={
          canManage
            ? {
                label: t('SCHEDULES.CREATE', 'Create Schedule'),
                onClick: () => {
                  setEditingSchedule(null);
                  setIsModalOpen(true);
                },
              }
            : null
        }
      />

      <Card noPadding className="border-none shadow-soft overflow-hidden">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('SCHEDULES.searchPlaceholder', 'Search by course or room...')}
        >
          {!isCollegeAdmin && (
            <>
              <Select
                
                value={selectedCollege}
                onChange={(e) => handleCollegeChange(e.target.value)}
              >
                <option value="">{t('common.allColleges', 'All Colleges')}</option>
                {colleges.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Select
                
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                disabled={!selectedCollege}
              >
                <option value="">{t('common.allDepartments', 'All Departments')}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </>
          )}
          <Select
            
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            <option value="">{t('common.allYears', 'All Years')}</option>
            {[1, 2, 3, 4, 5].map((y) => (
              <option key={y} value={y.toString()}>
                {t('common.year', 'Year')} {y}
              </option>
            ))}
          </Select>
          <Select
            
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
          >
            <option value="">{t('schedule.allSemesters', 'All Semesters')}</option>
            <option value="1">{t('schedule.semester1', 'Semester 1')}</option>
            <option value="2">{t('schedule.semester2', 'Semester 2')}</option>
            <option value="3">{t('timetables.semester', 'Semester')} 3</option>
          </Select>
        </FilterBar>

        <div className="min-h-[400px]">
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
            <div className="flex flex-col items-center justify-center h-96 text-center p-8">
              <div className="w-24 h-24 rounded-[2.5rem] bg-surface-subtle dark:bg-surface-subtle flex items-center justify-center mb-6 border-2 border-dashed border-slate-200 dark:border-slate-700">
                <Calendar size={48} className="text-brand-text-muted opacity-50" />
              </div>
              <h3 className="text-2xl font-black text-brand-text-primary dark:text-brand-text-main tracking-tight uppercase mb-2">
                {t('SCHEDULES.EMPTY_TITLE', 'No schedules yet')}
              </h3>
              <p className="text-brand-text-secondary font-bold max-w-xs mx-auto">
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
                  className="mt-6 px-6 py-3 rounded-2xl bg-brand-primary-600 text-white font-black text-xs uppercase tracking-widest hover:opacity-90 transition-opacity"
                >
                  {t('SCHEDULES.CREATE', 'Create Schedule')}
                </button>
              )}
            </div>
          ) : (
            <Table
              headers={[
                t('courses.course', 'Course'),
                t('timetables.day', 'Time Slot'),
                t('timetables.room', 'Room'),
                t('auth.department', 'Department'),
                t('common.actions', 'Actions'),
              ]}
            >
              {filteredSchedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-brand-primary-50 dark:bg-brand-primary-900/10 flex items-center justify-center text-brand-primary-600 font-black shadow-inner">
                        <BookOpen size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black text-brand-text-primary dark:text-brand-text-main tracking-tight">
                          {schedule.course.name}
                        </span>
                        <span className="text-[10px] font-black uppercase text-brand-primary-600 tracking-wider">
                          {schedule.course.courseCode}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-brand-text-primary dark:text-brand-text-main uppercase tracking-widest">
                        {schedule.dayOfWeek}
                      </span>
                      <span className="text-[10px] font-bold text-brand-text-secondary uppercase">
                        {schedule.startTime} - {schedule.endTime}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-brand-accent-yellow/10 flex items-center justify-center text-brand-accent-yellow">
                        <MapPin size={14} />
                      </div>
                      <span className="text-xs font-black text-brand-text-primary dark:text-brand-text-main uppercase tracking-widest">
                        {schedule.room || t('common.tba', 'TBA')}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-brand-text-primary dark:text-brand-text-main uppercase tracking-tight truncate max-w-[150px]">
                        {schedule.department?.name}
                      </span>
                      <span className="text-[10px] font-bold text-brand-text-muted uppercase">
                        {t('common.year', 'Year')} {schedule.year} •{' '}
                        {t('timetables.semester', 'Sem')} {schedule.semester}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
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
