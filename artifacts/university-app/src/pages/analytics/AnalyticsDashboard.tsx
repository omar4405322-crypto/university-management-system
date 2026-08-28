// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import {
  TrendingUp,
  Users,
  DollarSign,
  BookOpen,
  Building2,
  PieChart as PieChartIcon,
  RotateCw,
  FileSpreadsheet,
  Calendar,
  GraduationCap,
  ClipboardCheck,
  Award,
  Layers,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import analyticsService from '../../services/analytics.service';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/button';
import Badge from '../../components/ui/Badge';
import { PageHeader } from '../../components/ui/PageHeader';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import ChartTooltip from '../../components/ui/ChartTooltip';
import { SkeletonKPIGrid } from '../../components/ui/skeleton';
import { logger } from '../../lib/logger';
import { downloadCsv } from '../../utils/exportCsv';

export function AnalyticsDashboard() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState<'ACADEMIC' | 'ATTENDANCE' | 'DEPARTMENTS'>('ACADEMIC');

  const chartColors = {
    grid: isDark ? '#334155' : '#F1F5F9',
    tick: isDark ? '#94A3B8' : '#64748B',
    pie: ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'],
  };

  const fetchAnalytics = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const result = await analyticsService.getGeneralAnalytics({});
      if (result.success) {
        setData(result.data);
      }
    } catch (error: any) {
      logger.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleExportCsv = () => {
    if (!data) return;

    const sections = [];

    // 1. Summary
    const summaryHeaders = ['المؤشر (Metric)', 'القيمة (Value)'];
    const summaryRows = [
      ['إجمالي الطلاب المقيدين (Total Students)', data.collegeDistribution?.reduce((s, c) => s + c.students, 0) || 0],
      ['إيرادات الرسوم المحصلة (Collected Revenue)', data.finance?.find((f) => f.status === 'COMPLETED' || f.status === 'PAID')?._sum?.amount || 0],
      ['الامتحانات المجدولة (Scheduled Exams)', data.examStats?.reduce((s, e) => s + e._count._all, 0) || 0],
    ];
    sections.push(['=== الملخص العام (Summary) ===', summaryHeaders.join(','), ...summaryRows.map((r) => r.join(','))].join('\n'));

    // 2. Colleges
    const collegeHeaders = ['الكلية (College)', 'عدد الطلاب (Students)'];
    const collegeRows = (data.collegeDistribution || []).map((c) => `"${c.name}",${c.students}`);
    sections.push(['\n=== توزيع الكليات (Colleges) ===', collegeHeaders.join(','), ...collegeRows].join('\n'));

    // 3. Departments
    const deptHeaders = ['القسم (Department)', 'الطلاب (Students)', 'الأساتذة (Faculty)', 'المقررات (Courses)'];
    const deptRows = (data.departmentStats || []).map((d) => `"${d.name}",${d._count.students},${d._count.doctors},${d._count.courses}`);
    sections.push(['\n=== إحصائيات الأقسام (Departments) ===', deptHeaders.join(','), ...deptRows].join('\n'));

    const csvContent = sections.join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `university-analytics-report-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Processed metrics
  const totalStudents = useMemo(() => {
    return data?.collegeDistribution?.reduce((sum, c) => sum + c.students, 0) || 0;
  }, [data]);

  const totalRevenue = useMemo(() => {
    const completed = data?.finance?.find((f) => f.status === 'COMPLETED' || f.status === 'PAID');
    return completed?._sum?.amount || 0;
  }, [data]);

  const totalExams = useMemo(() => {
    return data?.examStats?.reduce((sum, e) => sum + e._count._all, 0) || 0;
  }, [data]);

  const avgAttendance = useMemo(() => {
    if (!data?.attendanceOverview || data.attendanceOverview.length === 0) return 0;
    const present = data.attendanceOverview.find((a) => a.status === 'PRESENT')?._count?._all || 0;
    const total = data.attendanceOverview.reduce((sum, a) => sum + a._count._all, 0);
    return total > 0 ? Math.round((present / total) * 100) : 0;
  }, [data]);

  // Chart datasets
  const yearDistributionData = useMemo(() => {
    if (!data?.yearDistribution) return [];
    return data.yearDistribution.map((item) => ({
      name: isRTL ? `الفرقة ${item.year}` : `Year ${item.year}`,
      students: item._count?._all || 0,
    }));
  }, [data, isRTL]);

  const attendancePieData = useMemo(() => {
    if (!data?.attendanceOverview) return [];
    const mapLabels = {
      PRESENT: isRTL ? 'حاضر' : 'Present',
      ABSENT: isRTL ? 'غائب' : 'Absent',
      LATE: isRTL ? 'متأخر' : 'Late',
      EXCUSED: isRTL ? 'بعذر' : 'Excused',
    };
    return data.attendanceOverview.map((item) => ({
      name: mapLabels[item.status] || item.status,
      value: item._count?._all || 0,
    }));
  }, [data, isRTL]);

  const examTypeData = useMemo(() => {
    if (!data?.examStats) return [];
    const mapLabels = {
      MIDTERM: isRTL ? 'منتصف الفصل' : 'Midterm',
      FINAL: isRTL ? 'نهائي' : 'Final Exam',
      QUIZ: isRTL ? 'اختبار قصير' : 'Quiz',
    };
    return data.examStats.map((item) => ({
      name: mapLabels[item.type] || item.type,
      count: item._count?._all || 0,
    }));
  }, [data, isRTL]);

  if (loading && !data) {
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        <SkeletonKPIGrid />
        <div className="h-64 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* 1. SLIM EXECUTIVE HEADER                                                  */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            {t('analytics.title', 'Analytics & Reports')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('analytics.subtitle', 'Visual reports and institutional performance data')}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing}
            className="h-8.5 px-3 rounded-lg border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 gap-1.5 cursor-pointer shadow-2xs"
          >
            <RotateCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>{t('common.refresh', 'Refresh')}</span>
          </Button>

          <Button
            size="sm"
            onClick={handleExportCsv}
            className="h-8.5 px-3.5 bg-brand-primary-600 hover:bg-brand-primary-700 text-white rounded-lg text-xs font-bold gap-1.5 shadow-xs cursor-pointer"
          >
            <FileSpreadsheet size={14} />
            <span>{t('analytics.exportReports', 'Export Reports')}</span>
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. EXECUTIVE OVERVIEW METRIC BADGES                                       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Students */}
        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-bold text-slate-600 dark:text-slate-300">
              {t('analytics.totalEnrollment', 'Total Students')}
            </span>
            <Users size={14} className="text-brand-primary-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
            {totalStudents.toLocaleString()}
          </div>
        </div>

        {/* Collected Revenue */}
        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-bold text-emerald-700 dark:text-emerald-400">
              {t('analytics.revenueMtd', 'Revenue (MTD)')}
            </span>
            <DollarSign size={14} className="text-emerald-500" />
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {isRTL ? 'ج.م ' : 'EGP '}
            {Number(totalRevenue).toLocaleString()}
          </div>
        </div>

        {/* Scheduled Exams */}
        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-bold text-blue-700 dark:text-blue-400">
              {t('analytics.scheduledExams', 'Scheduled Exams')}
            </span>
            <BookOpen size={14} className="text-blue-500" />
          </div>
          <div className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">
            {totalExams}
          </div>
        </div>

        {/* Average Attendance */}
        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-bold text-purple-700 dark:text-purple-400">
              {t('analytics.avgAttendance', 'Avg Attendance')}
            </span>
            <TrendingUp size={14} className="text-purple-500" />
          </div>
          <div className="text-xl font-black text-purple-600 dark:text-purple-400 font-mono">
            {avgAttendance}%
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SEGMENTED TAB SWITCHER                                                 */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-fit">
        <button
          onClick={() => setActiveTab('ACADEMIC')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'ACADEMIC'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <GraduationCap size={14} />
          <span>{t('analytics.academicTab', 'analytics.academicTab')}</span>
        </button>

        <button
          onClick={() => setActiveTab('ATTENDANCE')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'ATTENDANCE'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <ClipboardCheck size={14} />
          <span>{t('analytics.attendanceExamsTab', 'analytics.attendanceExamsTab')}</span>
        </button>

        <button
          onClick={() => setActiveTab('DEPARTMENTS')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'DEPARTMENTS'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Building2 size={14} />
          <span>{t('analytics.departmentsTab', 'analytics.departmentsTab')}</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 4. TAB 1: ACADEMIC & ENROLLMENT ANALYTICS                                 */}
      {/* ========================================================================= */}
      {activeTab === 'ACADEMIC' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {/* Enrollment Trends Over Time */}
          <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('analytics.enrollmentTrends', 'Enrollment Trends')}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {t('analytics.enrollmentTrendsDesc', 'New student registrations per month')}
                </p>
              </div>
              <Badge variant="primary" className="text-[10px] font-bold">12 شهراً</Badge>
            </div>

            <div className="h-[250px] w-full flex items-center justify-center">
              {(!data?.enrollmentTrends || data.enrollmentTrends.length === 0) ? (
                <p className="text-xs text-slate-400">{t('analytics.noDataAvailable', 'No data available')}</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.enrollmentTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorEnroll" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: chartColors.tick }}
                      dy={5}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartColors.tick }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#10B981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorEnroll)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Academic Year Distribution */}
          <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('analytics.yearDistribution', 'analytics.yearDistribution')}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {t('analytics.yearDistributionDesc', 'analytics.yearDistributionDesc')}
                </p>
              </div>
              <Badge variant="info" className="text-[10px] font-bold">الفرق 1-4</Badge>
            </div>

            <div className="h-[250px] w-full flex items-center justify-center">
              {yearDistributionData.length === 0 ? (
                <p className="text-xs text-slate-400">{t('analytics.noDataAvailable', 'No data available')}</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: chartColors.tick }}
                      dy={5}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartColors.tick }} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                    <Bar dataKey="students" fill="#3B82F6" radius={[8, 8, 0, 0]} barSize={36}>
                      {yearDistributionData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors.pie[index % chartColors.pie.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TAB 2: ATTENDANCE & ASSESSMENTS                                        */}
      {/* ========================================================================= */}
      {activeTab === 'ATTENDANCE' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {/* Attendance Breakdown */}
          <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('analytics.attendanceSummary', 'analytics.attendanceSummary')}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {isRTL ? 'توزيع نسب الحضور والغياب والتأخير' : 'Monthly attendance breakdown'}
                </p>
              </div>
            </div>

            <div className="h-[250px] w-full flex items-center justify-center">
              {attendancePieData.length === 0 ? (
                <div className="text-center text-slate-400">
                  <ClipboardCheck size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-xs font-semibold">{t('analytics.noDataAvailable', 'No data available')}</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={attendancePieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {attendancePieData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors.pie[index % chartColors.pie.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend verticalAlign="bottom" height={32} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Assessment & Exam Types */}
          <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('analytics.examTypesSummary', 'analytics.examTypesSummary')}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {isRTL ? 'إجمالي الاختبارات الفصلية والنهائية والقصيرة' : 'Midterm, Final, and Quizzes breakdown'}
                </p>
              </div>
            </div>

            <div className="h-[250px] w-full flex items-center justify-center">
              {examTypeData.length === 0 ? (
                <div className="text-center text-slate-400">
                  <Award size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-xs font-semibold">{t('analytics.noDataAvailable', 'No data available')}</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={examTypeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartColors.tick }} dy={5} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartColors.tick }} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                    <Bar dataKey="count" fill="#8B5CF6" radius={[8, 8, 0, 0]} barSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. TAB 3: COLLEGES & DEPARTMENTS                                          */}
      {/* ========================================================================= */}
      {activeTab === 'DEPARTMENTS' && (
        <div className="space-y-3.5">
          {/* College Distribution Chart */}
          <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('analytics.collegeDistribution', 'College Distribution')}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {t('analytics.collegeDistributionDesc', 'Student population across colleges')}
                </p>
              </div>
            </div>

            <div className="h-[220px] w-full flex items-center justify-center">
              {(!data?.collegeDistribution || data.collegeDistribution.length === 0) ? (
                <p className="text-xs text-slate-400">{t('analytics.noDataAvailable', 'No data available')}</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.collegeDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: chartColors.tick }}
                      dy={5}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartColors.tick }} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                    <Bar dataKey="students" fill="#10B981" radius={[8, 8, 0, 0]} barSize={40}>
                      {data.collegeDistribution.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors.pie[index % chartColors.pie.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Department Breakdown Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data?.departmentStats?.map((dept, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-2xs flex flex-col justify-between"
              >
                <div className="flex items-start gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-primary-50 dark:bg-brand-primary-950/50 text-brand-primary-600 dark:text-brand-primary-400 flex items-center justify-center shrink-0 border border-brand-primary-200/40">
                    <Building2 size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                      {dept.name}
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      {t('analytics.coursesCount', { count: dept._count.courses, defaultValue: `${dept._count.courses} مقررات` })}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 text-center">
                  <div>
                    <span className="block text-[10px] text-slate-400">
                      {isRTL ? 'الطلاب' : 'Students'}
                    </span>
                    <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                      {dept._count.students}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">
                      {isRTL ? 'الأساتذة' : 'Faculty'}
                    </span>
                    <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                      {dept._count.doctors}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">
                      {isRTL ? 'المقررات' : 'Courses'}
                    </span>
                    <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                      {dept._count.courses}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AnalyticsDashboard;
