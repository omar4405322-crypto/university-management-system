import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { X, BookOpen, Clock, Calendar, MapPin, Loader2, Award, ShieldCheck } from 'lucide-react';
import Button from '../../components/ui/button';
import api from '../../services/api';

interface AssignCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctor: any;
  preselectedCourseId?: string | number;
  onSuccess: () => void;
}

export default function AssignCourseModal({
  isOpen,
  onClose,
  doctor,
  preselectedCourseId,
  onSuccess
}: AssignCourseModalProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingCourses, setFetchingCourses] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [assignMode, setAssignMode] = useState<'FULL_COURSE' | 'CUSTOM_SLOT'>('FULL_COURSE');

  const [formData, setFormData] = useState({
    courseId: preselectedCourseId ? String(preselectedCourseId) : '',
    dayOfWeek: 'SUNDAY',
    startTime: '08:00',
    endTime: '10:00',
    room: 'Main Hall',
    slotType: 'LECTURE'
  });

  useEffect(() => {
    if (isOpen) {
      fetchCourses();
      if (preselectedCourseId) {
        setFormData(prev => ({ ...prev, courseId: String(preselectedCourseId) }));
      }
    }
  }, [isOpen, doctor?.departmentId, preselectedCourseId]);

  const fetchCourses = async () => {
    try {
      setFetchingCourses(true);
      setError(null);
      // 1. First attempt: Fetch courses in the doctor's department with high limit
      const params: any = { limit: 100 };
      if (doctor?.departmentId) {
        params.departmentId = doctor.departmentId;
      }
      let res = await api.get('/courses', { params });
      let list = res.data?.data?.courses || [];

      // 2. Fallback: If no courses found for specific department, fetch university-wide courses
      if (list.length === 0) {
        res = await api.get('/courses', { params: { limit: 100 } });
        list = res.data?.data?.courses || [];
      }

      setCourses(list);
    } catch (err: any) {
      console.error('Failed to fetch courses for assignment:', err);
      setError(isRTL ? 'تعذر جلب قائمة المقررات الدراسية' : 'Failed to load courses list');
    } finally {
      setFetchingCourses(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.courseId) {
      setError(isRTL ? 'الرجاء اختيار المقرر الدراسي' : 'Please select a course');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Call the dedicated assign doctor course endpoint
      await api.post(`/doctors/${doctor.id}/assign-course`, {
        courseId: parseInt(formData.courseId, 10),
        dayOfWeek: formData.dayOfWeek,
        startTime: formData.startTime,
        endTime: formData.endTime,
        room: formData.room || 'Main Hall',
      });

      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || (isRTL ? 'فشل في إسناد المقرر للدكتور' : 'Failed to assign course to professor'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedCourse = courses.find(c => String(c.id) === String(formData.courseId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-scale-up border border-slate-200 dark:border-slate-700">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400 flex items-center justify-center shadow-inner">
              <Award size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                {isRTL ? 'إسناد مقرر دراسي للدكتور' : 'Assign Course to Professor'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isRTL ? 'تعيين الدكتور مسؤولاً وأستاذاً للمقرر الدراسي' : 'Make doctor the lead instructor in charge of this course'}
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

        {/* Doctor Info Subheader */}
        <div className="bg-slate-50 dark:bg-slate-900/40 px-6 py-3 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">
            {isRTL ? 'عضو هيئة التدريس:' : 'Faculty Member:'}
          </span>
          <span className="font-bold text-slate-900 dark:text-white">
            د. {doctor.firstName} {doctor.lastName}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-2xl border border-red-200 dark:border-red-800 text-sm font-bold">
              {error}
            </div>
          )}

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl">
            <button
              type="button"
              onClick={() => setAssignMode('FULL_COURSE')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                assignMode === 'FULL_COURSE'
                  ? 'bg-white dark:bg-slate-800 text-brand-primary-600 dark:text-brand-primary-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Award size={15} />
              <span>{isRTL ? 'إسناد المقرر بالكامل' : 'Full Course Lead'}</span>
            </button>
            <button
              type="button"
              onClick={() => setAssignMode('CUSTOM_SLOT')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                assignMode === 'CUSTOM_SLOT'
                  ? 'bg-white dark:bg-slate-800 text-brand-primary-600 dark:text-brand-primary-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Clock size={15} />
              <span>{isRTL ? 'تحديد موعد مخصص' : 'Custom Slot Time'}</span>
            </button>
          </div>

          <div className="space-y-4">
            {/* Course Select */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isRTL ? 'اختر المقرر الدراسي' : 'Select Course'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <BookOpen size={18} className={`absolute top-3.5 ${isRTL ? 'right-3' : 'left-3'} text-slate-400`} />
                <select
                  required
                  value={formData.courseId}
                  onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                  className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-3 ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-primary-500 focus:border-brand-primary-500 transition-all font-medium appearance-none`}
                >
                  <option value="">{fetchingCourses ? (isRTL ? 'جاري التحميل...' : 'Loading...') : (isRTL ? 'اختر المقرر الدراسي المطلوب...' : 'Select a course...')}</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.name} ({course.courseCode}) - {isRTL ? 'الفرقة' : 'Year'} {course.year} {course.department?.name ? `[${course.department.name}]` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedCourse && (
              <div className="p-3.5 bg-brand-primary-500/5 dark:bg-brand-primary-950/30 rounded-2xl border border-brand-primary-500/20 text-xs space-y-1">
                <div className="font-bold text-brand-primary-700 dark:text-brand-primary-300 flex items-center gap-1.5">
                  <ShieldCheck size={15} />
                  <span>{selectedCourse.name} ({selectedCourse.courseCode})</span>
                </div>
                <div className="text-slate-500 dark:text-slate-400 flex items-center gap-3 flex-wrap pt-1">
                  <span>{isRTL ? 'الفرقة:' : 'Year:'} {selectedCourse.year}</span>
                  <span>•</span>
                  <span>{isRTL ? 'الساعات المعتمدة:' : 'Credits:'} {selectedCourse.credits || 3}</span>
                  {selectedCourse.department?.name && (
                    <>
                      <span>•</span>
                      <span>{selectedCourse.department.name}</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Custom Slot / Schedule Details */}
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isRTL ? 'يوم المحاضرة' : 'Lecture Day'} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar size={16} className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-slate-400`} />
                    <select
                      required
                      value={formData.dayOfWeek}
                      onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value })}
                      className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} text-xs text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-primary-500 font-medium appearance-none`}
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
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isRTL ? 'القاعة / المدرج' : 'Hall / Room'}
                  </label>
                  <div className="relative">
                    <MapPin size={16} className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-slate-400`} />
                    <input
                      type="text"
                      placeholder="e.g. Main Hall"
                      value={formData.room}
                      onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                      className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} text-xs text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-primary-500 font-medium`}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isRTL ? 'وقت البدء' : 'Start Time'} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Clock size={16} className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-slate-400`} />
                    <input
                      type="time"
                      required
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} text-xs text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-primary-500 font-medium font-mono`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isRTL ? 'وقت الانتهاء' : 'End Time'} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Clock size={16} className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-slate-400`} />
                    <input
                      type="time"
                      required
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} text-xs text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-primary-500 font-medium font-mono`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
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
              className="px-6 bg-brand-primary-500 hover:bg-brand-primary-600 text-white rounded-xl font-bold flex items-center gap-2 shadow-md shadow-brand-primary-500/20"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isRTL ? 'إسناد المقرر وتثبيته' : 'Assign & Confirm Course'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
