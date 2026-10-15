import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/button';
import { AlertTriangle, Users, BookOpen, Layers, CheckCircle2 } from 'lucide-react';
import academicTermService, {
  AcademicTermData,
  TermSwitchPreviewData,
} from '../../services/academicTerm.service';
import { useToast } from '../../context/ToastContext';

interface TermSwitchPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetTerm: AcademicTermData;
  onActivated: () => void;
}

export const TermSwitchPreviewModal: React.FC<TermSwitchPreviewModalProps> = ({
  isOpen,
  onClose,
  targetTerm,
  onActivated,
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<TermSwitchPreviewData | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadPreview() {
      setLoading(true);
      setError(null);
      try {
        const res = await academicTermService.getActivatePreview(targetTerm.id);
        if (isMounted && res.data) {
          setPreview(res.data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(
            err.response?.data?.message ||
              err.message ||
              t('academicTerms.previewError', 'Failed to calculate term switch preview.')
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (isOpen && targetTerm) {
      loadPreview();
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, targetTerm, t]);

  const handleConfirmActivate = async () => {
    setActivating(true);
    setError(null);
    try {
      const res = await academicTermService.activateTerm(targetTerm.id);
      showToast(
        res.data?.message || t('academicTerms.activatedSuccess', 'Term activated successfully.'),
        'success'
      );
      onActivated();
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          t('academicTerms.activationError', 'Failed to activate term.')
      );
    } finally {
      setActivating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('academicTerms.switchTermTitle', 'Switch Active Academic Term')}
      size="md"
    >
      <div className="space-y-4 p-2">
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-xl flex items-start gap-3 text-xs leading-relaxed">
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-500" />
          <div>
            <span className="font-bold block mb-1">
              {t('academicTerms.activationWarningTitle', 'Important: Term Switch Action')}
            </span>
            <span>
              {t(
                'academicTerms.activationWarningDesc',
                'Activating this term will make it the active calendar cycle system-wide. Active students will be automatically enrolled into published courses matching their department, year, and this term\'s semester.'
              )}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            {t('common.loading', 'Loading preview metrics...')}
          </div>
        ) : preview ? (
          <div className="space-y-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                {t('academicTerms.targetTerm', 'Target Term')}
              </div>
              <div className="text-base font-bold text-slate-900 dark:text-white">
                {preview.targetTerm.name} ({preview.targetTerm.academicYearName})
              </div>
              <div className="text-xs text-brand-primary-600 dark:text-brand-primary-400 font-semibold mt-0.5">
                {t('academicTerms.semesterNumber', 'Semester')} {preview.targetTerm.semesterNumber}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                <Users size={18} className="mx-auto text-blue-500 mb-1" />
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  {preview.metrics.studentsEligible}
                </div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                  {t('academicTerms.students', 'Students')}
                </div>
              </div>

              <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                <BookOpen size={18} className="mx-auto text-emerald-500 mb-1" />
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  {preview.metrics.publishedCourses}
                </div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                  {t('academicTerms.courses', 'Courses')}
                </div>
              </div>

              <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                <Layers size={18} className="mx-auto text-purple-500 mb-1" />
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  {preview.metrics.estimatedNewEnrollments}
                </div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                  {t('academicTerms.newEnrollments', 'Enrollments')}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button type="button" variant="ghost" onClick={onClose} disabled={activating}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleConfirmActivate}
            disabled={loading || activating || !preview}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5"
          >
            <CheckCircle2 size={16} />
            {activating
              ? t('academicTerms.activating', 'Activating...')
              : t('academicTerms.confirmActivate', 'Confirm Activation')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default TermSwitchPreviewModal;
