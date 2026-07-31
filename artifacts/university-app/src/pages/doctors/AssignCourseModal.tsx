import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { X, BookOpen, Clock, Calendar, MapPin, Loader2 } from 'lucide-react';
import Button from '../../components/ui/button';
import api from '../../services/api';

interface AssignCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctor: any;
  onSuccess: () => void;
}

export default function AssignCourseModal({ isOpen, onClose, doctor, onSuccess }: AssignCourseModalProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingCourses, setFetchingCourses] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    courseId: '',
    dayOfWeek: 'SUNDAY',
    startTime: '08:00',
    endTime: '10:00',
    room: '',
    slotType: 'LECTURE'
  });

  useEffect(() => {
    if (isOpen) {
      fetchCourses();
    }
  }, [isOpen]);

  const fetchCourses = async () => {
    try {
      setFetchingCourses(true);
      // Fetch all courses in the doctor's department, or all courses if admin
      const res = await api.get('/courses', { params: { departmentId: doctor.departmentId } });
      setCourses(res.data?.data?.courses || []);
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingCourses(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.courseId) {
      setError(isRTL ? 'الرجاء اختيار المقرر' : 'Please select a course');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      await api.post('/schedules', {
        ...formData,
        doctorId: doctor.id
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || (isRTL ? 'فشل في تعيين المقرر' : 'Failed to assign course'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-scale-up">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-primary-50 text-brand-primary-600 flex items-center justify-center">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                {isRTL ? 'تعيين مقرر جديد' : 'Assign New Course'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {doctor.firstName} {doctor.lastName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-sm font-bold">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isRTL ? 'المقرر الدراسي' : 'Course'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <BookOpen size={18} className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-slate-400`} />
                <select
                  required
                  value={formData.courseId}
                  onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                  className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-primary-500 focus:border-brand-primary-500 transition-all font-medium appearance-none`}
                >
                  <option value="">{fetchingCourses ? (isRTL ? 'جاري التحميل...' : 'Loading...') : (isRTL ? 'اختر المقرر...' : 'Select course...')}</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.name} ({course.courseCode})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isRTL ? 'يوم المحاضرة' : 'Day of Week'} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar size={18} className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-slate-400`} />
                  <select
                    required
                    value={formData.dayOfWeek}
                    onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value })}
                    className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-primary-500 transition-all font-medium appearance-none`}
                  >
                    <option value="SUNDAY">{isRTL ? 'الأحد' : 'Sunday'}</option>
                    <option value="MONDAY">{isRTL ? 'الإثنين' : 'Monday'}</option>
                    <option value="TUESDAY">{isRTL ? 'الثلاثاء' : 'Tuesday'}</option>
                    <option value="WEDNESDAY">{isRTL ? 'الأربعاء' : 'Wednesday'}</option>
                    <option value="THURSDAY">{isRTL ? 'الخميس' : 'Thursday'}</option>
                    <option value="FRIDAY">{isRTL ? 'الجمعة' : 'Friday'}</option>
                    <option value="SATURDAY">{isRTL ? 'السبت' : 'Saturday'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isRTL ? 'القاعة' : 'Room'}
                </label>
                <div className="relative">
                  <MapPin size={18} className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-slate-400`} />
                  <input
                    type="text"
                    placeholder="e.g. Hall A"
                    value={formData.room}
                    onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                    className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-primary-500 transition-all font-medium`}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isRTL ? 'وقت البدء' : 'Start Time'} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Clock size={18} className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-slate-400`} />
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-primary-500 transition-all font-medium font-mono`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isRTL ? 'وقت الانتهاء' : 'End Time'} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Clock size={18} className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-slate-400`} />
                  <input
                    type="time"
                    required
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-primary-500 transition-all font-medium font-mono`}
                  />
                </div>
              </div>
            </div>

          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-700 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="px-6 rounded-xl font-bold"
            >
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="px-6 bg-brand-primary-500 hover:bg-brand-primary-600 text-white rounded-xl font-bold flex items-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isRTL ? 'حفظ وتعيين' : 'Assign Course'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
