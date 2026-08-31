// FIXED [Phase 7.4]: Reusable confirmation modal
import React from 'react';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import Button from './button';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName?: string;
  onConfirm: () => void;
  loading?: boolean;
  title?: string;
  subtitle?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  icon?: React.ReactNode;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
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
  variant = 'danger',
  icon,
}) => {
  const { t } = useTranslation();

  const renderIcon = () => {
    if (icon) return icon;
    if (variant === 'danger') {
      return <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={24} />;
    }
    if (variant === 'warning') {
      return <AlertTriangle className="text-brand-yellow shrink-0 mt-0.5" size={24} />;
    }
    return <Info className="text-blue-500 shrink-0 mt-0.5" size={24} />;
  };

  const getContainerClass = () => {
    if (variant === 'danger') {
      return 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20';
    }
    if (variant === 'warning') {
      return 'bg-brand-yellow/10 border-brand-yellow/20';
    }
    return 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20';
  };

  const defaultTitle =
    variant === 'danger'
      ? t('common.deleteConfirmTitle')
      : t('common.confirmAction', 'Confirm Action');

  const defaultConfirmLabel =
    variant === 'danger'
      ? t('common.deletePermanent')
      : t('common.confirm', 'Confirm');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || defaultTitle}
      subtitle={subtitle || (variant === 'danger' ? t('common.deleteConfirmSubtitle', { name: itemName || '' }) : undefined)}
      size="sm"
    >
      <div className="space-y-6">
        <div className={`flex items-start gap-4 p-4 rounded-2xl border ${getContainerClass()}`}>
          {renderIcon()}
          <p className="text-sm font-bold text-brand-text-main leading-relaxed">
            {message || (variant === 'danger' ? t('common.deleteConfirmMessage', { name: itemName }) : t('common.confirmMessage', 'Are you sure you want to proceed?'))}
          </p>
        </div>
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel || t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant={variant === 'danger' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={loading}
            className={`font-black uppercase tracking-widest text-xs ${
              variant === 'danger' ? 'bg-rose-600 hover:bg-rose-700 text-white' : ''
            }`}
          >
            {loading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              confirmLabel || defaultConfirmLabel
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDeleteModal;
