import React, { useState, useEffect, useMemo } from 'react';
import { BookPlus, Search, AlertCircle, Loader2, Check, BookOpen, Calendar, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/button';
import coursesService from '../../services/courses.service';
import enrollmentService from '../../services/enrollment.service';
import { useToast } from '../../context/ToastContext';
import { logger } from '../../lib/logger';

interface CourseItem {
  id: number;
  courseCode: string;
  name: string;
  credits?: number;
  year?: number;
  semester?: number;
  departmentId?: number;
  department?: { id: number; name: string };
}

interface EnrollCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: number;
  studentName: string;
  studentCode: string;
  departmentId?: number;
  alreadyEnrolledCourseIds: number[];
  onSuccess: () => void;
}

const EnrollCourseModal: React.FC<EnrollCourseModalProps> = ({
  isOpen,
  onClose,
  studentId,
  studentName,
  studentCode,
  departmentId,
  alreadyEnrolledCourseIds,
  onSuccess,
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { showToast } = useToast();

  const currentAcademicYear = new Date().getFullYear();

  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchAvailableCourses();
      setSelectedCourseId(null);
      setSelectedSemester(1);
      setSearchQuery('');
      setErrorMessage(null);
    }
  }, [isOpen]);

  const fetchAvailableCourses = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await coursesService.getCourses({ limit: 150 });
      if (res.success) {
        const rawData = Array.isArray(res.data)
          ? res.data
          : (res.data as any)?.courses || (res.data as any)?.data || [];
        setCourses(rawData);
      } else {
        setCourses([]);
      }
    } catch (err: any) {
      logger.error('Error fetching courses for enrollment:', err);
      setErrorMessage(
        err.response?.data?.message ||
          (isRTL ? 'تعذر جلب قائمة المقررات الدراسية' : 'Failed to fetch course catalog')
      );
    } finally {
      setLoading(false);
    }
  };

  const enrolledSet = useMemo(() => new Set(alreadyEnrolledCourseIds), [alreadyEnrolledCourseIds]);

  const eligibleCourses = useMemo(() => {
    return courses.filter((c) => !enrolledSet.has(c.id));
  }, [courses, enrolledSet]);

  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) return eligibleCourses;
    const query = searchQuery.toLowerCase().trim();
    return eligibleCourses.filter((c) => {
      const name = (c.name || '').toLowerCase();
      const code = (c.courseCode || '').toLowerCase();
      return name.includes(query) || code.includes(query);
    });
  }, [eligibleCourses, searchQuery]);

  const selectedCourse = useMemo(() => {
    return courses.find((c) => c.id === selectedCourseId);
  }, [courses, selectedCourseId]);

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) {
      setErrorMessage(isRTL ? 'يرجى اختيار مقرر للتسجيل' : 'Please select a course to enroll');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const res = await enrollmentService.enrollStudent({
        studentId,
        courseId: selectedCourseId,
        semester: selectedSemester,
        academicYear: currentAcademicYear,
      });

      if (res.success) {
        showToast(
          t('students.enrollSuccess', 'تم تسجيل الطالب في المقرر بنجاح'),
          'success'
        );
        onSuccess();
        onClose();
      } else {
        setErrorMessage(
          res.message || (isRTL ? 'فشل تسجيل المقرر' : 'Failed to enroll course')
        );
      }
    } catch (err: any) {
      logger.error('Error enrolling course for student:', err);
      const backendMessage =
        err.response?.data?.message ||
        err.message ||
        (isRTL ? 'حدث خطأ أثناء تسجيل المقرر' : 'An error occurred during enrollment');
      setErrorMessage(backendMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('students.enrollCourse', 'تسجيل مقرر')}
      subtitle={`${studentName} (${studentCode})`}
      size="lg"
    >
      <form onSubmit={handleEnroll} className="space-y-5">
        {/* Inline Error Alert Banner */}
        {errorMessage && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-2xl flex items-center gap-3 animate-in fade-in zoom-in-95">
            <AlertCircle size={18} className="shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Configuration Row: Academic Year (Read-Only) & Semester Dropdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700">
          {/* Academic Year (Calendar) - Computed & Read-Only */}
          <div className="space-y-1.5 text-start">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Calendar size={14} className="text-brand-primary-500" />
              <span>{t('students.academicYearLabel', 'العام الأكاديمي (التقويم)')}</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={currentAcademicYear}
                readOnly
                disabled
                className="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-sm font-mono font-bold text-slate-700 dark:text-slate-200 cursor-not-allowed opacity-90 select-none"
              />
              <span className="absolute end-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {isRTL ? 'تلقائي' : 'Auto'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {isRTL ? 'يتم تحديد العام الحالي تلقائياً بالنظام' : 'Auto-computed as current calendar year'}
            </p>
          </div>

          {/* Semester Selector */}
          <div className="space-y-1.5 text-start">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Layers size={14} className="text-brand-primary-500" />
              <span>{t('students.semesterLabel', 'الفصل الدراسي')}</span>
            </label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(parseInt(e.target.value, 10))}
              className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all cursor-pointer"
            >
              <option value={1}>{t('students.semester1', 'الفصل الدراسي الأول')}</option>
              <option value={2}>{t('students.semester2', 'الفصل الدراسي الثاني')}</option>
              <option value={3}>{t('students.semester3', 'الفصل الدراسي الصيفي')}</option>
            </select>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {isRTL ? 'حدد الفصل الدراسي لتسجيل المقرر' : 'Select target semester for enrollment'}
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          <input
            type="text"
            placeholder={t('students.searchCoursesPlaceholder', 'ابحث باسم أو كود المقرر...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full ps-10 pe-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all font-medium text-start"
          />
        </div>

        {/* Selected Course Confirmation Pill */}
        {selectedCourse && (
          <div className="p-3 bg-brand-primary-50/70 dark:bg-brand-primary-950/30 border border-brand-primary-200 dark:border-brand-primary-800/50 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-brand-primary-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                <Check size={16} />
              </div>
              <div className="text-start min-w-0">
                <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                  {selectedCourse.name}
                </p>
                <p className="text-[11px] font-mono text-brand-primary-700 dark:text-brand-primary-400">
                  {selectedCourse.courseCode} {selectedCourse.credits ? `• ${selectedCourse.credits} ${isRTL ? 'ساعات' : 'credits'}` : ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCourseId(null)}
              className="text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors cursor-pointer px-2 py-1 shrink-0"
            >
              {isRTL ? 'إلغاء التحديد' : 'Deselect'}
            </button>
          </div>
        )}

        {/* Courses List Container */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-800 max-h-[260px] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="animate-spin text-brand-primary-500" size={32} />
              <p className="text-xs font-bold text-slate-400">
                {isRTL ? 'جاري تحميل قائمة المقررات...' : 'Loading course list...'}
              </p>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="text-center py-12 px-4 text-slate-400">
              <BookOpen size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs font-bold">
                {searchQuery
                  ? (isRTL ? 'لا توجد مقررات مطابقة لمعايير البحث' : 'No courses match your search')
                  : t('students.alreadyEnrolled', 'الطالب مسجل بالفعل في كافة المقررات المتاحة')}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {filteredCourses.map((course) => {
                const isSelected = selectedCourseId === course.id;
                return (
                  <div
                    key={course.id}
                    onClick={() => {
                      setSelectedCourseId(course.id);
                      setErrorMessage(null);
                    }}
                    className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-brand-primary-50/80 dark:bg-brand-primary-950/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-brand-primary-500 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <BookOpen size={16} />
                      </div>
                      <div className="text-start min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {course.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-mono font-bold text-brand-primary-600 dark:text-brand-primary-400">
                            {course.courseCode}
                          </span>
                          {course.credits && (
                            <>
                              <span>•</span>
                              <span>{course.credits} {isRTL ? 'ساعات معتمدة' : 'Credits'}</span>
                            </>
                          )}
                          {course.department?.name && (
                            <>
                              <span>•</span>
                              <span className="truncate">{course.department.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 ms-2">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected
                            ? 'border-brand-primary-500 bg-brand-primary-500 text-white'
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                        }`}
                      >
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold"
          >
            {t('common.cancel', 'إلغاء')}
          </Button>
          <Button
            type="submit"
            disabled={submitting || !selectedCourseId}
            className="rounded-xl bg-brand-primary-500 hover:bg-brand-primary-600 text-white font-bold flex items-center gap-2 min-w-[140px] justify-center shadow-sm"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>{isRTL ? 'جاري التسجيل...' : 'Enrolling...'}</span>
              </>
            ) : (
              <>
                <BookPlus size={16} />
                <span>{t('students.enrollCourse', 'تسجيل مقرر')}</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EnrollCourseModal;
