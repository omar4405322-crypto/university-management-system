import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
}) => {
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-[95vw]',
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div
        className={`relative w-full ${sizes[size]} bg-brand-bg-card rounded-[2rem] shadow-overlay border border-brand-border overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500`}
      >
        <div className="card-header">
          <div className="flex items-start justify-between w-full gap-4">
            <div className="flex flex-col text-start flex-1 min-w-0">
              <h2 className="heading-1 m-0">{title}</h2>
              {subtitle && <p className="text-caption mt-2">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-2xl bg-surface-subtle text-brand-text-secondary hover:text-error hover:bg-error/10 transition-all duration-200 focus-ring shrink-0"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 max-h-[60vh] sm:max-h-[75vh] overflow-y-auto custom-scrollbar overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
