import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/button';
import Badge from '../../components/ui/Badge';
import enrollmentService from '../../services/enrollment.service';
import {
  ShieldAlert,
  Clock,
  Calendar,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Layers,
  Sparkles,
} from 'lucide-react';

export interface ManageAbsenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  enrollmentId: number;
  studentName: string;
  courseName: string;
  currentCustomThreshold: number | null;
  currentStatus: string;
  onSuccess: () => void;
}

interface ExemptionPeriodItem {
  id: number;
  enrollmentId: number;
  startDate: string;
  endDate: string;
  reason: string;
  createdById: number;
  createdAt: string;
  createdBy?: {
    id: number;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

const ManageAbsenceModal: React.FC<ManageAbsenceModalProps> = ({
  isOpen,
  onClose,
  enrollmentId,
  studentName,
  courseName,
  currentCustomThreshold,
  currentStatus,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { showToast } = useToast();

  // Threshold state
  const [useCustomOverride, setUseCustomOverride] = useState<boolean>(currentCustomThreshold !== null);
  const [thresholdInput, setThresholdInput] = useState<string>(
    currentCustomThreshold !== null ? String(currentCustomThreshold) : ''
  );
  const [savingThreshold, setSavingThreshold] = useState<boolean>(false);

  // Exemption periods state
  const [exemptions, setExemptions] = useState<ExemptionPeriodItem[]>([]);
  const [loadingExemptions, setLoadingExemptions] = useState<boolean>(false);

  // Add Exemption form state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [addingExemption, setAddingExemption] = useState<boolean>(false);

  // Delete Exemption state
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Live status state
  const [activeStatus, setActiveStatus] = useState<string>(currentStatus);
  const [activeThreshold, setActiveThreshold] = useState<number | null>(currentCustomThreshold);

  const fetchExemptions = useCallback(async () => {
    try {
      setLoadingExemptions(true);
      const res = await enrollmentService.getExemptionPeriods(enrollmentId);
      if (res.success && Array.isArray(res.data)) {
        setExemptions(res.data);
      } else {
        setExemptions([]);
      }
    } catch {
      setExemptions([]);
    } finally {
      setLoadingExemptions(false);
    }
  }, [enrollmentId]);

  useEffect(() => {
    if (isOpen) {
      setUseCustomOverride(currentCustomThreshold !== null);
      setThresholdInput(currentCustomThreshold !== null ? String(currentCustomThreshold) : '');
      setActiveStatus(currentStatus);
      setActiveThreshold(currentCustomThreshold);
      setStartDate('');
      setEndDate('');
      setReason('');
      setConfirmDeleteId(null);
      fetchExemptions();
    }
  }, [isOpen, enrollmentId, currentCustomThreshold, currentStatus, fetchExemptions]);

  const handleSaveThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingThreshold(true);
      let targetValue: number | null = null;
      if (useCustomOverride) {
        const parsed = parseFloat(thresholdInput);
        if (isNaN(parsed) || parsed < 0 || parsed > 100) {
          showToast(
            isRTL ? 'يرجى إدخال نسبة صحيحة بين 0 و 100' : 'Please enter a valid threshold between 0 and 100',
            'error'
          );
          return;
        }
        targetValue = parsed;
      }

      const res = await enrollmentService.setAbsenceThreshold(enrollmentId, targetValue);
      if (res.success && res.data) {
        const newStatus = res.data.status;
        const newThreshold = res.data.customAbsenceThreshold;

        setActiveThreshold(newThreshold);
        if (newStatus && newStatus !== activeStatus) {
          setActiveStatus(newStatus);
          showToast(
            t('students.statusUpdatedTo', {
              status: isRTL ? (newStatus === 'BLOCKED' ? 'محروم / محظور' : 'مسجل') : newStatus,
            }),
            newStatus === 'ENROLLED' ? 'success' : 'warning'
          );
        } else {
          showToast(t('students.thresholdUpdated', 'تم تحديث حد الغياب بنجاح'), 'success');
        }

        onSuccess();
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        (isRTL ? 'فشل حفظ حد الغياب المخصص' : 'Failed to save custom absence threshold');
      showToast(msg, 'error');
    } finally {
      setSavingThreshold(false);
    }
  };

  const handleCreateExemption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      showToast(isRTL ? 'يرجى تحديد تاريخي البدء والانتهاء' : 'Please specify start and end dates', 'error');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      showToast(
        isRTL ? 'يجب أن يكون تاريخ البدء قبل أو يساوي تاريخ الانتهاء' : 'Start date must be before or equal to end date',
        'error'
      );
      return;
    }

    if (!reason.trim()) {
      showToast(isRTL ? 'يرجى كتابة سبب الإعفاء' : 'Please provide a reason for the exemption', 'error');
      return;
    }

    try {
      setAddingExemption(true);
      const res = await enrollmentService.createExemptionPeriod(enrollmentId, {
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(`${endDate}T23:59:59.999Z`).toISOString(),
        reason: reason.trim(),
      });

      if (res.success) {
        showToast(t('students.exemptionAdded', 'تمت إضافة فترة الإعفاء بنجاح'), 'success');
        const newStatus = res.data?.enrollment?.status;
        if (newStatus && newStatus !== activeStatus) {
          setActiveStatus(newStatus);
          showToast(
            t('students.statusUpdatedTo', {
              status: isRTL ? (newStatus === 'BLOCKED' ? 'محروم / محظور' : 'مسجل') : newStatus,
            }),
            newStatus === 'ENROLLED' ? 'success' : 'warning'
          );
        }

        setStartDate('');
        setEndDate('');
        setReason('');
        await fetchExemptions();
        onSuccess();
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        (isRTL ? 'فشل إنشاء فترة الإعفاء' : 'Failed to create exemption period');
      showToast(msg, 'error');
    } finally {
      setAddingExemption(false);
    }
  };

  const handleDeleteExemption = async (exemptionId: number) => {
    try {
      setDeletingId(exemptionId);
      const res = await enrollmentService.deleteExemptionPeriod(enrollmentId, exemptionId);
      if (res.success) {
        showToast(t('students.exemptionDeleted', 'تم حذف فترة الإعفاء بنجاح'), 'success');
        const newStatus = res.data?.enrollment?.status;
        if (newStatus && newStatus !== activeStatus) {
          setActiveStatus(newStatus);
          showToast(
            t('students.statusUpdatedTo', {
              status: isRTL ? (newStatus === 'BLOCKED' ? 'محروم / محظور' : 'مسجل') : newStatus,
            }),
            newStatus === 'ENROLLED' ? 'success' : 'warning'
          );
        }

        setConfirmDeleteId(null);
        await fetchExemptions();
        onSuccess();
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        (isRTL ? 'فشل حذف فترة الإعفاء' : 'Failed to delete exemption period');
      showToast(msg, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ENROLLED':
        return <Badge variant="success">{isRTL ? 'مسجل (نشط)' : 'Enrolled'}</Badge>;
      case 'BLOCKED':
        return <Badge variant="danger">{isRTL ? 'محروم / محظور' : 'Blocked'}</Badge>;
      case 'COMPLETED':
        return <Badge variant="info">{isRTL ? 'مكتمل' : 'Completed'}</Badge>;
      case 'WITHDRAWN':
        return <Badge variant="neutral">{isRTL ? 'منسحب' : 'Withdrawn'}</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('students.manageAbsence', 'إدارة الغياب')}
      subtitle={`${studentName} — ${courseName}`}
      size="lg"
    >
      <div className="space-y-6 text-start">
        {/* Header Status & Effective Policy Banner */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-primary-500/10 text-brand-primary-600 dark:text-brand-primary-400 rounded-xl">
              <ShieldAlert size={20} />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t('students.currentStatusLabel', 'الحالة الحالية')}
              </div>
              <div className="mt-0.5">{getStatusBadge(activeStatus)}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-end">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t('students.currentThresholdLabel', 'الحد الفعلي المطبق')}
              </div>
              <div className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                {activeThreshold !== null
                  ? `${activeThreshold}% (${t('students.customOverride', 'مخصص')})`
                  : t('students.defaultPolicyBadge', 'السياسة الافتراضية (25%)')}
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Custom Absence Threshold Form */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-white dark:bg-slate-800/80 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="text-brand-primary-500" size={18} />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('students.customThreshold', 'حد الغياب المخصص')}
            </h4>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            {t(
              'students.customThresholdDesc',
              'تجاوز حد الغياب الافتراضي لهذا التسجيل (0-100%). اتركه فارغاً لاستخدام السياسة العامة للجامعة/القسم.'
            )}
          </p>

          <form onSubmit={handleSaveThreshold} className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  name="thresholdMode"
                  checked={!useCustomOverride}
                  onChange={() => {
                    setUseCustomOverride(false);
                    setThresholdInput('');
                  }}
                  className="text-brand-primary-600 focus:ring-brand-primary-500 h-4 w-4"
                />
                <span>{t('students.useDefaultPolicy', 'استخدام السياسة الافتراضية (25%)')}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  name="thresholdMode"
                  checked={useCustomOverride}
                  onChange={() => {
                    setUseCustomOverride(true);
                    if (!thresholdInput) setThresholdInput('30');
                  }}
                  className="text-brand-primary-600 focus:ring-brand-primary-500 h-4 w-4"
                />
                <span>{t('students.customOverride', 'تحديد نسبة مخصصة')}</span>
              </label>
            </div>

            {useCustomOverride && (
              <div className="flex items-center gap-3">
                <div className="relative w-40">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(e.target.value)}
                    placeholder="e.g. 35"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-primary-500"
                    required
                  />
                  <span className="absolute inset-y-0 end-3 flex items-center text-xs font-bold text-slate-400 pointer-events-none">
                    %
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  {isRTL ? 'النسبة المئوية القصوى للغياب المسموح بها' : 'Maximum allowable absence percentage'}
                </span>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={savingThreshold}
                className="bg-brand-primary-500 hover:bg-brand-primary-600 text-white text-xs font-bold px-4 py-2 rounded-xl inline-flex items-center gap-2"
              >
                {savingThreshold ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>{t('students.saving', 'جاري الحفظ...')}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>{t('students.saveThreshold', 'حفظ النسبة المخصصة')}</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* Section 2: Exemption Periods List */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-white dark:bg-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="text-blue-500" size={18} />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('students.exemptionPeriods', 'فترات الإعفاء من الغياب')}
              </h4>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
              {exemptions.length} {isRTL ? 'فترات' : 'periods'}
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            {t(
              'students.exemptionPeriodsDesc',
              'تواريخ الحضور الواقعة ضمن فترات الإعفاء المعتمدة يتم استبعادها تلقائياً من احتساب نسبة الغياب دون تعديل سجلات الحضور الأصلية.'
            )}
          </p>

          {loadingExemptions ? (
            <div className="py-8 flex items-center justify-center text-slate-400 gap-2">
              <Loader2 size={18} className="animate-spin text-brand-primary-500" />
              <span className="text-xs">{isRTL ? 'جاري تحميل الفترات...' : 'Loading exemptions...'}</span>
            </div>
          ) : exemptions.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('students.noExemptions', 'لا توجد فترات إعفاء مسجلة لهذا التسجيل.')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {exemptions.map((item) => {
                const isConfirming = confirmDeleteId === item.id;
                const isDeleting = deletingId === item.id;
                const creatorName =
                  item.createdBy?.firstName && item.createdBy?.lastName
                    ? `${item.createdBy.firstName} ${item.createdBy.lastName}`
                    : item.createdBy?.firstName || item.createdBy?.email || 'Admin';

                const startFormatted = new Date(item.startDate).toLocaleDateString(
                  isRTL ? 'ar-EG' : 'en-US',
                  { year: 'numeric', month: 'short', day: 'numeric' }
                );
                const endFormatted = new Date(item.endDate).toLocaleDateString(
                  isRTL ? 'ar-EG' : 'en-US',
                  { year: 'numeric', month: 'short', day: 'numeric' }
                );

                return (
                  <div
                    key={item.id}
                    className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-start justify-between gap-4 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-md">
                          {startFormatted} → {endFormatted}
                        </span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <span>{t('students.createdBy', 'تم الاعتماد بواسطة')}:</span>
                          <span className="font-semibold text-slate-600 dark:text-slate-300">
                            {creatorName}
                          </span>
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 font-medium pt-0.5">
                        {item.reason}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {isConfirming ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => handleDeleteExemption(item.id)}
                            className="bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                          >
                            {isDeleting ? <Loader2 size={12} className="animate-spin" /> : isRTL ? 'تأكيد' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => setConfirmDeleteId(null)}
                            className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer hover:bg-slate-300"
                          >
                            {isRTL ? 'إلغاء' : 'Cancel'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title={isRTL ? 'حذف فترة الإعفاء' : 'Delete exemption period'}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sub-form: Add Exemption Period */}
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h5 className="text-xs font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-1.5">
              <Plus size={14} className="text-brand-primary-500" />
              <span>{t('students.addExemptionPeriod', 'إضافة فترة إعفاء جديدة')}</span>
            </h5>

            <form onSubmit={handleCreateExemption} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {t('students.startDate', 'تاريخ البدء')} *
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary-500 focus:outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {t('students.endDate', 'تاريخ الانتهاء')} *
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary-500 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  {t('students.reason', 'السبب / المبرر')} *
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t(
                    'students.reasonPlaceholder',
                    'مثال: عذر طبي معتمد، تمثيل رسمي للجامعة...'
                  )}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary-500 focus:outline-hidden resize-none"
                  required
                />
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  disabled={addingExemption}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl inline-flex items-center gap-1.5"
                >
                  {addingExemption ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>{t('students.adding', 'جاري الإضافة...')}</span>
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      <span>{t('students.addExemptionPeriod', 'إضافة فترة إعفاء')}</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold rounded-xl"
          >
            {isRTL ? 'إغلاق' : 'Close'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ManageAbsenceModal;
