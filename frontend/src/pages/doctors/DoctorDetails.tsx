import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import doctorsService from '../../services/doctors.service';
import schedulesService from '../../services/schedules.service';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Mail, BookOpen, Clock, MapPin, Shield, Calendar, Award, GraduationCap, Building2 } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import LoadingState from '../../components/ui/LoadingState';
import Table, { TableRow, TableCell } from '../../components/ui/Table';

const DAYS_EN = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const DAYS_AR: Record<string, string> = {
  Saturday: 'السبت',
  Sunday: 'الأحد',
  Monday: 'الاثنين',
  Tuesday: 'الثلاثاء',
  Wednesday: 'الأربعاء',
  Thursday: 'الخميس',
  Friday: 'الجمعة',
};

const DAY_COLORS: Record<string, string> = {
  Saturday: 'bg-brand-gray/20 dark:bg-brand-gray/10 border-brand-gray/30 dark:border-brand-gray/40 text-brand-gray-700 dark:text-brand-gray-300',
  Sunday: 'bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/30 text-purple-700 dark:text-purple-300',
  Monday: 'bg-brand-primary-50/20 dark:bg-brand-primary-900/10 border-brand-primary-100 dark:border-brand-primary-900/30 text-brand-green-dark dark:text-brand-green',
  Tuesday: 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-100 dark:border-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  Wednesday: 'bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30 text-orange-700 dark:text-orange-300',
  Thursday: 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-300',
  Friday: 'bg-slate-50 dark:bg-slate-900/10 border-slate-100 dark:border-slate-900/30 text-slate-700 dark:text-slate-300',
};

interface DoctorDetailsProps {
  doctorId?: string;
  isDrawerMode?: boolean;
}

