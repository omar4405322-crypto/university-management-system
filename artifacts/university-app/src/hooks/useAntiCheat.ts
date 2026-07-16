import { useState, useEffect, useCallback } from 'react';

export type ExamViolationType = 
  | 'TAB_SWITCH' 
  | 'BLUR' 
  | 'RIGHT_CLICK' 
  | 'COPY_PASTE' 
  | 'FULLSCREEN_EXIT';

export interface ExamViolation {
  type: ExamViolationType;
  occurredAt: string;
  details?: string;
}

export const useAntiCheat = (
  onViolation?: (violation: ExamViolation) => void,
  enabled: boolean = true
) => {
  const [violations, setViolations] = useState<ExamViolation[]>([]);

  const addViolation = useCallback((type: ExamViolationType, details?: string) => {
    if (!enabled) return;
    const newViolation: ExamViolation = {
      type,
      occurredAt: new Date().toISOString(),
      details,
    };
    setViolations(prev => [...prev, newViolation]);
    if (onViolation) onViolation(newViolation);
  }, [enabled, onViolation]);

  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        addViolation('TAB_SWITCH', 'User switched tab or minimized browser.');
      }
    };

    const handleBlur = () => {
      addViolation('BLUR', 'Window lost focus.');
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      addViolation('RIGHT_CLICK', 'Attempted to use right-click context menu.');
    };

    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      addViolation('COPY_PASTE', `Attempted to ${e.type}.`);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u'))
      ) {
        e.preventDefault();
        addViolation('TAB_SWITCH', 'Attempted to open DevTools.');
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        addViolation('FULLSCREEN_EXIT', 'Exited fullscreen mode.');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('cut', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('cut', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [addViolation, enabled]);

  return { violations, violationCount: violations.length };
};
