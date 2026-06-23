// FIXED [Phase 7.4]: Reusable delete confirmation modal
import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import Button from './Button';

const ConfirmDeleteModal = ({
  isOpen,
  onClose,
  itemName,
  onConfirm,
  loading = false,
  title,
  subtitle,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'danger'
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || t('common.deleteConfirmTitle')}
      subtitle={subtitle || t('common.deleteConfirmSubtitle', { name: itemName || '' })}
      size="sm"
    >
      <div className="space-y-6">
        <div className={`flex items-start gap-4 p-4 rounded-2xl border ${
          variant === 'danger' 
            ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20' 
            : 'bg-brand-yellow/10 border-brand-yellow/20'
        }`}>
          <AlertTriangle className={`${variant === 'danger' ? 'text-rose-500' : 'text-brand-yellow'} shrink-0 mt-0.5`} size={24} />
          <p className="text-sm font-bold text-brand-text-main leading-relaxed">
            {message || t('common.deleteConfirmMessage', { name: itemName })}
          </p>
        </div>
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel || t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={loading}
            className={`font-black uppercase tracking-widest text-xs ${
              variant === 'danger' ? 'bg-rose-600 hover:bg-rose-700 text-white' : ''
            }`}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : (confirmLabel || t('common.deletePermanent'))}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDeleteModal;
