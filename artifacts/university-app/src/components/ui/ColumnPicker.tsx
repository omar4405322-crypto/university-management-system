import React, { useState } from 'react';
import { Columns3, GripVertical, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface ColumnDef {
  id: string;
  header: string | React.ReactNode;
  cell: (row: Record<string, unknown>) => React.ReactNode;
  isEssential?: boolean; // Cannot be hidden
}

interface ColumnPickerProps {
  columns: ColumnDef[];
  visibleColumns: string[];
  onChange: (visibleColumnIds: string[]) => void;
}

const ColumnPicker: React.FC<ColumnPickerProps> = ({ columns, visibleColumns, onChange }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  // In a real app we would use a Dnd library, but here we'll just provide simple toggles
  // since a full DnD setup would require extra dependencies.

  const toggleColumn = (id: string, isEssential?: boolean) => {
    if (isEssential) return;
    if (visibleColumns.includes(id)) {
      onChange(visibleColumns.filter((c) => c !== id));
    } else {
      // Keep order based on original columns array
      const next = [...visibleColumns, id];
      onChange(columns.filter((c) => next.includes(c.id)).map((c) => c.id));
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-2 rounded-xl text-brand-text-secondary hover:text-brand-primary-600 hover:bg-surface-subtle transition-colors"
        title="Manage Columns"
      >
        <Columns3 size={18} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 rtl:right-auto rtl:left-0 mt-2 w-56 bg-brand-bg-card dark:bg-slate-800 rounded-2xl shadow-2xl border border-brand-border dark:border-brand-border z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
            <div className="p-3 border-b border-brand-border dark:border-brand-border bg-surface-subtle dark:bg-slate-900/50">
              <span className="text-xs font-black uppercase tracking-widest text-brand-text-muted">
                Manage Columns
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {columns.map((col) => {
                const isVisible = visibleColumns.includes(col.id);
                return (
                  <label
                    key={col.id}
                    className={`flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
                      col.isEssential ? 'opacity-60 cursor-not-allowed' : 'hover:bg-surface-subtle dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        isVisible
                          ? 'bg-brand-primary-600 border-brand-primary-600 text-white'
                          : 'border-brand-border dark:border-slate-600'
                      }`}
                    >
                      {isVisible && <Check size={12} strokeWidth={3} />}
                    </div>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isVisible}
                      disabled={col.isEssential}
                      onChange={() => toggleColumn(col.id, col.isEssential)}
                    />
                    <span className="text-sm font-bold text-brand-text-primary dark:text-brand-text-main flex-1 truncate select-none">
                      {typeof col.header === 'string' ? col.header : col.id}
                    </span>
                    <GripVertical size={14} className="text-brand-text-muted opacity-50" />
                  </label>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ColumnPicker;
