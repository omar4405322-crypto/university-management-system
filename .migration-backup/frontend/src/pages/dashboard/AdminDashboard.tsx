// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, Cell, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import {
  Users, Building2, GraduationCap, TrendingUp, Clock,
  ArrowUpRight, ArrowDownRight, CheckCircle2, AlertCircle,
  Shield, UserCheck, ChevronRight, History, Zap, Bell, Calendar, Target
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import ChartTooltip from '../../components/ui/ChartTooltip';
import dashboardService from '../../services/dashboard.service';
import { CAMPUS_HERO_1 } from '../../constants/universityAssets';
import { logger } from '../../lib/logger';

export default function AdminDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user } = useAuth();

  const CHART_GREEN = '#8BB83C';
  const CHART_COLORS = isDark
    ? ['#8BB83C', '#a3d150', '#b4d16e', '#5e7d25', '#6f9330', '#94a3b8']
    : ['#8BB83C', '#22c55e', '#16a34a', '#15803d', '#6f9330', '#132231'];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  const getCollegeName = () => {
    if (user?.role === 'COLLEGE_ADMIN' && user?.managedCollegeId && stats?.collegeDistribution) {
      const college = stats.collegeDistribution.find((c: any) => c.name);
      if (college) return college.name;
    }
    return null;
  };

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await dashboardService.getAdminStats();
      if (result?.success) {
        setStats(result.data);
      } else {
        setError(result?.message || 'Failed to load dashboard data.');
      }
    } catch (err: any) {
      logger.error('Error fetching dashboard stats:', err);
      setError(err.message || 'Failed to load dashboard data. Please check your connection.');
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
      id: 'totalStudents',
      title: t('dashboard.totalStudents'),
      value: stats?.counts?.totalStudents?.toLocaleString() || '0',
      change: stats?.growth?.students ? `+${stats.growth.students}%` : null,
      trend: 'up',
      icon: Users,
      color: 'green',
      link: '/students',
    },
    {
      id: 'totalColleges',
      title: t('dashboard.activeColleges'),
      value: stats?.counts?.totalColleges?.toLocaleString() || '0',
      change: stats?.growth?.colleges ? `+${stats.growth.colleges}%` : null,
      trend: 'neutral',
      icon: Building2,
      color: 'navy',
      link: '/colleges',
    },
    {
      id: 'totalPayments',
      title: t('dashboard.totalPayments'),
      value: stats?.counts?.totalPayments?.toLocaleString() || '0',
      change: stats?.growth?.payments ? `+${stats.growth.payments}%` : null,
      trend: 'up',
      icon: Clock,
      color: 'yellow',
      alert: true,
      alertLabel: t('dashboard.needsReview'),
      tooltip: t('dashboard.paymentsBelowExpected'),
      link: '/finance',
    },
    {
      id: 'totalDoctors',
      title: t('dashboard.totalDoctors'),
      value: stats?.counts?.totalDoctors?.toLocaleString() || '0',
      change: stats?.growth?.doctors ? `+${stats.growth.doctors}%` : null,
      trend: 'up',
      icon: GraduationCap,
      color: 'green',
      link: '/doctors',
    },
    {
      id: 'totalSuperAdmins',
      title: t('dashboard.superAdmin'),
      value: stats?.counts?.totalSuperAdmins?.toLocaleString() || '0',
      change: null,
      trend: 'neutral',
      icon: Shield,
      color: 'navy',
      link: '/admins',
    },
    {
      id: 'totalAdmins',
      title: t('dashboard.admin'),
      value: stats?.counts?.totalAdmins?.toLocaleString() || '0',
      change: null,
      trend: 'neutral',
      icon: UserCheck,
      color: 'navy',
      link: '/admins',
    },
    {
      id: 'totalAtRiskStudents',
      title: t('dashboard.atRiskStudents'),
      value: stats?.counts?.totalAtRiskStudents?.toLocaleString() || '0',
      change:
        stats?.counts?.totalAtRiskStudents > 0
          ? t('dashboard.requiresAttention')
          : t('dashboard.allClear'),
      trend: stats?.counts?.totalAtRiskStudents > 0 ? 'down' : 'up',
      icon: AlertCircle,
      color: stats?.counts?.totalAtRiskStudents > 0 ? 'yellow' : 'green',
      alert: stats?.counts?.totalAtRiskStudents > 0,
      alertLabel: t('dashboard.highRisk'),
      link: '/students?risk=high',
    },
  ];

  const academicChartData =
    stats?.growthData?.length > 0
      ? stats.growthData
      : (stats?.enrollmentData || []).map((row: any) => ({
          name: String(row.name),
          value: row.students ?? row.value ?? 0,
        }));

  const collegeDistributionData = stats?.collegeDistribution || [];
  const financeOverviewData = stats?.financeOverview || [];

  const totalStudentsCount = stats?.counts?.totalStudents ?? 0;
  const subscriptionLimit = Math.max(10000, totalStudentsCount + 2000);
  const subscriptionUsagePercent = subscriptionLimit
    ? Math.min(100, Math.round((totalStudentsCount / subscriptionLimit) * 100))
    : 0;

  return (
    <div className="section-gap animate-in fade-in duration-700">
      {/* === Hero Header === */}
      <div className="relative overflow-hidden rounded-[2rem] shadow-elevated" style={{ minHeight: '180px' }}>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${CAMPUS_HERO_1}), linear-gradient(135deg, var(--color-brand-navy-500) 0%, var(--color-brand-teal) 100%)` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/50 to-black/25 rtl:bg-gradient-to-l" />
        <div className="relative z-10 flex flex-col gap-6 p-6 md:flex-row md:items-end md:justify-between md:p-8">
          <div className="space-y-2 max-w-2xl">
            <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
              {t('dashboard.welcomeBack')}, {user?.email.split('@')[0]}
            </h1>
            {user?.role === 'COLLEGE_ADMIN' && getCollegeName() && (
              <div className="flex items-center gap-2 mt-2">
                <Building2 size={16} className="text-brand-brand-green" />
                <span className="text-sm font-bold text-white/90 bg-white/10 px-3 py-1 rounded-full">
                  {getCollegeName()}
                </span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-white/85">
              <Shield size={16} className="text-brand-brand-green shrink-0" />
              <span>{user?.role.replace('_', ' ')}</span>
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
              className="shadow-overlay shadow-brand-brand-green-dark/30 font-bold text-xs uppercase tracking-widest"
              onClick={() => navigate('/settings')}
            >
              <Zap size={16} /> {t('dashboard.quickActions')}
            </Button>
          </div>
        </div>
      </div>

      {/* === KPI Grid === */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-5 xl:gap-6 2xl:gap-8">
        {kpis.map((kpi, idx) => (
          <Card
            key={kpi.id || idx}
            variant="default"
            noPadding
            onClick={() => kpi.link && navigate(kpi.link)}
            className={`group hover:-translate-y-0.5 transition-all duration-300 overflow-hidden relative ${kpi.link ? 'cursor-pointer hover:shadow-elevated' : ''}`}
          >
            <div className="p-5 space-y-3">
              {kpi.alert && (
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-brand-accent-yellow text-brand-navy-500 text-[8px] font-black rounded-full uppercase tracking-tighter animate-pulse">
                  {kpi.alertLabel}
                </div>
              )}
              <div className="flex justify-between items-start">
                <div
                  className={`p-2.5 rounded-2xl transition-colors duration-300 ${
                    kpi.color === 'green'
                      ? 'bg-brand-primary-50 text-brand-brand-green-dark group-hover:bg-[var(--kpi-icon-hover)] group-hover:text-white'
                      : kpi.color === 'navy'
                        ? 'bg-brand-navy-50 text-brand-navy-500 group-hover:bg-[var(--kpi-icon-hover)] group-hover:text-white'
                        : 'bg-brand-accent-yellow/10 text-brand-accent-yellow group-hover:bg-[var(--kpi-icon-hover)] group-hover:text-white'
                  }`}
                >
                  <kpi.icon size={18} />
                </div>
                {kpi.trend === 'up' && <ArrowUpRight size={14} className="text-brand-brand-green-dark" />}
                {kpi.trend === 'down' && <ArrowDownRight size={14} className="text-error" />}
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-brand-text-muted">
                  {kpi.title}
                </p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-black tracking-tight text-brand-text-primary dark:text-brand-text-main">
                    {kpi.value}
                  </h3>
                  {kpi.change && (
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-[10px] font-bold ${
                          kpi.trend === 'up' ? 'text-brand-brand-green-dark' : kpi.trend === 'down' ? 'text-error' : 'text-brand-text-muted'
                        }`}
                      >
                        {kpi.change}
                      </span>
                      {kpi.trend === 'up' && <ArrowUpRight size={12} className="text-brand-brand-green-dark" />}
                      {kpi.trend === 'down' && <ArrowDownRight size={12} className="text-error" />}
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
            <Card variant="elevated" title={t('dashboard.collegeDistribution')} subtitle={t('dashboard.enrollmentTrends')}>
              <div className="h-80 w-full overflow-hidden mt-6">
                {!collegeDistributionData.length ? (
                  <div className="flex h-full items-center justify-center text-sm font-bold text-brand-text-muted">{t('common.noData')}</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={collegeDistributionData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#E2E8F0'} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: isDark ? '#94A3B8' : '#64748B' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: isDark ? '#94A3B8' : '#64748B' }} />
                                            <Tooltip content={<ChartTooltip active={false} payload={[]} label={''} />} cursor={{ fill: isDark ? '#1E293B' : '#F8FAFC' }} />
                      <Bar dataKey="students" radius={[4, 4, 0, 0]} barSize={40}>
                        {collegeDistributionData.map((entry: any, index: number) => (
                          <Cell key={`college-${entry.name}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card variant="elevated" title={t('dashboard.financialOverview')} subtitle={t('dashboard.paymentsStatus')}>
              <div className="h-80 w-full overflow-hidden mt-6 flex items-center">
                {!financeOverviewData.length ? (
                  <div className="flex h-full w-full items-center justify-center text-sm font-bold text-brand-text-muted">{t('common.noData')}</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={financeOverviewData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={6} dataKey="value">
                        {financeOverviewData.map((entry: any, index: number) => (
                          <Cell key={`finance-${entry.name}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                                            <Tooltip content={<ChartTooltip active={false} payload={[]} label={''} />} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

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
                      <div className="w-11 h-11 rounded-xl bg-brand-primary-50 dark:bg-brand-primary-900/10 text-brand-brand-green-dark flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <CheckCircle2 size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-brand-text-primary dark:text-brand-text-main truncate group-hover:text-brand-brand-green-dark transition-colors">
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
                  <div className="w-2.5 h-2.5 rounded-full bg-brand-brand-green-dark animate-ping shrink-0" />
                  <p className="text-xs font-black text-brand-brand-green-dark uppercase tracking-widest">{t('dashboard.allSystemsOperational')}</p>
                </div>
                <p className="text-xs text-brand-text-muted text-center font-medium">
                  {t('dashboard.systemStatusNote') || 'Detailed metrics available to system administrators.'}
                </p>
              </div>
            </Card>
          </div>
        </div>

        <div className="lg:col-span-4 xl:col-span-3 2xl:col-span-3 section-gap">
          <Card variant="elevated" noPadding className="rounded-[2rem]">
            <div className="p-8 space-y-8">
              <div className="space-y-1">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-text-muted">{t('dashboard.subscription')}</h4>
                <h3 className="text-3xl font-black tracking-tightest uppercase italic text-brand-text-primary dark:text-brand-text-main">{t('dashboard.enterprise')}</h3>
              </div>
              <div className="p-6 rounded-2xl bg-surface-subtle border border-brand-border space-y-5">
                <div className="flex justify-between items-center gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Target size={16} className="text-brand-brand-green-dark shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-brand-text-secondary">{t('dashboard.quotaUsage')}</span>
                  </div>
                  <span className="text-xs font-black text-brand-text-primary dark:text-brand-text-main whitespace-nowrap">
                    {totalStudentsCount.toLocaleString()} / {subscriptionLimit.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-brand-green-dark rounded-full shadow-lg transition-all duration-500" style={{ width: `${subscriptionUsagePercent}%` }} />
                </div>
                <p className="text-[10px] font-bold text-brand-text-muted">
                  {subscriptionUsagePercent}% {t('dashboard.quotaUsage')} · {totalStudentsCount.toLocaleString()} {t('dashboard.totalStudents').toLowerCase()}
                </p>
              </div>
              <Button variant="primary" className="w-full font-black uppercase tracking-[0.2em] py-5 shadow-overlay shadow-brand-brand-green-dark/20" onClick={() => navigate('/settings')}>
                {t('dashboard.manageSubscription')}
              </Button>
            </div>
          </Card>

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
                      <div className="flex flex-col items-center justify-center w-14 h-16 rounded-xl bg-surface-subtle border border-brand-border group-hover:bg-brand-brand-green-dark group-hover:border-brand-brand-green-dark transition-all duration-300">
                        <span className="text-sm font-black text-brand-text-primary dark:text-brand-text-main leading-none group-hover:text-white transition-colors">{d.getDate()}</span>
                        <span className="text-[9px] font-black uppercase text-brand-text-secondary group-hover:text-white/80 transition-colors">{d.toLocaleString('default', { month: 'short' })}</span>
                      </div>
                      <div className="flex-1 pt-1">
                        <h5 className="text-sm font-black text-brand-text-primary dark:text-brand-text-main leading-tight group-hover:text-brand-brand-green-dark transition-colors">{event.title}</h5>
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
