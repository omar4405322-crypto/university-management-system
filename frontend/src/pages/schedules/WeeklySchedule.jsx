import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { 
  Clock, 
  MapPin, 
  User, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Calendar,
  AlertCircle,
  FileText,
  Building2,
  GraduationCap
} from 'lucide-react';
import timetableService from '../../services/timetable.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/ui/PageHeader';

const WeeklySchedule = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [timetable, setTimetable] = useState(null);
  const [error, setError] = useState(null);

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const times = [
    '08:00', '09:00', '10:00', '11:00', '12:00', 
    '13:00', '14:00', '15:00', '16:00', '17:00'
  ];

  useEffect(() => {
    fetchTargetedTimetable();
  }, []);

  const fetchTargetedTimetable = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await timetableService.getTimetables();
      if (result.success && result.data.length > 0) {
        setTimetable(result.data[0]);
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

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? (t('common.pm') || 'PM') : (t('common.am') || 'AM');
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getEntriesForTimeSlot = (day, time) => {
    if (!timetable || !timetable.scheduleData || !timetable.scheduleData.slots) return [];
    
    return timetable.scheduleData.slots.filter(s => {
      if (s.day !== day) return false;
      const startHour = parseInt(s.startTime.split(':')[0]);
      const currentHour = parseInt(time.split(':')[0]);
      return startHour === currentHour;
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="animate-spin text-brand-green" size={48} />
        <p className="text-sm font-black text-brand-text-sub uppercase tracking-widest">{t('common.loading')}</p>
      </div>
    );
  }

  if (!timetable) {
    return (
      <div className="space-y-6 animate-in fade-in duration-700">
        <PageHeader title={t('timetables.title')} subtitle={t('timetables.subtitle')} />

        <Card className="flex flex-col items-center justify-center py-20 text-center border-l-0">
          <div className="h-20 w-20 rounded-full bg-brand-yellow/10 flex items-center justify-center mb-6 border border-brand-yellow/20">
            <Calendar size={40} className="text-brand-yellow" />
          </div>
          <h3 className="text-2xl font-black text-brand-text-main">{t('common.noData')}</h3>
          <p className="text-brand-text-sub font-bold mt-2 max-w-md mx-auto">
            {t('timetables.noSlots')}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="section-gap animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-2">
          {/* Use department name as the primary title if available */}
          <h1 className="text-3xl font-black text-brand-text-main tracking-tight">
            {timetable.department?.name} - {t('timetables.title')}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="info" className="font-black uppercase tracking-widest">{t('auth.year')} {timetable.academicYear}</Badge>
            <Badge variant="neutral" className="font-black uppercase tracking-widest">{t('timetables.semester')} {timetable.semester}</Badge>
            <span className="text-brand-text-muted hidden md:inline">•</span>
            <div className="flex items-center gap-1.5 text-xs font-bold text-brand-text-sub">
              <Building2 size={14} /> {timetable.college?.name}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 p-4 bg-brand-navy text-white rounded-2xl shadow-xl">
          <Calendar size={24} className="text-brand-green" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-brand-gray/60">{t('common.today')}</p>
            <p className="text-sm font-black">{new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
      </div>

      <Card noPadding className="overflow-hidden border-l-0 shadow-soft">
        <div className="overflow-x-auto">
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
                    {formatTime(time)}
                  </td>
                  {days.map(day => {
                    const entries = getEntriesForTimeSlot(day, time);
                    return (
                      <td key={`${day}-${time}`} className="p-2 min-w-[180px] border-r border-brand-border last:border-r-0 align-top group-hover:bg-brand-navy/[0.01] transition-colors">
                        {entries.length > 0 ? (
                          <div className="space-y-2">
                            {entries.map((entry, idx) => (
                              <div key={idx} className="rounded-2xl p-4 border border-brand-border shadow-sm transition-all hover:shadow-lg hover:scale-[1.02] bg-white group/entry">
                                <div className="flex justify-between items-start mb-2">
                                  <Badge variant="info" className="text-[9px] font-black px-2 py-0.5">
                                    {entry.startTime} - {entry.endTime}
                                  </Badge>
                                </div>
                                <p className="text-sm font-black text-brand-text-main leading-tight group-hover/entry:text-brand-green transition-colors">{entry.courseName}</p>
                                <div className="mt-3 space-y-2">
                                  <div className="flex items-center gap-2 text-[10px] font-bold text-brand-text-sub">
                                    <div className="p-1 bg-brand-navy/5 rounded-md"><MapPin size={10} /></div>
                                    {entry.room || 'TBA'}
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] font-bold text-brand-text-sub">
                                    <div className="p-1 bg-brand-navy/5 rounded-md"><User size={10} /></div>
                                    {entry.instructor || 'Staff'}
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
      </Card>
    </div>
  );
};

export default WeeklySchedule;
