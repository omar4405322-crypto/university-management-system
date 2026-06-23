import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { Edit2, Trash2 } from 'lucide-react';
import Badge from '../Badge';
import ConfirmDeleteModal from '../ConfirmDeleteModal';
import enrollmentService from '../../../services/enrollment.service';
import UpdateGradeModal from './UpdateGradeModal';

interface EnrollmentsTableProps {
  enrollments: any[];
  entityType: 'course' | 'student';
  onUpdate: () => void;
}

const EnrollmentsTable: React.FC<EnrollmentsTableProps> = ({ enrollments, entityType, onUpdate }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [enrollmentToDelete, setEnrollmentToDelete] = useState<number | null>(null);
  const [enrollmentToGrade, setEnrollmentToGrade] = useState<any>(null);

  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user?.role as string);
  const isDoctor = user?.role === 'DOCTOR';
  const isStudent = user?.role === 'STUDENT';

  const canManageGrades = isAdmin || isDoctor;
  const canWithdraw = isAdmin || isStudent; // Students can withdraw themselves

  const handleDelete = async () => {
    if (!enrollmentToDelete) return;
    try {
      await enrollmentService.withdrawStudent(enrollmentToDelete);
      setEnrollmentToDelete(null);
      onUpdate();
    } catch (err) {
      console.error('Failed to withdraw student', err);
    }
  };

  if (!enrollments.length) {
    return (
      <div className="text-center py-8 text-brand-text-muted">
        {t('enrollment.noEnrollments', 'No enrollments found.')}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-brand-border text-brand-text-muted text-xs uppercase tracking-wider">
            {entityType === 'course' ? (
              <>
                <th className="py-4 px-4">{t('enrollment.studentId', 'Student ID')}</th>
                <th className="py-4 px-4">{t('enrollment.studentName', 'Student Name')}</th>
              </>
            ) : (
              <>
                <th className="py-4 px-4">{t('enrollment.courseCode', 'Course Code')}</th>
                <th className="py-4 px-4">{t('enrollment.courseName', 'Course Name')}</th>
              </>
            )}
            <th className="py-4 px-4">{t('enrollment.semester', 'Semester')}</th>
            <th className="py-4 px-4">{t('enrollment.status', 'Status')}</th>
            <th className="py-4 px-4">{t('enrollment.grade', 'Final Grade')}</th>
            {(canManageGrades || canWithdraw) && (
              <th className="py-4 px-4 text-right">{t('common.actions', 'Actions')}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {enrollments.map((enrollment) => (
            <tr key={enrollment.id} className="border-b border-brand-border hover:bg-brand-bg-page/50 transition-colors">
              {entityType === 'course' ? (
                <>
                  <td className="py-4 px-4 font-bold text-brand-text-main">{enrollment.student?.studentId}</td>
                  <td className="py-4 px-4">
                    {enrollment.student?.firstName} {enrollment.student?.lastName}
                  </td>
                </>
              ) : (
                <>
                  <td className="py-4 px-4 font-bold text-brand-text-main">{enrollment.course?.courseCode}</td>
                  <td className="py-4 px-4">{enrollment.course?.name}</td>
                </>
              )}
              <td className="py-4 px-4">
                {enrollment.semester} ({enrollment.academicYear})
              </td>
              <td className="py-4 px-4">
                <Badge variant={enrollment.status === 'ENROLLED' ? 'info' : enrollment.status === 'COMPLETED' ? 'success' : 'error'}>
                  {enrollment.status}
                </Badge>
              </td>
              <td className="py-4 px-4 font-black">
                {enrollment.finalGrade !== null ? `${enrollment.finalGrade}%` : '-'}
              </td>
              {(canManageGrades || canWithdraw) && (
                <td className="py-4 px-4 text-right">
                  <div className="flex justify-end gap-2">
                    {canManageGrades && (
                      <button
                        onClick={() => setEnrollmentToGrade(enrollment)}
                        className="p-2 rounded-lg text-brand-text-muted hover:text-brand-green hover:bg-brand-green/10 transition-all"
                        title={t('enrollment.updateGrade', 'Update Grade')}
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                    {canWithdraw && (
                      <button
                        onClick={() => setEnrollmentToDelete(enrollment.id)}
                        className="p-2 rounded-lg text-brand-text-muted hover:text-error hover:bg-error/10 transition-all"
                        title={t('enrollment.withdraw', 'Withdraw')}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {enrollmentToGrade && (
        <UpdateGradeModal
          isOpen={!!enrollmentToGrade}
          onClose={() => setEnrollmentToGrade(null)}
          onSuccess={() => {
            setEnrollmentToGrade(null);
            onUpdate();
          }}
          enrollment={enrollmentToGrade}
        />
      )}

      <ConfirmDeleteModal
        isOpen={!!enrollmentToDelete}
        onClose={() => setEnrollmentToDelete(null)}
        onConfirm={handleDelete}
        title={t('enrollment.withdrawConfirmTitle', 'Withdraw Student')}
        confirmLabel={t('enrollment.withdrawConfirmBtn', 'Withdraw')}
      />
    </div>
  );
};

export default EnrollmentsTable;
