// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import { BookOpen, Users, ClipboardList, FileText, ArrowUpRight, ArrowDownRight, CheckCircle2, ChevronRight, History, Zap, Bell, Calendar, Target, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import ChartTooltip from '../../components/ui/ChartTooltip';
import dashboardService from '../../services/dashboard.service';
import { CAMPUS_HERO_1 } from '../../constants/universityAssets';
import { logger } from '../../lib/logger';

export default function DoctorDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user } = useAuth();

  const CHART_GREEN = '#8BB83C';

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

  const kpis = [
    {
      id: 'myCourses',
      title: t('dashboard.myCourses'),
      value: stats?.counts?.myCourses || '0',
      change: t('dashboard.activeCourses'),
      trend: 'neutral',
      icon: BookOpen,
      color: 'navy',
    },
    {
      id: 'totalStudents',
      title: t('dashboard.totalStudents'),
      value: stats?.counts?.totalStudents || '0',
      change: t('dashboard.enrolled'),
      trend: 'up',
      icon: Users,
      color: 'green',
    },
    {
      id: 'totalQuizzes',
      title: t('dashboard.totalQuizzes'),
      value: stats?.counts?.totalQuizzes || '0',
      change: t('dashboard.assessments'),
      trend: 'neutral',
      icon: ClipboardList,
      color: 'yellow',
    },
    {
      id: 'pendingTasks',
      title: t('dashboard.pendingTasks'),
      value: stats?.counts?.pendingTasks || '0',
      change: t('dashboard.toGrade'),
      trend: stats?.counts?.pendingTasks > 0 ? 'down' : 'up',
      icon: FileText,
      color: 'navy',
    },
  ];

  const academicChartData =
    stats?.growthData?.length > 0
      ? stats.growthData
      : (stats?.enrollmentData || []).map((row: any) => ({
          name: String(row.name),
          value: row.students ?? row.value ?? 0,
        }));

  return (
    <div className="section-gap animate-in fade-in duration-700">
      {/* === Hero Header === */}
      <div className="relative overflow-hidden rounded-[2rem] shadow-elevated" style={{ minHeight: '180px' }}>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${CAMPUS_HERO_1}), linear-gradient(135deg, var(--color-brand-navy) 0%, var(--color-brand-teal) 100%)` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/50 to-black/25 rtl:bg-gradient-to-l" />
        <div className="relative z-10 flex flex-col gap-6 p-6 md:flex-row md:items-end md:justify-between md:p-8">
          <div className="space-y-2 max-w-2xl">
            <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
              {t('dashboard.welcomeBack')}, {user?.doctor?.firstName || user?.email.split('@')[0]}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-white/85">
              <span className="text-white/40">|</span>
              <span>
                {new Date().toLocaleDateString(undefined, {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                })}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Button
              variant="outline"
              size="md"
              className="border-white/30 bg-white/10 font-bold text-xs uppercase tracking-widest text-white backdrop-blur-sm hover:bg-white/20"
              onClick={() => navigate('/notifications')}
            >
              <History size={16} /> {t('dashboard.activityLog')}
            </Button>
            <Button
              variant="primary"
              size="md"
              className="shadow-overlay shadow-brand-primary-500/30 font-bold text-xs uppercase tracking-widest"
              onClick={() => navigate('/settings')}
            >
              <Zap size={16} /> {t('dashboard.quickActions')}
            </Button>
          </div>
        </div>
      </div>

      {/* === KPI Grid === */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-5 xl:gap-6 2xl:gap-8">
        {kpis.map((kpi, idx) => (
          <Card key={kpi.id || idx} variant="default" noPadding className="group hover:-translate-y-0.5 transition-all duration-300 overflow-hidden relative">
            <div className="p-5 space-y-3">
              <div className="flex justify-between items-start">
                <div className={`p-2.5 rounded-2xl transition-colors duration-300 ${
                  kpi.color === 'green' ? 'bg-brand-primary-50 text-brand-primary-500 group-hover:bg-[var(--kpi-icon-hover)] group-hover:text-white'
                  : kpi.color === 'navy' ? 'bg-brand-navy-50 text-brand-navy-500 group-hover:bg-[var(--kpi-icon-hover)] group-hover:text-white'
                  : 'bg-brand-accent-yellow/10 text-brand-accent-yellow group-hover:bg-[var(--kpi-icon-hover)] group-hover:text-white'
                }`}>
                  <kpi.icon size={18} />
                </div>
                {kpi.trend === 'up' && <ArrowUpRight size={14} className="text-brand-primary-500" />}
                {kpi.trend === 'down' && <ArrowDownRight size={14} className="text-error" />}
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-brand-text-muted">{kpi.title}</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-black tracking-tight text-brand-text-primary dark:text-brand-text-main">{kpi.value}</h3>
                  {kpi.change && (
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] font-bold ${
                        kpi.trend === 'up' ? 'text-brand-primary-500' : kpi.trend === 'down' ? 'text-error' : 'text-brand-text-muted'
                      }`}>
                        {kpi.change}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* === Main Content Grid === */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 xl:gap-6 2xl:gap-8">
        <div className="lg:col-span-8 xl:col-span-9 2xl:col-span-9 section-gap">
          <Card variant="elevated" title={t('dashboard.academicOverview')} subtitle={t('dashboard.growthTrend')}>
            <div className="h-[400px] w-full overflow-hidden mt-6">
              {!academicChartData.length ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-brand-text-muted">
                  <TrendingUp size={40} className="opacity-40" />
                  <p className="text-sm font-bold">{t('common.noData')}</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={academicChartData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_GREEN} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={CHART_GREEN} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#E2E8F0'} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 12, fontWeight: 600 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 12, fontWeight: 600 }} dx={-10} />
                                        <Tooltip content={<ChartTooltip active={false} payload={[]} label={''} />} />
                    <Area type="monotone" dataKey="value" stroke={CHART_GREEN} strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card title={t('dashboard.recentActivity')} variant="default" noPadding>
              <div className="divide-y divide-brand-border">
                {!stats?.recentActivity?.length ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                    <CheckCircle2 size={32} className="text-brand-text-muted opacity-30" />
                    <p className="text-sm font-bold text-brand-text-muted">{t('common.noData')}</p>
                  </div>
                ) : (
                  stats.recentActivity.slice(0, 4).map((activity: any) => (
                    <div key={activity.id} className="p-5 flex items-center gap-4 hover:bg-surface-subtle/60 transition-colors group cursor-pointer">
                      <div className="w-11 h-11 rounded-xl bg-brand-primary-50 dark:bg-brand-primary-900/10 text-brand-primary-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <CheckCircle2 size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-brand-text-primary dark:text-brand-text-main truncate group-hover:text-brand-primary-500 transition-colors">
                          {activity.description || t('dashboard.newStudentRegistration')}
                        </p>
                        <p className="text-caption mt-0.5">
                          {activity.createdAt ? new Date(activity.createdAt).toLocaleDateString() : ''}
                        </p>
                      </div>
                      <ChevronRight size={16} className="rtl:-scale-x-100 text-brand-text-muted shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  ))
                )}
              </div>
              <div className="px-5 py-4 border-t border-brand-border bg-surface-subtle/50">
                <Button variant="ghost" size="sm" className="w-full font-black text-xs uppercase tracking-widest" onClick={() => navigate('/notifications')}>
                  {t('dashboard.viewAllActivity')}
                </Button>
              </div>
            </Card>

            <Card title={t('dashboard.systemStatus')} variant="default" noPadding>
              <div className="p-6 flex flex-col items-center justify-center gap-4 min-h-[160px]">
                <div className="p-4 rounded-2xl bg-brand-primary-50 dark:bg-brand-primary-900/10 border border-brand-primary-100 dark:border-brand-primary-900/20 flex items-center gap-3 w-full">
                  <div className="w-2.5 h-2.5 rounded-full bg-brand-primary-500 animate-ping shrink-0" />
                  <p className="text-xs font-black text-brand-primary-500 uppercase tracking-widest">{t('dashboard.allSystemsOperational')}</p>
                </div>
                <p className="text-xs text-brand-text-muted text-center font-medium">
                  {t('dashboard.systemStatusNote') || 'Detailed metrics available to system administrators.'}
                </p>
              </div>
            </Card>
          </div>
        </div>

        <div className="lg:col-span-4 xl:col-span-3 2xl:col-span-3 section-gap">
          <Card title={t('dashboard.upcomingEvents')} variant="default" noPadding>
            <div className="p-6 space-y-5">
              {!stats?.upcomingEvents?.length ? (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                  <Calendar size={28} className="text-brand-text-muted opacity-30" />
                  <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider">{t('dashboard.noUpcomingEvents') || 'No upcoming events'}</p>
                </div>
              ) : (
                stats.upcomingEvents.slice(0, 3).map((event: any) => {
                  const d = new Date(event.date);
                  return (
                    <div key={event.id} className="flex gap-4 group cursor-pointer">
                      <div className="flex flex-col items-center justify-center w-14 h-16 rounded-xl bg-surface-subtle border border-brand-border group-hover:bg-brand-primary-500 group-hover:border-brand-primary-500 transition-all duration-300">
                        <span className="text-sm font-black text-brand-text-primary dark:text-brand-text-main leading-none group-hover:text-white transition-colors">{d.getDate()}</span>
                        <span className="text-[9px] font-black uppercase text-brand-text-secondary group-hover:text-white/80 transition-colors">{d.toLocaleString('default', { month: 'short' })}</span>
                      </div>
                      <div className="flex-1 pt-1">
                        <h5 className="text-sm font-black text-brand-text-primary dark:text-brand-text-main leading-tight group-hover:text-brand-primary-500 transition-colors">{event.title}</h5>
                        <p className="text-caption mt-1">{event.location || ''}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {stats?.latestAnnouncement && (
            <Card variant="subtle" className="border-brand-accent-yellow/20">
              <div className="flex gap-4">
                <div className="p-3 bg-brand-accent-yellow/20 text-brand-accent-yellow rounded-xl h-fit shrink-0"><Bell size={18} /></div>
                <div className="space-y-1.5">
                  <h6 className="text-sm font-black text-brand-text-primary dark:text-brand-text-main leading-tight">{stats.latestAnnouncement.title || t('dashboard.examSchedulePublished')}</h6>
                  <p className="text-xs text-brand-text-secondary font-medium leading-relaxed">{stats.latestAnnouncement.body || t('dashboard.examScheduleNote')}</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
