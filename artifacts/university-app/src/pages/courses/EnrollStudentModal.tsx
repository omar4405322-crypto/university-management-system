import React, { useState, useEffect, useMemo } from 'react';
import { UserPlus, Search, AlertCircle, Loader2, Check, GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/button';
import studentsService from '../../services/students.service';
import enrollmentService from '../../services/enrollment.service';
import { useToast } from '../../context/ToastContext';
import { logger } from '../../lib/logger';

interface StudentItem {
  id: number;
  firstName: string;
  lastName: string;
  studentCode?: string;
  year?: number;
  department?: { id: number; name: string };
  user?: { email: string };
}

interface EnrollStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: number | string;
  courseName: string;
  courseCode?: string;
  semester: number | string;
  academicYear: number | string;
  currentEnrolledStudentIds: number[];
  departmentId?: number | string;
  onSuccess: () => void;
}

const EnrollStudentModal: React.FC<EnrollStudentModalProps> = ({
  isOpen,
  onClose,
  courseId,
  courseName,
  courseCode,
  semester,
  academicYear,
  currentEnrolledStudentIds,
  departmentId,
  onSuccess,
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { showToast } = useToast();

  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCandidateStudents();
      setSelectedStudentId(null);
      setSearchQuery('');
      setErrorMessage(null);
    }
  }, [isOpen, courseId]);

  const fetchCandidateStudents = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const params: Record<string, unknown> = { limit: 150 };
      if (departmentId) {
        params.departmentId = departmentId;
      }
      const res = await studentsService.getStudents(params);
      if (res.success) {
        const rawData = Array.isArray(res.data)
          ? res.data
          : (res.data as any)?.students || (res.data as any)?.data || [];
        setStudents(rawData);
      } else {
        setStudents([]);
      }
    } catch (err: any) {
      logger.error('Error fetching students for enrollment:', err);
      setErrorMessage(
        err.response?.data?.message ||
          (isRTL ? 'تعذر جلب قائمة الطلاب' : 'Failed to fetch student roster')
      );
    } finally {
      setLoading(false);
    }
  };

  // Filter out students already enrolled in this course
  const enrolledSet = useMemo(() => new Set(currentEnrolledStudentIds), [currentEnrolledStudentIds]);

  const eligibleStudents = useMemo(() => {
    return students.filter((s) => !enrolledSet.has(s.id));
  }, [students, enrolledSet]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return eligibleStudents;
    const query = searchQuery.toLowerCase().trim();
    return eligibleStudents.filter((s) => {
      const fullName = `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
      const code = (s.studentCode || '').toLowerCase();
      const email = (s.user?.email || '').toLowerCase();
      return fullName.includes(query) || code.includes(query) || email.includes(query);
    });
  }, [eligibleStudents, searchQuery]);

  const selectedStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId);
  }, [students, selectedStudentId]);

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      setErrorMessage(isRTL ? 'يرجى اختيار طالب للتسجيل' : 'Please select a student to enroll');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const res = await enrollmentService.enrollStudent({
        studentId: selectedStudentId,
        courseId,
        semester,
        academicYear,
      });

      if (res.success) {
        showToast(
          t('courses.enrollSuccess', 'تم تسجيل الطالب في المقرر بنجاح'),
          'success'
        );
        onSuccess();
        onClose();
      } else {
        setErrorMessage(
          res.message || (isRTL ? 'فشل تسجيل الطالب' : 'Failed to enroll student')
        );
      }
    } catch (err: any) {
      logger.error('Error enrolling student:', err);
      const backendMessage =
        err.response?.data?.message ||
        err.message ||
        (isRTL ? 'حدث خطأ أثناء تسجيل الطالب' : 'An error occurred during enrollment');
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
      title={t('courses.addStudentToRoster', 'تسجيل طالب في المقرر')}
      subtitle={`${courseName} ${courseCode ? `(${courseCode})` : ''}`}
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

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" size={16} />
          <input
            type="text"
            placeholder={isRTL ? 'ابحث باسم الطالب، الكود الجامعي، أو البريد...' : 'Search by name, student code, or email...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full ps-10 pe-4 py-2.5 rounded-2xl bg-surface-card border border-brand-border text-sm text-brand-text-main placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary-500/20 focus:border-brand-primary-500 transition-all font-medium"
          />
        </div>

        {/* Selected Student Confirmation Pill */}
        {selectedStudent && (
          <div className="p-3 bg-brand-primary-50/70 dark:bg-brand-primary-950/30 border border-brand-primary-200 dark:border-brand-primary-800/50 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-primary-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                <Check size={16} />
              </div>
              <div className="text-start">
                <p className="text-xs font-black text-brand-text-primary dark:text-brand-text-main">
                  {selectedStudent.firstName} {selectedStudent.lastName}
                </p>
                <p className="text-[11px] font-mono text-brand-primary-700 dark:text-brand-primary-400">
                  {selectedStudent.studentCode || selectedStudent.user?.email || '—'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedStudentId(null)}
              className="text-xs font-bold text-brand-text-muted hover:text-rose-500 transition-colors cursor-pointer px-2 py-1"
            >
              {isRTL ? 'إلغاء التحديد' : 'Deselect'}
            </button>
          </div>
        )}

        {/* Students List Container */}
        <div className="border border-brand-border rounded-2xl overflow-hidden bg-surface-card max-h-[300px] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="animate-spin text-brand-primary-600" size={32} />
              <p className="text-xs font-bold text-brand-text-muted">
                {isRTL ? 'جاري تحميل قائمة الطلاب المتاحين...' : 'Loading candidate students...'}
              </p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-12 px-4 text-brand-text-muted">
              <GraduationCap size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs font-bold">
                {searchQuery
                  ? (isRTL ? 'لا يوجد طلاب مطابقون لمعايير البحث' : 'No students match your search')
                  : (isRTL ? 'جميع الطلاب مسجلون بالفعل في هذا المقرر' : 'All eligible students are already enrolled')}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-brand-border">
              {filteredStudents.map((student) => {
                const isSelected = selectedStudentId === student.id;
                return (
                  <div
                    key={student.id}
                    onClick={() => {
                      setSelectedStudentId(student.id);
                      setErrorMessage(null);
                    }}
                    className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-brand-primary-50/80 dark:bg-brand-primary-950/40'
                        : 'hover:bg-surface-subtle'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-brand-primary-500 text-white shadow-sm'
                            : 'bg-surface-subtle border border-brand-border text-brand-text-muted'
                        }`}
                      >
                        {student.firstName?.[0] || 'S'}
                      </div>
                      <div className="text-start min-w-0">
                        <p className="text-xs font-bold text-brand-text-primary dark:text-brand-text-main truncate">
                          {student.firstName} {student.lastName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-brand-text-muted">
                          {student.studentCode && (
                            <span className="font-mono text-brand-primary-600 dark:text-brand-primary-400 font-bold">
                              {student.studentCode}
                            </span>
                          )}
                          {student.department?.name && (
                            <>
                              <span>•</span>
                              <span className="truncate">{student.department.name}</span>
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
                            : 'border-brand-border bg-white dark:bg-slate-800'
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
            className="rounded-2xl"
          >
            {t('common.cancel', 'إلغاء')}
          </Button>
          <Button
            type="submit"
            disabled={submitting || !selectedStudentId}
            className="rounded-2xl flex items-center gap-2 min-w-[140px] justify-center"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>{isRTL ? 'جاري التسجيل...' : 'Enrolling...'}</span>
              </>
            ) : (
              <>
                <UserPlus size={16} />
                <span>{t('courses.confirmEnrollment', 'تأكيد التسجيل')}</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EnrollStudentModal;
