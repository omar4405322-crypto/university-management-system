import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  QrCode,
  ClipboardList,
  Sparkles,
  Award,
  Layers,
  ArrowRight,
  ArrowLeft,
  CalendarX,
} from 'lucide-react';
import { StatCard } from '../../components/ui/card';
import Button from '../../components/ui/button';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import { useAuth } from '../../context/AuthContext';
import { CAMPUS_HERO_1 } from '../../constants/universityAssets';
import schedulesService from '../../services/schedules.service';
import quizService from '../../services/quiz.service';
import { logger } from '../../lib/logger';

export default function TADashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isRTL = i18n.dir() === 'rtl';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
  const [totalSessions, setTotalSessions] = useState<number>(0);
  const [quizCount, setQuizCount] = useState<number>(0);

  const fetchTAData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [schedulesRes, quizzesRes] = await Promise.all([
        schedulesService.getSchedules({ page: 1, limit: 100 }),
        quizService.getQuizzes(),
      ]);

      if (schedulesRes?.success) {
        const raw = schedulesRes.data as any;
        const slots = Array.isArray(raw)
          ? raw
          : raw?.schedules || raw?.data || [];
        setTodaySchedule(slots);
        const total = (schedulesRes as any).pagination?.total ?? slots.length;
        setTotalSessions(total);
      } else {
        throw new Error(schedulesRes?.message || 'Failed to fetch schedule slots');
      }

      if (quizzesRes?.success) {
        const quizzes = Array.isArray(quizzesRes.data)
          ? quizzesRes.data
          : ((quizzesRes.data as any)?.quizzes || []);
        setQuizCount(quizzes.length);
      } else {
        throw new Error(quizzesRes?.message || 'Failed to fetch quizzes');
      }
    } catch (err: any) {
      logger.error('Error fetching TA dashboard data:', err);
      setError(err?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTAData();
  }, [fetchTAData]);

  if (!user) return null;

  if (loading) {
    return <LoadingState message={t('dashboard.loading', 'Loading dashboard...')} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchTAData} />;
  }

  const taName =
    `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
    user?.email?.split('@')[0] ||
    'Teaching Assistant';

  const kpis = [
    {
      id: 'labSessions',
      title: t('dashboard.labSessions', 'Lab & Practical Sections'),
      value: totalSessions,
      icon: Clock,
      link: '/schedules',
    },
    {
      id: 'quizzes',
      title: t('dashboard.quizzes', 'Quizzes & Lab Assessments'),
      value: quizCount,
      icon: ClipboardList,
      link: '/quizzes',
    },
  ];

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10 animate-page">
      {/* 1. Executive University Campus Hero Banner */}
      <div
        className="relative overflow-hidden rounded-[2rem] shadow-elevated border border-white/10"
        style={{ minHeight: '180px' }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${CAMPUS_HERO_1}), linear-gradient(135deg, var(--color-brand-navy-500) 0%, var(--color-brand-navy-600) 100%)`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-brand-navy-900/80 to-black/45 rtl:bg-gradient-to-l" />
        <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-brand-brand-green shrink-0 shadow-inner">
              <Award size={36} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-3 py-0.5 rounded-full bg-brand-brand-green/20 text-brand-brand-green text-xs font-bold border border-brand-brand-green/30 flex items-center gap-1.5">
                  <Sparkles size={12} />{' '}
                  {isRTL
                    ? 'جامعة 6 أكتوبر التكنولوجية'
                    : '6th of October University of Technology'}
                </span>
                <span className="text-white/70 text-xs">
                  • {t('dashboard.academicStaff', 'Academic Staff')}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                {isRTL ? (
                  <>
                    {t('dashboard.welcomeBack', 'مرحباً بك')}, م.{' '}
                    <bdi>{taName}</bdi>
                  </>
                ) : (
                  <>
                    {t('dashboard.welcomeBack', 'Welcome back')}, Eng.{' '}
                    <bdi>{taName}</bdi>
                  </>
                )}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-white/70">
                <span className="px-2 py-0.5 rounded bg-white/10 text-white font-bold text-[10px] uppercase tracking-wider">
                  {t('roles.teachingAssistant', 'Teaching Assistant')}
                </span>
                <span>•</span>
                <span>
                  {new Date().toLocaleDateString(
                    i18n.language === 'ar' ? 'ar-EG' : 'en-US',
                    {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    }
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button
              variant="primary"
              size="default"
              className="bg-brand-brand-green hover:bg-brand-brand-green-dark text-brand-navy-950 font-bold text-xs shadow-overlay shadow-brand-brand-green/30 border-0 flex items-center gap-2 py-2.5 px-5 rounded-xl transition-all cursor-pointer"
              onClick={() => navigate('/attendance')}
            >
              <QrCode size={16} />{' '}
              {t('dashboard.takeAttendance', isRTL ? 'تسجيل الحضور' : 'Take Attendance')}
            </Button>
            <Button
              variant="outline"
              size="default"
              className="border-white/20 bg-white/10 hover:bg-white/20 text-white font-bold text-xs backdrop-blur-sm flex items-center gap-2 py-2.5 px-4 rounded-xl cursor-pointer"
              onClick={() => navigate('/schedules')}
            >
              <Calendar size={16} />{' '}
              {t('dashboard.viewSchedule', isRTL ? 'جدول الجلسات' : 'View Schedule')}
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Institutional KPI Grid (#8BB83C, #132231 via colorIndex % 4) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <StatCard
              key={kpi.id}
              compact
              title={kpi.title}
              value={kpi.value}
              icon={Icon}
              colorIndex={idx % 4}
              onClick={() => kpi.link && navigate(kpi.link)}
              hasLink
            />
          );
        })}
      </div>

      {/* 3. Main Sections & Lab Schedules Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Assigned Labs & Sections (8 cols) */}
        <div className="lg:col-span-8 bg-surface-card rounded-3xl border border-brand-border p-6 shadow-card space-y-5">
          <div className="flex items-center justify-between border-b border-brand-border pb-4">
            <div>
              <h2 className="text-lg font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
                <Layers size={20} className="text-brand-brand-green" />
                {t('dashboard.assignedLabsAndCourses', isRTL ? 'المختبرات والسكاشن المسندة' : 'Assigned Labs & Sections')}
              </h2>
              <p className="text-xs text-brand-text-muted mt-0.5">
                {t(
                  'dashboard.taAssignedSubtitle',
                  isRTL
                    ? 'إدارة جلسات التدريب العملي والتواصل مع الطلاب'
                    : 'Manage laboratory sections and monitor student attendance'
                )}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs font-bold text-brand-primary-700 dark:text-brand-primary-300 hover:bg-brand-primary-50 dark:hover:bg-brand-primary-950/40"
              onClick={() => navigate('/schedules')}
            >
              {t('common.viewAll', isRTL ? 'عرض الكل' : 'View All')}
            </Button>
          </div>

          {todaySchedule.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm font-semibold">
              {t(
                'dashboard.noAssignedSections',
                isRTL
                  ? 'لا توجد سكاشن مسندة حالياً في جدول الفصل الدراسي'
                  : 'No active laboratory sections assigned currently'
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {todaySchedule.slice(0, 4).map((slot: any, idx: number) => {
                const courseName = slot.course?.name || t('dashboard.labSession', 'Practical Section');
                const courseCode = slot.course?.courseCode || 'LAB';
                const roomName = slot.room || 'Lab';
                const timeSpan = slot.startTime && slot.endTime ? `${slot.startTime} - ${slot.endTime}` : 'Scheduled';
                return (
                  <div
                    key={slot.id || idx}
                    className="p-5 rounded-2xl bg-surface-subtle border border-brand-border hover:border-brand-primary-500/40 hover:shadow-md transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="px-2.5 py-0.5 rounded text-[11px] font-black bg-brand-primary-50 dark:bg-brand-primary-950/50 text-brand-primary-800 dark:text-brand-primary-200 border border-brand-primary-200 dark:border-brand-primary-800/40">
                          {courseCode}
                        </span>
                        <h3 className="text-sm font-bold text-brand-text-primary dark:text-brand-text-main pt-1.5">
                          {courseName}
                        </h3>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-surface-card px-2 py-0.5 rounded-lg border border-brand-border">
                        {slot.slotType || 'LAB'}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-brand-border flex items-center justify-between">
                      <span className="text-xs text-brand-text-muted flex items-center gap-1.5">
                        <Clock size={12} /> {timeSpan} • {roomName}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate('/attendance')}
                        className="text-xs font-bold text-brand-primary-600 dark:text-brand-primary-400 flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        {t('dashboard.takeAttendance', isRTL ? 'حضور الجلسة' : 'Take Attendance')}
                        <ArrowIcon size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Tools & Today's Schedule (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-surface-card rounded-3xl border border-brand-border p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <h2 className="text-base font-bold text-brand-text-primary dark:text-brand-text-main flex items-center gap-2">
                <Clock size={18} className="text-brand-brand-green" />
                {t('dashboard.todaySessions', isRTL ? 'جلسات اليوم' : "Today's Schedule")}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs font-bold text-brand-primary-600 dark:text-brand-primary-400"
                onClick={() => navigate('/schedules')}
              >
                {t('common.details', isRTL ? 'التفاصيل' : 'Details')}
              </Button>
            </div>

            {todaySchedule.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-xs font-medium flex flex-col items-center gap-2">
                <CalendarX size={28} className="text-slate-400 opacity-60" />
                <p>
                  {t(
                    'dashboard.noSessionsToday',
                    isRTL ? 'لا توجد جلسات مجدولة لهذا اليوم' : 'No scheduled sessions for today'
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {todaySchedule.slice(0, 3).map((slot: any, idx: number) => (
                  <div
                    key={slot.id || idx}
                    className="p-3.5 rounded-xl bg-surface-subtle border border-brand-border flex items-center justify-between"
                  >
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main">
                        {slot.course?.name || slot.courseName || t('dashboard.labSession', 'Practical Section')}
                      </p>
                      <p className="text-[11px] text-brand-text-muted flex items-center gap-1.5">
                        <Clock size={12} /> {slot.startTime || '09:00'} - {slot.endTime || '11:00'} • {slot.room || 'Lab'}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-brand-green/15 text-brand-brand-green">
                      {isRTL ? 'مجدول' : 'Scheduled'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Direct Actions Card */}
          <div className="bg-surface-card rounded-3xl border border-brand-border p-5 shadow-card space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-text-muted">
              {t('dashboard.quickActions', isRTL ? 'إجراءات سريعة' : 'Quick Actions')}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => navigate('/attendance')}
                className="p-3 rounded-xl bg-surface-subtle border border-brand-border hover:bg-brand-primary-50 dark:hover:bg-brand-primary-950/30 text-start transition-all cursor-pointer space-y-1"
              >
                <QrCode size={18} className="text-brand-brand-green" />
                <p className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main">
                  {isRTL ? 'مسح QR' : 'QR Attendance'}
                </p>
              </button>
              <button
                type="button"
                onClick={() => navigate('/quizzes')}
                className="p-3 rounded-xl bg-surface-subtle border border-brand-border hover:bg-brand-primary-50 dark:hover:bg-brand-primary-950/30 text-start transition-all cursor-pointer space-y-1"
              >
                <ClipboardList size={18} className="text-brand-support-blue" />
                <p className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main">
                  {isRTL ? 'الاختبارات' : 'Quizzes'}
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
