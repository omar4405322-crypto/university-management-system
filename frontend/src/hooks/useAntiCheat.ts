import { useEffect, useRef, useCallback } from 'react';
import { examSessionService } from '../services/examSession.service';

interface AntiCheatOptions {
  sessionId: number;
  enabled: boolean;
  onAutoSubmit: () => void;   // called if server forces submission
  onWarning: (count: number, remaining: number) => void; // show toast warning
}

export const useAntiCheat = ({ sessionId, enabled, onAutoSubmit, onWarning }: AntiCheatOptions) => {
  const reportingRef = useRef(false); // prevent double-reports

  const reportViolation = useCallback(async (type: string, metadata?: object) => {
    if (!enabled || reportingRef.current) return;
    reportingRef.current = true;
    try {
      const result = await examSessionService.reportViolation(sessionId, type, metadata);
      if (result.autoSubmitted) {
        onAutoSubmit();
      } else {
        onWarning(result.violationCount, result.warningsRemaining);
      }
    } catch (_e) {
      // silently fail — don't block student
    } finally {
      reportingRef.current = false;
    }
  }, [sessionId, enabled, onAutoSubmit, onWarning]);

  useEffect(() => {
    if (!enabled) return;

    // 1. Tab switch / window blur detection
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        reportViolation('TAB_SWITCH');
      }
    };

    const handleWindowBlur = () => {
      reportViolation('WINDOW_BLUR');
    };

    // 2. Copy/Paste/Right-click prevention
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      reportViolation('COPY_ATTEMPT');
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      reportViolation('PASTE_ATTEMPT');
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      reportViolation('RIGHT_CLICK');
    };

    // 3. Keyboard shortcut blocking (Ctrl+C, Ctrl+V, Ctrl+U, F12, etc.)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block DevTools shortcuts
      if (e.key === 'F12') {
        e.preventDefault();
        reportViolation('DEVTOOLS_OPEN');
        return;
      }
      if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) {
        e.preventDefault();
        reportViolation('DEVTOOLS_OPEN');
        return;
      }
      // Block copy/paste/select-all/view-source
      if (e.ctrlKey && ['C', 'V', 'A', 'U'].includes(e.key.toUpperCase())) {
        e.preventDefault();
        if (e.key.toUpperCase() === 'C') reportViolation('COPY_ATTEMPT');
        if (e.key.toUpperCase() === 'V') reportViolation('PASTE_ATTEMPT');
      }
    };

    // 4. Fullscreen exit detection
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        reportViolation('FULLSCREEN_EXIT');
      }
    };

    // Register all listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Request fullscreen on exam start
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {
        // Fullscreen not supported or denied — continue without it
      });
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);

      // Exit fullscreen when exam ends
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [enabled, reportViolation]);
};
