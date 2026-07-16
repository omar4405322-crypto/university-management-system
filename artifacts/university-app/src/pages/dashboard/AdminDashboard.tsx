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

  const CHART_GREEN = '#9EBC48';
  const CHART_COLORS = isDark
    ? ['#9EBC48', '#B8D068', '#7A9A2E', '#D6BA34', '#3B82F6', '#10B981']
    : ['#7A9A2E', '#9EBC48', '#142632', '#D6BA34', '#3B82F6', '#10B981'];

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

  const kpiStats = [
    kpis.find(k => k.id === 'totalStudents'),
    kpis.find(k => k.id === 'totalDoctors'),
    kpis.find(k => k.id === 'totalColleges'),
    kpis.find(k => k.id === 'totalPayments')
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6 animate-page">
      {/* === Hero Header === */}
      <div className="relative overflow-hidden rounded-2xl bg-brand-navy-500 text-white min-h-[9rem] py-6 flex items-center transition-all duration-300">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between w-full px-8 gap-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl md:text-3xl font-black text-white mb-0 leading-tight">
              {t('dashboard.welcomeBack')}, {user?.email.split('@')[0]}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
              <span className="px-2 py-0.5 rounded bg-white/10 text-white font-bold text-[10px] uppercase tracking-wider">
                {user?.role.replace('_', ' ')}
              </span>
              <span>•</span>
              <span>
                {new Date().toLocaleDateString(undefined, {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                })}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button
              variant="outline"
              size="md"
              className="border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-widest transition-all"
              onClick={() => navigate('/notifications')}
            >
              <History size={14} /> {t('dashboard.activityLog')}
            </Button>
            <Button
              variant="outline"
              size="md"
              className="border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-widest transition-all"
              onClick={() => navigate('/settings')}
            >
              <Zap size={14} /> {t('dashboard.quickActions')}
            </Button>
          </div>
        </div>
      </div>

      {/* === KPI Grid === */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiStats.map((kpi, idx) => {
          const Icon = kpi.icon;

          let colorName = "green";
          if (kpi.id === 'totalStudents') colorName = "blue";
          else if (kpi.id === 'totalDoctors') colorName = "green";
          else if (kpi.id === 'totalColleges') colorName = "navy";
          else if (kpi.id === 'totalPayments') colorName = "yellow";

          let iconColor = "";
          let hoverText = "";

          if (colorName === 'blue') {
            iconColor = "text-blue-500";
            hoverText = "group-hover:text-blue-600";
          } else if (colorName === 'green') {
            iconColor = "text-brand-primary-500";
            hoverText = "group-hover:text-brand-primary-700";
          } else if (colorName === 'navy') {
            iconColor = "text-brand-navy-500 dark:text-slate-400";
            hoverText = "group-hover:text-brand-navy-700 dark:group-hover:text-slate-200";
          } else if (colorName === 'yellow') {
            iconColor = "text-brand-accent-amber";
            hoverText = "group-hover:text-amber-600";
          }

          return (
            <Card
              key={kpi.id || idx}
              variant="default"
              noPadding
              onClick={() => kpi.link && navigate(kpi.link)}
              className={`group rounded-2xl border border-brand-border/60 bg-brand-bg-card hover:shadow-md transition-all duration-300 ${kpi.link ? 'cursor-pointer' : ''}`}
            >
              <div className="p-6 flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs uppercase tracking-widest text-brand-text-muted font-bold">
                      {kpi.title}
                    </p>
                    {kpi.alert && (
                      <span className="px-2 py-0.5 bg-brand-accent-amber/15 text-brand-accent-amber text-[9px] font-black rounded-md uppercase tracking-wider animate-pulse">
                        {kpi.alertLabel}
                      </span>
                    )}
                  </div>
                  <h3 className="text-3xl font-black text-brand-text-primary dark:text-brand-text-main tabular-nums">
                    {kpi.value}
                  </h3>
                </div>
                <div className={`shrink-0 transition-colors duration-300 ease-in-out ${iconColor} ${hoverText}`}>
                  <Icon size={20} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* === Second Row: Subscription + Academic Overview === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 min-w-0">
          <Card variant="default" className="rounded-2xl border border-brand-border/60 shadow-sm p-6 flex flex-col justify-between h-full bg-brand-bg-card">
            <div className="space-y-5">
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-text-muted">{t('dashboard.subscription')}</h4>
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-black uppercase text-brand-text-primary dark:text-brand-text-main leading-none mb-0">
                    {t('dashboard.enterprise')}
                  </h3>
                  <span className="px-2 py-0.5 text-[9px] font-black text-brand-primary-700 bg-brand-primary-50 dark:text-brand-primary-300 dark:bg-brand-primary-950/30 rounded-md uppercase tracking-wider">
                    {t('common.active')}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-brand-text-secondary">{t('dashboard.quotaUsage')}</span>
                  <span className="font-black text-brand-text-primary dark:text-brand-text-main">
                    {totalStudentsCount.toLocaleString()} / {subscriptionLimit.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-primary-500 rounded-full transition-all duration-1000"
                    style={{ width: `${subscriptionUsagePercent}%` }}
                  />
                </div>
                <p className="text-[10px] font-bold text-brand-text-muted">
                  {subscriptionUsagePercent}% {t('dashboard.quotaUsage')} · {totalStudentsCount.toLocaleString()} {t('dashboard.totalStudents').toLowerCase()}
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              className="w-full font-black uppercase tracking-[0.15em] py-3 mt-6 shadow-sm animate-interactive"
              onClick={() => navigate('/settings')}
            >
              {t('dashboard.manageSubscription')}
            </Button>
          </Card>
        </div>

        <div className="lg:col-span-2 min-w-0">
          <Card variant="default" className="rounded-2xl border border-brand-border/60 shadow-sm p-6 bg-brand-bg-card">
            <div className="mb-4">
              <h3 className="text-lg font-black text-brand-text-primary dark:text-brand-text-main leading-none mb-1">
                {t('dashboard.academicOverview')}
              </h3>
              <p className="text-xs text-brand-text-secondary dark:text-brand-text-sub font-medium">
                {t('dashboard.growthTrend')}
              </p>
            </div>
            <div className="h-[300px] w-full overflow-hidden">
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
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11, fontWeight: 600 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11, fontWeight: 600 }} dx={-10} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="value" stroke={CHART_GREEN} strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* === Third Row: Charts === */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card variant="default" className="rounded-2xl border border-brand-border/60 shadow-sm p-6 bg-brand-bg-card min-w-0">
          <div className="mb-4">
            <h3 className="text-base font-black text-brand-text-primary dark:text-brand-text-main leading-none mb-1">
              {t('dashboard.collegeDistribution')}
            </h3>
            <p className="text-[11px] text-brand-text-secondary dark:text-brand-text-sub font-medium">
              {t('dashboard.enrollmentTrends')}
            </p>
          </div>
          <div className="h-72 w-full overflow-hidden">
            {!collegeDistributionData.length ? (
              <div className="flex h-full items-center justify-center text-sm font-bold text-brand-text-muted">{t('common.noData')}</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={collegeDistributionData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#E2E8F0'} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: isDark ? '#94A3B8' : '#64748B' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: isDark ? '#94A3B8' : '#64748B' }} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: isDark ? '#1E293B' : '#F8FAFC' }} />
                  <Bar dataKey="students" radius={[4, 4, 0, 0]} barSize={32}>
                    {collegeDistributionData.map((entry: any, index: number) => (
                      <Cell key={`college-${entry.name}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card variant="default" className="rounded-2xl border border-brand-border/60 shadow-sm p-6 bg-brand-bg-card min-w-0">
          <div className="mb-4">
            <h3 className="text-base font-black text-brand-text-primary dark:text-brand-text-main leading-none mb-1">
              {t('dashboard.financialOverview')}
            </h3>
            <p className="text-[11px] text-brand-text-secondary dark:text-brand-text-sub font-medium">
              {t('dashboard.paymentsStatus')}
            </p>
          </div>
          <div className="h-72 w-full overflow-hidden flex items-center">
            {!financeOverviewData.length ? (
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-brand-text-muted">{t('common.noData')}</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={financeOverviewData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value">
                    {financeOverviewData.map((entry: any, index: number) => (
                      <Cell key={`finance-${entry.name}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* === Bottom Row: Activity & Health === */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title={t('dashboard.recentActivity')} variant="default" noPadding className="border border-brand-border/60 overflow-hidden shadow-sm bg-brand-bg-card rounded-2xl">
          <div className="divide-y divide-brand-border/40">
            {!stats?.recentActivity?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                <CheckCircle2 size={32} className="text-brand-text-muted opacity-30" />
                <p className="text-sm font-bold text-brand-text-muted">{t('common.noData')}</p>
              </div>
            ) : (
              stats.recentActivity.slice(0, 4).map((activity: any) => (
                <div key={activity.id} className="p-5 flex items-center gap-4 hover:bg-brand-primary-50/10 dark:hover:bg-brand-navy-900/20 transition-all duration-150 group cursor-pointer border-b border-brand-border/40 last:border-0">
                  <div className="w-10 h-10 rounded-xl bg-brand-primary-50 dark:bg-brand-primary-950/20 text-brand-primary-600 dark:text-brand-primary-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <CheckCircle2 size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-brand-text-primary dark:text-brand-text-main truncate group-hover:text-brand-primary-600 dark:group-hover:text-brand-primary-400 transition-colors">
                      {activity.description || t('dashboard.newStudentRegistration')}
                    </p>
                    <p className="text-[10px] text-brand-text-muted mt-1 font-bold">
                      {activity.createdAt ? new Date(activity.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                    </p>
                  </div>
                  <ChevronRight size={16} className="rtl:-scale-x-100 text-brand-text-muted shrink-0 group-hover:translate-x-1 transition-transform" />
                </div>
              ))
            )}
          </div>
          <div className="px-5 py-4 border-t border-brand-border/40 bg-surface-subtle/50">
            <Button variant="ghost" size="sm" className="w-full font-black text-xs uppercase tracking-widest text-brand-primary-600 dark:text-brand-primary-400 hover:bg-brand-primary-500/10" onClick={() => navigate('/notifications')}>
              {t('dashboard.viewAllActivity')}
            </Button>
          </div>
        </Card>

        <Card title={t('dashboard.systemStatus')} variant="default" className="border border-brand-border/60 shadow-sm bg-brand-bg-card rounded-2xl">
          <div className="p-2 flex flex-col gap-4">
            <div className="p-4 rounded-2xl bg-brand-primary-50 dark:bg-brand-primary-950/10 border border-brand-primary-100/30 dark:border-brand-primary-900/20 flex items-center gap-3">
              <div className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-primary-600"></span>
              </div>
              <p className="text-xs font-black text-brand-primary-600 dark:text-brand-primary-400 uppercase tracking-widest">
                {t('dashboard.allSystemsOperational')}
              </p>
            </div>
            <p className="text-xs text-brand-text-secondary dark:text-brand-text-sub leading-relaxed">
              {t('dashboard.systemStatusNote') || 'All APIs, database clusters, and storage instances are fully functional. Detailed metrics are available in the logs.'}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
