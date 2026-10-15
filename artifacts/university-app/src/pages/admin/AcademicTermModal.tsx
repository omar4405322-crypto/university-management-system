import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/button';
import { AlertCircle } from 'lucide-react';
import academicTermService, {
  AcademicYearData,
  AcademicTermData,
  CreateYearPayload,
  CreateTermPayload,
} from '../../services/academicTerm.service';
import { useToast } from '../../context/ToastContext';

interface AcademicTermModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'YEAR' | 'TERM';
  isEdit?: boolean;
  initialData?: AcademicYearData | AcademicTermData | null;
  academicYears: AcademicYearData[];
  selectedYearId?: number;
  onSuccess: () => void;
}

const formatDateForInput = (d?: string): string => {
  if (!d) return '';
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

export const AcademicTermModal: React.FC<AcademicTermModalProps> = ({
  isOpen,
  onClose,
  mode,
  isEdit = false,
  initialData,
  academicYears,
  selectedYearId,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Year fields
  const [yearName, setYearName] = useState('');
  const [yearStartDate, setYearStartDate] = useState('');
  const [yearEndDate, setYearEndDate] = useState('');

  // Term fields
  const [termAcademicYearId, setTermAcademicYearId] = useState<number>(0);
  const [termName, setTermName] = useState('');
  const [termType, setTermType] = useState('FALL');
  const [semesterNumber, setSemesterNumber] = useState<number>(1);
  const [termStartDate, setTermStartDate] = useState('');
  const [termEndDate, setTermEndDate] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (mode === 'YEAR') {
        const yData = isEdit && initialData ? (initialData as AcademicYearData) : null;
        setYearName(yData?.name || '');
        setYearStartDate(formatDateForInput(yData?.startDate));
        setYearEndDate(formatDateForInput(yData?.endDate));
      } else {
        const tData = isEdit && initialData ? (initialData as AcademicTermData) : null;
        const initialYearId =
          tData?.academicYearId ?? (selectedYearId || academicYears[0]?.id || 0);
        setTermAcademicYearId(initialYearId);
        setTermName(tData?.name || '');
        setTermType(tData?.termType || 'FALL');
        setSemesterNumber(tData?.semesterNumber ?? 1);
        setTermStartDate(formatDateForInput(tData?.startDate));
        setTermEndDate(formatDateForInput(tData?.endDate));
      }
    }
  }, [isOpen, mode, isEdit, initialData, selectedYearId, academicYears]);

  const localizeError = (msg: string): string => {
    const lower = msg.toLowerCase();
    if (
      lower.includes('after start') ||
      lower.includes('before end') ||
      lower.includes('start before end')
    ) {
      return t('academicTerms.startBeforeEnd', 'Start date must be before end date.');
    }
    if (lower.includes('overlap')) {
      return t('academicTerms.noOverlap', 'Dates must not overlap with an existing period.');
    }
    if (
      lower.includes('within') ||
      lower.includes('inside') ||
      lower.includes('boundary') ||
      lower.includes('year')
    ) {
      return t('academicTerms.termInsideYear', 'Term dates must fall within its academic year.');
    }
    return msg;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const startStr = mode === 'YEAR' ? yearStartDate : termStartDate;
    const endStr = mode === 'YEAR' ? yearEndDate : termEndDate;

    if (!startStr || !endStr) {
      setError(t('academicTerms.validDatesRequired', 'Valid start and end dates are required.'));
      return;
    }

    const start = new Date(startStr);
    const end = new Date(endStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setError(t('academicTerms.validDatesRequired', 'Valid start and end dates are required.'));
      return;
    }

    if (end <= start) {
      setError(t('academicTerms.startBeforeEnd', 'Start date must be before end date.'));
      return;
    }

    // Term-specific boundary checks
    if (mode === 'TERM') {
      const parentYear = academicYears.find((y) => y.id === termAcademicYearId);
      if (parentYear) {
        const yStart = new Date(parentYear.startDate);
        const yEnd = new Date(parentYear.endDate);
        if (start < yStart || end > yEnd) {
          setError(
            t(
              'academicTerms.termInsideYear',
              'Term dates must fall within its academic year.'
            )
          );
          return;
        }

        if (parentYear.terms && parentYear.terms.length > 0) {
          for (const sibling of parentYear.terms) {
            if (isEdit && initialData && sibling.id === initialData.id) {
              continue;
            }
            const sStart = new Date(sibling.startDate);
            const sEnd = new Date(sibling.endDate);
            if (start < sEnd && end > sStart) {
              setError(
                t(
                  'academicTerms.noOverlap',
                  'Dates must not overlap with an existing period.'
                )
              );
              return;
            }
          }
        }
      }
    }

    setLoading(true);
    try {
      if (mode === 'YEAR') {
        const payload: CreateYearPayload = {
          name: yearName.trim(),
          startDate: new Date(yearStartDate).toISOString(),
          endDate: new Date(yearEndDate).toISOString(),
        };
        if (isEdit && initialData) {
          await academicTermService.updateAcademicYear(initialData.id, payload);
          showToast(t('academicTerms.yearUpdated', 'Academic Year updated successfully.'), 'success');
        } else {
          await academicTermService.createAcademicYear(payload);
          showToast(t('academicTerms.yearCreated', 'Academic Year created successfully.'), 'success');
        }
      } else {
        const payload: CreateTermPayload = {
          academicYearId: termAcademicYearId,
          name: termName.trim(),
          termType,
          semesterNumber: Number(semesterNumber),
          startDate: new Date(termStartDate).toISOString(),
          endDate: new Date(termEndDate).toISOString(),
        };
        if (isEdit && initialData) {
          await academicTermService.updateAcademicTerm(initialData.id, payload);
          showToast(t('academicTerms.termUpdated', 'Academic Term updated successfully.'), 'success');
        } else {
          await academicTermService.createAcademicTerm(payload);
          showToast(t('academicTerms.termCreated', 'Academic Term created successfully.'), 'success');
        }
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        t('common.errorOccurred', 'An error occurred.');
      setError(localizeError(msg));
    } finally {
      setLoading(false);
    }
  };

  const modalTitle =
    mode === 'YEAR'
      ? isEdit
        ? t('academicTerms.editYear', 'Edit Academic Year')
        : t('academicTerms.createYear', 'Create Academic Year')
      : isEdit
        ? t('academicTerms.editTerm', 'Edit Academic Term')
        : t('academicTerms.createTerm', 'Create Academic Term');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-2">
        {error && (
          <div
            role="alert"
            className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl flex items-center gap-2 text-xs"
          >
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {mode === 'YEAR' ? (
          <>
            <div>
              <label
                htmlFor="yearName"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                {t('academicTerms.yearName', 'Academic Year Name')} (e.g. 2026-2027)
              </label>
              <input
                id="yearName"
                type="text"
                required
                placeholder="2026-2027"
                value={yearName}
                onChange={(e) => setYearName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-brand-primary-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="yearStartDate"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t('common.startDate', 'Start Date')}
                </label>
                <input
                  id="yearStartDate"
                  type="date"
                  required
                  value={yearStartDate}
                  onChange={(e) => setYearStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-brand-primary-500"
                />
              </div>
              <div>
                <label
                  htmlFor="yearEndDate"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t('common.endDate', 'End Date')}
                </label>
                <input
                  id="yearEndDate"
                  type="date"
                  required
                  value={yearEndDate}
                  onChange={(e) => setYearEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-brand-primary-500"
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <label
                htmlFor="termAcademicYearId"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                {t('academicTerms.academicYear', 'Academic Year')}
              </label>
              <select
                id="termAcademicYearId"
                value={termAcademicYearId}
                disabled={isEdit}
                onChange={(e) => setTermAcademicYearId(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-brand-primary-500 disabled:opacity-60"
              >
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name} {y.isCurrent ? `(${t('common.active', 'Active')})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="termName"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                {t('academicTerms.termName', 'Term Name')} (e.g. Fall 2026)
              </label>
              <input
                id="termName"
                type="text"
                required
                placeholder="Fall 2026"
                value={termName}
                onChange={(e) => setTermName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-brand-primary-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="semesterNumber"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t('academicTerms.semesterNumber', 'Semester Number')}
                </label>
                <select
                  id="semesterNumber"
                  value={semesterNumber}
                  onChange={(e) => setSemesterNumber(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-brand-primary-500"
                >
                  <option value={1}>{t('academicTerms.semester1', 'Semester 1')}</option>
                  <option value={2}>{t('academicTerms.semester2', 'Semester 2')}</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="termType"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t('academicTerms.termType', 'Term Type')}
                </label>
                <select
                  id="termType"
                  value={termType}
                  onChange={(e) => setTermType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-brand-primary-500"
                >
                  <option value="FALL">FALL</option>
                  <option value="SPRING">SPRING</option>
                  <option value="SUMMER">SUMMER</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="termStartDate"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t('common.startDate', 'Start Date')}
                </label>
                <input
                  id="termStartDate"
                  type="date"
                  required
                  value={termStartDate}
                  onChange={(e) => setTermStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-brand-primary-500"
                />
              </div>
              <div>
                <label
                  htmlFor="termEndDate"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t('common.endDate', 'End Date')}
                </label>
                <input
                  id="termEndDate"
                  type="date"
                  required
                  value={termEndDate}
                  onChange={(e) => setTermEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-brand-primary-500"
                />
              </div>
            </div>
          </>
        )}

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-brand-primary-500 text-white font-bold"
          >
            {loading ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AcademicTermModal;
