import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Loader2,
  Save,
  UserX,
  BookOpen,
  Calendar,
  FileX2,
  TrendingUp,
  History,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import useScope from '../../hooks/useScope';
import attendanceService from '../../services/attendance.service';
import coursesService from '../../services/courses.service';
import api from '../../services/api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { Select } from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';
import type {
  AttendanceStatus,
  AttendanceRecord,
  AttendanceStats,
  Course,
  Student,
  ApiResponse,
} from '../../types/models';

type AttendancePageMode = 'record' | 'student';

interface StatusButtonDef {
  id: AttendanceStatus;
  labelKey: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  bg: string;
  active: string;
}

const AttendancePage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { scopeParams } = useScope();
  const { showToast } = useToast();

  const canRecord = useMemo(
    () => ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user?.role ?? ''),
    [user?.role]
  );

  const mode: AttendancePageMode = canRecord ? 'record' : 'student';

  if (!user) return <LoadingState message={t('common.loading')} />;

  return (
    <div className="section-gap animate-in fade-in duration-700">
      {mode === 'record' ? (
        <RecordingView
          user={user}
          scopeParams={scopeParams}
          t={t}
          showToast={showToast}
        />
      ) : (
        <StudentView user={user} t={t} />
      )}
    </div>
  );
};

/* ========================= RECORDING VIEW (Admin / Doctor) ========================= */

interface RecordingViewProps {
  user: any;
  scopeParams: Record<string, unknown>;
  t: any;
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const RecordingView: React.FC<RecordingViewProps> = ({ scopeParams, t, showToast }) => {
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceData, setAttendanceData] = useState<Record<number, AttendanceStatus>>({});
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const statusButtons: StatusButtonDef[] = [
    {
      id: 'PRESENT',
      labelKey: 'attendance.present',
      icon: CheckCircle2,
      color: 'text-brand-green',
      bg: 'bg-brand-green/10',
      active: 'bg-brand-green text-white shadow-lg shadow-brand-green/20',
    },
    {
      id: 'LATE',
      labelKey: 'attendance.late',
      icon: Clock,
      color: 'text-brand-yellow',
      bg: 'bg-brand-yellow/10',
      active: 'bg-brand-yellow text-white shadow-lg shadow-brand-yellow/20',
    },
    {
      id: 'ABSENT',
      labelKey: 'attendance.absent',
      icon: XCircle,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
      active: 'bg-rose-500 text-white shadow-lg shadow-rose-500/20',
    },
    {
      id: 'EXCUSED',
      labelKey: 'attendance.excused',
      icon: FileX2,
      color: 'text-brand-navy-500',
      bg: 'bg-brand-navy-500/10',
      active: 'bg-brand-navy-500 text-white shadow-lg shadow-brand-navy-500/20',
    },
  ];

