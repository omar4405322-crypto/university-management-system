// @ts-nocheck
import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import {
  Clock,
  MapPin,
  User,
  ChevronLeft,
  ChevronRight,
  Calendar,
  AlertCircle,
  FileText,
  Building2,
  GraduationCap,
  Printer,
  CheckCircle
} from 'lucide-react';
import { getSocket, initSocket, disconnectSocket } from '../../utils/socket';
import schedulesService from '../../services/schedules.service';
import collegeService from '../../services/college.service';
import departmentService from '../../services/department.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

const WeeklySchedule = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [timetable, setTimetable] = useState(null);
  const [error, setError] = useState(null);
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedYear, setSelectedYear] = useState(1);
  const [toast, setToast] = useState<{message: string; type: 'success' | 'info'} | null>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const isRTL = i18n.language === 'ar';
  const days = isRTL
    ? ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const [selectedDay, setSelectedDay] = useState(days[0]);

  // Update selected day if days array order changes due to language
  useEffect(() => {
    setSelectedDay(days[0]);
  }, [i18n.language]);

  const times = [
    '09:00 - 10:30', '10:30 - 12:00', '12:00 - 13:30', '13:30 - 15:00', '15:00 - 16:30'
  ];

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      const fetchColleges = async () => {
        try {
          const res = await collegeService.getColleges();
          if (res.success) setColleges(res.data);
        } catch (err) {
          console.error(err);
        }
      };
      fetchColleges();
    } else if (user?.role === 'ADMIN') {
      const fetchDepartments = async () => {
        try {
          const res = await departmentService.getDepartments();
          if (res.success) setDepartments(res.data);
        } catch (err) {
          console.error(err);
        }
      };
      fetchDepartments();
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      if (selectedCollege) {
        const fetchDepartments = async () => {
          try {
            const res = await departmentService.getDepartmentsByCollege(selectedCollege);
            if (res.success) setDepartments(res.data);
          } catch (err) {
            console.error(err);
          }
        };
        fetchDepartments();
      } else {
        setDepartments([]);
        setSelectedDepartment('');
      }
    }
  }, [selectedCollege, user]);

  useEffect(() => {
    fetchTargetedTimetable();
  }, [selectedSemester, selectedDepartment, selectedYear, user]);

  const fetchTargetedTimetable = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = { semester: selectedSemester };
      if (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') {
        if (selectedDepartment) params.departmentId = selectedDepartment;
        if (selectedYear) params.year = selectedYear;
      }

      const result = await schedulesService.getWeeklyTimetable(params);
      if (result.success && result.data) {
        setTimetable(result.data);
      } else {
        setTimetable(null);
      }
    } catch (err) {
      console.error('Error fetching timetable:', err);
      setError(t('common.errorFetching'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const socket = initSocket();

    const handleTimetableUpdate = (payload: any) => {
      const { departmentId, year, semester } = payload;
      
      let viewingDept = selectedDepartment;
      if (user?.role === 'STUDENT' || user?.role === 'DOCTOR') {
         viewingDept = String(user.departmentId);
      }
      
      if (
        String(departmentId) === String(viewingDept) && 
        String(semester) === String(selectedSemester)
      ) {
         fetchTargetedTimetable();
         showToast(
           isRTL ? 'تم تحديث الجدول الدراسي' : 'Timetable has been updated', 
           'success'
         );
      }
    };

    socket.on('timetable:updated', handleTimetableUpdate);

    return () => {
      socket.off('timetable:updated', handleTimetableUpdate);
      disconnectSocket();
    };
  }, [selectedDepartment, selectedSemester, selectedYear, user, isRTL]);

  const getEntriesForTimeSlot = (day, time) => {
    if (!timetable || !timetable[day]) return [];

    return timetable[day].filter(s => {
      const startHour = parseInt(s.startTime.split(':')[0]);
      const currentHour = parseInt(time.split(':')[0]);
      return startHour === currentHour;
    });
  };

  const firstEntry = timetable ? Object.values(timetable).flat().find(Boolean) : null;
  const dataDepartmentName = isRTL
    ? (firstEntry?.course?.department?.nameAr || firstEntry?.course?.department?.name)
    : firstEntry?.course?.department?.name;
  const academicYear = firstEntry?.course?.year;
  const dataCollegeName = isRTL
    ? (firstEntry?.course?.department?.college?.nameAr || firstEntry?.course?.department?.college?.name)
    : firstEntry?.course?.department?.college?.name;

  const handleCollegeChange = (e) => {
    setSelectedCollege(e.target.value);
    setSelectedDepartment('');
  };

  const selectedDeptObj = departments.find(d => String(d.id) === String(selectedDepartment));
  const selectedCollegeObj = colleges.find(c => String(c.id) === String(selectedCollege));
  
  const selectedDeptName = selectedDeptObj ? (isRTL ? (selectedDeptObj.nameAr || selectedDeptObj.name) : selectedDeptObj.name) : dataDepartmentName;
  const selectedCollegeName = selectedCollegeObj ? (isRTL ? (selectedCollegeObj.nameAr || selectedCollegeObj.name) : selectedCollegeObj.name) : dataCollegeName;

  const showDeptSubtitle = !!(selectedDepartment || ((user?.role === 'STUDENT' || user?.role === 'DOCTOR') && dataDepartmentName));

  return (
    <div className="section-gap animate-page">
      
      {/* Toast */}
      {toast && (
        <div className="toast-success">
          <div className="flex items-center gap-2">
            <CheckCircle size={18} />
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Page Header - Always fixed */}
      <PageHeader
        title={t('nav.schedule')}
        subtitle={showDeptSubtitle ? `${selectedDeptName} - ${selectedCollegeName}` : t('schedule.subtitle')}
      />

      {/* Filter Bar - Only for SUPER_ADMIN and ADMIN - Fixed position below header */}
      {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
        <Card noPadding className="border-none shadow-soft">
          <div className="p-4 flex flex-wrap items-end gap-4">
            
            {/* College */}
            {user?.role === 'SUPER_ADMIN' && (
              <div className="flex flex-col gap-1 min-w-[180px]">
                <label className="label-stat">{t('auth.college')}</label>
                <select
                  value={selectedCollege}
                  onChange={handleCollegeChange}
                  className="w-full h-10 px-4 bg-surface-subtle border-none rounded-xl text-xs font-black uppercase tracking-widest focus:ring-2 focus:ring-brand-primary-500/20 appearance-none cursor-pointer"
                >
                  <option value="">{t('colleges.allColleges')}</option>
                  {colleges.map(c => (
                    <option key={c.id} value={c.id}>{isRTL ? (c.nameAr || c.name) : c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Department */}
            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="label-stat">{t('auth.department')}</label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                disabled={!selectedCollege}
                className="w-full h-10 px-4 bg-surface-subtle border-none rounded-xl text-xs font-black uppercase tracking-widest focus:ring-2 focus:ring-brand-primary-500/20 appearance-none cursor-pointer disabled:opacity-50"
              >
                <option value="">{t('departments.allDepartments')}</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{isRTL ? (d.nameAr || d.name) : d.name}</option>
                ))}
              </select>
            </div>

            {/* Year */}
            <div className="flex flex-col gap-1 min-w-[140px]">
              <label className="label-stat">{t('timetables.academicYear') || 'السنة الدراسية'}</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full h-10 px-4 bg-surface-subtle border-none rounded-xl text-xs font-black uppercase tracking-widest focus:ring-2 focus:ring-brand-primary-500/20 appearance-none cursor-pointer"
              >
                {[1,2,3,4].map(y => (
                  <option key={y} value={y}>{t('timetables.year') || 'السنة'} {y}</option>
                ))}
              </select>
            </div>

            {/* Semester */}
            <div className="flex flex-col gap-1 min-w-[140px]">
              <label className="label-stat">{t('timetables.semesterLabel') || 'الفصل الدراسي'}</label>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(Number(e.target.value))}
                className="w-full h-10 px-4 bg-surface-subtle border-none rounded-xl text-xs font-black uppercase tracking-widest focus:ring-2 focus:ring-brand-primary-500/20 appearance-none cursor-pointer"
              >
                <option value={1}>{t('schedule.semester1') || 'الفصل الأول'}</option>
                <option value={2}>{t('schedule.semester2') || 'الفصل الثاني'}</option>
              </select>
            </div>

          </div>
        </Card>
      )}

      {/* For STUDENT/DOCTOR - Simple semester selector */}
      {(user?.role === 'STUDENT' || user?.role === 'DOCTOR') && (
        <div className="flex items-center gap-3">
          <span className="label-stat">{t('timetables.semesterLabel') || 'الفصل الدراسي'}</span>
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(Number(e.target.value))}
            className="h-10 px-4 bg-surface-subtle border-none rounded-xl text-xs font-black uppercase tracking-widest appearance-none cursor-pointer"
          >
            <option value={1}>{t('schedule.semester1') || 'الفصل الأول'}</option>
            <option value={2}>{t('schedule.semester2') || 'الفصل الثاني'}</option>
          </select>
        </div>
      )}

      {/* Schedule Grid - Always below filters */}
      <Card noPadding className="border-none shadow-soft overflow-hidden">
        {loading ? (
          <SkeletonTable rows={7} />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border-l-0 p-6">
            <div className="h-20 w-20 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center mb-6 border border-rose-200 dark:border-rose-700">
              <AlertCircle size={40} className="text-rose-500" />
            </div>
            <h3 className="text-2xl font-black text-brand-text-main">{error}</h3>
            <button
              onClick={fetchTargetedTimetable}
              className="mt-4 px-6 py-2.5 rounded-xl bg-brand-primary-500 text-white font-black text-xs uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              {t('common.retry', 'Retry')}
            </button>
          </div>
        ) : !timetable || Object.keys(timetable).length === 0 || Object.values(timetable).flat().length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border-l-0 p-6">
            <div className="h-20 w-20 rounded-full bg-brand-yellow/10 flex items-center justify-center mb-6 border border-brand-yellow/20">
              <Calendar size={40} className="text-brand-yellow" />
            </div>
            <h3 className="text-2xl font-black text-brand-text-main">{t('common.noData')}</h3>
            <p className="text-brand-text-sub font-bold mt-2 max-w-md mx-auto">
              {t('timetables.noSlots')}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Day Selector */}
            <div className="flex gap-2 overflow-x-auto pb-4 md:hidden custom-scrollbar p-4">
              {days.map(day => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`flex-shrink-0 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm ${selectedDay === day
                    ? 'bg-brand-primary-500 text-white shadow-brand-primary-500/20'
                    : 'bg-surface-subtle text-brand-text-secondary hover:bg-brand-primary-500/10'
                    }`}
                >
                  {t(`days.${day.toLowerCase()}`) || day.slice(0, 3)}
                </button>
              ))}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block">
              <Card noPadding className="overflow-hidden border-l-0 shadow-soft">
                <div className="overflow-x-auto">
                  <div className="min-w-[1000px]">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-brand-navy/5 border-b border-brand-border">
                          <th className="p-4 w-24 border-r border-brand-border"></th>
                          {days.map(day => (
                            <th key={day} className="p-4 text-xs font-black text-brand-text-main uppercase tracking-widest border-r border-brand-border last:border-r-0">
                              {t(`days.${day.toLowerCase()}`)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-border">
                        {times.map(time => (
                          <tr key={time} className="group">
                            <td className="p-4 text-[10px] font-black text-brand-text-muted text-center bg-brand-navy/[0.02] border-r border-brand-border">
                              {time}
                            </td>
                            {days.map(day => {
                              const entries = getEntriesForTimeSlot(day, time);
                              return (
                                <td key={`${day}-${time}`} className="p-2 border-r border-brand-border last:border-r-0 align-top group-hover:bg-brand-navy/[0.01] transition-colors">
                                  {entries.length > 0 ? (
                                    <div className="space-y-2">
                                      {entries.map((entry, idx) => (
                                        <div key={idx} className="rounded-2xl p-4 border border-brand-border shadow-sm transition-all hover:shadow-lg hover:scale-[1.02] bg-brand-bg-card dark:bg-brand-bg-elevated group/entry">
                                          <div className="flex justify-between items-start mb-2">
                                            <Badge variant="info" className="text-[9px] font-black px-2 py-0.5">
                                              {entry.startTime} - {entry.endTime}
                                            </Badge>
                                          </div>
                                          <p className="text-sm font-black text-brand-text-main leading-tight group-hover/entry:text-brand-green transition-colors">
                                            {isRTL ? (entry.course?.nameAr || entry.course?.name) : entry.course?.name}
                                          </p>
                                          <div className="mt-3 space-y-2">
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-brand-text-sub">
                                              <div className="p-1 bg-brand-navy/5 rounded-md"><MapPin size={10} /></div>
                                              {entry.room || t('common.tba', 'TBA')}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-brand-text-sub">
                                              <div className="p-1 bg-brand-navy/5 rounded-md"><User size={10} /></div>
                                              {entry.course?.doctor ? `${entry.course.doctor.firstName} ${entry.course.doctor.lastName}` : t('common.staff', 'Staff')}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="h-20 rounded-2xl border border-dashed border-brand-border/50 flex items-center justify-center opacity-30 hover:opacity-60 transition-opacity">
                                      <span className="label-stat">{t('common.noData')}</span>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4 p-4">
              <p className="text-[10px] font-black uppercase text-brand-text-muted text-center tracking-widest animate-pulse">
                {t('schedule.swipeHint', 'Swipe to see other days')}
              </p>
              {times.flatMap(time => getEntriesForTimeSlot(selectedDay, time)).length > 0 ? (
                times.flatMap(time => getEntriesForTimeSlot(selectedDay, time)).map((entry, idx) => (
                  <Card key={idx} className="p-5 border-l-4 border-l-brand-primary-500 shadow-soft animate-in slide-in-from-bottom-2 duration-300">
                    <div className="flex justify-between items-start mb-4">
                      <Badge variant="info" className="text-[10px] font-black px-3 py-1">
                        {entry.startTime} - {entry.endTime}
                      </Badge>
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-brand-text-muted bg-surface-subtle px-2 py-1 rounded-lg">
                        <MapPin size={12} className="text-brand-primary-500" />
                        {entry.room || t('common.tba', 'TBA')}
                      </div>
                    </div>

                    <h3 className="text-lg font-black text-brand-text-main leading-tight mb-4">
                      {isRTL ? (entry.course?.nameAr || entry.course?.name) : entry.course?.name}
                    </h3>

                    <div className="pt-4 border-t border-brand-border flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-brand-navy/5 flex items-center justify-center">
                          <User size={14} className="text-brand-navy" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest">{t('courses.instructor')}</span>
                          <span className="text-xs font-bold text-brand-text-main">
                            {entry.course?.doctor ? `${entry.course.doctor.firstName} ${entry.course.doctor.lastName}` : t('common.staff', 'Staff')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <EmptyState
                  icon={<Calendar size={40} />}
                  title={t('common.noData')}
                  subtitle={t('timetables.noSlots')}
                />
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default WeeklySchedule;
