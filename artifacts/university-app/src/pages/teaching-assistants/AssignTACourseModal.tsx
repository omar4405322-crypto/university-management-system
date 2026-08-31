import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import {
  X,
  BookOpen,
  Calendar,
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Building2,
  Search,
} from 'lucide-react';
import Button from '../../components/ui/button';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface AssignTACourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  ta: any;
  onSuccess: () => void;
  preselectedCourseId?: string | number;
}

export default function AssignTACourseModal({
  isOpen,
  onClose,
  ta,
  onSuccess,
  preselectedCourseId,
}: AssignTACourseModalProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { showToast } = useToast();

  const [courses, setCourses] = useState<any[]>([]);
  const [fetchingCourses, setFetchingCourses] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [courseSearch, setCourseSearch] = useState('');

  const [dayOfWeek, setDayOfWeek] = useState('MONDAY');
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('14:00');
  const [room, setRoom] = useState('Lab 1');
  const [slotType, setSlotType] = useState<'TUTORIAL' | 'LAB'>('TUTORIAL');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCourses();
      if (preselectedCourseId) {
        setSelectedCourseId(String(preselectedCourseId));
      } else {
        setSelectedCourseId('');
      }
      setError(null);
    }
  }, [isOpen, preselectedCourseId]);

  const fetchCourses = async () => {
    try {
      setFetchingCourses(true);
      const res = await api.get('/courses', { params: { limit: 300 } });
      const list = res.data?.data?.courses || res.data?.data || [];
      setCourses(list);
    } catch (err: any) {
      console.error('Failed to fetch courses:', err);
      setError(isRTL ? 'تعذر جلب قائمة المقررات' : 'Failed to load courses');
    } finally {
      setFetchingCourses(false);
    }
  };

  const filteredCourses = courses.filter((c) => {
    if (!courseSearch.trim()) return true;
    const q = courseSearch.toLowerCase();
    const name = (c.name || '').toLowerCase();
    const code = (c.courseCode || '').toLowerCase();
    const dept = (c.department?.name || c.department?.nameAr || '').toLowerCase();
    const col = (c.department?.college?.name || c.department?.college?.nameAr || '').toLowerCase();
    return name.includes(q) || code.includes(q) || dept.includes(q) || col.includes(q);
  });

  const selectedCourse = courses.find((c) => String(c.id) === selectedCourseId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) {
      setError(isRTL ? 'يرجى اختيار المقرر الدراسي' : 'Please select a course');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await api.post(`/teaching-assistants/${ta.id}/assign-course`, {
        courseId: Number(selectedCourseId),
        dayOfWeek,
        startTime,
        endTime,
        room: room || 'Lab 1',
        slotType,
      });

      showToast(
        isRTL
          ? `تم إسناد مقرر (${selectedCourse?.name || ''}) بنجاح للمُعيد`
          : `Successfully assigned ${selectedCourse?.name || 'course'} to teaching assistant`,
        'success'
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error assigning course to TA:', err);
      const msg = err.response?.data?.message || (isRTL ? 'فشل إسناد المقرر' : 'Failed to assign course');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400 flex items-center justify-center font-bold">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                {isRTL ? 'إسناد مقرر وموعد معمل/سكشن' : 'Assign Course & Lab/Tutorial Slot'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isRTL ? 'للمعيد:' : 'For TA:'} م. {ta?.firstName || ''} {ta?.lastName || ta?.employeeId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-start">
          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-2xl border border-rose-200 dark:border-rose-800/60 text-xs font-bold flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Course Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              {isRTL ? 'المقرر الدراسي' : 'Course'} <span className="text-rose-500">*</span>
            </label>

            {courses.length > 8 && (
              <div className="relative">
                <Search size={14} className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-slate-400`} />
                <input
                  type="text"
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  placeholder={isRTL ? 'ابحث عن المقرر، القسم، أو الكلية...' : 'Search course, dept, or college...'}
                  className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 ${
                    isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'
                  } text-xs text-slate-900 dark:text-white font-medium`}
                />
              </div>
            )}

            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              disabled={fetchingCourses}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-brand-primary-500 transition-all"
            >
              <option value="">{fetchingCourses ? (isRTL ? 'جاري التحميل...' : 'Loading...') : (isRTL ? '-- اختر المقرر الدراسي --' : '-- Select Course --')}</option>
              {filteredCourses.map((c) => {
                const deptName = isRTL ? c.department?.nameAr || c.department?.name : c.department?.name || c.department?.nameAr;
                const colName = isRTL ? c.department?.college?.nameAr || c.department?.college?.name : c.department?.college?.name || c.department?.college?.nameAr;
                const deptStr = deptName ? ` [${deptName}${colName ? ` - ${colName}` : ''}]` : '';
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.courseCode}) - {isRTL ? `الفرقة ${c.year}` : `Division ${c.year}`}{deptStr}
                  </option>
                );
              })}
            </select>

            {selectedCourse && (
              <div className="p-3 bg-brand-primary-50 dark:bg-brand-primary-950/30 rounded-xl border border-brand-primary-200 dark:border-brand-primary-800/50 flex items-center justify-between text-[11px] text-brand-primary-700 dark:text-brand-primary-300">
                <span className="font-semibold">{selectedCourse.name}</span>
                <span className="font-bold flex items-center gap-1">
                  <Building2 size={12} />
                  {selectedCourse.department?.name || selectedCourse.department?.nameAr || 'General'}
                </span>
              </div>
            )}
          </div>

          {/* Slot Type */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isRTL ? 'نوع الحصة المسندة' : 'Slot Type'}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSlotType('TUTORIAL')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  slotType === 'TUTORIAL'
                    ? 'bg-brand-primary-500 text-white border-brand-primary-500 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {isRTL ? 'سكشن (تمارين)' : 'Tutorial (Section)'}
              </button>
              <button
                type="button"
                onClick={() => setSlotType('LAB')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  slotType === 'LAB'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {isRTL ? 'معمل (عملي)' : 'Lab / Practical'}
              </button>
            </div>
          </div>

          {/* Timetable Configuration */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 space-y-3">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              {isRTL ? 'موعد الحصة في الجدول الأسبوعي' : 'Weekly Schedule Slot'}
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {isRTL ? 'اليوم' : 'Day of Week'}
                </label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-medium"
                >
                  <option value="SATURDAY">{isRTL ? 'السبت' : 'Saturday'}</option>
                  <option value="SUNDAY">{isRTL ? 'الأحد' : 'Sunday'}</option>
                  <option value="MONDAY">{isRTL ? 'الإثنين' : 'Monday'}</option>
                  <option value="TUESDAY">{isRTL ? 'الثلاثاء' : 'Tuesday'}</option>
                  <option value="WEDNESDAY">{isRTL ? 'الأربعاء' : 'Wednesday'}</option>
                  <option value="THURSDAY">{isRTL ? 'الخميس' : 'Thursday'}</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {isRTL ? 'المعمل / القاعة' : 'Lab / Room'}
                </label>
                <input
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="e.g. Lab 2, Computer Lab A"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {isRTL ? 'وقت البدء' : 'Start Time'}
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {isRTL ? 'وقت الانتهاء' : 'End Time'}
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-medium"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs font-bold rounded-xl px-4 py-2"
            >
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              disabled={loading || fetchingCourses}
              className="bg-brand-primary-500 hover:bg-brand-primary-600 text-white text-xs font-bold rounded-xl px-5 py-2 flex items-center gap-2 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>{isRTL ? 'جاري الإسناد والتحقق...' : 'Assigning & Verifying...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  <span>{isRTL ? 'تأكيد إسناد المقرر' : 'Confirm Assignment'}</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
