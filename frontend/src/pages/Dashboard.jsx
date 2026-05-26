import React, { useState, useEffect } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { 
  Users, 
  Building2, 
  GraduationCap, 
  TrendingUp, 
  Clock, 
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  DollarSign,
  ClipboardList,
  FileText,
  Calendar,
  Shield,
  UserCheck
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import dashboardService from '../services/dashboard.service';

const Dashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchStats();
  }, [user.role]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      let result;
      if (['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user.role)) {
        result = await dashboardService.getAdminStats();
      } else if (user.role === 'STUDENT') {
        result = await dashboardService.getStudentStats();
      } else if (user.role === 'DOCTOR') {
        result = await dashboardService.getDoctorStats();
      }
      
      if (result && result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getKpis = () => {
    if (['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user.role)) {
      return [
        {
          title: t('dashboard.totalStudents'),
          value: stats?.counts?.totalStudents?.toLocaleString() || '0',
          change: stats?.counts?.totalStudents > 0 ? '+100%' : '0%',
          trend: 'up',
          icon: Users,
          color: 'blue'
        },
        {
          title: t('dashboard.activeColleges'),
          value: stats?.counts?.totalColleges?.toLocaleString() || '0',
          change: 'Real-time',
          trend: 'neutral',
          icon: Building2,
          color: 'indigo'
        },
        {
          title: t('dashboard.totalPayments'),
          value: stats?.counts?.totalPayments?.toLocaleString() || '0',
          change: 'Active',
          trend: 'up',
          icon: Clock,
          color: 'amber'
        },
        {
          title: t('dashboard.totalDoctors'),
          value: stats?.counts?.totalDoctors?.toLocaleString() || '0',
          change: 'Faculty',
          trend: 'up',
          icon: GraduationCap,
          color: 'emerald'
        },
        {
          title: t('dashboard.superAdmin'),
          value: stats?.counts?.totalSuperAdmins?.toLocaleString() || '0',
          change: 'System',
          trend: 'neutral',
          icon: Shield,
          color: 'rose'
        },
        {
          title: t('dashboard.admin'),
          value: stats?.counts?.totalAdmins?.toLocaleString() || '0',
          change: 'Staff',
          trend: 'neutral',
          icon: UserCheck,
          color: 'blue'
        }
      ];
    } else if (user.role === 'STUDENT') {
      return [
        {
          title: t('dashboard.academicYear'),
          value: stats?.profile?.year || '1',
          change: t('dashboard.yearOfStudy'),
          trend: 'neutral',
          icon: BookOpen,
          color: 'blue'
        },
        {
          title: t('dashboard.paymentsStatus'),
          value: stats?.myPayments?.pending?.count || '0',
          change: t('dashboard.pendingPayments'),
          trend: stats?.myPayments?.pending?.count > 0 ? 'down' : 'up',
          icon: DollarSign,
          color: 'amber'
        },
        {
          title: t('dashboard.upcomingQuizzes'),
          value: stats?.upcomingQuizzes?.length || '0',
          change: t('dashboard.activeNow'),
          trend: 'neutral',
          icon: ClipboardList,
          color: 'indigo'
        },
        {
          title: t('dashboard.currentSemester'),
          value: stats?.profile?.semester || '1',
          change: stats?.profile?.semester === 2 ? t('dashboard.spring') : t('dashboard.fall'),
          trend: 'neutral',
          icon: Calendar,
          color: 'emerald'
        }
      ];
    } else if (user.role === 'DOCTOR') {
      return [
        {
          title: t('dashboard.myCourses'),
          value: stats?.counts?.myCourses || '0',
          change: t('dashboard.activeCourses'),
          trend: 'neutral',
          icon: BookOpen,
          color: 'blue'
        },
        {
          title: t('dashboard.totalStudents'),
          value: stats?.counts?.totalStudents || '0',
          change: t('dashboard.enrolled'),
          trend: 'up',
          icon: Users,
          color: 'emerald'
        },
        {
          title: t('dashboard.upcomingExams'),
          value: stats?.upcomingExams?.length || '0',
          change: t('dashboard.thisMonth'),
          trend: 'neutral',
          icon: ClipboardList,
          color: 'indigo'
        },
        {
          title: t('dashboard.todayClasses'),
          value: stats?.todaySchedule?.length || '0',
          change: t('dashboard.scheduled'),
          trend: 'neutral',
          icon: Clock,
          color: 'amber'
        }
      ];
    }
    return [];
  };

  const kpis = getKpis();

  const getRecentRequests = () => {
    if (['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user.role)) {
      return stats?.recentStudents?.map((student, index) => ({
        id: index,
        name: `${student.firstName} ${student.lastName}`,
        subtitle: student.studentId,
        date: new Date(student.enrolledAt).toLocaleDateString(),
        status: 'active'
      })) || [];
    } else if (user.role === 'STUDENT') {
      return stats?.upcomingExams?.map((exam, index) => ({
        id: index,
        name: exam.courseName,
        subtitle: exam.type,
        date: new Date(exam.date).toLocaleDateString(),
        status: 'upcoming'
      })) || [];
    } else if (user.role === 'DOCTOR') {
      return stats?.todaySchedule?.map((schedule, index) => ({
        id: index,
        name: schedule.courseName,
        subtitle: `${schedule.startTime} - ${schedule.endTime}`,
        date: schedule.room,
        status: 'scheduled'
      })) || [];
    }
    return [];
  };

  const recentRequests = getRecentRequests();

  // Academic control links for Doctors
  const academicControls = [
    {
      title: t('nav.quizzes'),
      description: 'Create and manage course quizzes',
      path: '/quizzes',
      icon: ClipboardList,
      color: 'indigo',
      action: 'Create New Quiz'
    },
    {
      title: t('nav.tasks'),
      description: 'Post assignments and grade submissions',
      path: '/tasks',
      icon: FileText,
      color: 'blue',
      action: 'Post Assignment'
    }
  ];

  const enrollmentData = stats?.enrollmentData?.length > 0 
    ? stats.enrollmentData 
    : [
        { name: '2021', students: 0 },
        { name: '2022', students: 0 },
        { name: '2023', students: 0 },
        { name: '2024', students: 0 },
        { name: '2025', students: stats?.counts?.totalStudents || 0 },
      ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const getRoleTitle = () => {
    switch (user.role) {
      case 'SUPER_ADMIN': return t('dashboard.superAdmin');
      case 'ADMIN': return t('dashboard.admin');
      case 'COLLEGE_ADMIN': return t('dashboard.collegeAdmin');
      case 'DEPARTMENT_ADMIN': return t('dashboard.deptAdmin');
      case 'DOCTOR': return t('dashboard.doctor');
      case 'STUDENT': return t('dashboard.student');
      default: return '';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('dashboard.title')}</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">{t('dashboard.welcome')}, {getRoleTitle()}. {t('dashboard.subtitle')}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, index) => (
          <Card key={index} className="relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{kpi.title}</p>
                <h3 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{kpi.value}</h3>
                <div className="mt-2 flex items-center gap-1.5">
                  {kpi.trend === 'up' ? (
                    <ArrowUpRight size={16} className="text-emerald-500 dark:text-emerald-400" />
                  ) : kpi.trend === 'down' ? (
                    <ArrowDownRight size={16} className="text-rose-500 dark:text-rose-400" />
                  ) : null}
                  <span className={`text-xs font-semibold ${
                    kpi.trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 
                    kpi.trend === 'down' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {kpi.change}
                  </span>
                  {!['neutral'].includes(kpi.trend) && <span className="text-xs text-slate-400 dark:text-slate-500">{t('dashboard.vsLastMonth')}</span>}
                </div>
              </div>
              <div className={`rounded-xl p-3 ${
                kpi.color === 'blue' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' :
                kpi.color === 'indigo' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' :
                kpi.color === 'amber' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' :
                kpi.color === 'rose' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' :
                'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
              } transition-transform group-hover:scale-110`}>
                <kpi.icon size={24} />
              </div>
            </div>
            <div className={`absolute -right-4 -bottom-4 h-24 w-24 rounded-full ${
              kpi.color === 'blue' ? 'bg-blue-50/50 dark:bg-blue-900/10' :
              kpi.color === 'indigo' ? 'bg-indigo-50/50 dark:bg-indigo-900/10' :
              kpi.color === 'amber' ? 'bg-amber-50/50 dark:bg-amber-900/10' :
              kpi.color === 'rose' ? 'bg-rose-50/50 dark:bg-rose-900/10' :
              'bg-emerald-50/50 dark:bg-emerald-900/10'
            } blur-2xl group-hover:bg-opacity-100 transition-colors`}></div>
          </Card>
        ))}
      </div>

      {/* Academic Control Section for Doctors */}
      {user.role === 'DOCTOR' && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {academicControls.map((control, i) => (
            <Card key={i} className="group hover:border-blue-500/50 transition-colors border-dashed border-2">
              <div className="flex items-center gap-6">
                <div className={`p-4 rounded-2xl ${
                  control.color === 'indigo' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 
                  'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                }`}>
                  <control.icon size={32} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{control.title}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{control.description}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button onClick={() => navigate(control.path)} className="whitespace-nowrap">
                    {control.action}
                  </Button>
                  <Button variant="ghost" onClick={() => navigate(control.path)} className="text-xs">
                    View All
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main Chart Area */}
        <Card title={user.role === 'STUDENT' ? t('dashboard.myPerformance') : t('dashboard.enrollmentTrends')} className="lg:col-span-2">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={enrollmentData}>
                <defs>
                  <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                    color: isDark ? '#f8fafc' : '#0f172a'
                  }}
                  itemStyle={{ color: isDark ? '#f8fafc' : '#0f172a' }}
                />
                <Area 
                  type="monotone" 
                  dataKey={user.role === 'STUDENT' ? 'grade' : 'students'} 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorStudents)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Recent Activities */}
        <Card 
          title={user.role === 'STUDENT' ? t('dashboard.upcomingExams') : user.role === 'DOCTOR' ? t('dashboard.todayClasses') : t('dashboard.recentRequests')} 
          subtitle={user.role === 'STUDENT' ? t('dashboard.dontMiss') : t('dashboard.recentRequestsDesc')}
        >
          <div className="space-y-6">
            {recentRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-semibold group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {req.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{req.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-500">{req.subtitle}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={req.status === 'active' || req.status === 'scheduled' ? 'success' : 'warning'}>
                    {t(`dashboard.${req.status}`)}
                  </Badge>
                  <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-600">{req.date}</p>
                </div>
              </div>
            ))}
            {recentRequests.length === 0 && (
              <p className="text-center text-sm text-slate-500 py-4">{t('common.noData')}</p>
            )}
            {recentRequests.length > 0 && (
              <Button variant="ghost" className="w-full mt-4 text-sm">{t('dashboard.viewAll')}</Button>
            )}
          </div>
        </Card>
      </div>

      {/* System Health / Quick Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="border-l-4 border-emerald-500 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-emerald-500" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('dashboard.dbSync')}</p>
              <p className="text-xs text-slate-500 dark:text-slate-500">{t('dashboard.lastSync')}: {t('dashboard.fiveMinsAgo')}</p>
            </div>
          </div>
        </Card>
        <Card className="border-l-4 border-blue-500 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <GraduationCap className="text-blue-500" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('dashboard.academicYear')} {stats?.profile?.year ? `${stats.profile.year}` : t('dashboard.nextYear')}</p>
              <p className="text-xs text-slate-500 dark:text-slate-500">{t('dashboard.activeSemester')}: {stats?.profile?.semester === 2 ? t('dashboard.spring') : t('dashboard.fall')}</p>
            </div>
          </div>
        </Card>
        <Card className="border-l-4 border-amber-500 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-amber-500" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('dashboard.maintenance')}</p>
              <p className="text-xs text-slate-500 dark:text-slate-500">{t('dashboard.scheduledFor')} {t('dashboard.maintenanceDate')}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