  const fetchCourses = useCallback(async () => {
    try {
      setCoursesLoading(true);
      setError(null);
      const params = { limit: 100, ...(scopeParams as Record<string, unknown>) };
      const result = await coursesService.getCourses(params);
      if (result.success) {
        const payload = result.data as any;
        const list: Course[] = Array.isArray(payload)
          ? payload
          : payload?.courses ?? payload?.data ?? [];
        setCourses(Array.isArray(list) ? (list as Course[]) : []);
      }
    } catch (err: any) {
      logger.error('Error fetching courses:', err);
      setError(t('attendance.coursesLoadError', 'Failed to load courses'));
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
        coursesService.getCourseRoster(selectedCourse) as Promise<ApiResponse<Student[]>>,
        attendanceService.getCourseAttendance(selectedCourse, date),
      ]);

      const roster: Student[] = rosterResult.success
        ? (rosterResult.data as Student[] ?? [])
        : [];
      setStudents(roster);

      const existingByStudent: Record<number, AttendanceStatus> = {};
      if (attendanceResult.success && Array.isArray(attendanceResult.data)) {
        (attendanceResult.data as AttendanceRecord[]).forEach((row) => {
          existingByStudent[row.studentId] = row.status;
        });
      }

      const initialData: Record<number, AttendanceStatus> = {};
      roster.forEach((s) => {
        initialData[s.id] = existingByStudent[s.id] || 'PRESENT';
      });
      setAttendanceData(initialData);
    } catch (err: any) {
      logger.error('Error fetching roster:', err);
      setError(t('attendance.rosterLoadError', 'Failed to load the student roster'));
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

  const handleStatusChange = (studentId: number, status: AttendanceStatus) => {
    setAttendanceData((prev) => ({ ...prev, [studentId]: status }));
  };

  const applyBulkStatus = (status: AttendanceStatus) => {
    const next: Record<number, AttendanceStatus> = {};
    students.forEach((s) => (next[s.id] = status));
    setAttendanceData(next);
  };

  const saveAttendance = async () => {
    if (!selectedCourse || students.length === 0) return;
    try {
      setSaving(true);
      const records = Object.keys(attendanceData).map((key) => ({
        studentId: Number(key),
        status: attendanceData[Number(key)],
      }));

      const result = await attendanceService.recordAttendance({
        courseId: parseInt(selectedCourse, 10),
        date,
        records,
      });

      if (result.success) {
        showToast(t('attendance.saveSuccess', 'Attendance saved successfully'), 'success');
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        fetchRoster();
      } else {
        showToast(
          (result as any).message || t('attendance.saveFailedRetry', 'Save failed — please try again'),
          'error'
        );
      }
    } catch (err: any) {
      logger.error('Save attendance error:', err);
      const errorMsg =
        err.response?.data?.message || t('attendance.saveFailedRetry', 'Save failed — please try again');
      showToast(errorMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title={t('attendance.title', 'Attendance')}
        subtitle={t(
          'attendance.subtitle',
          'Record and review attendance for each course session'
        )}
        action={{
          label: saving ? t('common.loading', 'Loading...') : t('attendance.save', 'Save'),
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
              <BookOpen size={16} className="text-brand-brand-green-dark" />
              {t('attendance.selectCourse', 'Select Course')}
            </h3>
            {coursesLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="animate-spin text-brand-brand-green-dark" size={24} />
              </div>
            ) : (
              <Select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full h-11 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm font-bold text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20"
              >
                <option value="">{t('attendance.chooseCourse', 'Choose a course...')}</option>
                {courses.map((course) => (
                  <option key={course.id} value={String(course.id)}>
                    {course.courseCode} — {course.name}
                  </option>
                ))}
              </Select>
            )}

            <div className="space-y-2">
              <label className="text-xs font-black text-brand-text-muted uppercase tracking-widest flex items-center gap-2">
                <Calendar size={14} />
                {t('attendance.date', 'Date')}
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
                {t('attendance.rosterCount', { count: students.length, defaultValue: '{{count}} student(s) in roster' })}
              </p>
            )}

            {/* Bulk Actions */}
            {selectedCourse && students.length > 0 && (
              <div className="pt-3 border-t border-brand-border space-y-2">
                <p className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest">
                  {t('attendance.bulkMark', 'Mark all as:')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {statusButtons.slice(0, 2).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      disabled={saving}
                      onClick={() => applyBulkStatus(s.id)}
                      className={`px-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${s.bg} ${s.color} hover:scale-105 disabled:opacity-50 disabled:hover:scale-100`}
                    >
                      {t(s.labelKey, s.id)}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {statusButtons.slice(2).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      disabled={saving}
                      onClick={() => applyBulkStatus(s.id)}
                      className={`px-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${s.bg} ${s.color} hover:scale-105 disabled:opacity-50 disabled:hover:scale-100`}
                    >
                      {t(s.labelKey, s.id)}
                    </button>
                  ))}
                </div>
              </div>
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
              {t('attendance.save', 'Save')}
            </Button>
          </Card>
        </div>

        <div className="lg:col-span-3 xl:col-span-4 relative">
          {saving && (
            <div className="absolute inset-0 z-20 bg-brand-bg-page/40 backdrop-blur-[1px] flex items-center justify-center rounded-3xl animate-in fade-in duration-300">
              <div className="bg-brand-bg-card dark:bg-brand-bg-elevated p-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-brand-border">
                <Loader2 className="animate-spin text-brand-brand-green-dark" size={24} />
                <span className="font-bold text-brand-text-main">
                  {t('common.loading', 'Loading...')}
                </span>
              </div>
            </div>
          )}
          <Card noPadding className="border-l-0 overflow-hidden min-h-[500px]">
            {!selectedCourse ? (
              <EmptyState
                icon={<BookOpen size={40} />}
                title={t('attendance.chooseCourse', 'Choose a course')}
                subtitle={t(
                  'attendance.chooseCourseDesc',
                  'Select a course from the panel to see its roster and record attendance'
                )}
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
                title={t('attendance.noStudents', 'No students')}
                subtitle={t(
                  'attendance.noStudentsDesc',
                  'The roster for this course is empty. Enroll students first.'
                )}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right" dir="rtl">
                  <thead>
                    <tr className="bg-surface-subtle dark:bg-slate-800/50 border-b border-brand-border">
                      <th className="px-6 py-4 text-left label-stat">
                        {t('students.studentId', 'Student ID')}
                      </th>
                      <th className="px-6 py-4 text-left label-stat">
                        {t('students.fullName', 'Full Name')}
                      </th>
                      <th className="px-6 py-4 text-center label-stat">
                        {t('attendance.statusColumn', 'Status')}
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
                          <span className="font-black text-brand-navy-500 tracking-tight">
                            {student.studentId}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center font-black">
                              {student.firstName?.[0] ?? ''}
                              {student.lastName?.[0] ?? ''}
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
                                title={t(status.labelKey, status.id)}
                                className={`flex flex-col items-center justify-center w-20 py-2 rounded-xl border-2 transition-all duration-300 ${
                                  attendanceData[student.id] === status.id
                                    ? `${status.active} border-transparent`
                                    : `border-transparent ${status.bg} ${status.color} ${saving ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`
                                }`}
                              >
                                <status.icon size={18} className="mb-1" />
                                <span className="text-[9px] font-black uppercase tracking-widest">
                                  {t(status.labelKey, status.id)}
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
    </>
  );
};

/* ========================= STUDENT VIEW ========================= */

interface StudentViewProps {
  user: any;
  t: any;
}

const StudentView: React.FC<StudentViewProps> = ({ user, t }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [pagination, setPagination] = useState<{
    page: number;
    totalPages: number;
    total: number;
  } | null>(null);
  const [courseFilter, setCourseFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [enrolledCourses, setEnrolledCourses] = useState<
    Array<{ id: number; courseCode?: string; name: string }>
  >([]);

  const studentId: number | undefined = user?.student?.id;

  useEffect(() => {
    let cancelled = false;
    const loadCourses = async () => {
      try {
        const res = await api.get('/users/profile');
        if (res.data?.success && !cancelled) {
          const enrollments = res.data.data?.enrollments ?? [];
          const courses = enrollments
            .map((e: any) => e.course)
            .filter(Boolean);
          setEnrolledCourses(courses);
        }
      } catch (err) {
        logger.error('[StudentView] Failed to load enrolled courses', err);
      }
    };
    if (user?.role === 'STUDENT') loadCourses();
    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  const fetchAttendance = useCallback(async () => {
    if (!studentId) {
      setError(t('attendance.studentProfileMissing', 'Student profile missing'));
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await attendanceService.getStudentAttendance(
        studentId,
        courseFilter || undefined,
        page,
        10
      );
      if (result.success) {
        setRecords((result.data as AttendanceRecord[]) ?? []);
        setStats((result as any).stats ?? null);
        setPagination((result as any).pagination ?? null);
      }
    } catch (err: any) {
      logger.error('Error fetching student attendance:', err);
      setError(err.message || t('attendance.studentLoadError', 'Could not load your attendance data'));
    } finally {
      setLoading(false);
    }
  }, [studentId, courseFilter, page, t]);

  useEffect(() => {
    setPage(1);
  }, [courseFilter]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const statusBadgeVariant = (status: AttendanceStatus): 'success' | 'warning' | 'error' | 'info' => {
    switch (status) {
      case 'PRESENT':
        return 'success';
      case 'LATE':
        return 'warning';
      case 'ABSENT':
        return 'error';
      case 'EXCUSED':
        return 'info';
    }
  };

  if (!studentId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-700">
        <div className="w-20 h-20 bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center mb-6">
          <UserX size={40} />
        </div>
        <h2 className="text-2xl font-black text-brand-text-main tracking-tight uppercase italic">
          {t('attendance.accessDenied', 'Access Denied')}
        </h2>
        <p className="text-brand-text-sub font-bold mt-2 max-w-sm">
          {t(
            'attendance.accessDeniedDesc',
            'You do not have permission to access this section.'
          )}
        </p>
      </div>
    );
  }

  const percentage = stats?.percentage ?? 0;
  const kpis = stats
    ? [
        { key: 'PRESENT', labelKey: 'attendance.present', value: stats.PRESENT, icon: CheckCircle2, color: 'text-brand-green', bg: 'bg-brand-green/10' },
        { key: 'LATE', labelKey: 'attendance.late', value: stats.LATE, icon: Clock, color: 'text-brand-yellow', bg: 'bg-brand-yellow/10' },
        { key: 'ABSENT', labelKey: 'attendance.absent', value: stats.ABSENT, icon: XCircle, color: 'text-rose-500', bg: 'bg-rose-500/10' },
        { key: 'EXCUSED', labelKey: 'attendance.excused', value: stats.EXCUSED, icon: FileX2, color: 'text-brand-navy-500', bg: 'bg-brand-navy-500/10' },
      ]
    : [];

  return (
    <>
      <PageHeader
        title={t('attendance.myTitle', 'My Attendance')}
        subtitle={t('attendance.mySubtitle', 'Track your class attendance and check your progress')}
        action={null}
      />

      {/* KPI + Percentage */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 xl:gap-6 mb-6">
        <Card className="lg:col-span-1 p-5 flex flex-col items-center justify-center">
          <div className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted mb-2">
            {t('attendance.overallRate', 'Overall Rate')}
          </div>
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" strokeWidth="12" fill="none" className="stroke-brand-border" />
              <circle
                cx="60" cy="60" r="50" strokeWidth="12" fill="none"
                strokeLinecap="round"
                className={percentage >= 80 ? 'stroke-brand-green' : percentage >= 65 ? 'stroke-brand-yellow' : 'stroke-rose-500'}
                strokeDasharray={`${2 * Math.PI * 50}`}
                strokeDashoffset={`${2 * Math.PI * 50 * (1 - Math.min(100, Math.max(0, percentage)) / 100)}`}
                style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-3xl font-black text-brand-text-primary">
                {percentage.toFixed(1)}%
              </div>
              <div className="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider">
                {stats ? `${stats.total - stats.EXCUSED} ${t('attendance.classesCounted', 'counted')}` : ''}
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1">
            <TrendingUp size={14} className={percentage >= 80 ? 'text-brand-green' : 'text-brand-yellow'} />
            <span className={`text-xs font-bold ${percentage >= 80 ? 'text-brand-green' : percentage >= 65 ? 'text-brand-yellow' : 'text-rose-500'}`}>
              {percentage >= 80
                ? t('attendance.standingGood', 'Good standing')
                : percentage >= 65
                ? t('attendance.standingWarning', 'At risk — improve attendance')
                : t('attendance.standingPoor', 'Critical — contact advisor')}
            </span>
          </div>
        </Card>

        {kpis.map((k) => (
          <Card key={k.key} className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div className={`p-2.5 rounded-2xl ${k.bg}`}><k.icon size={18} className={k.color} /></div>
              <div className="text-3xl font-black tracking-tight text-brand-text-primary">{k.value}</div>
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted">
              {t(k.labelKey, k.key)}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 xl:gap-6">
        <Card className="p-5 lg:col-span-1 space-y-4 h-fit">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-brand-brand-green-dark" />
            <h3 className="text-sm font-black uppercase tracking-widest text-brand-text-primary">
              {t('attendance.filters', 'Filters')}
            </h3>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">
              {t('attendance.filterByCourse', 'Filter by course')}
            </label>
            <Select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="w-full h-11 px-4 bg-brand-bg-page/30 border border-brand-border rounded-xl text-sm font-bold text-brand-text-main focus:outline-none focus:ring-2 focus:ring-brand-green/20"
            >
              <option value="">{t('attendance.allCourses', 'All Courses')}</option>
              {enrolledCourses.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.courseCode ? `${c.courseCode} — ` : ''}
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="pt-3 border-t border-brand-border space-y-2">
            <p className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest">
              {t('attendance.formulaNote', 'Attendance formula')}
            </p>
            <ul className="text-xs text-brand-text-secondary space-y-1 font-medium leading-relaxed">
              <li>✓ {t('attendance.present', 'Present')}: 100% credit</li>
              <li>⏰ {t('attendance.late', 'Late')}: 50% credit</li>
              <li>❌ {t('attendance.absent', 'Absent')}: 0% credit</li>
              <li>📄 {t('attendance.excused', 'Excused')}: {t('attendance.excusedExcluded', 'Excluded from rate')}</li>
            </ul>
          </div>
        </Card>

        <Card noPadding className="lg:col-span-3 min-h-[500px]">
          {loading ? (
            <SkeletonTable rows={5} />
          ) : error ? (
            <div className="p-12">
              <ErrorState message={error} onRetry={fetchAttendance} />
            </div>
          ) : records.length === 0 ? (
            <EmptyState
              icon={<History size={40} />}
              title={t('attendance.noRecords', 'No attendance records yet')}
              subtitle={t('attendance.noRecordsDesc', 'Records will appear here after your classes start marking attendance')}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full" dir="rtl">
                  <thead>
                    <tr className="bg-surface-subtle dark:bg-slate-800/50 border-b border-brand-border">
                      <th className="px-6 py-4 text-right label-stat">
                        {t('attendance.date', 'Date')}
                      </th>
                      <th className="px-6 py-4 text-right label-stat">
                        {t('courses.name', 'Course')}
                      </th>
                      <th className="px-6 py-4 text-center label-stat">
                        {t('attendance.statusColumn', 'Status')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {records.map((record) => (
                      <tr key={record.id} className="hover:bg-surface-subtle dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-brand-text-muted" />
                            <span className="font-bold text-brand-text-main">
                              {new Date(record.date).toLocaleDateString(undefined, {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div>
                            <div className="font-bold text-brand-text-main">
                              {record.course?.name}
                            </div>
                            <div className="text-xs font-bold text-brand-text-muted">
                              {record.course?.courseCode}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex justify-center">
                            <Badge variant={statusBadgeVariant(record.status)} className="px-3 py-1">
                              {t(`attendance.${record.status.toLowerCase()}`, record.status)}
                            </Badge>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pagination && pagination.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-brand-border flex items-center justify-between">
                  <p className="text-xs font-bold text-brand-text-muted">
                    {t('common.showing', `Showing page ${pagination.page} of ${pagination.totalPages}`)}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pagination.page <= 1 || loading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronRight className="rtl:-scale-x-100" size={16} />
                      {t('common.previous', 'Previous')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages || loading}
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    >
                      {t('common.next', 'Next')}
                      <ChevronLeft className="rtl:-scale-x-100" size={16} />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </>
  );
};

export default AttendancePage;
