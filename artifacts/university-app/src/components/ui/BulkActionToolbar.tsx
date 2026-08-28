import React from 'react';
import { Download, Trash2, Edit2, X, UserX, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import Button from './button';

export interface BulkActionToolbarProps {
  selectedCount: number;
  onClear: () => void;
  onExport?: () => void;
  onDelete?: () => void;
  onStatusChange?: () => void;
  onDeactivate?: () => void;
  onReactivate?: () => void;
  onHardDelete?: () => void;
  actions?: Array<{
    label: string;
    icon?: React.ComponentType<{ size?: number; className?: string }>;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'default' | 'link';
    className?: string;
  }>;
  children?: React.ReactNode;
}

const BulkActionToolbar: React.FC<BulkActionToolbarProps> = ({
  selectedCount,
  onClear,
  onExport,
  onDelete,
  onStatusChange,
  onDeactivate,
  onReactivate,
  onHardDelete,
  actions,
  children,
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  if (selectedCount === 0) return null;

  return createPortal(
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-5 py-2.5 rounded-2xl shadow-[0_12px_40px_rgb(0,0,0,0.18)] border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-8 fade-in duration-300">
      <div className="flex items-center gap-2 border-r border-slate-200 dark:border-slate-700 pr-3.5 rtl:pr-0 rtl:border-r-0 rtl:border-l rtl:pl-3.5">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-primary-500 text-white text-xs font-black">
          {selectedCount}
        </span>
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
          {isRTL ? 'محدد' : 'Selected'}
        </span>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto">
        {onDeactivate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDeactivate}
            className="h-8 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:text-amber-700 transition-all rounded-xl"
          >
            <UserX size={14} className="mr-1.5 rtl:mr-0 rtl:ml-1.5" />
            {isRTL ? 'تعطيل الحسابات' : 'Deactivate'}
          </Button>
        )}

        {onReactivate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReactivate}
            className="h-8 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-700 transition-all rounded-xl"
          >
            <UserCheck size={14} className="mr-1.5 rtl:mr-0 rtl:ml-1.5" />
            {isRTL ? 'إعادة تفعيل' : 'Reactivate'}
          </Button>
        )}

        {onHardDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onHardDelete}
            className="h-8 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-700 transition-all rounded-xl"
          >
            <Trash2 size={14} className="mr-1.5 rtl:mr-0 rtl:ml-1.5" />
            {isRTL ? 'حذف نهائي' : 'Permanent Delete'}
          </Button>
        )}

        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-8 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-700 transition-all rounded-xl"
          >
            <Trash2 size={14} className="mr-1.5 rtl:mr-0 rtl:ml-1.5" />
            {t('common.delete', 'Delete')}
          </Button>
        )}

        {onStatusChange && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onStatusChange}
            className="h-8 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all rounded-xl"
          >
            <Edit2 size={14} className="mr-1.5 rtl:mr-0 rtl:ml-1.5" />
            {t('common.changeStatus', 'Status')}
          </Button>
        )}

        {onExport && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onExport}
            className="h-8 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all rounded-xl"
          >
            <Download size={14} className="mr-1.5 rtl:mr-0 rtl:ml-1.5" />
            {t('common.export', 'Export')}
          </Button>
        )}

        {actions &&
          actions.map((act, index) => {
            const Icon = act.icon;
            return (
              <Button
                key={index}
                variant={act.variant || 'ghost'}
                size="sm"
                onClick={act.onClick}
                className={`h-8 text-xs font-bold transition-all rounded-xl ${act.className || ''}`}
              >
                {Icon && <Icon size={14} className="mr-1.5 rtl:mr-0 rtl:ml-1.5" />}
                {act.label}
              </Button>
            );
          })}

        {children}
      </div>

      <div className="border-l border-slate-200 dark:border-slate-700 pl-3.5 rtl:pl-0 rtl:border-l-0 rtl:border-r rtl:pr-3.5">
        <button
          onClick={onClear}
          className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          aria-label={t('common.clear', 'Clear')}
          title={isRTL ? 'إلغاء التحديد' : 'Clear selection'}
        >
          <X size={16} />
        </button>
      </div>
    </div>,
    document.body
  );
};

export default BulkActionToolbar;
