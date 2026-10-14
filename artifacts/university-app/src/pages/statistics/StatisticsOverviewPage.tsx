import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  UserCheck,
  GraduationCap,
  Award,
  Layers,
  Building2,
  Calendar,
  AlertCircle,
  RotateCw,
  TrendingUp,
} from 'lucide-react';
import statisticsService, { StatisticsOverviewData } from '../../services/statistics.service';
import { StatCard, Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import Button from '../../components/ui/button';
import { useLanguage } from '../../context/LanguageContext';

export default function StatisticsOverviewPage() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StatisticsOverviewData | null>(null);

  const fetchOverview = () => {
    setLoading(true);
    setError(null);
    statisticsService
      .getOverview()
      .then((res) => {
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.message || 'Failed to load statistics overview');
        }
      })
      .catch((err) => {
        console.error('Error fetching statistics overview:', err);
        setError(err.response?.data?.message || err.message || 'Failed to load statistics');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-500">
            {isRTL ? 'جاري تحميل الإحصائيات الأكاديمية...' : 'Loading academic statistics overview...'}
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Card className="border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20">
          <CardContent className="pt-6 flex flex-col items-center text-center gap-3">
            <AlertCircle className="w-12 h-12 text-rose-500" />
            <h3 className="text-lg font-bold text-rose-800 dark:text-rose-200">
              {isRTL ? 'تعذر تحميل البيانات' : 'Failed to load statistics'}
            </h3>
            <p className="text-sm text-rose-600 dark:text-rose-300">{error || 'Unknown error'}</p>
            <Button onClick={fetchOverview} variant="outline" size="sm" className="mt-2">
              <RotateCw className="w-4 h-4 mr-1.5" />
              {isRTL ? 'إعادة المحاولة' : 'Retry'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activePercent =
    data.totalStudents > 0
      ? Math.round((data.activeStudents / data.totalStudents) * 100)
      : 0;

  const scopeLabel =
    data.scope === 'UNIVERSITY'
      ? (isRTL ? 'نطاق الجامعة العام' : 'University Wide')
      : data.scope === 'COLLEGE'
      ? (isRTL ? 'نطاق الكلية' : 'College Scoped')
      : (isRTL ? 'نطاق القسم' : 'Department Scoped');

  const standingList = Array.isArray(data.standingDistribution)
    ? data.standingDistribution
    : Object.entries(data.standingDistribution || {}).map(([standing, count]) => {
        const c = Number(count) || 0;
        const percentage = data.totalStudents > 0 ? Math.round((c / data.totalStudents) * 100) : 0;
        return { standing, count: c, percentage };
      });

  const yearsList = (data.byYear || (data as any).byAcademicYear || []) as Array<{
    year: number;
    totalStudents: number;
    activeStudents: number;
  }>;

  const collegesList = (data.byCollege || []) as any[];
  const departmentsList = (data.byDepartment || []) as any[];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── Page Header Banner ── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                {t('statistics.overviewTitle', isRTL ? 'نظرة عامة على الإحصائيات الأكاديمية' : 'Academic Statistics Overview')}
              </h1>
              <Badge className="bg-brand-primary-500/20 text-brand-primary-300 border-brand-primary-400/30 text-xs font-bold">
                {scopeLabel}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              {t(
                'statistics.overviewSubtitle',
                isRTL
                  ? 'مؤشرات وبيانات رسمية دقيقة حول مجتمع الطلاب والأداء الأكاديمي والأقسام'
                  : 'Official verified metrics across student body, academic standing, and departments'
              )}
            </p>
          </div>

          <Button
            onClick={fetchOverview}
            variant="outline"
            size="sm"
            className="border-white/20 text-white hover:bg-white/10 shrink-0"
          >
            <RotateCw size={14} className="mr-1.5" />
            <span>{isRTL ? 'تحديث' : 'Refresh'}</span>
          </Button>
        </div>
      </div>

      {/* ── 4-Color StatCard KPI Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          colorIndex={0}
          title={t('statistics.totalStudents', isRTL ? 'إجمالي الطلاب' : 'Total Students')}
          value={data.totalStudents}
          subtitle={isRTL ? 'مسجل في السجلات' : 'All enrolled records'}
          icon={Users}
        />
        <StatCard
          colorIndex={1}
          title={t('statistics.activeStudents', isRTL ? 'الطلاب النشطون' : 'Active Students')}
          value={data.activeStudents}
          subtitle={isRTL ? `${activePercent}% من الإجمالي` : `${activePercent}% active rate`}
          icon={UserCheck}
        />
        <StatCard
          colorIndex={2}
          title={t('statistics.averageGpa', isRTL ? 'متوسط المعدل التراكمي' : 'Average GPA')}
          value={data.averageGpa.toFixed(2)}
          subtitle={isRTL ? 'من 4.00 نقاط' : 'Scale out of 4.00'}
          icon={GraduationCap}
        />
        <StatCard
          colorIndex={3}
          title={isRTL ? 'معدل الانتظام' : 'Active Retention'}
          value={`${activePercent}%`}
          subtitle={isRTL ? 'حالة القيد الفعالة' : 'Effective active standing'}
          icon={TrendingUp}
        />
      </div>

      {/* ── Academic Standing & Year Distributions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card: Academic Standing */}
        <Card className="border-slate-200/80 dark:border-slate-800 shadow-md">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <CardTitle className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-brand-primary-600 dark:text-brand-primary-400" />
              {t('statistics.standingDistribution', isRTL ? 'توزيع الحالات الأكاديمية' : 'Academic Standing Distribution')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {standingList.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                {isRTL ? 'لا توجد بيانات متاحة' : 'No standing data recorded'}
              </p>
            ) : (
              standingList.map((item) => (
                <div key={item.standing} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>{item.standing}</span>
                    <span className="font-mono text-slate-900 dark:text-white">
                      {item.count} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-primary-500 rounded-full transition-all duration-500"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Card: Academic Year Breakdown */}
        <Card className="border-slate-200/80 dark:border-slate-800 shadow-md">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <CardTitle className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-support-blue" />
              {t('statistics.yearBreakdown', isRTL ? 'توزيع الفرق الدراسية' : 'Academic Year Breakdown')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {yearsList.map((yr) => {
                const yrLabel =
                  yr.year === 1
                    ? isRTL ? 'الفرقة الأولى' : 'Year 1'
                    : yr.year === 2
                    ? isRTL ? 'الفرقة الثانية' : 'Year 2'
                    : yr.year === 3
                    ? isRTL ? 'الفرقة الثالثة' : 'Year 3'
                    : yr.year === 4
                    ? isRTL ? 'الفرقة الرابعة' : 'Year 4'
                    : isRTL ? `الفرقة ${yr.year}` : `Year ${yr.year}`;
                return (
                  <div
                    key={yr.year}
                    className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-800 text-center space-y-1"
                  >
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block truncate">
                      {yrLabel}
                    </span>
                    <p className="text-lg font-black text-slate-900 dark:text-white">
                      {yr.totalStudents}
                    </p>
                    <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      {yr.activeStudents} {isRTL ? 'نشط' : 'active'}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Super Admin: College Breakdown (if present) ── */}
      {collegesList.length > 0 && (
        <Card className="border-slate-200/80 dark:border-slate-800 shadow-md">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <CardTitle className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-brand-primary-600" />
              {t('statistics.collegeBreakdown', isRTL ? 'توزيع الكليات' : 'College Breakdown')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3 font-bold text-start">{isRTL ? 'الكلية' : 'College'}</th>
                  <th className="py-2.5 px-3 font-bold text-center">{isRTL ? 'إجمالي الطلاب' : 'Total Students'}</th>
                  <th className="py-2.5 px-3 font-bold text-center">{isRTL ? 'الطلاب النشطون' : 'Active Students'}</th>
                  <th className="py-2.5 px-3 font-bold text-end">{isRTL ? 'نسبة النشاط' : 'Active %'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {collegesList.map((col) => {
                  const rate =
                    col.totalStudents > 0
                      ? Math.round((col.activeStudents / col.totalStudents) * 100)
                      : 0;
                  const colName = col.collegeName || col.name;
                  const colNameAr = col.collegeNameAr || col.nameAr;
                  return (
                    <tr key={col.collegeId || col.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                      <td className="py-3 px-3 font-semibold text-slate-800 dark:text-white">
                        {isRTL ? colNameAr || colName : colName}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                        {col.totalStudents}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {col.activeStudents}
                      </td>
                      <td className="py-3 px-3 text-end font-mono font-bold text-slate-600 dark:text-slate-300">
                        {rate}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* ── Department Breakdown ── */}
      <Card className="border-slate-200/80 dark:border-slate-800 shadow-md">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <CardTitle className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-primary-600" />
            {t('statistics.departmentBreakdown', isRTL ? 'توزيع الأقسام العلمية' : 'Department Breakdown')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 overflow-x-auto">
          {departmentsList.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              {isRTL ? 'لا توجد أقسام مسجلة' : 'No department records found'}
            </p>
          ) : (
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3 font-bold text-start">{isRTL ? 'القسم' : 'Department'}</th>
                  {data.scope === 'UNIVERSITY' && (
                    <th className="py-2.5 px-3 font-bold text-start">{isRTL ? 'الكلية' : 'College'}</th>
                  )}
                  <th className="py-2.5 px-3 font-bold text-center">{isRTL ? 'إجمالي الطلاب' : 'Total Students'}</th>
                  <th className="py-2.5 px-3 font-bold text-center">{isRTL ? 'الطلاب النشطون' : 'Active Students'}</th>
                  <th className="py-2.5 px-3 font-bold text-end">{isRTL ? 'نسبة النشاط' : 'Active %'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {departmentsList.map((dept) => {
                  const rate =
                    dept.totalStudents > 0
                      ? Math.round((dept.activeStudents / dept.totalStudents) * 100)
                      : 0;
                  const deptName = dept.departmentName || dept.name;
                  const deptNameAr = dept.departmentNameAr || dept.nameAr;
                  return (
                    <tr key={dept.departmentId || dept.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                      <td className="py-3 px-3 font-semibold text-slate-800 dark:text-white">
                        {isRTL ? deptNameAr || deptName : deptName}
                      </td>
                      {data.scope === 'UNIVERSITY' && (
                        <td className="py-3 px-3 text-slate-500 dark:text-slate-400">
                          {isRTL ? dept.collegeNameAr || dept.collegeName : dept.collegeName}
                        </td>
                      )}
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                        {dept.totalStudents}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {dept.activeStudents}
                      </td>
                      <td className="py-3 px-3 text-end font-mono font-bold text-slate-600 dark:text-slate-300">
                        {rate}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