const DoctorDetails: React.FC<DoctorDetailsProps> = ({ doctorId, isDrawerMode = false }) => {
  const { id } = useParams();
  const actualId = doctorId || id;
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');

  const [doctor, setDoctor] = useState<any>(null);
  const [schedule, setSchedule] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!actualId) return;
      try {
        setLoading(true);
        setError(null);
        const [doctorRes, scheduleRes] = await Promise.all([
          doctorsService.getDoctorById(actualId),
          schedulesService.getWeeklyTimetable({ doctorId: actualId }),
        ]);

        if (doctorRes.success) {
          setDoctor(doctorRes.data);
        } else {
          setError(t('doctors.notFound', 'Doctor not found'));
        }

        setSchedule(scheduleRes?.data || scheduleRes || {});
      } catch (err: any) {
        setError(err.response?.data?.message || t('doctors.errorFetching', 'Failed to load doctor profile'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [actualId, t]);

  if (loading) {
    return <LoadingState message={t('common.loading', 'Loading profile...')} />;
  }

  if (error || !doctor) {
    return (
      <div className="page-padding text-center">
        <div className="max-w-md mx-auto py-20">
          <p className="text-error text-xl mb-4 font-bold">{error || t('doctors.notFound', 'Doctor not found')}</p>
          <button
            onClick={() => navigate('/doctors')}
            className="text-brand-accent-blue hover:underline flex items-center justify-center gap-2 mx-auto font-medium"
          >
            <ArrowLeft size={18} className="rtl:-scale-x-100" /> {t('doctors.backToList', 'Back to List')}
          </button>
        </div>
      </div>
    );
  }

  const totalClasses = Object.values(schedule).reduce(
    (sum: number, day: any) => sum + (Array.isArray(day) ? day.length : 0),
    0
  );

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const isActive = doctor.status === 'active' || !doctor.status;

  return (
    <div className={isDrawerMode ? "" : "page-padding content-container section-gap animate-in fade-in duration-700"}>
      {!isDrawerMode && (
        <button
          onClick={() => navigate('/doctors')}
          className="flex items-center gap-2 text-brand-text-secondary dark:text-brand-text-muted hover:text-info dark:hover:text-info transition-colors font-medium mb-6"
        >
          <ArrowLeft size={20} className="rtl:-scale-x-100" /> {t('doctors.backToList', 'Back to List')}
        </button>
      )}

      {/* Hero Doctor Card */}
      <Card className="mb-6 overflow-hidden relative">
        <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-brand-green-dark to-brand-primary-400" />
        <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
          {/* Avatar Circle */}
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-brand-green-dark to-brand-primary-400 text-white flex items-center justify-center text-3xl font-black shadow-lg shrink-0 select-none">
            {getInitials(doctor.firstName, doctor.lastName)}
          </div>
          
          <div className="flex-grow text-center sm:text-start space-y-1.5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-center sm:justify-start">
              <h1 className="text-2xl font-black text-brand-text-primary dark:text-brand-text-main">
                {t('common.dr', 'Dr.')} {doctor.firstName} {doctor.lastName}
              </h1>
              <Badge variant={isActive ? 'success' : 'warning'} className="self-center sm:self-auto px-3 py-1 font-bold text-xs">
                {isAr ? (isActive ? 'نشط' : 'غير نشط') : (isActive ? 'Active' : 'Inactive')}
              </Badge>
            </div>
            
            <p className="text-sm font-mono text-brand-text-muted flex items-center justify-center sm:justify-start gap-1">
              <span className="font-bold uppercase tracking-wider">{t('doctors.doctorId', 'Doctor ID')}:</span>
              <span className="text-brand-navy-500 font-bold">{doctor.doctorId}</span>
            </p>
          </div>
        </div>
      </Card>

      {/* Grid of Profile Info */}
      <div className={`grid grid-cols-1 ${isDrawerMode ? 'gap-5' : 'lg:grid-cols-3 xl:grid-cols-4 gap-5 xl:gap-6'}`}>
        
        {/* Info Cards Grid */}
        <Card className={isDrawerMode ? '' : 'lg:col-span-2 xl:col-span-3'}>
          <div className="flex items-center gap-3 mb-6 border-b border-brand-border dark:border-brand-border pb-4">
            <div className="p-2 bg-info/10 dark:bg-info/20 rounded-lg text-info dark:text-info">
              <GraduationCap size={20} />
            </div>
            <h2 className="text-xl font-bold text-brand-text-primary dark:text-brand-text-main">
              {t('doctors.personalInformation', 'Academic Information')}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <InfoItem 
              label={t('profile.email', 'Email Address')} 
              value={doctor.user?.email} 
              icon={<Mail size={16} className="text-brand-text-muted" />} 
            />
            <InfoItem 
              label={t('doctors.specialty', 'Specialization')} 
              value={doctor.specialty || t('common.notProvided', 'Not provided')} 
              icon={<Award size={16} className="text-brand-text-muted" />} 
            />
            <InfoItem 
              label={t('doctors.college', 'College')} 
              value={doctor.department?.college?.name || t('common.notProvided', 'Not provided')} 
              icon={<Building2 size={16} className="text-brand-text-muted" />} 
            />
            <InfoItem 
              label={t('doctors.department', 'Department')} 
              value={doctor.department?.name || t('common.notProvided', 'Not provided')} 
              icon={<Building2 size={16} className="text-brand-text-muted" />} 
            />
            <InfoItem 
              label={t('students.phone', 'Phone Number')} 
              value={doctor.phone || t('common.notProvided', 'Not provided')} 
            />
          </div>
        </Card>

        {/* System Details Card */}
        <Card>
          <div className="flex items-center gap-3 mb-6 border-b border-brand-border dark:border-brand-border pb-4">
            <div className="p-2 bg-info/10 dark:bg-info/20 rounded-lg text-info dark:text-info">
              <Shield size={20} />
            </div>
            <h2 className="text-xl font-bold text-brand-text-primary dark:text-brand-text-main">
              {t('students.accountDetails', 'Security Details')}
            </h2>
          </div>

          <div className="space-y-6">
            <div className="space-y-1">
              <p className="text-xs font-bold text-brand-text-secondary dark:text-brand-text-muted uppercase tracking-wider">
                {t('students.accountRole', 'System Role')}
              </p>
              <Badge variant="info" className="mt-1">
                {doctor.user?.role || 'DOCTOR'}
              </Badge>
            </div>
            
            <div className="space-y-1">
              <p className="text-xs font-bold text-brand-text-secondary dark:text-brand-text-muted uppercase tracking-wider">
                {t('profile.status', 'Account Status')}
              </p>
              <Badge variant={isActive ? 'success' : 'warning'}>
                {isActive ? t('students.active', 'Active') : t('students.inactive', 'Inactive')}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Assigned Courses Table */}
        <Card className="lg:col-span-full">
          <div className="flex items-center gap-3 mb-6 border-b border-brand-border dark:border-brand-border pb-4">
            <div className="p-2 bg-info/10 dark:bg-info/20 rounded-lg text-info dark:text-info">
              <BookOpen size={20} />
            </div>
            <h2 className="text-xl font-bold text-brand-text-primary dark:text-brand-text-main">
              {t('doctors.coursesList', 'Assigned Courses')}
            </h2>
          </div>

          {!doctor.courses || doctor.courses.length === 0 ? (
            <p className="text-brand-text-secondary dark:text-brand-text-muted py-4">
              {t('doctors.noCoursesAssigned', 'No courses are currently assigned to this doctor.')}
            </p>
          ) : (
            <Table
              headers={[
                t('courses.code', 'Course Code'),
                t('courses.name', 'Course Name'),
                t('courses.level', 'Study Level (Year)'),
                t('courses.semester', 'Semester'),
                t('courses.studentsCount', 'Student Count'),
              ]}
            >
              {doctor.courses.map((course: any) => (
                <TableRow key={course.id}>
                  <TableCell className="font-mono text-xs font-bold text-info dark:text-info">
                    {course.courseCode}
                  </TableCell>
                  <TableCell className="font-bold text-brand-text-primary dark:text-brand-text-main">
                    {course.name}
                  </TableCell>
                  <TableCell className="font-bold text-xs text-brand-text-secondary dark:text-brand-text-muted">
                    {t('common.year', 'Year')} {course.year}
                  </TableCell>
                  <TableCell className="font-bold text-xs text-brand-text-secondary dark:text-brand-text-muted">
                    {t('timetables.semester', 'Semester')} {course.semester}
                  </TableCell>
                  <TableCell className="font-black text-sm text-brand-green-dark dark:text-brand-green">
                    {course._count?.enrollments ?? 0}
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          )}
        </Card>

        {/* Weekly Schedule Section */}
        <Card className="lg:col-span-full">
          <div className="flex items-center justify-between mb-6 border-b border-brand-border dark:border-brand-border pb-4 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-info/10 dark:bg-info/20 rounded-lg text-info dark:text-info">
                <Calendar size={20} />
              </div>
              <h2 className="text-xl font-bold text-brand-text-primary dark:text-brand-text-main">
                {t('schedule.weeklySchedule', 'Weekly Schedule')}
              </h2>
            </div>
            <span className="text-xs font-semibold text-brand-text-secondary dark:text-brand-text-muted">
              {t('schedule.totalClasses', 'Total Classes')}: {totalClasses}
            </span>
          </div>

          {totalClasses === 0 ? (
            <div className="text-center py-12 text-brand-text-secondary dark:text-brand-text-muted">
              <p className="text-4xl mb-2">📅</p>
              <p>{t('schedule.noSchedule', 'No weekly schedule has been generated for this doctor.')}</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {DAYS_EN.map((dayKey) => {
                const entries = schedule[dayKey] || [];
                if (entries.length === 0) return null;
                const borderClass = DAY_COLORS[dayKey] || '';
                return (
                  <div key={dayKey} className={`rounded-xl border p-4 ${borderClass}`}>
                    <h3 className="font-bold mb-3 text-base">
                      {isAr ? DAYS_AR[dayKey] : dayKey}
                    </h3>
                    <div className="grid gap-2">
                      {entries.map((entry: any, i: number) => (
                        <div
                          key={i}
                          className="bg-white dark:bg-slate-900 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm border border-slate-100 dark:border-slate-800/80"
                        >
                          <div className="flex items-center gap-1.5 text-info dark:text-info font-bold text-xs min-w-[120px]">
                            <Clock size={14} />
                            <span>{entry.startTime} - {entry.endTime}</span>
                          </div>
                          <span className="font-bold text-brand-text-primary dark:text-brand-text-main flex-grow text-sm">
                            {entry.course?.name || entry.courseName}
                          </span>
                          {entry.room && (
                            <div className="flex items-center gap-1 text-xs text-brand-text-secondary dark:text-brand-text-muted">
                              <MapPin size={12} />
                              <span>{entry.room}</span>
                            </div>
                          )}
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-medium">
                            {entry.course?.department?.name || ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

const InfoItem: React.FC<{ label: string; value: any; isMono?: boolean; icon?: React.ReactNode }> = ({
  label,
  value,
  isMono = false,
  icon = null,
}) => (
  <div className="space-y-1">
    <p className="text-xs font-bold text-brand-text-secondary dark:text-brand-text-muted uppercase tracking-wider">
      {label}
    </p>
    <div className="flex items-center gap-2">
      {icon}
      <p
        className={`text-base text-brand-text-primary dark:text-brand-text-main ${
          isMono ? 'font-mono' : 'font-medium'
        }`}
      >
        {value}
      </p>
    </div>
  </div>
);

export default DoctorDetails;
