import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { 
  Calendar, CheckCircle, Clock, XCircle, BookOpen, AlertCircle, ScanLine, X, History, MapPin
} from 'lucide-react';
import attendanceService from '../../services/attendance.service';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { StudentAttendanceScanner } from '../../components/attendance/StudentAttendanceScanner';

export function StudentAttendanceDashboard() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const dateLocale = isRTL ? ar : enUS;
  
  // Helper to fix missing i18n keys
  const txt = (key: string, fallback: string) => {
    const val = t(key);
    return val === key ? fallback : val;
  };

  const [myCourses, setMyCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [myAttendance, setMyAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    attendanceService.getMyCourses()
      .then(res => {
        setMyCourses(res.data || []);
        if (res.data?.length > 0) setSelectedCourseId(res.data[0].id);
      })
      .catch(() => console.error('Failed to load courses'));
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      setLoading(true);
      attendanceService.getMyAttendance(selectedCourseId)
        .then(res => setMyAttendance(res.data || []))
        .catch(() => console.error('Failed to load attendance records'))
        .finally(() => setLoading(false));
    }
  }, [selectedCourseId]);

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PRESENT': return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 px-4 py-1.5 text-sm font-bold shadow-sm"><CheckCircle className="w-4 h-4 ltr:mr-1.5 rtl:ml-1.5" />{txt('attendance.present', 'حاضر')}</Badge>;
      case 'ABSENT': return <Badge className="bg-rose-100 text-rose-800 border-rose-200 px-4 py-1.5 text-sm font-bold shadow-sm"><XCircle className="w-4 h-4 ltr:mr-1.5 rtl:ml-1.5" />{txt('attendance.absent', 'غائب')}</Badge>;
      case 'LATE': return <Badge className="bg-amber-100 text-amber-800 border-amber-200 px-4 py-1.5 text-sm font-bold shadow-sm"><Clock className="w-4 h-4 ltr:mr-1.5 rtl:ml-1.5" />{txt('attendance.late', 'متأخر')}</Badge>;
      case 'EXCUSED': return <Badge className="bg-blue-100 text-blue-800 border-blue-200 px-4 py-1.5 text-sm font-bold shadow-sm"><AlertCircle className="w-4 h-4 ltr:mr-1.5 rtl:ml-1.5" />{txt('attendance.excused', 'عذر')}</Badge>;
      default: return null;
    }
  };

  const getStats = () => {
    let present = 0, absent = 0, late = 0;
    myAttendance.forEach(a => {
      if (a.status === 'PRESENT') present++;
      if (a.status === 'ABSENT') absent++;
      if (a.status === 'LATE') late++;
    });
    const attendancePercentage = myAttendance.length === 0 ? 0 : Math.round(((present + late) / myAttendance.length) * 100);
    return { present, absent, late, total: myAttendance.length, percentage: attendancePercentage };
  };

  const stats = getStats();
  const selectedCourseName = myCourses.find(c => c.id === selectedCourseId)?.name;

  return (
    <div className="space-y-8 relative pb-28 animate-fade-in max-w-[1400px] mx-auto">
      {/* Scanner Overlay - Full Screen Glassmorphism */}
      {showScanner && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex flex-col pt-10 px-4 pb-4 overflow-y-auto animate-fade-in">
          <div className="max-w-xl w-full mx-auto relative flex-1 flex flex-col">
            <button 
              onClick={() => setShowScanner(false)}
              className="absolute -top-12 ltr:-right-4 rtl:-left-4 text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors z-50 shadow-lg border border-white/20"
            >
              <X className="w-6 h-6" />
            </button>
            <StudentAttendanceScanner onCancel={() => setShowScanner(false)} />
          </div>
        </div>
      )}

      {/* Floating Action Button for Scanning */}
      <div className="fixed bottom-8 ltr:right-8 rtl:left-8 z-40">
        <button 
          onClick={() => setShowScanner(true)}
          className="animate-pulse-gentle bg-brand-primary-600 hover:bg-brand-primary-700 text-white shadow-[0_0_40px_rgba(var(--brand-primary-600),0.5)] hover:shadow-[0_0_60px_rgba(var(--brand-primary-600),0.7)] rounded-full h-16 w-16 md:w-auto md:px-8 flex items-center justify-center gap-3 transition-all transform hover:scale-110 active:scale-95 border-2 border-brand-primary-400/50"
        >
          <ScanLine className="w-7 h-7" />
          <span className="hidden md:inline font-black text-lg tracking-wide uppercase">{txt('attendance.studentScanner', 'تسجيل الحضور الآن')}</span>
        </button>
      </div>

      {/* Premium Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-brand-primary-950 to-slate-900 p-8 text-white shadow-xl border border-slate-800">
        <div className="absolute -end-10 -top-10 w-64 h-64 rounded-full bg-brand-primary-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -start-10 -bottom-10 w-64 h-64 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center justify-between">
          <div className="flex items-center gap-5 w-full md:w-auto">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-primary-400 to-brand-primary-600 flex items-center justify-center shadow-lg ring-4 ring-white/10 shrink-0">
              <ScanLine className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black mb-1">
                {txt('attendance.studentDashboard', 'بوابة الحضور والانصراف')}
              </h1>
              <p className="text-brand-primary-200 font-medium opacity-80 text-sm md:text-base">
                {isRTL ? 'امسح الرمز الخاص بالمحاضرة لتسجيل حضورك فوراً' : 'Scan the lecture QR code to record your attendance instantly'}
              </p>
            </div>
          </div>
          
          <div className="w-full md:w-auto bg-white/10 backdrop-blur-md border border-white/20 p-1.5 rounded-2xl shadow-inner">
            <select
              value={selectedCourseId ?? ''}
              onChange={e => setSelectedCourseId(Number(e.target.value) || null)}
              className="h-12 px-5 bg-slate-900/50 text-white border-0 rounded-xl text-base font-bold w-full md:w-72 focus:ring-2 focus:ring-brand-primary-400 outline-none appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em' }}
            >
              {myCourses.map(c => (
                <option key={c.id} value={c.id} className="text-slate-900">{c.courseCode} - {c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedCourseId ? (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            
            <Card className="col-span-2 lg:col-span-1 bg-gradient-to-br from-brand-primary-500 to-brand-primary-700 rounded-3xl border-0 shadow-lg p-6 flex flex-col justify-center text-white relative overflow-hidden">
              <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
                <Calendar size={100} />
              </div>
              <span className="text-brand-primary-100 font-bold mb-1">{txt('attendance.attendanceRate', 'نسبة الحضور')}</span>
              <div className="flex items-end gap-1">
                <span className="text-5xl font-black">{stats.percentage}</span>
                <span className="text-2xl font-bold mb-1">%</span>
              </div>
            </Card>

            <Card className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex flex-col justify-center gap-1 hover:border-brand-primary-500/30 transition-colors group">
              <div className="rounded-xl w-12 h-12 flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 mb-3 group-hover:scale-110 transition-transform"><BookOpen size={24}/></div>
              <span className="text-sm text-slate-500 font-bold uppercase tracking-wider">{txt('attendance.heldSessions', 'إجمالي المحاضرات')}</span>
              <span className="text-3xl font-black text-slate-800 dark:text-white">{stats.total}</span>
            </Card>

            <Card className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex flex-col justify-center gap-1 hover:border-emerald-500/30 transition-colors group">
              <div className="rounded-xl w-12 h-12 flex items-center justify-center bg-emerald-100 text-emerald-600 mb-3 group-hover:scale-110 transition-transform"><CheckCircle size={24}/></div>
              <span className="text-sm text-slate-500 font-bold uppercase tracking-wider">{txt('attendance.present', 'حاضر')}</span>
              <span className="text-3xl font-black text-slate-800 dark:text-white">{stats.present}</span>
            </Card>

            <Card className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex flex-col justify-center gap-1 hover:border-amber-500/30 transition-colors group">
              <div className="rounded-xl w-12 h-12 flex items-center justify-center bg-amber-100 text-amber-600 mb-3 group-hover:scale-110 transition-transform"><Clock size={24}/></div>
              <span className="text-sm text-slate-500 font-bold uppercase tracking-wider">{txt('attendance.late', 'متأخر')}</span>
              <span className="text-3xl font-black text-slate-800 dark:text-white">{stats.late}</span>
            </Card>

            <Card className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex flex-col justify-center gap-1 hover:border-rose-500/30 transition-colors group">
              <div className="rounded-xl w-12 h-12 flex items-center justify-center bg-rose-100 text-rose-600 mb-3 group-hover:scale-110 transition-transform"><XCircle size={24}/></div>
              <span className="text-sm text-slate-500 font-bold uppercase tracking-wider">{txt('attendance.absent', 'غائب')}</span>
              <span className="text-3xl font-black text-slate-800 dark:text-white">{stats.absent}</span>
            </Card>
          </div>

          <Card className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-slate-700 px-8 py-6 bg-slate-50/50 dark:bg-slate-900/50 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-primary-500/10 text-brand-primary-600 rounded-lg">
                  <History size={20} />
                </div>
                <CardTitle className="text-xl font-bold">{txt('attendance.history', 'سجل الحضور التفصيلي')}</CardTitle>
              </div>
              <Badge className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 font-bold text-slate-700 py-1.5">{selectedCourseName}</Badge>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-20 text-center text-slate-400 font-medium">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
              ) : myAttendance.length === 0 ? (
                <div className="py-20">
                  <EmptyState icon={<Calendar size={64} className="text-slate-300" />} title={txt('attendance.noRecords', 'لا توجد سجلات حضور حتى الآن')} subtitle={null} />
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {myAttendance.map((record, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-6 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-slate-500 shrink-0">
                          <Calendar size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-white text-base mb-1">
                            {format(new Date(record.date), 'EEEE, dd MMMM yyyy', { locale: dateLocale })}
                          </p>
                          <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
                            {record.remarks && (
                              <span className="flex items-center gap-1"><AlertCircle size={14}/> {record.remarks}</span>
                            )}
                            <span className="flex items-center gap-1 text-slate-400"><MapPin size={14}/> {isRTL ? 'تم التسجيل داخل الحرم الجامعي' : 'Recorded on campus'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="sm:text-end shrink-0">
                        {renderStatusBadge(record.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="py-24 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <EmptyState icon={<BookOpen size={64} className="text-slate-300" />} title={txt('attendance.selectCourse', 'الرجاء اختيار مقرر من القائمة الجانبية لعرض السجل التفصيلي')} subtitle={null} />
        </div>
      )}
    </div>
  );
}
