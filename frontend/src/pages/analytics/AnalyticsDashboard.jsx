// FIXED: Phase 4 — Arabic i18n for stats, charts, and page header
import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, Users, DollarSign, BookOpen, Download, Filter, 
  Calendar, Building2, PieChart as PieChartIcon
} from 'lucide-react';
import analyticsService from '../../services/analytics.service';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { PageHeader } from '../../components/ui/PageHeader';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { SkeletonKPIGrid } from '../../components/ui/Skeleton';

const COLORS = ['#84cc16', '#22c55e', '#16a34a', '#15803d', '#8BB83C', '#132231'];
const BAR_GREEN = '#84cc16';

const AnalyticsDashboard = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({
    departmentId: '',
    startDate: '',
    endDate: ''
  });

  const tooltipStyle = { 
    contentStyle: { 
      borderRadius: '16px', 
      border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`, 
      backgroundColor: isDark ? '#1E293B' : '#FFFFFF', 
      color: isDark ? '#f8fafc' : '#132231', 
      boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.15)', 
      padding: '14px 18px', 
      fontSize: '13px', 
      fontWeight: 700, 
    }, 
    cursor: { fill: isDark ? '#1E293B' : '#F8FAFC' }, 
  }; 

  useEffect(() => {
    fetchAnalytics();
  }, [filters]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const result = await analyticsService.getGeneralAnalytics(filters);
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    if (!data) return;

    const sections = [];

    // 1. Summary Statistics
    const summaryHeader = 'Metric,Value';
    const summaryRows = [
      `Total Students,${data.counts?.totalStudents || 0}`,
      `Total Doctors,${data.counts?.totalDoctors || 0}`,
      `Total Courses,${data.counts?.totalCourses || 0}`,
      `Total Colleges,${data.counts?.totalColleges || 0}`
    ];
    sections.push(['Summary Statistics', summaryHeader, ...summaryRows].join('\n'));

    // 2. Enrollment Trends
    const trendHeader = 'Period,Enrollment Count';
    const trendRows = (data.enrollmentTrends || []).map(t => `"${t.name}",${t.count}`);
    sections.push(['Enrollment Trends', trendHeader, ...trendRows].join('\n'));

    // 3. College Distribution
    const collegeHeader = 'College Name,Student Count';
    const collegeRows = (data.collegeDistribution || []).map(c => `"${c.name}",${c.students}`);
    sections.push(['College Distribution', collegeHeader, ...collegeRows].join('\n'));

    // 4. Financial Overview
    const financeHeader = 'Status,Total Amount,Transaction Count';
    const financeRows = (data.finance || []).map(f => `${f.status},${f._sum.amount || 0},${f._count._all}`);
    sections.push(['Financial Overview', financeHeader, ...financeRows].join('\n'));

    const csvContent = sections.join('\n\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const date = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `analytics-report-${date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading && !data) {
    return (
      <div className="space-y-8 animate-page">
        <SkeletonKPIGrid />
        <SkeletonKPIGrid />
      </div>
    );
  }

  const financeData = data?.finance?.map(item => ({
    name: item.status,
    value: item._sum.amount || 0,
    count: item._count._all
  })) || [];

  const examData = data?.examStats?.map(item => ({
    name: item.type,
    count: item._count._all
  })) || [];

  return (
    <div className="space-y-8 animate-page">
      <PageHeader 
        title={t('nav.analytics')}
        subtitle={t('analytics.subtitle')}
        action={{
          label: t('analytics.exportReports'),
          onClick: handleExportCsv
        }}
      />

      {/* === High Level Stats === */}
      <div className="grid-dense">
        <Card variant="elevated" noPadding className="group overflow-hidden">
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div className="p-3 rounded-xl bg-brand-primary-50 text-brand-primary-500 group-hover:bg-brand-primary-500 group-hover:text-white transition-all duration-300">
                <Users size={24} />
              </div>
              <Badge variant="success" className="font-black">{t('analytics.growth')}</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-caption">{t('analytics.totalEnrollment')}</p>
              <h3 className="heading-display !text-3xl md:!text-4xl m-0 tracking-tightest">
                {data?.collegeDistribution?.reduce((sum, c) => sum + c.students, 0) || 0}
              </h3>
            </div>
          </div>
        </Card>

        <Card variant="elevated" noPadding className="group overflow-hidden">
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div className="p-3 rounded-xl bg-brand-navy-50 text-brand-navy-500 group-hover:bg-brand-navy-500 group-hover:text-white transition-all duration-300">
                <DollarSign size={24} />
              </div>
              <Badge variant="primary" className="font-black">{t('analytics.stable')}</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-caption">{t('analytics.revenueMtd')}</p>
              <h3 className="heading-display !text-3xl md:!text-4xl m-0 tracking-tightest">
                ${data?.finance?.find(f => f.status === 'COMPLETED')?._sum.amount?.toLocaleString() || 0}
              </h3>
            </div>
          </div>
        </Card>

        <Card variant="elevated" noPadding className="group overflow-hidden">
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div className="p-3 rounded-xl bg-brand-accent-yellow/10 text-brand-accent-yellow group-hover:bg-brand-accent-yellow group-hover:text-white transition-all duration-300">
                <BookOpen size={24} />
              </div>
              <Badge variant="warning" className="font-black">{t('analytics.active')}</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-caption">{t('analytics.scheduledExams')}</p>
              <h3 className="heading-display !text-3xl md:!text-4xl m-0 tracking-tightest">
                {data?.examStats?.reduce((sum, e) => sum + e._count._all, 0) || 0}
              </h3>
            </div>
          </div>
        </Card>

        <Card variant="elevated" noPadding className="group overflow-hidden">
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div className="p-3 rounded-xl bg-rose-50 text-error group-hover:bg-error group-hover:text-white transition-all duration-300">
                <TrendingUp size={24} />
              </div>
              <Badge variant="danger" className="font-black">{t('analytics.decline')}</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-caption">{t('analytics.avgAttendance')}</p>
              <h3 className="heading-display !text-3xl md:!text-4xl m-0 tracking-tightest">
                {data?.attendanceOverview?.find(a => a.status === 'PRESENT')?._count._all ? 
                  Math.round((data.attendanceOverview.find(a => a.status === 'PRESENT')._count._all / 
                  data.attendanceOverview.reduce((sum, a) => sum + a._count._all, 0)) * 100) : 0}%
              </h3>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-5 xl:gap-6">
        {/* Enrollment Trends */}
        <Card variant="elevated" title={t('analytics.enrollmentTrends')} subtitle={t('analytics.enrollmentTrendsDesc')}>
          <div className="h-80 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.enrollmentTrends || []}>
                <defs>
                  <linearGradient id="colorEnroll" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8BB83C" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8BB83C" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#E2E8F0'} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: isDark ? '#64748B' : '#94A3B8'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: isDark ? '#64748B' : '#94A3B8'}} />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke="#8BB83C" strokeWidth={4} fillOpacity={1} fill="url(#colorEnroll)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* College Distribution */}
        <Card variant="elevated" title={t('analytics.collegeDistribution')} subtitle={t('analytics.collegeDistributionDesc')}>
          <div className="h-80 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.collegeDistribution || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#E2E8F0'} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: isDark ? '#64748B' : '#94A3B8'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: isDark ? '#64748B' : '#94A3B8'}} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="students" fill={BAR_GREEN} radius={[12, 12, 0, 0]} barSize={40}>
                  {(data?.collegeDistribution || []).map((entry, index) => (
                    <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Financial Status */}
        <Card variant="elevated" title={t('analytics.financialOverview')} subtitle={t('analytics.financialOverviewDesc')}>
          <div className="h-80 w-full pt-4 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={financeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {financeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Department Stats Table */}
        <Card variant="elevated" title={t('analytics.departmentalEfficiency')} subtitle={t('analytics.departmentalEfficiencyDesc')}>
          <div className="space-y-4 pt-4">
            {data?.departmentStats?.slice(0, 5).map((dept, idx) => (
              <div key={idx} className="flex items-center justify-between p-5 rounded-2xl bg-surface-subtle dark:bg-slate-800/50 border border-brand-border dark:border-slate-800 group hover:border-brand-primary-500/30 transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-700 flex items-center justify-center text-brand-navy-500 dark:text-brand-text-main group-hover:bg-brand-primary-500 group-hover:text-white transition-all duration-500 shadow-sm">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-brand-text-primary dark:text-brand-text-main">{dept.name}</h4>
                    <p className="label-stat">{t('analytics.coursesCount', { count: dept._count.courses })}</p>
                  </div>
                </div>
                <div className="text-end">
                  <p className="text-lg font-black text-brand-text-primary dark:text-brand-text-main tracking-tight">{dept._count.students}</p>
                  <p className="label-stat">{t('analytics.studentsLabel')}</p>
                </div>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="w-full font-black text-xs uppercase tracking-widest py-4">
              {t('analytics.viewAllDepartments')}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
