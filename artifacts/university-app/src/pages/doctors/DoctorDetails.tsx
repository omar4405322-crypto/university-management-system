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
  Briefcase
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
  // Assuming doctors are active by default unless specified
  const isActive = doctor.isActive !== false;

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
              onClick={() => setIsAssignModalOpen(true)}
              className="bg-brand-primary-500 hover:bg-brand-primary-600 text-white rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95"
            >
              <BookOpen size={15} />
              <span>{isRTL ? 'تعيين مقرر' : 'Assign Course'}</span>
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
                title={isActive ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive')}
              />
            </div>

            {/* Doctor Titles & Badges */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                  د. {doctor.firstName} {doctor.lastName}
                </h1>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-mono font-bold bg-white/10 text-brand-primary-200 border border-white/15">
                  <Hash size={12} /> {doctor.doctorId}
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
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <BookOpen size={24} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isRTL ? 'المحاضرات' : 'Lectures'}
            </span>
            <span className="text-lg font-black text-slate-900 dark:text-white truncate">
              {doctor.scheduleSlots?.length || 0} {isRTL ? 'محاضرات' : 'Lectures'}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Briefcase size={24} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isRTL ? 'الدور' : 'Role'}
            </span>
            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {doctor.user?.role || 'DOCTOR'}
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
            <BookOpen size={18} />
            <span>{isRTL ? 'المحاضرات المجدولة' : 'Scheduled Lectures'}</span>
            <span className="ms-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
              {doctor.scheduleSlots?.length || 0}
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
            </div>
          </Card>

          {/* Card B: Academic & Account Details */}
          <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
              <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                <Building2 size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {isRTL ? 'التبعية الأكاديمية وحالة الحساب' : 'Academic & Account Details'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isRTL ? 'الكلية، القسم، التخصص، وحالة القيد' : 'College affiliation, specialty, and status'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <InfoTile
                label={isRTL ? 'الكلية' : 'College'}
                value={collegeName || '—'}
                icon={<Building2 size={14} className="text-slate-400" />}
              />
              <InfoTile
                label={isRTL ? 'القسم الأكاديمي' : 'Department'}
                value={deptName || '—'}
                icon={<Building2 size={14} className="text-slate-400" />}
              />
              <InfoTile
                label={isRTL ? 'التخصص' : 'Specialty'}
                value={doctor.specialty || '—'}
                icon={<Stethoscope size={14} className="text-slate-400" />}
              />
              <InfoTile
                label={isRTL ? 'تاريخ التعيين' : 'Join Date'}
                value={
                  doctor.createdAt
                    ? new Date(doctor.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : '—'
                }
                icon={<Calendar size={14} className="text-slate-400" />}
              />
              <InfoTile
                label={isRTL ? 'دور النظام' : 'System Role'}
                value={<Badge variant="info">{doctor.user?.role || 'DOCTOR'}</Badge>}
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

      {/* Tab 2: Scheduled Courses */}
      {activeTab === 'courses' && (
        <Card className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <BookOpen size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {isRTL ? 'المحاضرات المجدولة' : 'Scheduled Lectures'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isRTL ? 'المقررات التي يدرسها الدكتور' : 'Courses taught by this doctor'}
                </p>
              </div>
            </div>
          </div>

          {!doctor.scheduleSlots || doctor.scheduleSlots.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <BookOpen size={28} />
              </div>
              <h4 className="text-base font-bold text-slate-800 dark:text-white mb-1">
                {isRTL ? 'لا توجد محاضرات مجدولة' : 'No Lectures Scheduled'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isRTL ? 'لم يتم تعيين الدكتور لأي محاضرات في الجدول.' : 'This doctor has not been assigned any lectures yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {doctor.scheduleSlots.map((slot: any) => (
                <div
                  key={slot.id}
                  className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-3 hover:border-brand-primary-500/50 transition-all text-start"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-brand-primary-600 dark:text-brand-primary-400 bg-brand-primary-500/10 px-2.5 py-1 rounded-lg">
                      {slot.course?.courseCode || `CRS-${slot.course?.id}`}
                    </span>
                    <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Clock size={12} />
                      {isRTL ? 'مجدول' : 'Scheduled'}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-base mb-1">
                      {slot.course?.name}
                    </h4>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                      {isRTL ? 'الفرقة' : 'Year'} {slot.course?.year}
                    </p>
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
          onClose={() => setIsAssignModalOpen(false)}
          doctor={doctor}
          onSuccess={() => {
            setIsAssignModalOpen(false);
            showToast(isRTL ? 'تم تعيين المقرر بنجاح' : 'Course assigned successfully', 'success');
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
