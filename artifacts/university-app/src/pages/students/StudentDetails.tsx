// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import studentsService from '../../services/students.service';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeft,
  User,
  Mail,
  Shield,
  Calendar,
  Edit2,
  KeyRound,
  Printer,
  BookOpen,
  GraduationCap,
  Building2,
  Phone,
  MapPin,
  CreditCard,
  CheckCircle2,
  XCircle,
  Hash,
  ShieldCheck,
  Users,
  BarChart3,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/button';
import LoadingState from '../../components/ui/LoadingState';
import EditStudentModal from './EditStudentModal';
import ResetPasswordModal from '../../components/ui/ResetPasswordModal';
import { useToast } from '../../context/ToastContext';

interface StudentDetailsProps {
  studentId?: string;
  isDrawerMode?: boolean;
}

const StudentDetails: React.FC<StudentDetailsProps> = ({ studentId, isDrawerMode = false }) => {
  const { id } = useParams();
  const actualId = studentId || id;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { showToast } = useToast();
  const { user } = useAuth();
  const canViewStatistics = Boolean(
    user && ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user.role)
  );

  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'courses' | 'payments'>('overview');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);

  const fetchStudent = useCallback(async () => {
    try {
      setLoading(true);
      const result = await studentsService.getStudentById(actualId);
      if (result.success && result.data) {
        setStudent(result.data);
      } else {
        setError(isRTL ? 'لم يتم العثور على الطالب' : 'Student not found');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || (isRTL ? 'خطأ في جلب تفاصيل الطالب' : 'Error fetching student details'));
    } finally {
      setLoading(false);
    }
  }, [actualId, isRTL]);

  useEffect(() => {
    fetchStudent();
  }, [fetchStudent]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <LoadingState message={isRTL ? 'جاري تحميل تفاصيل الطالب...' : 'Loading student details...'} />;
  }

  if (error || !student) {
    return (
      <div className="page-padding text-center py-16">
        <div className="max-w-md mx-auto bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center mx-auto mb-4">
            <XCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
            {error || (isRTL ? 'لم يتم العثور على سجل الطالب' : 'Student record not found')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            {isRTL ? 'رقم الطالب المطلوب غير موجود أو تم إزالته من القاعدة.' : 'The requested student ID does not exist or has been removed.'}
          </p>
          <Button
            onClick={() => navigate('/students')}
            className="bg-brand-primary-500 hover:bg-brand-primary-600 text-white gap-2 mx-auto font-bold rounded-xl"
          >
            <ArrowLeft size={18} className="rtl:-scale-x-100" />
            <span>{isRTL ? 'العودة إلى قائمة الطلاب' : 'Back to Students List'}</span>
          </Button>
        </div>
      </div>
    );
  }

  const initials = `${student.firstName?.[0] || ''}${student.lastName?.[0] || ''}`.toUpperCase();
  const deptName = isRTL ? (student.department?.nameAr || student.department?.name) : (student.department?.name || student.department?.nameAr);
  const collegeName = isRTL ? (student.department?.college?.nameAr || student.department?.college?.name) : (student.department?.college?.name || student.department?.college?.nameAr);
  const isActive = student.isActive;

  const getStudentGroupText = (group: any, isRTL: boolean) => {
    if (!group) return isRTL ? 'غير معين في مجموعة' : 'Not Assigned';
    if (group.parentGroup) {
      return isRTL
        ? `المجموعة ${group.parentGroup.name} (فرعية ${group.name})`
        : `Group ${group.parentGroup.name} (Subgroup ${group.name})`;
    }
    return isRTL ? `المجموعة ${group.name}` : `Group ${group.name}`;
  };

  const getGroupBadgeLabel = (group: any, isRTL: boolean) => {
    if (!group) return isRTL ? 'بدون مجموعة' : 'No Group';
    if (group.parentGroup) {
      return `${group.parentGroup.name} / ${group.name}`;
    }
    return group.name;
  };

  return (
    <div className={isDrawerMode ? 'p-2 space-y-6' : 'page-padding content-container section-gap space-y-6'}>
      {/* Top Header Navigation & Actions Bar */}
      {!isDrawerMode && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <button
            onClick={() => navigate('/students')}
            className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-brand-primary-600 dark:hover:text-brand-primary-400 transition-colors font-bold text-sm"
          >
            <ArrowLeft size={18} className="rtl:-scale-x-100" />
            <span>{isRTL ? 'العودة إلى قائمة الطلاب' : 'Back to Students List'}</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {canViewStatistics && (
              <Button
                variant="outline"
                onClick={() => navigate(`/statistics/${student.id}`)}
                className="border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-2 transition-all"
              >
                <BarChart3 size={15} />
                <span>{t('nav.statistics', 'Academic Statistics')}</span>
              </Button>
            )}

            <Button
              variant="outline"
              onClick={handlePrint}
              className="border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-2 transition-all"
            >
              <Printer size={15} />
              <span>{isRTL ? 'طباعة الملف الأكاديمي' : 'Print Profile'}</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => setIsResetPasswordOpen(true)}
              className="border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-2 transition-all"
            >
              <KeyRound size={15} />
              <span>{isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset Password'}</span>
            </Button>

            <Button
              onClick={() => setIsEditModalOpen(true)}
              className="bg-brand-primary-500 hover:bg-brand-primary-600 text-white rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95"
            >
              <Edit2 size={15} />
              <span>{isRTL ? 'تعديل الملف الشخصي' : 'Edit Profile'}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Hero Profile Banner Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-brand-primary-950 to-slate-900 p-6 md:p-8 text-white shadow-xl border border-slate-800">
        <div className="absolute -end-10 -top-10 w-60 h-60 rounded-full bg-brand-primary-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -start-10 -bottom-10 w-60 h-60 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Avatar */}
            <div className="relative">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-brand-primary-400 to-brand-primary-600 flex items-center justify-center text-2xl md:text-3xl font-black text-white shadow-lg ring-4 ring-white/10 shrink-0">
                {student.user?.profilePicture ? (
                  <img
                    src={student.user.profilePicture}
                    alt={student.firstName}
                    className="w-full h-full object-cover rounded-2xl"
                  />
                ) : (
                  initials
                )}
              </div>
              <span
                className={`absolute -bottom-1 -end-1 w-5 h-5 rounded-full border-2 border-slate-900 ${
                  isActive ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
                title={isActive ? (isRTL ? 'طالب نشط' : 'Active Student') : (isRTL ? 'طالب غير نشط' : 'Inactive Student')}
              />
            </div>

            {/* Student Titles & Badges */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                  {student.firstName} {student.lastName}
                </h1>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-mono font-bold bg-white/10 text-brand-primary-200 border border-white/15">
                  <Hash size={12} /> {student.studentId}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {isActive ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                  {isActive ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive')}
                </span>
                {student.group && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <Users size={13} />
                    {isRTL ? `المجموعة ${getGroupBadgeLabel(student.group, true)}` : `Group ${getGroupBadgeLabel(student.group, false)}`}
                  </span>
                )}
              </div>

              {/* Department & College Chips */}
              <div className="flex items-center gap-3 text-sm text-slate-300 flex-wrap mt-1">
                {deptName && (
                  <span className="flex items-center gap-1.5 font-medium">
                    <Building2 size={16} className="text-brand-primary-400" />
                    {deptName}
                  </span>
                )}
                {deptName && collegeName && <span className="text-slate-600">•</span>}
                {collegeName && (
                  <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                    <GraduationCap size={16} className="text-blue-400" />
                    {collegeName}
                  </span>
                )}
              </div>

              {/* Email & Phone Chips */}
              <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap mt-1">
                {student.user?.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail size={13} className="text-slate-400" />
                    {student.user.email}
                  </span>
                )}
                {student.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone size={13} className="text-slate-400" />
                    {student.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Metrics Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <GraduationCap size={24} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isRTL ? 'الفرقة الدراسية' : 'Academic Division'}
            </span>
            <span className="text-lg font-black text-slate-900 dark:text-white truncate">
              {t(`students.YEAR${student.year}`, isRTL ? `الفرقة ${student.year || 1}` : `Division ${student.year || 1}`)}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Users size={24} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isRTL ? 'المجموعة الدراسية' : 'Student Group'}
            </span>
            <span className="text-sm font-black text-amber-600 dark:text-amber-400 truncate" title={getStudentGroupText(student.group, isRTL)}>
              {getGroupBadgeLabel(student.group, isRTL)}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <BookOpen size={24} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isRTL ? 'المقررات المسجلة' : 'Enrolled Courses'}
            </span>
            <span className="text-lg font-black text-slate-900 dark:text-white truncate">
              {student.enrollments?.length || 0} {isRTL ? 'مقررات' : 'Courses'}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Building2 size={24} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isRTL ? 'القسم الأكاديمي' : 'Department'}
            </span>
            <span className="text-sm font-bold text-slate-900 dark:text-white truncate" title={deptName || '—'}>
              {deptName || '—'}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck size={24} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isRTL ? 'الحالة' : 'Status'}
            </span>
            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {isActive ? (isRTL ? 'طالب نشط' : 'Active Student') : (isRTL ? 'غير نشط' : 'Inactive')}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-5 py-3 font-bold text-sm border-b-2 transition-all ${
              activeTab === 'overview'
                ? 'border-brand-primary-500 text-brand-primary-600 dark:text-brand-primary-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <User size={18} />
            <span>{isRTL ? 'البيانات الشخصية والأكاديمية' : 'Personal & Academic Details'}</span>
          </button>

          <button
            onClick={() => setActiveTab('courses')}
            className={`flex items-center gap-2 px-5 py-3 font-bold text-sm border-b-2 transition-all ${
              activeTab === 'courses'
                ? 'border-brand-primary-500 text-brand-primary-600 dark:text-brand-primary-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <BookOpen size={18} />
            <span>{isRTL ? 'المقررات المسجلة' : 'Enrolled Courses'}</span>
            <span className="ms-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
              {student.enrollments?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`flex items-center gap-2 px-5 py-3 font-bold text-sm border-b-2 transition-all ${
              activeTab === 'payments'
                ? 'border-brand-primary-500 text-brand-primary-600 dark:text-brand-primary-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <CreditCard size={18} />
            <span>{isRTL ? 'المدفوعات والرسوم' : 'Payments & Fees'}</span>
            {student.payments?.length > 0 && (
              <span className="ms-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                {student.payments.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab 1: Personal & Academic Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card A: Personal & Contact Info */}
          <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
              <div className="p-2.5 bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400 rounded-xl">
                <User size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {isRTL ? 'المعلومات الشخصية وبيانات الاتصال' : 'Personal & Contact Information'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isRTL ? 'بيانات الهوية الأساسية والتواصل الخاصة بالطالب' : 'Basic identity and contact details of the student'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <InfoTile
                label={isRTL ? 'الاسم الأول' : 'First Name'}
                value={student.firstName}
              />
              <InfoTile
                label={isRTL ? 'اسم العائلة' : 'Last Name'}
                value={student.lastName}
              />
              <InfoTile
                label={isRTL ? 'الرقم الجامعي للطالب' : 'Student Academic ID'}
                value={student.studentId}
                isMono
              />
              <InfoTile
                label={isRTL ? 'البريد الإلكتروني' : 'Email Address'}
                value={student.user?.email || '—'}
                icon={<Mail size={14} className="text-slate-400" />}
              />
              <InfoTile
                label={isRTL ? 'رقم الهاتف' : 'Phone Number'}
                value={student.phone || (isRTL ? 'غير متوفر' : 'Not provided')}
                icon={<Phone size={14} className="text-slate-400" />}
              />
              <InfoTile
                label={isRTL ? 'عنوان السكن' : 'Residential Address'}
                value={student.address || (isRTL ? 'غير متوفر' : 'Not provided')}
                icon={<MapPin size={14} className="text-slate-400" />}
              />
            </div>
          </Card>

          {/* Card B: Academic & Account Details */}
          <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
              <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                <Shield size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {isRTL ? 'التبعية الأكاديمية وحالة الحساب' : 'Academic & Account Details'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isRTL ? 'الكلية، القسم، الدور الصلاحيات، وحالة القيد' : 'College affiliation, role, and enrollment status'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <InfoTile
                label={isRTL ? 'الكلية' : 'College'}
                value={collegeName || '—'}
                icon={<GraduationCap size={14} className="text-slate-400" />}
              />
              <InfoTile
                label={isRTL ? 'القسم الأكاديمي' : 'Department'}
                value={deptName || '—'}
                icon={<Building2 size={14} className="text-slate-400" />}
              />
              <InfoTile
                label={isRTL ? 'الفرقة الدراسية' : 'Academic Division'}
                value={t(`students.YEAR${student.year}`, isRTL ? `الفرقة ${student.year || 1}` : `Division ${student.year || 1}`)}
              />
              <InfoTile
                label={isRTL ? 'المجموعة الأكاديمية' : 'Student Group'}
                value={
                  student.group ? (
                    <Badge variant="primary" className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-1 text-xs">
                      {getStudentGroupText(student.group, isRTL)}
                    </Badge>
                  ) : (
                    <span className="text-slate-400 text-sm font-normal italic">
                      {isRTL ? 'غير معين في مجموعة' : 'Not assigned to a group'}
                    </span>
                  )
                }
                icon={<Users size={14} className="text-slate-400" />}
              />
              <InfoTile
                label={isRTL ? 'دور النظام' : 'System Role'}
                value={<Badge variant="info">{student.user?.role || 'STUDENT'}</Badge>}
              />
              <InfoTile
                label={isRTL ? 'تاريخ الالتحاق' : 'Enrolled Since'}
                value={
                  student.enrolledAt
                    ? new Date(student.enrolledAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : '—'
                }
                icon={<Calendar size={14} className="text-slate-400" />}
              />
              <InfoTile
                label={isRTL ? 'حالة الحساب' : 'Account Status'}
                value={
                  <Badge variant={isActive ? 'success' : 'danger'}>
                    {isActive ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive')}
                  </Badge>
                }
              />
            </div>
          </Card>
        </div>
      )}

      {/* Tab 2: Enrolled Courses */}
      {activeTab === 'courses' && (
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <BookOpen size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {isRTL ? 'المقررات الأكاديمية المسجلة' : 'Enrolled Academic Courses'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isRTL ? 'المواد والمقررات التي يقوم الطالب بدراستها حالياً' : 'Courses currently registered by this student'}
                </p>
              </div>
            </div>
          </div>

          {!student.enrollments || student.enrollments.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <BookOpen size={28} />
              </div>
              <h4 className="text-base font-bold text-slate-800 dark:text-white mb-1">
                {isRTL ? 'لا توجد مقررات مسجلة' : 'No Courses Enrolled'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isRTL ? 'لم يتم تسجيل هذا الطالب في أي مقررات دراسية حتى الآن.' : 'This student has not been registered in any courses yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {student.enrollments.map((item: any, index: number) => {
                const course = item.course || item;
                return (
                  <div
                    key={course.id || index}
                    className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-3 hover:border-brand-primary-500/50 transition-all text-start"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-brand-primary-600 dark:text-brand-primary-400 bg-brand-primary-500/10 px-2.5 py-1 rounded-lg">
                        {course.courseCode || `CRS-${course.id}`}
                      </span>
                      <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full">
                        {isRTL ? 'مسجل' : 'Enrolled'}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-base mb-1">
                        {course.name}
                      </h4>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Tab 3: Payments & Fees */}
      {activeTab === 'payments' && (
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                <CreditCard size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {isRTL ? 'سجل الرسوم والمدفوعات' : 'Payment & Tuition History'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isRTL ? 'العمليات المالية والدفعات الخاصة بالطالب' : 'Recent transactions and fee payments for this student'}
                </p>
              </div>
            </div>
          </div>

          {!student.payments || student.payments.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <CreditCard size={28} />
              </div>
              <h4 className="text-base font-bold text-slate-800 dark:text-white mb-1">
                {isRTL ? 'لا توجد مدفوعات' : 'No Payments Found'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isRTL ? 'لا توجد أي سجلات دفع سابقة لهذا الطالب.' : 'No payment records exist for this student.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="p-3 text-start">{isRTL ? 'المبلغ' : 'Amount'}</th>
                    <th className="p-3 text-start">{isRTL ? 'طريقة الدفع' : 'Payment Method'}</th>
                    <th className="p-3 text-center">{isRTL ? 'الحالة' : 'Status'}</th>
                    <th className="p-3 text-end">{isRTL ? 'التاريخ' : 'Date'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {student.payments.map((p: any, idx: number) => (
                    <tr key={p.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                        {isRTL ? 'ج.م ' : 'EGP '}{p.amount?.toLocaleString()}
                      </td>
                      <td className="p-3 font-medium text-slate-700 dark:text-slate-300">
                        {p.method || (isRTL ? 'بطاقة ائتمان / فيزا' : 'Credit Card / Visa')}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="success">
                          {p.status || (isRTL ? 'مدفوع' : 'Paid')}
                        </Badge>
                      </td>
                      <td className="p-3 text-end font-medium text-slate-500 dark:text-slate-400">
                        {new Date(p.createdAt || p.date || Date.now()).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Modals */}
      {isEditModalOpen && (
        <EditStudentModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          student={student}
          onSuccess={() => {
            setIsEditModalOpen(false);
            showToast(isRTL ? 'تم تحديث بيانات الطالب بنجاح' : 'Student updated successfully', 'success');
            fetchStudent();
          }}
        />
      )}

      <ResetPasswordModal
        isOpen={isResetPasswordOpen}
        onClose={() => setIsResetPasswordOpen(false)}
        person={student}
        type="student"
      />
    </div>
  );
};

const InfoTile = ({
  label,
  value,
  isMono = false,
  icon = null,
}: {
  label: string;
  value: React.ReactNode;
  isMono?: boolean;
  icon?: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1 text-start">
    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
      {label}
    </span>
    <div className="flex items-center gap-2">
      {icon}
      {typeof value === 'string' || typeof value === 'number' ? (
        <span
          className={`text-base font-bold text-slate-800 dark:text-slate-100 ${
            isMono ? 'font-mono text-brand-primary-600 dark:text-brand-primary-400' : ''
          }`}
        >
          {value}
        </span>
      ) : (
        value
      )}
    </div>
  </div>
);

export default StudentDetails;
