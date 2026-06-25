import React from 'react';
import { Download, Trash2, Edit2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from './Button';

export interface BulkActionToolbarProps {
  selectedCount: number;
  onClear: () => void;
  onExport?: () => void;
  onDelete?: () => void;
  onStatusChange?: () => void;
}

const BulkActionToolbar: React.FC<BulkActionToolbarProps> = ({
  selectedCount,
  onClear,
  onExport,
  onDelete,
  onStatusChange,
}) => {
  const { t } = useTranslation();

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-brand-bg-elevated text-brand-text-primary px-6 py-3 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-brand-border animate-in slide-in-from-bottom-8 fade-in duration-300">
      <div className="flex items-center gap-3 border-r border-brand-border/60 pr-4 rtl:pr-0 rtl:border-r-0 rtl:border-l rtl:pl-4">
        <span className="flex items-center justify-center bg-brand-primary-600 text-white font-bold text-sm h-6 w-6 rounded-full">
          {selectedCount}
        </span>
        <span className="text-sm font-semibold">{t('common.selected', 'Selected')}</span>
      </div>

      <div className="flex items-center gap-2">
        {onExport && (
          <Button variant="ghost" size="sm" onClick={onExport} className="h-8 text-sm hover:bg-surface-subtle">
            <Download size={14} className="mr-1.5 rtl:mr-0 rtl:ml-1.5" />
            {t('common.export', 'Export')}
          </Button>
        )}
        {onStatusChange && (
          <Button variant="ghost" size="sm" onClick={onStatusChange} className="h-8 text-sm hover:bg-surface-subtle">
            <Edit2 size={14} className="mr-1.5 rtl:mr-0 rtl:ml-1.5" />
            {t('common.changeStatus', 'Status')}
          </Button>
        )}
        {onDelete && (
          <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 text-sm text-error hover:bg-error/10 hover:text-error">
            <Trash2 size={14} className="mr-1.5 rtl:mr-0 rtl:ml-1.5" />
            {t('common.delete', 'Delete')}
          </Button>
        )}
      </div>

      <div className="border-l border-brand-border/60 pl-4 rtl:pl-0 rtl:border-l-0 rtl:border-r rtl:pr-4">
        <button
          onClick={onClear}
          className="p-1.5 rounded-xl hover:bg-surface-subtle text-brand-text-muted hover:text-brand-text-primary transition-colors"
          aria-label={t('common.clear', 'Clear')}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default BulkActionToolbar;
