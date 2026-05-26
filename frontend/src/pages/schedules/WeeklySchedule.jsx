import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { Clock, MapPin, User, ChevronLeft, ChevronRight, Loader2, Calendar } from 'lucide-react';
import schedulesService from '../../services/schedules.service';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

const WeeklySchedule = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [timetable, setTimetable] = useState({});
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const times = [
    '08:00', '09:00', '10:00', '11:00', '12:00', 
    '13:00', '14:00', '15:00', '16:00', '17:00'
  ];

  useEffect(() => {
    fetchSchedule();
  }, [selectedYear, selectedSemester]);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (selectedYear) params.year = selectedYear;
      if (selectedSemester) params.semester = selectedSemester;
      
      const result = await schedulesService.getWeeklyTimetable(params);
      if (result.success) {
        setTimetable(result.data);
      } else {
        setError(result.message);
      }
    } catch (err) {
      console.error('Error fetching schedule:', err);
      setError('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getEntriesForTimeSlot = (day, time) => {
    if (!timetable[day]) return [];
    
    return timetable[day].filter(s => {
      const startHour = parseInt(s.startTime.split(':')[0]);
      const currentHour = parseInt(time.split(':')[0]);
      return startHour === currentHour;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('nav.schedule')}</h1>
          <p className="text-slate-500 mt-1">Academic timetable for the current semester.</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            className="px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white text-sm"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            <option value="">All Years</option>
            <option value="1">Year 1</option>
            <option value="2">Year 2</option>
            <option value="3">Year 3</option>
            <option value="4">Year 4</option>
            <option value="5">Year 5</option>
          </select>

          <select
            className="px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white text-sm"
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
          >
            <option value="">All Semesters</option>
            <option value="1">Semester 1</option>
            <option value="2">Semester 2</option>
            <option value="3">Semester 3 (Summer)</option>
          </select>

          <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-1">
            <Calendar size={18} className="text-slate-400 ml-2" />
            <span className="px-4 py-1 text-sm font-semibold text-slate-900">
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100">
          {error}
        </div>
      )}

      <Card noPadding className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 w-32 border-r border-slate-200"></th>
                {days.map(day => (
                  <th key={day} className="p-4 text-sm font-bold text-slate-900 border-r border-slate-200 last:border-r-0">
                    {t(`days.${day.toLowerCase()}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {times.map(time => (
                <tr key={time} className="border-b border-slate-100 last:border-b-0">
                  <td className="p-4 text-xs font-bold text-slate-400 text-center bg-slate-50/50 border-r border-slate-200">
                    {formatTime(time)}
                  </td>
                  {days.map(day => {
                    const entries = getEntriesForTimeSlot(day, time);
                    return (
                      <td key={`${day}-${time}`} className="p-2 min-w-[160px] border-r border-slate-100 last:border-r-0 align-top">
                        {entries.length > 0 ? (
                          <div className="space-y-2">
                            {entries.map((entry, idx) => (
                              <div key={idx} className={`rounded-xl p-3 border-l-4 shadow-sm transition-all hover:shadow-md
                                bg-blue-50 border-blue-500
                              `}>
                                <div className="flex justify-between items-start mb-1">
                                  <Badge variant="neutral" className="bg-white/80 border-transparent text-[10px] py-0">
                                    {entry.startTime} - {entry.endTime}
                                  </Badge>
                                </div>
                                <p className="text-xs font-bold text-slate-900 leading-tight">{entry.course.name}</p>
                                <div className="mt-2 space-y-1">
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                    <MapPin size={10} /> {entry.room || 'TBA'}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                    <User size={10} /> {entry.course.doctor ? `${entry.course.doctor.firstName} ${entry.course.doctor.lastName}` : 'No Doctor'}
                                  </div>
                                  {entry.course.department && (
                                    <div className="text-[9px] text-blue-600 font-medium">
                                      {entry.course.department.name}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="h-16 rounded-xl border border-dashed border-slate-100 group hover:border-slate-200 transition-colors flex items-center justify-center">
                            <span className="text-[10px] text-slate-300 group-hover:text-slate-400 font-medium">No session</span>
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
