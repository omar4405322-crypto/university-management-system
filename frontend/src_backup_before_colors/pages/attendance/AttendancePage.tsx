// @ts-nocheck
// FIXED: Course dropdown, full roster API, date filter, bulk save - Phase 5
import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Loader2,
  Save,
  AlertCircle,
  UserX,
  BookOpen,
  Calendar,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import useScope from '../../hooks/useScope';
import attendanceService from '../../services/attendance.service';
import coursesService from '../../services/courses.service';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { Select } from '../../components/ui/Select';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';

const AttendancePage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { scopeParams } = useScope();
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [students, setStudents] = useState([]);
  const [attendanceData, setAttendanceData] = useState({});
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const { showToast } = useToast();
  const [saveSuccess, setSaveSuccess] = useState(false);

    const isAdminOrDoctor = ['SUPER_ADMIN', 'ADMIN', 'DOCTOR'].includes(user?.role);


  const fetchCourses = useCallback(async () => {
    try {
      setCoursesLoading(true);
      setError(null);
      const params = { limit: 100, ...scopeParams };
      const result = await coursesService.getCourses(params);
      if (result.success) {
        const list = result.data.courses || result.data || [];
        setCourses(Array.isArray(list) ? list : []);
      }
    } catch (err: any) {
      logger.error('Error fetching courses:', err);
      setError(t('attendance.coursesLoadError'));
    } finally {
      setCoursesLoading(false);
    }
  }, [t, scopeParams]);

  const fetchRoster = useCallback(async () => {
    if (!selectedCourse) {
      setStudents([]);
      setAttendanceData({});
      return;
    }
    try {
      setRosterLoading(true);
      setError(null);
      const [rosterResult, attendanceResult] = await Promise.all([
        coursesService.getCourseRoster(selectedCourse),
        attendanceService.getCourseAttendance(selectedCourse, date),
      ]);

      const roster = rosterResult.success ? rosterResult.data || [] : [];
      setStudents(roster);

      const existingByStudent = {};
      if (attendanceResult.success && Array.isArray(attendanceResult.data)) {
        attendanceResult.data.forEach((row) => {
          existingByStudent[row.studentId] = row.status;
        });
      }

      const initialData = {};
      roster.forEach((s) => {
        initialData[s.id] = existingByStudent[s.id] || 'PRESENT';
      });
      setAttendanceData(initialData);
    } catch (err: any) {
      logger.error('Error fetching roster:', err);
      setError(t('attendance.rosterLoadError'));
      setStudents([]);
    } finally {
      setRosterLoading(false);
    }
  }, [selectedCourse, date, t]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    fetchRoster();
  }, [fetchRoster]);

  const handleStatusChange = (studentId, status) => {
    setAttendanceData((prev) => ({ ...prev, [studentId]: status }));
  };

  const saveAttendance = async () => {
    if (!selectedCourse || students.length === 0) return;
    try {
      setSaving(true);
      const records = Object.keys(attendanceData).map((studentId) => ({
        studentId: parseInt(studentId, 10),
        status: attendanceData[studentId],
      }));

      const result = await attendanceService.recordAttendance({
        courseId: parseInt(selectedCourse, 10),
        date,
        records,
      });

      if (result.success) {
        showToast(t('attendance.saveSuccess'), 'success');
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        fetchRoster();
      }
    } catch (err: any) {
      logger.error('Save attendance error:', err);
      // Specific error message from API or generic fallback
      const errorMsg = err.response?.data?.message || t('attendance.saveFailedRetry');
      showToast(errorMsg, 'error');
      // DO NOT reset attendanceData or students here - state is preserved
    } finally {
      setSaving(false);
    }
  };

  if (!isAdminOrDoctor) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-700">
        <div className="w-20 h-20 bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center mb-6">
          <UserX size={40} />
        </div>
        <h2 className="text-2xl font-black text-brand-text-main tracking-tight uppercase italic">
          {t('attendance.accessDenied')}
        </h2>
        <p className="text-brand-text-sub font-bold mt-2 max-w-sm">
          {t('attendance.accessDeniedDesc')}
        </p>
      </div>
    );
  }

  const statusButtons = [
    {
      id: 'PRESENT',
      label: t('attendance.present'),
      icon: CheckCircle2,
      color: 'text-brand-green',
      bg: 'bg-brand-green/10',
      active: 'bg-brand-green text-white shadow-lg shadow-brand-green/20',
    },
    {
      id: 'LATE',
      label: t('attendance.late'),
      icon: Clock,
      color: 'text-brand-yellow',
      bg: 'bg-brand-yellow/10',
      active: 'bg-brand-yellow text-white shadow-lg shadow-brand-yellow/20',
    },
    {
      id: 'ABSENT',
      label: t('attendance.absent'),
      icon: XCircle,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
      active: 'bg-rose-500 text-white shadow-lg shadow-rose-500/20',
    },
  ];

  return (
    <div className="section-gap animate-in fade-in duration-700">
      

      <PageHeader
        title={t('attendance.title')}
        subtitle={t('attendance.subtitle')}
        action={{
          label: saving ? t('common.loading') : t('attendance.save'),
          onClick: saveAttendance,
          disabled: saving || !selectedCourse || students.length === 0,
          icon: saveSuccess ? CheckCircle2 : saving ? Loader2 : Save,
          className: saveSuccess
            ? 'bg-brand-green hover:bg-brand-green border-transparent shadow-brand-green/20'
            : '',
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-5 gap-5 xl:gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-black text-brand-text-primary uppercase tracking-widest flex items-center gap-2">
              <BookOpen size={16} className="text-brand-primary-500" />
              {t('attendance.selectCourse')}
            </h3>
            {coursesLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="animate-spin text-brand-primary-500" size={24} />
              </div>
            ) : (
              <Select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full h-11 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm font-bold text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20"
              >
                <option value="">{t('attendance.chooseCourse')}</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.courseCode} — {course.name}
                  </option>
                ))}
              </Select>
            )}
            <div className="space-y-2">
              <label className="text-xs font-black text-brand-text-muted uppercase tracking-widest flex items-center gap-2">
                <Calendar size={14} />
                {t('attendance.date')}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-11 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm font-bold text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20"
              />
            </div>
            {selectedCourse && (
              <p className="text-xs font-bold text-brand-text-muted">
                {t('attendance.rosterCount', { count: students.length })}
              </p>
            )}
            <Button
              className={`w-full gap-2 transition-all duration-300 ${saveSuccess ? 'bg-brand-green hover:bg-brand-green border-transparent' : ''}`}
              onClick={saveAttendance}
              disabled={saving || !selectedCourse || students.length === 0}
            >
              {saveSuccess ? (
                <CheckCircle2 className="animate-in zoom-in duration-300" size={18} />
              ) : saving ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Save size={18} />
              )}
              {t('attendance.save')}
            </Button>
          </Card>
        </div>

        <div className="lg:col-span-3 xl:col-span-4 relative">
          {saving && (
            <div className="absolute inset-0 z-20 bg-brand-bg-page/40 backdrop-blur-[1px] flex items-center justify-center rounded-3xl animate-in fade-in duration-300">
              <div className="bg-brand-bg-card dark:bg-brand-bg-elevated p-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-brand-border">
                <Loader2 className="animate-spin text-brand-primary-500" size={24} />
                <span className="font-bold text-brand-text-main">{t('common.loading')}</span>
              </div>
            </div>
          )}
          <Card noPadding className="border-l-0 overflow-hidden min-h-[500px]">
            {!selectedCourse ? (
              <EmptyState
                icon={<BookOpen size={40} />}
                title={t('attendance.chooseCourse')}
                subtitle={t('attendance.chooseCourseDesc')}
              />
            ) : rosterLoading ? (
              <SkeletonTable rows={5} />
            ) : error ? (
              <div className="p-12">
                <ErrorState message={error} onRetry={fetchRoster} />
              </div>
            ) : students.length === 0 ? (
              <EmptyState
                icon={<Users size={40} />}
                title={t('attendance.noStudents')}
                subtitle={t('attendance.noStudentsDesc')}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right" dir="rtl">
                  <thead>
                    <tr className="bg-surface-subtle dark:bg-slate-800/50 border-b border-brand-border">
                      <th className="px-6 py-4 text-left label-stat">{t('students.studentId')}</th>
                      <th className="px-6 py-4 text-left label-stat">{t('students.fullName')}</th>
                      <th className="px-6 py-4 text-center label-stat">
                        {t('attendance.statusColumn')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {students.map((student) => (
                      <tr
                        key={student.id}
                        className="hover:bg-surface-subtle dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-6 py-5">
                          <span className="font-black text-brand-navy tracking-tight">
                            {student.studentId}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center font-black">
                              {student.firstName?.[0]}
                              {student.lastName?.[0]}
                            </div>
                            <span className="font-bold text-brand-text-main">
                              {student.firstName} {student.lastName}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            {statusButtons.map((status) => (
                              <button
                                key={status.id}
                                type="button"
                                onClick={() => handleStatusChange(student.id, status.id)}
                                disabled={saving}
                                title={status.label}
                                className={`flex flex-col items-center justify-center w-20 py-2 rounded-xl border-2 transition-all duration-300 ${
                                  attendanceData[student.id] === status.id
                                    ? `${status.active} border-transparent`
                                    : `border-transparent ${status.bg} ${status.color} ${saving ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`
                                }`}
                              >
                                <status.icon size={18} className="mb-1" />
                                <span className="text-[9px] font-black uppercase tracking-widest">
                                  {status.label}
                                </span>
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AttendancePage;
