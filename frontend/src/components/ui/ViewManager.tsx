import React, { useState } from 'react';
import { Save, Plus, Trash2, CheckCircle, LayoutTemplate } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SavedView } from '../../hooks/useSavedViews';
import Input from './Input';
import Button from './Button';

interface ViewManagerProps {
  views: SavedView[];
  activeViewId: string;
  onSelectView: (id: string) => void;
  onSaveView: (view: SavedView) => void;
  onDeleteView: (id: string) => void;
  onSetDefault: (id: string) => void;
  currentViewState: Omit<SavedView, 'id' | 'name' | 'isDefault'>;
}

const ViewManager: React.FC<ViewManagerProps> = ({
  views,
  activeViewId,
  onSelectView,
  onSaveView,
  onDeleteView,
  onSetDefault,
  currentViewState,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  const activeView = views.find((v) => v.id === activeViewId);

  const handleSaveNew = () => {
    if (!newViewName.trim()) return;
    onSaveView({
      ...currentViewState,
      id: Date.now().toString(),
      name: newViewName.trim(),
      isDefault: false,
    });
    setNewViewName('');
    setIsCreating(false);
    setIsOpen(false);
  };

  const handleUpdateCurrent = () => {
    if (activeView) {
      onSaveView({
        ...activeView,
        ...currentViewState,
      });
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-bold bg-surface-subtle dark:bg-slate-800 rounded-xl hover:bg-brand-primary-50 dark:hover:bg-brand-primary-900/20 text-brand-text-secondary hover:text-brand-brand-green-dark transition-colors"
      >
        <LayoutTemplate size={16} />
        {activeView?.name || 'View'}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsOpen(false);
              setIsCreating(false);
            }}
          />
          <div className="absolute top-full right-0 rtl:right-auto rtl:left-0 mt-2 w-64 bg-brand-bg-card dark:bg-slate-800 rounded-2xl shadow-2xl border border-brand-border dark:border-brand-border z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
            <div className="p-2 border-b border-brand-border dark:border-brand-border bg-surface-subtle dark:bg-slate-900/50">
              <span className="px-2 text-xs font-black uppercase tracking-widest text-brand-text-muted">
                Saved Views
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
              {views.map((view) => (
                <div
                  key={view.id}
                  className={`flex items-center justify-between px-3 py-2 hover:bg-surface-subtle dark:hover:bg-slate-700/50 cursor-pointer group ${
                    view.id === activeViewId ? 'text-brand-brand-green-dark bg-brand-primary-50/50 dark:bg-brand-primary-900/10' : 'text-brand-text-secondary'
                  }`}
                  onClick={() => {
                    onSelectView(view.id);
                    setIsOpen(false);
                  }}
                >
                  <span className="text-sm font-bold truncate flex-1">{view.name}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!view.isDefault && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetDefault(view.id);
                        }}
                        className="p-1 text-brand-text-muted hover:text-brand-brand-green-dark"
                        title="Set as Default"
                      >
                        <CheckCircle size={14} />
                      </button>
                    )}
                    {views.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteView(view.id);
                        }}
                        className="p-1 text-brand-text-muted hover:text-error"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-surface-subtle dark:bg-slate-900/50 border-t border-brand-border dark:border-brand-border space-y-2">
              {isCreating ? (
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    placeholder="View Name"
                    value={newViewName}
                    onChange={(e) => setNewViewName(e.target.value)}
                    className="h-8 text-sm px-2"
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveNew()}
                  />
                  <Button size="sm" onClick={handleSaveNew} className="h-8 px-3">
                    <Save size={14} />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <button
                    className="flex items-center gap-2 px-2 py-1.5 text-xs font-bold text-brand-text-secondary hover:text-brand-brand-green-dark rounded-lg hover:bg-brand-primary-50 dark:hover:bg-brand-primary-900/20 transition-colors w-full"
                    onClick={() => setIsCreating(true)}
                  >
                    <Plus size={14} /> Save as New View
                  </button>
                  <button
                    className="flex items-center gap-2 px-2 py-1.5 text-xs font-bold text-brand-text-secondary hover:text-brand-brand-green-dark rounded-lg hover:bg-brand-primary-50 dark:hover:bg-brand-primary-900/20 transition-colors w-full"
                    onClick={handleUpdateCurrent}
                  >
                    <Save size={14} /> Update "{activeView?.name}"
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ViewManager;
