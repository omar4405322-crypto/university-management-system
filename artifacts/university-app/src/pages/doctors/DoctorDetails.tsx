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
  Stethoscope,
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
  GraduationCap
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/button';
import Badge from '../../components/ui/Badge';
import LoadingState from '../../components/ui/LoadingState';
import api from '../../services/api';
import EditDoctorModal from './EditDoctorModal';
import AssignCourseModal from './AssignCourseModal';
import ResetPasswordModal from '../../components/ui/ResetPasswordModal';
import { useToast } from '../../context/ToastContext';

export default function DoctorDetails({ isDrawerMode = false }: { isDrawerMode?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { showToast } = useToast();

  const [doctor, setDoctor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'courses'>('overview');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedCourseForSlot, setSelectedCourseForSlot] = useState<string | number | undefined>(undefined);

  const fetchDoctor = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/doctors/${id}`);
      if (res.data?.success && res.data?.data) {
        setDoctor(res.data.data);
      } else {
        setError(isRTL ? 'لم يتم العثور على الدكتور' : 'Doctor not found');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || (isRTL ? 'خطأ في جلب تفاصيل الدكتور' : 'Error fetching doctor details'));
    } finally {
      setLoading(false);
    }
  }, [id, isRTL]);

  useEffect(() => {
    fetchDoctor();
  }, [fetchDoctor]);

  const handlePrint = () => {
    window.print();
  };

  const handleUnassignCourse = async (courseId: number, courseName: string) => {
    if (!window.confirm(isRTL ? `هل أنت متأكد من إلغاء إسناد مقرر (${courseName}) من هذا الدكتور؟ سيتم إزالة جميع محاضراته المجدولة لهذه المادة.` : `Are you sure you want to remove ${courseName} from this professor? All related lecture schedule slots will be removed.`)) {
      return;
    }
    try {
      await api.delete(`/doctors/${doctor.id}/courses/${courseId}`);
      showToast(isRTL ? 'تم إلغاء إسناد المقرر بنجاح' : 'Course unassigned successfully', 'success');
      fetchDoctor();
    } catch (err: any) {
      showToast(err.response?.data?.message || (isRTL ? 'فشل إلغاء إسناد المقرر' : 'Failed to unassign course'), 'error');
    }
  };

  const handleUnassignSlot = async (slotId: number) => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد من حذف هذا الموعد من جدول المحاضرات؟' : 'Are you sure you want to remove this lecture slot?')) {
      return;
    }
    try {
      await api.delete(`/schedules/${slotId}`);
      showToast(isRTL ? 'تم حذف موعد المحاضرة بنجاح' : 'Lecture slot removed successfully', 'success');
      fetchDoctor();
    } catch (err: any) {
      showToast(err.response?.data?.message || (isRTL ? 'فشل حذف موعد المحاضرة' : 'Failed to remove slot'), 'error');
    }
  };

  if (loading) {
    return <LoadingState message={isRTL ? 'جاري تحميل تفاصيل الدكتور...' : 'Loading doctor details...'} />;
  }

  if (error || !doctor) {
    return (
      <div className="page-padding text-center py-16">
        <div className="max-w-md mx-auto bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center mx-auto mb-4">
            <XCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
            {error || (isRTL ? 'لم يتم العثور على سجل الدكتور' : 'Doctor record not found')}
          </h2>
          <Button
            onClick={() => navigate('/doctors')}
            className="bg-brand-primary-500 hover:bg-brand-primary-600 text-white gap-2 mx-auto font-bold rounded-xl mt-6"
          >
            <ArrowLeft size={18} className="rtl:-scale-x-100" />
            <span>{isRTL ? 'العودة لقائمة الدكاترة' : 'Back to Doctors List'}</span>
          </Button>
        </div>
      </div>
    );
  }

  const initials = `${doctor.firstName?.[0] || ''}${doctor.lastName?.[0] || ''}`.toUpperCase();
  const deptName = isRTL ? (doctor.department?.nameAr || doctor.department?.name) : (doctor.department?.name || doctor.department?.nameAr);
  const collegeName = isRTL ? (doctor.department?.college?.nameAr || doctor.department?.college?.name) : (doctor.department?.college?.name || doctor.department?.college?.nameAr);
  const isActive = doctor.isActive !== false;
  const taughtCourses = doctor.taughtCourses || [];
  const scheduleSlots = doctor.scheduleSlots || [];

  return (
    <div className={isDrawerMode ? 'p-2 space-y-6' : 'page-padding content-container section-gap space-y-6'}>
      {/* Top Header Navigation & Actions Bar */}
      {!isDrawerMode && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <button
            onClick={() => navigate('/doctors')}
            className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-brand-primary-600 dark:hover:text-brand-primary-400 transition-colors font-bold text-sm"
          >
            <ArrowLeft size={18} className="rtl:-scale-x-100" />
            <span>{isRTL ? 'العودة إلى قائمة الدكاترة' : 'Back to Doctors List'}</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={handlePrint}
              className="border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-2 transition-all"
            >
              <Printer size={15} />
              <span>{isRTL ? 'طباعة الملف' : 'Print Profile'}</span>
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
              onClick={() => {
                setSelectedCourseForSlot(undefined);
                setIsAssignModalOpen(true);
              }}
              className="bg-brand-primary-500 hover:bg-brand-primary-600 text-white rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95"
            >
              <Award size={15} />
              <span>{isRTL ? 'إسناد مقرر دراسي' : 'Assign Course'}</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(true)}
              className="border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-2 transition-all"
            >
              <Edit2 size={15} />
              <span>{isRTL ? 'تعديل الملف' : 'Edit Profile'}</span>
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
                {doctor.user?.profilePicture ? (
                  <img
                    src={doctor.user.profilePicture}
                    alt={doctor.firstName}
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
                title={isActive ? 'Active' : 'Inactive'}
              />
            </div>

            {/* Main Info */}
            <div className="space-y-1.5 text-start">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                  د. {doctor.firstName} {doctor.lastName}
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {isActive ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                  {isActive ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive')}
                </span>
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
                    <Building2 size={16} className="text-blue-400" />
                    {collegeName}
                  </span>
                )}
              </div>

              {/* Email & Phone Chips */}
              <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap mt-1">
                {doctor.user?.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail size={13} className="text-slate-400" />
                    {doctor.user.email}
                  </span>
                )}
                {doctor.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone size={13} className="text-slate-400" />
                    {doctor.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Metrics Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Building2 size={24} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isRTL ? 'القسم' : 'Department'}
            </span>
            <span className="text-sm font-black text-slate-900 dark:text-white truncate" title={deptName}>
              {deptName || '—'}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400 flex items-center justify-center shrink-0">
            <Award size={24} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isRTL ? 'المقررات المسندة' : 'Assigned Courses'}
            </span>
            <span className="text-lg font-black text-slate-900 dark:text-white truncate">
              {taughtCourses.length} {isRTL ? 'مقررات' : 'Courses'}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <BookOpen size={24} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isRTL ? 'المحاضرات المجدولة' : 'Lectures'}
            </span>
            <span className="text-lg font-black text-slate-900 dark:text-white truncate">
              {scheduleSlots.length} {isRTL ? 'مواعيد' : 'Slots'}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <ShieldCheck size={24} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isRTL ? 'الحالة' : 'Status'}
            </span>
            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {isActive ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive')}
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
            <Award size={18} />
            <span>{isRTL ? 'المقررات والمحاضرات المسندة' : 'Assigned Courses & Schedule'}</span>
            <span className="ms-1 px-2 py-0.5 rounded-full text-xs bg-brand-primary-100 dark:bg-brand-primary-900/40 text-brand-primary-700 dark:text-brand-primary-300 font-mono font-bold">
              {taughtCourses.length}
            </span>
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
                  {isRTL ? 'بيانات الهوية الأساسية والتواصل' : 'Basic identity and contact details'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <InfoTile label={isRTL ? 'الاسم الأول' : 'First Name'} value={doctor.firstName} />
              <InfoTile label={isRTL ? 'اسم العائلة' : 'Last Name'} value={doctor.lastName} />
              <InfoTile label={isRTL ? 'الرقم الوظيفي' : 'Doctor ID'} value={doctor.doctorId} isMono />
              <InfoTile
                label={isRTL ? 'البريد الإلكتروني' : 'Email Address'}
                value={doctor.user?.email || '—'}
                icon={<Mail size={14} className="text-slate-400" />}
              />
              <InfoTile
                label={isRTL ? 'رقم الهاتف' : 'Phone Number'}
                value={doctor.phone || (isRTL ? 'غير متوفر' : 'Not provided')}
                icon={<Phone size={14} className="text-slate-400" />}
              />
              <InfoTile
                label={isRTL ? 'العنوان' : 'Address'}
                value={doctor.address || (isRTL ? 'غير متوفر' : 'Not provided')}
                icon={<MapPin size={14} className="text-slate-400" />}
              />
              <InfoTile
                label={isRTL ? 'الجنس' : 'Gender'}
                value={
                  doctor.gender
                    ? doctor.gender === 'MALE'
                      ? isRTL
                        ? 'ذكر'
                        : 'Male'
                      : isRTL
                      ? 'أنثى'
                      : 'Female'
                    : isRTL
                    ? 'غير محدد'
                    : 'Unspecified'
                }
              />
              <InfoTile
                label={isRTL ? 'تاريخ الميلاد' : 'Birth Date'}
                value={
                  doctor.birthDate
                    ? new Date(doctor.birthDate).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : isRTL
                    ? 'غير متوفر'
                    : 'Not provided'
                }
                icon={<Calendar size={14} className="text-slate-400" />}
              />
            </div>
          </Card>

          {/* Card B: Academic & Department Info */}
          <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
              <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                <Building2 size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {isRTL ? 'البيانات الأكاديمية والتعيين' : 'Academic & Affiliation Details'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isRTL ? 'الكلية، القسم، والتخصص الأكاديمي' : 'College, Department, and Academic Specialization'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <InfoTile
                label={isRTL ? 'الكلية' : 'College'}
                value={collegeName || (isRTL ? 'غير محددة' : 'Not assigned')}
                icon={<Building2 size={14} className="text-slate-400" />}
              />
              <InfoTile
                label={isRTL ? 'القسم الأكاديمي' : 'Department'}
                value={deptName || (isRTL ? 'غير محدد' : 'Not assigned')}
                icon={<Building2 size={14} className="text-slate-400" />}
              />
              <InfoTile
                label={isRTL ? 'التخصص الدقيق' : 'Specialization'}
                value={doctor.specialty || (isRTL ? 'عام' : 'General')}
                icon={<Briefcase size={14} className="text-slate-400" />}
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

      {/* Tab 2: Assigned Courses & Lecture Schedule */}
      {activeTab === 'courses' && (
        <div className="space-y-8">
          {/* Section 1: Assigned Courses (Professor is Responsible / Course Lead) */}
          <Card className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400 rounded-2xl">
                  <Award size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {isRTL ? 'المقررات الدراسية المسندة (أستاذ المقرر)' : 'Assigned Courses (Course Lead)'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {isRTL
                      ? `المقررات الدراسية التي يشرف عليها ويدرسها د. ${doctor.firstName} ${doctor.lastName}`
                      : `Courses supervised and taught by Dr. ${doctor.firstName} ${doctor.lastName}`}
                  </p>
                </div>
              </div>

              <Button
                onClick={() => {
                  setSelectedCourseForSlot(undefined);
                  setIsAssignModalOpen(true);
                }}
                className="bg-brand-primary-500 hover:bg-brand-primary-600 text-white rounded-xl px-5 py-2.5 text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 self-start sm:self-auto"
              >
                <Plus size={16} />
                <span>{isRTL ? 'إسناد مقرر جديد للدكتور' : 'Assign New Course'}</span>
              </Button>
            </div>

            {taughtCourses.length === 0 ? (
              <div className="text-center py-16 px-4 space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-brand-primary-50 dark:bg-brand-primary-950/40 text-brand-primary-600 dark:text-brand-primary-400 flex items-center justify-center mx-auto shadow-inner">
                  <Award size={32} />
                </div>
                <div className="max-w-md mx-auto">
                  <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-1.5">
                    {isRTL ? 'لا توجد مقررات دراسية مسندة' : 'No Courses Assigned Yet'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                    {isRTL
                      ? 'لم يتم إسناد أي مقرر دراسي لهذا الدكتور حتى الآن. يمكنك إسناد مقرر دراسي كامل وجعله أستاذاً للمقرر بنقرة واحدة.'
                      : 'This doctor is not currently responsible for any courses. Click below to assign a course and make this professor the course lead.'}
                  </p>
                  <Button
                    onClick={() => {
                      setSelectedCourseForSlot(undefined);
                      setIsAssignModalOpen(true);
                    }}
                    className="bg-brand-primary-500 hover:bg-brand-primary-600 text-white rounded-xl px-6 py-3 text-sm font-bold inline-flex items-center gap-2 shadow-lg shadow-brand-primary-500/20 transition-all hover:scale-105 active:scale-95"
                  >
                    <Award size={18} />
                    <span>{isRTL ? 'إسناد أول مقرر لهذا الدكتور' : 'Assign First Course to Doctor'}</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {taughtCourses.map((course: any) => (
                  <div
                    key={course.id}
                    className="bg-slate-50/80 dark:bg-slate-900/60 p-6 rounded-3xl border border-slate-200 dark:border-slate-700/80 hover:border-brand-primary-500/40 hover:shadow-md transition-all space-y-4 text-start"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="font-mono text-xs font-black text-brand-primary-600 dark:text-brand-primary-400 bg-brand-primary-500/10 px-3 py-1 rounded-xl">
                            {course.courseCode}
                          </span>
                          <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <ShieldCheck size={12} />
                            {isRTL ? 'أستاذ المقرر الرئيسي' : 'Course Lead'}
                          </span>
                        </div>
                        <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                          {course.name}
                        </h4>
                      </div>

                      <button
                        onClick={() => handleUnassignCourse(course.id, course.name)}
                        title={isRTL ? 'إلغاء إسناد المقرر' : 'Unassign Course'}
                        className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-200/60 dark:border-slate-700/60 text-xs">
                      <div>
                        <span className="text-slate-400 block mb-0.5">{isRTL ? 'الفرقة' : 'Year'}</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          {isRTL ? 'الفرقة' : 'Year'} {course.year}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">{isRTL ? 'الفصل الدراسي' : 'Semester'}</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          {isRTL ? 'الترم' : 'Sem'} {course.semester || 1}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">{isRTL ? 'الساعات المعتمدة' : 'Credits'}</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          {course.credits || 3} {isRTL ? 'ساعات' : 'Hrs'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Users size={14} className="text-brand-primary-500" />
                          <strong className="text-slate-800 dark:text-slate-200">{course.studentCount ?? 0}</strong> {isRTL ? 'طالب مسجل' : 'Students'}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock size={14} className="text-emerald-500" />
                          <strong className="text-slate-800 dark:text-slate-200">{course.totalScheduledSlots ?? 0}</strong> {isRTL ? 'مواعيد محاضرات' : 'Slots'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedCourseForSlot(course.id);
                            setIsAssignModalOpen(true);
                          }}
                          className="px-3 py-1.5 text-xs font-bold border-slate-200 dark:border-slate-700 rounded-xl"
                        >
                          <Plus size={13} />
                          <span>{isRTL ? 'موعد محاضرة' : 'Add Slot'}</span>
                        </Button>

                        <Button
                          onClick={() => navigate(`/courses/${course.id}`)}
                          className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5"
                        >
                          <span>{isRTL ? 'صفحة المقرر' : 'View Course'}</span>
                          <ExternalLink size={12} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Section 2: Weekly Lecture Schedule Slots */}
          <Card className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                  <Calendar size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {isRTL ? 'جدول المحاضرات الأسبوعية المجدولة' : 'Weekly Lecture Timetable'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {isRTL ? 'المواعيد والقاعات المحددة لكل محاضرة' : 'Scheduled time slots and halls for this professor'}
                  </p>
                </div>
              </div>
            </div>

            {scheduleSlots.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs font-medium">
                {isRTL ? 'لا توجد مواعيد محاضرات محددة في الجدول بعد.' : 'No weekly lecture slots configured yet.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scheduleSlots.map((slot: any) => (
                  <div
                    key={slot.id}
                    className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-4 hover:border-brand-primary-500/50 hover:shadow-md transition-all text-start"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-brand-primary-600 dark:text-brand-primary-400 bg-brand-primary-500/10 px-2.5 py-1 rounded-lg">
                        {slot.course?.courseCode || `CRS-${slot.course?.id}`}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock size={12} />
                          {isRTL ? 'مجدول' : 'Scheduled'}
                        </span>
                        <button
                          onClick={() => handleUnassignSlot(slot.id)}
                          title={isRTL ? 'حذف موعد المحاضرة' : 'Remove Slot'}
                          className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-lg"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-base mb-1">
                        {slot.course?.name}
                      </h4>
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <span>{isRTL ? 'الفرقة' : 'Year'} {slot.course?.year}</span>
                        {slot.room && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <MapPin size={12} />
                              {slot.room}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                        <Calendar size={14} className="text-slate-400" />
                        <span>{slot.dayOfWeek}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 font-mono" dir="ltr">
                        {slot.startTime} - {slot.endTime}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Modals */}
      {isEditModalOpen && (
        <EditDoctorModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          doctor={doctor}
          onSuccess={() => {
            setIsEditModalOpen(false);
            showToast(isRTL ? 'تم تحديث بيانات الدكتور بنجاح' : 'Doctor updated successfully', 'success');
            fetchDoctor();
          }}
        />
      )}

      {isAssignModalOpen && (
        <AssignCourseModal
          isOpen={isAssignModalOpen}
          onClose={() => {
            setIsAssignModalOpen(false);
            setSelectedCourseForSlot(undefined);
          }}
          doctor={doctor}
          preselectedCourseId={selectedCourseForSlot}
          onSuccess={() => {
            setIsAssignModalOpen(false);
            setSelectedCourseForSlot(undefined);
            showToast(isRTL ? 'تم إسناد المقرر للدكتور بنجاح' : 'Course assigned to professor successfully', 'success');
            fetchDoctor();
          }}
        />
      )}

      <ResetPasswordModal
        isOpen={isResetPasswordOpen}
        onClose={() => setIsResetPasswordOpen(false)}
        person={doctor}
        type="doctor"
      />
    </div>
  );
}

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
    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
      {icon}
      {label}
    </span>
    <span
      className={`text-sm font-bold text-slate-800 dark:text-slate-100 ${
        isMono ? 'font-mono' : ''
      }`}
    >
      {value}
    </span>
  </div>
);
