import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  dismissToast: (id: string) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Record<string, { timeoutId: ReturnType<typeof setTimeout>; remaining: number; start: number }>>({});

  const dismissToast = useCallback((id: string) => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id].timeoutId);
      delete timersRef.current[id];
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const pauseToast = useCallback((id: string) => {
    const entry = timersRef.current[id];
    if (entry) {
      clearTimeout(entry.timeoutId);
      const elapsed = Date.now() - entry.start;
      entry.remaining = Math.max(1000, entry.remaining - elapsed);
    }
  }, []);

  const resumeToast = useCallback((id: string) => {
    const entry = timersRef.current[id];
    if (entry) {
      entry.start = Date.now();
      entry.timeoutId = setTimeout(() => dismissToast(id), entry.remaining);
    }
  }, [dismissToast]);

  const showToast = useCallback((message: string, type: ToastType = 'info', customDuration?: number) => {
    const duration = customDuration ?? (type === 'error' ? 6000 : 4000);
    
    setToasts(prev => {
      const existing = prev.find(t => t.message === message && t.type === type);
      if (existing) {
        const entry = timersRef.current[existing.id];
        if (entry) {
          clearTimeout(entry.timeoutId);
          entry.remaining = duration;
          entry.start = Date.now();
          entry.timeoutId = setTimeout(() => dismissToast(existing.id), duration);
        }
        return prev;
      }

      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      timersRef.current[id] = {
        timeoutId: setTimeout(() => dismissToast(id), duration),
        remaining: duration,
        start: Date.now(),
      };
      return [...prev.slice(-4), { id, message, type, duration }];
    });
  }, [dismissToast]);

  const success = useCallback((msg: string, dur?: number) => showToast(msg, 'success', dur), [showToast]);
  const error = useCallback((msg: string, dur?: number) => showToast(msg, 'error', dur), [showToast]);
  const warning = useCallback((msg: string, dur?: number) => showToast(msg, 'warning', dur), [showToast]);
  const info = useCallback((msg: string, dur?: number) => showToast(msg, 'info', dur), [showToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast, success, error, warning, info }}>
      {children}
      <ToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
        onPause={pauseToast}
        onResume={resumeToast}
      />
    </ToastContext.Provider>
  );
}

function ToastContainer({
  toasts,
  onDismiss,
  onPause,
  onResume,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}) {
  const { t } = useTranslation();
  if (toasts.length === 0) return null;

  const colorMap: Record<ToastType, string> = {
    success: 'bg-emerald-600 text-white shadow-emerald-950/20',
    error:   'bg-rose-600 text-white shadow-rose-950/20',
    warning: 'bg-amber-400 text-slate-900 shadow-amber-950/20',
    info:    'bg-brand-navy-600 text-white shadow-navy-950/20',
  };

  const renderIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={18} className="shrink-0 text-emerald-100" aria-hidden="true" />;
      case 'error':
        return <AlertCircle size={18} className="shrink-0 text-rose-100" aria-hidden="true" />;
      case 'warning':
        return <AlertTriangle size={18} className="shrink-0 text-slate-900" aria-hidden="true" />;
      case 'info':
      default:
        return <Info size={18} className="shrink-0 text-blue-100" aria-hidden="true" />;
    }
  };

  return (
    <div
      className="fixed bottom-4 end-4 z-[9999] flex flex-col gap-2 pointer-events-none max-w-full px-4 sm:px-0"
      role="region"
      aria-live="polite"
      aria-label={t('common.notifications', 'Notifications')}
    >
      {toasts.map(toast => {
        const isError = toast.type === 'error';
        return (
          <div
            key={toast.id}
            tabIndex={0}
            onMouseEnter={() => onPause(toast.id)}
            onMouseLeave={() => onResume(toast.id)}
            onFocus={() => onPause(toast.id)}
            onBlur={() => onResume(toast.id)}
            onKeyDown={e => {
              if (e.key === 'Escape') onDismiss(toast.id);
            }}
            className={`pointer-events-auto flex items-center justify-between gap-3 min-w-[280px] max-w-[420px] px-4 py-3 rounded-xl shadow-xl text-sm font-semibold transition-all duration-200 border border-white/10 ${colorMap[toast.type]}`}
            role={isError ? 'alert' : 'status'}
            aria-live={isError ? 'assertive' : 'polite'}
            aria-atomic="true"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {renderIcon(toast.type)}
              <span className="truncate break-words">{toast.message}</span>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="p-1 rounded-lg opacity-75 hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/40 transition-all cursor-pointer shrink-0"
              aria-label={t('common.dismissNotification', 'Dismiss notification')}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
