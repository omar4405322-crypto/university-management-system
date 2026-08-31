import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import {
  ArrowLeft,
  User,
  Mail,
  Calendar,
  Building2,
  Phone,
  BookOpen,
  XCircle,
  Hash,
  MapPin,
  Clock,
  Printer,
  KeyRound,
  Edit2,
  CheckCircle2,
  ShieldCheck,
  Briefcase,
  Users,
  Award,
  Plus,
  Trash2,
  ExternalLink,
  GraduationCap,
} from 'lucide-react';
import Card from '../../components/ui/card';
import Button from '../../components/ui/button';
import Badge from '../../components/ui/Badge';
import LoadingState from '../../components/ui/LoadingState';
import api from '../../services/api';
import EditTAModal from './EditTAModal';
import AssignTACourseModal from './AssignTACourseModal';
import ResetPasswordModal from '../../components/ui/ResetPasswordModal';
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal';
import { useToast } from '../../context/ToastContext';

export default function TeachingAssistantDetails({ isDrawerMode = false }: { isDrawerMode?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { showToast } = useToast();

  const [ta, setTa] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'courses'>('overview');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedCourseForSlot, setSelectedCourseForSlot] = useState<number | undefined>(undefined);

  const [unassignCourseTarget, setUnassignCourseTarget] = useState<{ courseId: number; courseName: string } | null>(null);
  const [unassignSlotTarget, setUnassignSlotTarget] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTA = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/teaching-assistants/${id}`);
      if (res.data?.success && res.data?.data) {
        setTa(res.data.data);
      } else {
        setError(isRTL ? 'لم يتم العثور على المعيد' : 'Teaching Assistant not found');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          (isRTL ? 'خطأ في جلب تفاصيل المعيد' : 'Error fetching teaching assistant details')
      );
    } finally {
      setLoading(false);
    }
  }, [id, isRTL]);

  useEffect(() => {
    fetchTA();
  }, [fetchTA]);

  const handlePrint = () => {
    window.print();
  };

  const handleUnassignCourse = (courseId: number, courseName: string) => {
    setUnassignCourseTarget({ courseId, courseName });
  };

  const confirmUnassignCourse = async () => {
    if (!unassignCourseTarget) return;
    try {
      setActionLoading(true);
      await api.delete(`/teaching-assistants/${ta.id}/courses/${unassignCourseTarget.courseId}`);
      showToast(isRTL ? 'تم إلغاء إسناد المقرر بنجاح' : 'Course unassigned successfully', 'success');
      fetchTA();
      setUnassignCourseTarget(null);
    } catch (err: any) {
      showToast(
        err.response?.data?.message || (isRTL ? 'فشل إلغاء إسناد المقرر' : 'Failed to unassign course'),
        'error'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnassignSlot = (slotId: number) => {
    setUnassignSlotTarget(slotId);
  };

  const confirmUnassignSlot = async () => {
    if (!unassignSlotTarget) return;
    try {
      setActionLoading(true);
      await api.delete(`/schedules/${unassignSlotTarget}`);
      showToast(isRTL ? 'تم حذف الموعد بنجاح' : 'Slot removed successfully', 'success');
      fetchTA();
      setUnassignSlotTarget(null);
    } catch (err: any) {
      showToast(err.response?.data?.message || (isRTL ? 'فشل حذف الموعد' : 'Failed to remove slot'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <LoadingState
        message={isRTL ? 'جاري تحميل تفاصيل المعيد...' : 'Loading teaching assistant details...'}
      />
    );
  }

  if (error || !ta) {
    return (
      <div className="page-padding text-center py-16">
        <div className="max-w-md mx-auto bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center mx-auto mb-4">
            <XCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
            {error || (isRTL ? 'لم يتم العثور على سجل المعيد' : 'Teaching Assistant record not found')}
          </h2>
          <Button
            onClick={() => navigate('/teaching-assistants')}
            className="bg-purple-600 hover:bg-purple-700 text-white gap-2 mx-auto font-bold rounded-xl mt-6"
          >
            <ArrowLeft size={18} className="rtl:-scale-x-100" />
            <span>{isRTL ? 'العودة لقائمة المعيدين' : 'Back to Teaching Assistants List'}</span>
          </Button>
        </div>
      </div>
    );
  }

  const initials = `${ta.firstName?.[0] || ''}${ta.lastName?.[0] || ta.employeeId?.[0] || 'T'}`.toUpperCase();
  const deptName = isRTL
    ? ta.department?.nameAr || ta.department?.name
    : ta.department?.name || ta.department?.nameAr;
  const collegeName = isRTL
    ? ta.department?.college?.nameAr || ta.department?.college?.name
    : ta.department?.college?.name || ta.department?.college?.nameAr;
  const isActive = ta.status === 'ACTIVE';
  const taughtCourses = ta.taughtCourses || [];
  const scheduleSlots = ta.scheduleSlots || [];

  return (
    <div className={isDrawerMode ? 'p-2 space-y-6' : 'page-padding content-container section-gap space-y-6'}>
      {/* Top Header Navigation & Actions Bar */}
      {!isDrawerMode && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <button
            onClick={() => navigate('/teaching-assistants')}
            className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors font-bold text-sm"
          >
            <ArrowLeft size={18} className="rtl:-scale-x-100" />
            <span>{isRTL ? 'العودة لقائمة المعيدين' : 'Back to Teaching Assistants'}</span>
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-2 text-xs font-bold rounded-xl border-slate-200 dark:border-slate-700"
            >
              <Printer size={15} />
              <span>{isRTL ? 'طباعة الملف' : 'Print Profile'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsResetPasswordOpen(true)}
              className="gap-2 text-xs font-bold rounded-xl border-slate-200 dark:border-slate-700"
            >
              <KeyRound size={15} />
              <span>{isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset Password'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(true)}
              className="gap-2 text-xs font-bold rounded-xl border-slate-200 dark:border-slate-700"
            >
              <Edit2 size={15} />
              <span>{isRTL ? 'تعديل البيانات' : 'Edit Profile'}</span>
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setSelectedCourseForSlot(undefined);
                setIsAssignModalOpen(true);
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white gap-2 text-xs font-bold rounded-xl shadow-sm"
            >
              <Plus size={15} />
              <span>{isRTL ? 'إسناد مقرر دراسي / معمل' : 'Assign Course / Lab'}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Main Profile Header Banner */}
      <Card className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 md:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400 flex items-center justify-center font-black text-2xl sm:text-3xl border-2 border-brand-primary-500/20 shadow-sm shrink-0">
              {initials}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  م. {ta.firstName || ''} {ta.lastName || ''}
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  />
                  {isActive ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive')}
                </span>
              </div>

              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-2">
                <span className="text-brand-primary-600 dark:text-brand-primary-400 font-bold">
                  {ta.specialization || (isRTL ? 'معيد' : 'Teaching Assistant')}
                </span>
                {deptName && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Building2 size={14} className="text-slate-400" />
                      {deptName}
                      {collegeName && ` (${collegeName})`}
                    </span>
                  </>
                )}
              </p>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
                <span className="flex items-center gap-1.5 font-mono bg-slate-100 dark:bg-slate-900 px-2.5 py-1 rounded-lg">
                  <Hash size={13} className="text-slate-400" />
                  {ta.employeeId}
                </span>
                {ta.user?.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail size={13} className="text-slate-400" />
                    {ta.user.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-4 border-t md:border-t-0 md:border-s border-slate-200 dark:border-slate-700 pt-4 md:pt-0 md:ps-8 w-full md:w-auto justify-around md:justify-start">
            <div className="text-center">
              <span className="block text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {taughtCourses.length}
              </span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {isRTL ? 'المقررات المسندة' : 'Assigned Courses'}
              </span>
            </div>
            <div className="w-px h-10 bg-slate-200 dark:bg-slate-700" />
            <div className="text-center">
              <span className="block text-2xl sm:text-3xl font-black text-brand-primary-600 dark:text-brand-primary-400">
                {scheduleSlots.length}
              </span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {isRTL ? 'الحصص الأسبوعية' : 'Weekly Slots'}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all ${
            activeTab === 'overview'
              ? 'bg-brand-primary-500 text-white shadow-md shadow-brand-primary-500/20'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <User size={16} />
          <span>{isRTL ? 'نظرة عامة والبيانات' : 'Overview & Info'}</span>
        </button>

        <button
          onClick={() => setActiveTab('courses')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all ${
            activeTab === 'courses'
              ? 'bg-brand-primary-500 text-white shadow-md shadow-brand-primary-500/20'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <BookOpen size={16} />
          <span>{isRTL ? 'المقررات والمعامل المسندة' : 'Assigned Courses & Labs'}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'courses' ? 'bg-white/20 text-white' : 'bg-brand-primary-100 text-brand-primary-700'
            }`}
          >
            {taughtCourses.length}
          </span>
        </button>
      </div>

      {/* TAB CONTENT: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info Cards */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-4">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Briefcase size={18} className="text-purple-600" />
                <span>{isRTL ? 'البيانات الأكاديمية والوظيفية' : 'Academic & Employment Info'}</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
                  <span className="text-slate-400 font-medium block">
                    {isRTL ? 'الرقم الوظيفي / الكود' : 'Employee ID'}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-sm">
                    {ta.employeeId}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
                  <span className="text-slate-400 font-medium block">
                    {isRTL ? 'التخصص الأكاديمي' : 'Specialization'}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {ta.specialization || '—'}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
                  <span className="text-slate-400 font-medium block">{isRTL ? 'القسم الأساسي' : 'Primary Department'}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {deptName || (isRTL ? 'غير محدد' : 'Not assigned')}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
                  <span className="text-slate-400 font-medium block">{isRTL ? 'الكلية' : 'College'}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {collegeName || (isRTL ? 'غير محدد' : 'Not assigned')}
                  </span>
                </div>
              </div>
            </Card>

            {/* Teaching Summary */}
            <Card className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <GraduationCap size={18} className="text-purple-600" />
                  <span>{isRTL ? 'المقررات المسندة في مختلف الأقسام' : 'Taught Courses Across Departments'}</span>
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTab('courses')}
                  className="text-xs font-bold rounded-xl"
                >
                  {isRTL ? 'عرض الكل' : 'View All'}
                </Button>
              </div>

              {taughtCourses.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs italic bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700">
                  {isRTL ? 'لا توجد مقررات دراسية أو معامل مسندة لهذا المعيد بعد' : 'No courses or labs assigned yet'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {taughtCourses.map((c: any) => {
                    const cDept = isRTL
                      ? c.department?.nameAr || c.department?.name
                      : c.department?.name || c.department?.nameAr;
                    const cCol = isRTL
                      ? c.department?.college?.nameAr || c.department?.college?.name
                      : c.department?.college?.name || c.department?.college?.nameAr;

                    return (
                      <div
                        key={c.id}
                        onClick={() => navigate(`/courses/${c.id}`)}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-purple-500 transition-all cursor-pointer space-y-2 group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-md">
                            {c.courseCode}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500">
                            {isRTL ? `الفرقة ${c.year}` : `Division ${c.year}`}
                          </span>
                        </div>
                        <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100 group-hover:text-purple-600 transition-colors line-clamp-1">
                          {c.name}
                        </h3>
                        {cDept && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
                            <Building2 size={11} className="shrink-0" />
                            <span>
                              {cDept} {cCol && `(${cCol})`}
                            </span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Side Info Cards */}
          <div className="space-y-6">
            <Card className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-4">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck size={18} className="text-purple-600" />
                <span>{isRTL ? 'حساب النظام والأمان' : 'Account & Security'}</span>
              </h2>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900">
                  <span className="text-slate-500">{isRTL ? 'البريد الإلكتروني' : 'Email'}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{ta.user?.email || '—'}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900">
                  <span className="text-slate-500">{isRTL ? 'الصلاحية' : 'Role'}</span>
                  <span className="font-bold text-purple-600">معيد / Teaching Assistant</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900">
                  <span className="text-slate-500">{isRTL ? 'حالة الحساب' : 'Account Status'}</span>
                  <span className="font-bold text-emerald-600">
                    {isActive ? (isRTL ? 'مفعل ومتاح' : 'Active') : (isRTL ? 'معطل' : 'Disabled')}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => setIsResetPasswordOpen(true)}
                className="w-full text-xs font-bold rounded-xl gap-2 mt-2"
              >
                <KeyRound size={15} />
                <span>{isRTL ? 'تغيير كلمة المرور' : 'Change Password'}</span>
              </Button>
            </Card>
          </div>
        </div>
      )}

      {/* TAB CONTENT: ASSIGNED COURSES */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                {isRTL ? 'المقررات والسكاشن المسندة للمعيد' : 'Assigned Courses & Labs'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isRTL
                  ? 'يمكن للمعيد التدريس والمساعدة في أكثر من قسم أو كلية مع منع تعارض المواعيد تلقائياً'
                  : 'Teaching assistants can assist courses across multiple departments/colleges with automated conflict prevention'}
              </p>
            </div>

            <Button
              size="sm"
              onClick={() => {
                setSelectedCourseForSlot(undefined);
                setIsAssignModalOpen(true);
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white gap-2 text-xs font-bold rounded-xl shadow-sm self-start sm:self-auto"
            >
              <Plus size={15} />
              <span>{isRTL ? 'إسناد مقرر جديد' : 'Assign New Course'}</span>
            </Button>
          </div>

          {taughtCourses.length === 0 ? (
            <Card className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-12 text-center shadow-sm space-y-4">
              <div className="w-16 h-16 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center mx-auto">
                <BookOpen size={30} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  {isRTL ? 'لم يتم إسناد أي مقررات دراسية بعد' : 'No courses assigned yet'}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  {isRTL
                    ? 'قم بالضغط على زر إسناد مقرر لاختيار المواد من أي قسم أو كلية وتحديد مواعيد السكاشن والمعامل'
                    : 'Click the Assign Course button to assign subjects across any department and configure lab/tutorial slots'}
                </p>
              </div>
              <Button
                onClick={() => {
                  setSelectedCourseForSlot(undefined);
                  setIsAssignModalOpen(true);
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white gap-2 text-xs font-bold rounded-xl mx-auto"
              >
                <Plus size={15} />
                <span>{isRTL ? 'إسناد مقرر دراسي الآن' : 'Assign Course Now'}</span>
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {taughtCourses.map((course: any) => {
                const cDept = isRTL
                  ? course.department?.nameAr || course.department?.name
                  : course.department?.name || course.department?.nameAr;
                const cCol = isRTL
                  ? course.department?.college?.nameAr || course.department?.college?.name
                  : course.department?.college?.name || course.department?.college?.nameAr;
                const slots = scheduleSlots.filter((s: any) => s.courseId === course.id);

                return (
                  <Card
                    key={course.id}
                    className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-2.5 py-0.5 rounded-lg">
                            {course.courseCode}
                          </span>
                          <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-lg">
                            {isRTL ? `الفرقة ${course.year}` : `Division ${course.year}`}
                          </span>
                          <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-lg">
                            {isRTL ? `الفصل ${course.semester}` : `Semester ${course.semester}`}
                          </span>
                        </div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{course.name}</span>
                        </h3>
                        {cDept && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                            <Building2 size={13} className="text-purple-500" />
                            <span>
                              {cDept} {cCol && `• ${cCol}`}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedCourseForSlot(course.id);
                            setIsAssignModalOpen(true);
                          }}
                          className="gap-1.5 text-xs font-bold rounded-xl border-purple-200 text-purple-600 dark:text-purple-400 hover:bg-purple-50"
                        >
                          <Plus size={14} />
                          <span>{isRTL ? 'إضافة موعد حصة/معمل' : 'Add Slot'}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/courses/${course.id}`)}
                          className="gap-1.5 text-xs font-bold rounded-xl"
                        >
                          <ExternalLink size={14} />
                          <span>{isRTL ? 'صفحة المقرر' : 'Course Details'}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUnassignCourse(course.id, course.name)}
                          className="gap-1.5 text-xs font-bold rounded-xl text-rose-600 hover:bg-rose-50 border-rose-200"
                        >
                          <Trash2 size={14} />
                          <span>{isRTL ? 'إلغاء الإسناد' : 'Unassign'}</span>
                        </Button>
                      </div>
                    </div>

                    {/* Schedule Slots Breakdown */}
                    <div>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-2">
                        {isRTL ? 'المواعيد والقاعات المجدولة لهذا المقرر:' : 'Scheduled Slots & Labs:'}
                      </span>

                      {slots.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">
                          {isRTL ? 'لا توجد مواعيد مجدولة لهذا المقرر بعد' : 'No schedule slots set yet'}
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {slots.map((slot: any) => (
                            <div
                              key={slot.id}
                              className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-purple-600 dark:text-purple-400">
                                    {slot.dayOfWeek}
                                  </span>
                                  <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded font-semibold">
                                    {slot.slotType || 'TUTORIAL'}
                                  </span>
                                </div>
                                <div className="text-slate-500 flex items-center gap-2 text-[11px]">
                                  <span className="flex items-center gap-1">
                                    <Clock size={11} />
                                    {slot.startTime} - {slot.endTime}
                                  </span>
                                  {slot.room && (
                                    <span className="flex items-center gap-1">
                                      <MapPin size={11} />
                                      {slot.room}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleUnassignSlot(slot.id)}
                                className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all"
                                title={isRTL ? 'حذف الموعد' : 'Remove slot'}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      {isEditModalOpen && (
        <EditTAModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          ta={ta}
          onSuccess={fetchTA}
        />
      )}

      {isResetPasswordOpen && (
        <ResetPasswordModal
          isOpen={isResetPasswordOpen}
          onClose={() => setIsResetPasswordOpen(false)}
          person={ta ? { ...ta, firstName: ta.firstName || ta.employeeId, lastName: ta.lastName || '' } : null}
          type="teaching-assistant"
        />
      )}

      {isAssignModalOpen && (
        <AssignTACourseModal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          ta={ta}
          preselectedCourseId={selectedCourseForSlot}
          onSuccess={fetchTA}
        />
      )}

      <ConfirmDeleteModal
        isOpen={Boolean(unassignCourseTarget)}
        title={isRTL ? 'تأكيد إلغاء إسناد المقرر' : 'Confirm Unassign Course'}
        message={
          isRTL
            ? `هل أنت متأكد من إلغاء إسناد مقرر (${unassignCourseTarget?.courseName}) من هذا المعيد؟ سيتم إزالة جميع حصصه المجدولة لهذه المادة.`
            : `Are you sure you want to remove ${unassignCourseTarget?.courseName} from this teaching assistant? All related lab and tutorial slots will be removed.`
        }
        onClose={() => !actionLoading && setUnassignCourseTarget(null)}
        onConfirm={confirmUnassignCourse}
        loading={actionLoading}
        variant="warning"
        confirmLabel={isRTL ? 'إلغاء الإسناد' : 'Unassign'}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(unassignSlotTarget)}
        title={isRTL ? 'تأكيد حذف الموعد' : 'Confirm Remove Slot'}
        message={
          isRTL
            ? 'هل أنت متأكد من حذف هذا الموعد من جدول السكاشن/المعامل؟'
            : 'Are you sure you want to remove this lab/tutorial slot?'
        }
        onClose={() => !actionLoading && setUnassignSlotTarget(null)}
        onConfirm={confirmUnassignSlot}
        loading={actionLoading}
        variant="danger"
      />
    </div>
  );
}
