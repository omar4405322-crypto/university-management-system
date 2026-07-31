import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import studentsService from '../../services/students.service';
import attendanceService from '../../services/attendance.service';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, User, Mail, Shield, Calendar, CheckCircle2, XCircle, Clock, FileX2, History, ExternalLink } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import LoadingState from '../../components/ui/LoadingState';
import Button from '../../components/ui/Button';
import type { AttendanceRecord, AttendanceStats, Student as StudentType } from '../../types/models';

interface StudentDetailsProps {
  studentId?: string;
  isDrawerMode?: boolean;
}

const StudentDetails: React.FC<StudentDetailsProps> = ({ studentId, isDrawerMode = false }) => {
  const { id } = useParams();
  const actualId = studentId || id;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [student, setStudent] = useState<StudentType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStats | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);

  const fetchAttendance = useCallback(async (sid: number) => {
    try {
      setAttendanceLoading(true);
      const result = await attendanceService.getStudentAttendance(sid, undefined, 1, 5);
      if (result.success) {
        setRecentAttendance((result.data as AttendanceRecord[]) ?? []);
        setAttendanceStats((result as any).stats ?? null);
      }
    } catch (err: any) {
      // Soft-fail — don't block personal info loading
      console.error('[StudentDetails] attendance fetch failed', err);
    } finally {
      setAttendanceLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchStudent = async () => {
      try {
        setLoading(true);
        const result = await studentsService.getStudentById(actualId);
        if (result.success) {
          const payload = result.data as StudentType;
          setStudent(payload);
          fetchAttendance(payload.id);
        }
      } catch (err: any) {
        setError(err.response?.data?.message || t('students.errorFetching'));
      } finally {
        setLoading(false);
      }
    };

    if (actualId) fetchStudent();
  }, [actualId, t, fetchAttendance]);

  if (loading) {
    return <LoadingState message={t('common.loading')} />;
  }

  if (error || !student) {
    return (
      <div className="page-padding text-center">
        <div className="max-w-md mx-auto py-20">
          <p className="text-error text-xl mb-4 font-bold">{error || t('students.noStudents')}</p>
          <button
            onClick={() => navigate('/students')}
            className="text-brand-accent-blue hover:underline flex items-center justify-center gap-2 mx-auto font-medium"
          >
            <ArrowLeft size={18} className="rtl:-scale-x-100" /> {t('students.backToList')}
          </button>
        </div>
      </div>
    );
  }

  const statusBadgeVariant = (s: string): 'success' | 'warning' | 'error' | 'info' => {
    switch (s) {
      case 'PRESENT': return 'success';
      case 'LATE': return 'warning';
      case 'ABSENT': return 'error';
      case 'EXCUSED': return 'info';
      default: return 'info';
    }
  };

  const percentage = attendanceStats?.percentage ?? 0;
  const kpis = attendanceStats
    ? [
        { key: 'PRESENT', labelKey: 'attendance.present', value: attendanceStats.PRESENT, icon: CheckCircle2, color: 'text-brand-green', bg: 'bg-brand-green/10' },
        { key: 'LATE', labelKey: 'attendance.late', value: attendanceStats.LATE, icon: Clock, color: 'text-brand-yellow', bg: 'bg-brand-yellow/10' },
        { key: 'ABSENT', labelKey: 'attendance.absent', value: attendanceStats.ABSENT, icon: XCircle, color: 'text-rose-500', bg: 'bg-rose-500/10' },
        { key: 'EXCUSED', labelKey: 'attendance.excused', value: attendanceStats.EXCUSED, icon: FileX2, color: 'text-brand-navy-500', bg: 'bg-brand-navy-500/10' },
      ]
    : [];

  return (
    <div className={isDrawerMode ? "" : "page-padding content-container section-gap animate-in fade-in duration-700"}>
      {!isDrawerMode && (
        <button
          onClick={() => navigate('/students')}
          className="flex items-center gap-2 text-brand-text-secondary dark:text-brand-text-muted hover:text-info dark:hover:text-info transition-colors font-medium mb-6"
        >
          <ArrowLeft size={20} className="rtl:-scale-x-100" /> {t('students.backToList')}
        </button>
      )}

      {/* ======== ATTENDANCE SUMMARY ROW ======== */}
      <Card className="mb-5 xl:mb-6 p-5">
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-brand-green/10 text-brand-green">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-brand-text-primary dark:text-brand-text-main uppercase tracking-wider">
                {t('attendance.overview', 'Attendance Overview')}
              </h2>
              <p className="text-xs font-bold text-brand-text-muted">
                {t('attendance.overviewDesc', 'Real-time attendance statistics and latest records')}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/attendance`)}
            className="gap-1.5"
          >
            <ExternalLink size={14} />
            {t('attendance.openPage', 'Open attendance')}
          </Button>
        </div>

        {attendanceLoading && !attendanceStats ? (
          <div className="h-24 flex items-center justify-center">
            <LoadingState message={t('common.loading')} />
          </div>
        ) : attendanceStats ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-5 items-stretch">
            <div className="flex flex-col items-center justify-center py-3 border lg:border-0 lg:border-r border-brand-border pr-0 lg:pr-5">
              <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
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
                  <div className="text-2xl font-black text-brand-text-primary">{percentage.toFixed(1)}%</div>
                  <div className="text-[9px] font-bold text-brand-text-muted uppercase tracking-wider">
                    {attendanceStats.total - attendanceStats.EXCUSED} {t('attendance.classesCounted', 'counted')}
                  </div>
                </div>
              </div>
            </div>

            {kpis.map((k) => (
              <div key={k.key} className="bg-brand-bg-page/40 dark:bg-slate-800/20 rounded-2xl p-4 border border-brand-border/50">
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-xl ${k.bg}`}><k.icon size={14} className={k.color} /></div>
                  <div className="text-2xl font-black tracking-tight text-brand-text-primary">{k.value}</div>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted">
                  {t(k.labelKey, k.key)}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {recentAttendance.length > 0 && (
          <div className="mt-5 border-t border-brand-border pt-5">
            <div className="flex items-center gap-2 mb-3">
              <History size={14} className="text-brand-text-muted" />
              <p className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted">
                {t('attendance.recentRecords', 'Recent attendance records')}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" dir="rtl">
                <thead>
                  <tr className="border-b border-brand-border/50">
                    <th className="text-right label-stat text-[10px] font-black tracking-widest uppercase py-2 px-3">
                      {t('attendance.date', 'Date')}
                    </th>
                    <th className="text-right label-stat text-[10px] font-black tracking-widest uppercase py-2 px-3">
                      {t('courses.name', 'Course')}
                    </th>
                    <th className="text-center label-stat text-[10px] font-black tracking-widest uppercase py-2 px-3">
                      {t('attendance.statusColumn', 'Status')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/40">
                  {recentAttendance.map((r) => (
                    <tr key={r.id} className="hover:bg-surface-subtle dark:hover:bg-slate-800/20">
                      <td className="py-3 px-3 font-bold text-sm text-brand-text-main">
                        {new Date(r.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-3 px-3 font-medium text-sm text-brand-text-secondary">
                        {r.course?.name || '—'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge variant={statusBadgeVariant(r.status)} className="px-2.5 py-0.5 text-[10px]">
                          {t(`attendance.${r.status.toLowerCase()}`, r.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      <div className={`grid grid-cols-1 ${isDrawerMode ? 'gap-5' : 'lg:grid-cols-3 xl:grid-cols-4 gap-5 xl:gap-6'}`}>
        <Card className={isDrawerMode ? '' : 'lg:col-span-2 xl:col-span-3'}>
          <div className="flex items-center gap-3 mb-6 border-b border-brand-border dark:border-brand-border pb-4">
            <div className="p-2 bg-info/10 dark:bg-info/20 rounded-lg text-info dark:text-info">
              <User size={20} />
            </div>
            <h2 className="text-xl font-bold text-brand-text-primary dark:text-brand-text-main">
              {t('students.personalInformation')}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <InfoItem label={t('students.firstName')} value={student.firstName} />
            <InfoItem label={t('students.lastName')} value={student.lastName} />
            <InfoItem label={t('students.studentId')} value={student.studentId} isMono />
            <InfoItem
              label={t('students.phone')}
              value={student.phone || t('students.notProvided')}
            />
            <div className="md:col-span-2">
              <InfoItem
                label={t('students.address')}
                value={student.address || t('students.notProvided')}
              />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3 mb-6 border-b border-brand-border dark:border-brand-border pb-4">
            <div className="p-2 bg-info/10 dark:bg-info/20 rounded-lg text-info dark:text-info">
              <Shield size={20} />
            </div>
            <h2 className="text-xl font-bold text-brand-text-primary dark:text-brand-text-main">
              {t('students.accountDetails')}
            </h2>
          </div>

          <div className="space-y-6">
            <InfoItem
              label={t('profile.email')}
              value={student.user?.email}
              icon={<Mail size={14} className="text-brand-text-muted" />}
            />

            <div className="space-y-1">
              <p className="text-xs font-bold text-brand-text-secondary dark:text-brand-text-muted uppercase tracking-wider">
                {t('students.accountRole')}
              </p>
              <Badge variant="info" className="mt-1">
                {student.user?.role}
              </Badge>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold text-brand-text-secondary dark:text-brand-text-muted uppercase tracking-wider">
                {t('students.enrolledSince')}
              </p>
              <div className="flex items-center gap-2 text-brand-text-primary dark:text-brand-text-main">
                <Calendar size={16} className="text-brand-text-muted" />
                <span className="text-lg font-medium">
                  {student.enrolledAt
                    ? new Date(student.enrolledAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : '—'}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold text-brand-text-secondary dark:text-brand-text-muted uppercase tracking-wider">
                {t('profile.status')}
              </p>
              <Badge variant={student.status === 'active' ? 'success' : 'warning'}>
                {t(`students.${student.status || 'active'}`)}
              </Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

const InfoItem = ({ label, value, isMono = false, icon = null }: { label: string; value: any; isMono?: boolean; icon?: React.ReactNode }) => (
  <div className="space-y-1">
    <p className="text-xs font-bold text-brand-text-secondary dark:text-brand-text-muted uppercase tracking-wider">
      {label}
    </p>
    <div className="flex items-center gap-2">
      {icon}
      <p
        className={`text-lg text-brand-text-primary dark:text-brand-text-main ${isMono ? 'font-mono' : 'font-medium'}`}
      >
        {value || '—'}
      </p>
    </div>
  </div>
);

export default StudentDetails;
