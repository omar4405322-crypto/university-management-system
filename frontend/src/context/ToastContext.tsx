import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

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
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismissToast = useCallback((id: string) => {
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(prev => [...prev.slice(-4), { id, message, type, duration }]);
    timersRef.current[id] = setTimeout(() => dismissToast(id), duration);
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  const colorMap: Record<ToastType, string> = {
    success: 'bg-brand-green-dark text-white',
    error:   'bg-red-500 text-white',
    warning: 'bg-amber-400 text-brand-navy-500',
    info:    'bg-brand-navy-500 text-white',
  };

  return (
    <div
      className="fixed bottom-4 end-4 z-[9999] flex flex-col gap-2"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-center justify-between gap-3 min-w-[280px] max-w-[380px] px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-toast-in ${colorMap[toast.type]}`}
          role="alert"
        >
          <span>{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="opacity-70 hover:opacity-100 transition-opacity text-lg leading-none"
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
