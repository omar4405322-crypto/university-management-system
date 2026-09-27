import React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  closeAriaLabel?: string;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  ariaLabel?: string;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]',
].join(', ');

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = "md",
  closeAriaLabel,
  initialFocusRef,
  returnFocusRef,
  ariaLabel,
}) => {
  const titleId = React.useId();
  const subtitleId = React.useId();
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const previousActiveElementRef = React.useRef<HTMLElement | null>(null);
  const initialFocusRefCapture = React.useRef(initialFocusRef);
  initialFocusRefCapture.current = initialFocusRef;
  const returnFocusRefCapture = React.useRef(returnFocusRef);
  returnFocusRefCapture.current = returnFocusRef;

  // Handle Escape key unconditionally to adhere to React Rules of Hooks
  React.useEffect(() => {
    if (!isOpen) return;

    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      previousActiveElementRef.current = document.activeElement;
    }

    const previousOverflow = typeof document !== "undefined" ? document.body.style.overflow : "";
    if (typeof document !== "undefined" && document.body) {
      document.body.style.overflow = "hidden";
    }

    // Set initial focus inside dialog
    const focusTimer = setTimeout(() => {
      const explicitFocus = initialFocusRefCapture.current?.current;
      if (explicitFocus && typeof explicitFocus.focus === "function") {
        explicitFocus.focus();
        return;
      }

      if (dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        const visibleFocusable = Array.from(focusable).filter(
          (el) => !el.hasAttribute("disabled") && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0)
        );

        if (visibleFocusable.length > 0) {
          visibleFocusable[0].focus();
        } else {
          dialogRef.current.focus();
        }
      }
    }, 10);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        const dialogNode = dialogRef.current;
        if (!dialogNode) return;

        const focusable = dialogNode.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        const visibleFocusable = Array.from(focusable).filter(
          (el) => !el.hasAttribute("disabled") && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0)
        );

        if (visibleFocusable.length === 0) {
          e.preventDefault();
          dialogNode.focus();
          return;
        }

        const first = visibleFocusable[0];
        const last = visibleFocusable[visibleFocusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !dialogNode.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !dialogNode.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      if (typeof document !== "undefined" && document.body) {
        document.body.style.overflow = previousOverflow;
      }
      const targetToFocus = returnFocusRefCapture.current?.current || previousActiveElementRef.current;
      if (targetToFocus && typeof targetToFocus.focus === "function") {
        setTimeout(() => {
          if (typeof document !== "undefined" && document.body && document.body.contains(targetToFocus)) {
            targetToFocus.focus();
          }
        }, 10);
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
    full: "max-w-[95vw]",
  };

  const hasTitle = Boolean(title);
  const hasSubtitle = Boolean(subtitle);

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300"
      aria-hidden={!isOpen}
    >
      <div
        className="absolute inset-0 bg-[var(--brand-overlay)] backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={hasTitle ? titleId : undefined}
        aria-label={!hasTitle && ariaLabel ? ariaLabel : undefined}
        aria-describedby={hasSubtitle ? subtitleId : undefined}
        tabIndex={-1}
        className={`relative w-full ${sizes[size]} bg-brand-bg-elevated rounded-2xl shadow-overlay border border-brand-border overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 outline-none`}
      >
        <div className="card-header">
          <div className="flex items-start justify-between w-full gap-4">
            <div className="flex flex-col text-start flex-1 min-w-0">
              {hasTitle && (
                <h2
                  id={titleId}
                  className="m-0 text-xl font-black leading-tight tracking-heading text-brand-text-primary"
                >
                  {title}
                </h2>
              )}
              {hasSubtitle && (
                <p
                  id={subtitleId}
                  className="mt-1 text-sm font-medium leading-relaxed text-brand-text-secondary"
                >
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeAriaLabel || "Close dialog"}
              className="p-2 rounded-2xl bg-surface-subtle text-brand-text-secondary hover:text-error hover:bg-error/10 transition-all duration-200 focus-ring shrink-0"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 max-h-[60vh] sm:max-h-[75vh] overflow-y-auto custom-scrollbar overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default Modal;
