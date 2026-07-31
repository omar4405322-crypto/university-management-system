// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/button';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import {
  BookOpen,
  Users,
  ClipboardList,
  FileText,
  Clock,
  Calendar,
  QrCode,
  Plus,
  CheckCircle2,
  GraduationCap,
  Sparkles,
  MapPin,
  Award
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import dashboardService from '../../services/dashboard.service';
import { CAMPUS_HERO_1 } from '../../constants/universityAssets';
import { logger } from '../../lib/logger';

export default function DoctorDashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const isRTL = i18n.language === 'ar';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await dashboardService.getDoctorStats();
      if (result?.success) {
        setStats(result.data);
      } else {
        setError(result?.message || 'Failed to load dashboard data.');
      }
    } catch (err: any) {
      logger.error('Error fetching dashboard stats:', err);
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (!user) return null;

  if (loading && !stats) {
    return <LoadingState message={t('dashboard.loading')} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchStats} />;
  }

  const profile = stats?.profile || {};
  const doctorName = `${profile.firstName || user?.doctor?.firstName || ''} ${profile.lastName || user?.doctor?.lastName || ''}`.trim() || user?.email?.split('@')[0] || 'Doctor';
  const departmentName = profile.departmentName || 'قسم الميكاترونيكس';
  const collegeName = profile.collegeName || 'جامعة 6 أكتوبر التكنولوجية';

  const myCourses = stats?.myCourses || [];
  const todaySchedule = stats?.todaySchedule || [];
  const upcomingExams = stats?.upcomingExams || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* 1. Official University Brand Hero Banner */}
      <div className="relative overflow-hidden rounded-[2rem] shadow-elevated" style={{ minHeight: '180px' }}>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${CAMPUS_HERO_1}), linear-gradient(135deg, var(--color-brand-navy-500) 0%, var(--color-brand-navy-600) 100%)` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-brand-navy-900/75 to-black/40 rtl:bg-gradient-to-l" />
        <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-brand-brand-green shrink-0 shadow-inner">
              <GraduationCap size={36} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-3 py-0.5 rounded-full bg-brand-brand-green/20 text-brand-brand-green text-xs font-bold border border-brand-brand-green/30 flex items-center gap-1.5">
                  <Sparkles size={12} /> {isRTL ? 'جامعة 6 أكتوبر التكنولوجية' : '6th of October Technological University'}
                </span>
                <span className="text-white/60 text-xs">• {collegeName}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                {isRTL ? `أهلاً بك، د. ${doctorName}` : `Welcome, Dr. ${doctorName}`}
              </h1>
              <p className="text-xs md:text-sm text-white/80 font-medium flex items-center gap-2">
                <Award size={14} className="text-brand-brand-green" />
                {departmentName} {profile.specialty ? `— ${profile.specialty}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="md"
              className="bg-brand-brand-green hover:bg-brand-brand-green-dark text-white font-bold text-xs shadow-overlay shadow-brand-brand-green/30 border-0 flex items-center gap-2 py-2.5 px-5 rounded-xl transition-all"
              onClick={() => navigate('/attendance')}
            >
              <QrCode size={16} /> {isRTL ? 'بدء تسجيل الحضور (QR)' : 'Take Attendance'}
            </Button>
            <Button
              variant="outline"
              size="md"
              className="border-white/20 bg-white/10 hover:bg-white/20 text-white font-bold text-xs backdrop-blur-sm flex items-center gap-2 py-2.5 px-4 rounded-xl"
              onClick={() => navigate('/quizzes')}
            >
              <Plus size={16} /> {isRTL ? 'إضافة اختبار' : 'Create Quiz'}
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Standalone Elevated Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <div
          onClick={() => navigate('/courses')}
          className="bg-surface-card border border-brand-border p-5 rounded-2xl flex items-center justify-between shadow-card hover:-translate-y-0.5 transition-all cursor-pointer group"
        >
          <div className="space-y-1">
            <p className="text-xs font-bold text-brand-text-muted">{isRTL ? 'المقررات الدراسية' : 'My Courses'}</p>
            <h3 className="text-3xl font-black text-brand-text-primary dark:text-brand-text-main">{stats?.counts?.myCourses || 0}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-primary-50 dark:bg-brand-primary-950/40 text-brand-brand-green-dark flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <BookOpen size={24} />
          </div>
        </div>

        <div
          onClick={() => navigate('/record')}
          className="bg-surface-card border border-brand-border p-5 rounded-2xl flex items-center justify-between shadow-card hover:-translate-y-0.5 transition-all cursor-pointer group"
        >
          <div className="space-y-1">
            <p className="text-xs font-bold text-brand-text-muted">{isRTL ? 'إجمالي الطلاب' : 'Total Students'}</p>
            <h3 className="text-3xl font-black text-brand-text-primary dark:text-brand-text-main">{stats?.counts?.totalStudents || 0}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-navy-50 dark:bg-brand-navy-900/40 text-brand-navy-500 dark:text-brand-navy-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Users size={24} />
          </div>
        </div>

        <div
          onClick={() => navigate('/quizzes')}
          className="bg-surface-card border border-brand-border p-5 rounded-2xl flex items-center justify-between shadow-card hover:-translate-y-0.5 transition-all cursor-pointer group"
        >
          <div className="space-y-1">
            <p className="text-xs font-bold text-brand-text-muted">{isRTL ? 'الاختبارات المنجزة' : 'Total Quizzes'}</p>
            <h3 className="text-3xl font-black text-brand-text-primary dark:text-brand-text-main">{stats?.counts?.totalQuizzes || 0}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <ClipboardList size={24} />
          </div>
        </div>

        <div
          onClick={() => navigate('/tasks')}
          className="bg-surface-card border border-brand-border p-5 rounded-2xl flex items-center justify-between shadow-card hover:-translate-y-0.5 transition-all cursor-pointer group"
        >
          <div className="space-y-1">
            <p className="text-xs font-bold text-brand-text-muted">{isRTL ? 'الواجبات المعلقة' : 'Pending Tasks'}</p>
            <h3 className="text-3xl font-black text-brand-text-primary dark:text-brand-text-main">{stats?.counts?.pendingTasks || 0}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-navy-50 dark:bg-brand-navy-900/40 text-brand-navy-600 dark:text-slate-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <FileText size={24} />
          </div>
        </div>
      </div>

      {/* 3. Main Cohesive Container: Active Courses & Attendance Launcher */}
      <div className="bg-surface-card rounded-3xl border border-brand-border p-6 shadow-card space-y-6">
        <div className="flex items-center justify-between border-b border-brand-border pb-4">
          <div>
            <h2 className="text-lg font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
              <BookOpen size={20} className="text-brand-brand-green-dark" />
              {isRTL ? 'المقررات الدراسية وجلسات الحضور' : 'Active Courses & Attendance'}
            </h2>
            <p className="text-xs text-brand-text-muted mt-0.5">
              {isRTL ? 'إدارة مقرراتك الدراسية وبدء تسجيل الحضور المباشر للطلاب' : 'Manage active courses and start live attendance sessions'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs font-bold text-brand-brand-green-dark hover:bg-brand-primary-50"
            onClick={() => navigate('/courses')}
          >
            {isRTL ? 'إدارة جميع المقررات' : 'Manage All Courses'}
          </Button>
        </div>

        {myCourses.length === 0 ? (
          <div className="text-center py-12 text-brand-text-muted text-sm font-bold">
            {isRTL ? 'لا توجد مقررات دراسية مسجلة حالياً' : 'No active courses currently assigned'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {myCourses.map((course: any) => (
              <div
                key={course.id}
                className="p-5 rounded-2xl bg-surface-subtle border border-brand-border hover:border-brand-brand-green/40 hover:shadow-md transition-all space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="px-2.5 py-0.5 rounded text-xs font-black bg-brand-primary-50 text-brand-brand-green-dark border border-brand-primary-200">
                      {course.courseCode || 'MTR'}
                    </span>
                    <h3 className="text-base font-bold text-brand-text-primary dark:text-brand-text-main pt-1">
                      {course.name}
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-brand-text-muted bg-surface-card px-2.5 py-1 rounded-lg border border-brand-border">
                    {course.credits ? `${course.credits} ${isRTL ? 'ساعات معتمدة' : 'Credits'}` : ''}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs font-medium text-brand-text-secondary">
                  <span>{isRTL ? `الفرقة الدراسية: ${course.year || 1}` : `Year: ${course.year || 1}`}</span>
                  <span>•</span>
                  <span>{isRTL ? `الفصل: ${course.semester || 1}` : `Sem: ${course.semester || 1}`}</span>
                </div>

                <div className="pt-3 border-t border-brand-border flex items-center gap-3">
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1 bg-brand-brand-green hover:bg-brand-brand-green-dark text-white font-bold text-xs py-2.5 shadow-sm flex items-center justify-center gap-2 border-0"
                    onClick={() => navigate('/attendance')}
                  >
                    <QrCode size={15} /> {isRTL ? 'بدء تسجيل الحضور' : 'Start QR Session'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-brand-border hover:bg-surface-card font-bold text-xs py-2.5"
                    onClick={() => navigate('/record')}
                  >
                    <Users size={15} /> {isRTL ? 'سجل الطلاب' : 'Student Roster'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Secondary Cohesive Container: Today's Schedule & Upcoming Events */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Today's Schedule (8 cols) */}
        <div className="lg:col-span-8 bg-surface-card rounded-3xl border border-brand-border p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-brand-border pb-3">
            <h3 className="text-base font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
              <Clock size={18} className="text-brand-brand-green-dark" />
              {isRTL ? 'محاضرات ومواعيد اليوم' : "Today's Lectures"}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs font-bold text-brand-text-muted"
              onClick={() => navigate('/schedules/doctor')}
            >
              {isRTL ? 'الجدول الكامل' : 'Full Schedule'}
            </Button>
          </div>

          {todaySchedule.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <CheckCircle2 size={32} className="mx-auto text-brand-brand-green-dark/60" />
              <p className="text-xs font-bold text-brand-text-muted">
                {isRTL ? 'لا توجد محاضرات مجدولة لهذا اليوم' : 'No lectures scheduled for today'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {todaySchedule.map((slot: any) => (
                <div key={slot.id} className="p-4 rounded-xl bg-surface-subtle border border-brand-border flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1.5 rounded-lg bg-brand-primary-50 text-brand-brand-green-dark font-bold text-xs">
                      {slot.startTime} - {slot.endTime}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-brand-text-primary dark:text-brand-text-main">{slot.courseName}</h4>
                      <p className="text-xs text-brand-text-muted">{slot.room} • {slot.slotType}</p>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-brand-brand-green hover:bg-brand-brand-green-dark text-white font-bold text-xs border-0"
                    onClick={() => navigate('/attendance')}
                  >
                    <QrCode size={14} /> {isRTL ? 'حضور' : 'Attendance'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Exams (4 cols) */}
        <div className="lg:col-span-4 bg-surface-card rounded-3xl border border-brand-border p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-brand-border pb-3">
            <h3 className="text-base font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
              <Calendar size={18} className="text-brand-accent-gold" />
              {isRTL ? 'الاختبارات القادمة' : 'Upcoming Exams'}
            </h3>
            <Button variant="ghost" size="sm" className="text-xs font-bold text-brand-text-muted" onClick={() => navigate('/exams')}>
              {isRTL ? 'عرض' : 'View'}
            </Button>
          </div>

          {upcomingExams.length === 0 ? (
            <div className="py-8 text-center text-xs font-bold text-brand-text-muted">
              {isRTL ? 'لا توجد امتحانات قادمة' : 'No upcoming exams'}
            </div>
          ) : (
            <div className="space-y-2.5">
              {upcomingExams.map((exam: any) => (
                <div key={exam.id} className="p-3 rounded-xl bg-surface-subtle border border-brand-border flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                    {new Date(exam.date).getDate()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main truncate">{exam.courseName}</p>
                    <p className="text-[10px] text-brand-text-muted">{exam.type} • {exam.room}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
