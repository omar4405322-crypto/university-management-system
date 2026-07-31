import { useState, useEffect, useCallback, useRef } from 'react';
import type { DeviceInfo, AntiCheatSettings } from '../pages/exams/examUtils';
import { DEFAULT_ANTI_CHEAT_SETTINGS } from '../pages/exams/examUtils';

// ── Violation Types ──────────────────────────────────────────────────────────

export type ExamViolationType =
  | 'TAB_SWITCH'
  | 'BLUR'
  | 'RIGHT_CLICK'
  | 'COPY_PASTE'
  | 'FULLSCREEN_EXIT'
  | 'SCREENSHOT'
  | 'WINDOW_RESIZE'
  | 'MULTI_TAB'
  | 'DEVTOOLS'
  | 'LEAVE_TIMEOUT'
  | 'LOCATION_DENIED';

export interface ExamViolation {
  type: ExamViolationType;
  occurredAt: string;
  details?: string;
}

// ── Device Fingerprinting ────────────────────────────────────────────────────

function parseUserAgent(): { deviceType: string; browserName: string; browserVersion: string; os: string } {
  const ua = navigator.userAgent;
  let deviceType = 'Desktop';
  if (/Mobi|Android/i.test(ua)) deviceType = 'Mobile';
  else if (/Tablet|iPad/i.test(ua)) deviceType = 'Tablet';

  let browserName = 'Unknown';
  let browserVersion = '';
  if (/Edg\//i.test(ua)) {
    browserName = 'Edge';
    browserVersion = ua.match(/Edg\/([\d.]+)/)?.[1] || '';
  } else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) {
    browserName = 'Opera';
    browserVersion = ua.match(/(?:OPR|Opera)\/([\d.]+)/)?.[1] || '';
  } else if (/Chrome\//i.test(ua) && !/Edg/i.test(ua)) {
    browserName = 'Chrome';
    browserVersion = ua.match(/Chrome\/([\d.]+)/)?.[1] || '';
  } else if (/Firefox\//i.test(ua)) {
    browserName = 'Firefox';
    browserVersion = ua.match(/Firefox\/([\d.]+)/)?.[1] || '';
  } else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) {
    browserName = 'Safari';
    browserVersion = ua.match(/Version\/([\d.]+)/)?.[1] || '';
  }

  let os = 'Unknown';
  if (/Windows NT 10/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/CrOS/i.test(ua)) os = 'ChromeOS';

  return { deviceType, browserName, browserVersion, os };
}

export function collectDeviceInfo(): DeviceInfo {
  const { deviceType, browserName, browserVersion, os } = parseUserAgent();
  return {
    deviceType,
    browserName,
    browserVersion,
    operatingSystem: os,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    userAgent: navigator.userAgent,
    language: navigator.language || 'unknown',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
    touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    concurrentScreens: (window.screen as any).isExtended ? 2 : 1,
  };
}

export async function fetchIPAddress(): Promise<string> {
  const endpoints = [
    'https://api.ipify.org?format=json',
    'https://api.ipify.org',
    'https://ipapi.co/json/',
    'https://api.db-ip.com/v2/free/json',
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) continue;
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        const ip = json.ip || json.ipAddress || json.query;
        if (ip && typeof ip === 'string') return ip.trim();
      } catch {
        if (text && text.trim().length >= 7 && text.trim().length <= 45) {
          return text.trim();
        }
      }
    } catch {
      /* try next endpoint */
    }
  }

  return 'Local / Unknown IP';
}

export function requestGeolocation(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    // Try high accuracy first
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => {
        // Fallback to low accuracy
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
          () => resolve(null),
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}

// ── Multi-Tab Lock ───────────────────────────────────────────────────────────

const EXAM_LOCK_PREFIX = 'exam_tab_lock_';
const EXAM_LOCK_HEARTBEAT = 2000;

function acquireExamLock(examId: string): boolean {
  const key = EXAM_LOCK_PREFIX + examId;
  const existing = localStorage.getItem(key);
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      if (Date.now() - parsed.timestamp < 5000) {
        return false;
      }
    } catch { /* ignore */ }
  }
  const sessionId = Math.random().toString(36).substring(2);
  sessionStorage.setItem('exam_session_id', sessionId);
  localStorage.setItem(key, JSON.stringify({ sessionId, timestamp: Date.now() }));
  return true;
}

function heartbeatExamLock(examId: string): void {
  const key = EXAM_LOCK_PREFIX + examId;
  const sessionId = sessionStorage.getItem('exam_session_id') || '';
  localStorage.setItem(key, JSON.stringify({ sessionId, timestamp: Date.now() }));
}

function isExamLockOwned(examId: string): boolean {
  const key = EXAM_LOCK_PREFIX + examId;
  const existing = localStorage.getItem(key);
  if (!existing) return true;
  try {
    const parsed = JSON.parse(existing);
    const mySessionId = sessionStorage.getItem('exam_session_id') || '';
    return parsed.sessionId === mySessionId;
  } catch {
    return true;
  }
}

function releaseExamLock(examId: string): void {
  const key = EXAM_LOCK_PREFIX + examId;
  const existing = localStorage.getItem(key);
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      const mySessionId = sessionStorage.getItem('exam_session_id') || '';
      if (parsed.sessionId === mySessionId) {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface UseAntiCheatOptions {
  examId?: string;
  settings?: Partial<AntiCheatSettings>;
  onViolation?: (violation: ExamViolation) => void;
  onExamCancelled?: () => void;
  enabled?: boolean;
}

export interface UseAntiCheatResult {
  violations: ExamViolation[];
  violationCount: number;
  deviceInfo: DeviceInfo | null;
  leaveCount: number;
  isCountdownActive: boolean;
  countdownSeconds: number;
  examCancelled: boolean;
  multiTabBlocked: boolean;
  refreshDeviceInfo: () => Promise<DeviceInfo | null>;
}

export const useAntiCheat = (
  onViolation?: (violation: ExamViolation) => void,
  enabled: boolean = true,
  options?: UseAntiCheatOptions
): UseAntiCheatResult => {
  const examId = options?.examId || '';

  // Store options in refs so callbacks stay stable and don't re-create event listeners
  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  const onExamCancelledRef = useRef(options?.onExamCancelled);
  onExamCancelledRef.current = options?.onExamCancelled;

  const [violations, setViolations] = useState<ExamViolation[]>(() => {
    if (!examId) return [];
    const saved = localStorage.getItem(`exam_violations_${examId}`);
    return saved ? JSON.parse(saved) : [];
  });

  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(() => {
    if (!examId) return collectDeviceInfo();
    const saved = localStorage.getItem(`exam_device_${examId}`);
    return saved ? JSON.parse(saved) : collectDeviceInfo();
  });

  const [leaveCount, setLeaveCount] = useState<number>(() => {
    if (!examId) return 0;
    const saved = localStorage.getItem(`exam_leaves_${examId}`);
    return saved ? parseInt(saved) : 0;
  });

  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [examCancelled, setExamCancelled] = useState(false);
  const [multiTabBlocked, setMultiTabBlocked] = useState(false);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastResizeRef = useRef<number>(0);
  const lastLeaveTimeRef = useRef<number>(0);

  const settings: AntiCheatSettings = {
    ...DEFAULT_ANTI_CHEAT_SETTINGS,
    ...options?.settings,
  };

  // Save state to localStorage whenever updated
  useEffect(() => {
    if (examId && violations.length > 0) {
      localStorage.setItem(`exam_violations_${examId}`, JSON.stringify(violations));
    }
  }, [violations, examId]);

  useEffect(() => {
    if (examId && deviceInfo) {
      localStorage.setItem(`exam_device_${examId}`, JSON.stringify(deviceInfo));
    }
  }, [deviceInfo, examId]);

  useEffect(() => {
    if (examId) {
      localStorage.setItem(`exam_leaves_${examId}`, leaveCount.toString());
    }
  }, [leaveCount, examId]);

  const addViolation = useCallback((type: ExamViolationType, details?: string) => {
    const newViolation: ExamViolation = {
      type,
      occurredAt: new Date().toISOString(),
      details,
    };
    setViolations((prev) => [...prev, newViolation]);
    if (onViolationRef.current) {
      onViolationRef.current(newViolation);
    }
  }, []);

  // ── Device Info Collection (Runs immediately on mount regardless of enabled) ──
  const refreshDeviceInfo = useCallback(async (): Promise<DeviceInfo | null> => {
    const baseInfo = collectDeviceInfo();
    setDeviceInfo(baseInfo);

    // Fetch IP in background
    const ip = await fetchIPAddress();
    let updated = { ...baseInfo, ipAddress: ip };

    // Request GPS location
    const loc = await requestGeolocation();
    if (loc) {
      updated = {
        ...updated,
        latitude: loc.lat,
        longitude: loc.lng,
        locationAccuracy: loc.accuracy,
        locationDenied: false,
      };
    } else {
      updated = { ...updated, locationDenied: true };
    }

    setDeviceInfo(updated);
    if (examId) {
      localStorage.setItem(`exam_device_${examId}`, JSON.stringify(updated));
    }
    return updated;
  }, [examId]);

  useEffect(() => {
    refreshDeviceInfo();
  }, [refreshDeviceInfo]);

  // ── Multi-Tab Detection ────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !examId || !settings.blockMultipleTabs) return;

    const acquired = acquireExamLock(examId);
    if (!acquired) {
      setMultiTabBlocked(true);
      addViolation('MULTI_TAB', 'Exam is already open in another tab.');
      return;
    }

    heartbeatRef.current = setInterval(() => {
      heartbeatExamLock(examId);
      if (!isExamLockOwned(examId)) {
        setMultiTabBlocked(true);
        addViolation('MULTI_TAB', 'Another tab took over the exam session.');
      }
    }, EXAM_LOCK_HEARTBEAT);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === EXAM_LOCK_PREFIX + examId && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          const mySessionId = sessionStorage.getItem('exam_session_id') || '';
          if (parsed.sessionId !== mySessionId) {
            setMultiTabBlocked(true);
            addViolation('MULTI_TAB', 'Exam opened in another tab/window.');
          }
        } catch { /* ignore */ }
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      releaseExamLock(examId);
      window.removeEventListener('storage', handleStorage);
    };
  }, [enabled, examId, settings.blockMultipleTabs, addViolation]);

  // ── Focus / Leave Detection with Countdown ───────────────────────────────────
  useEffect(() => {
    if (!enabled || examCancelled) return;

    const startCountdown = () => {
      if (countdownRef.current) return;
      setIsCountdownActive(true);
      setCountdownSeconds(settings.leaveGraceSeconds);
      let remaining = settings.leaveGraceSeconds;

      countdownRef.current = setInterval(() => {
        remaining -= 1;
        setCountdownSeconds(remaining);
        if (remaining <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          countdownRef.current = null;
          setIsCountdownActive(false);
          setExamCancelled(true);
          addViolation('LEAVE_TIMEOUT', `Student did not return within ${settings.leaveGraceSeconds} seconds. Exam cancelled.`);
          if (onExamCancelledRef.current) onExamCancelledRef.current();
        }
      }, 1000);
    };

    const stopCountdown = () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      setIsCountdownActive(false);
      setCountdownSeconds(0);
    };

    const handleLeave = (reason: 'TAB_SWITCH' | 'BLUR') => {
      const now = Date.now();
      // Debounce leaves so blur + visibilitychange in the same millisecond count as 1 leave
      if (now - lastLeaveTimeRef.current < 1500) return;
      lastLeaveTimeRef.current = now;

      addViolation(reason, reason === 'TAB_SWITCH' ? 'User switched tab or minimized browser.' : 'Window lost focus.');

      setLeaveCount((prev) => {
        const newCount = prev + 1;
        if (newCount > settings.maxLeavesBeforeCancel) {
          startCountdown();
        }
        return newCount;
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleLeave('TAB_SWITCH');
      } else {
        stopCountdown();
      }
    };

    const handleBlur = () => {
      handleLeave('BLUR');
    };

    const handleFocus = () => {
      stopCountdown();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      stopCountdown();
    };
  }, [enabled, examCancelled, settings.maxLeavesBeforeCancel, settings.leaveGraceSeconds, addViolation]);

  // ── Anti-Cheat Listeners (ContextMenu, Copy, Cut, Paste, Keydown, Screenshot, DevTools, Resize) ──
  useEffect(() => {
    if (!enabled || examCancelled) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      addViolation('RIGHT_CLICK', 'Attempted to use right-click context menu.');
    };

    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      addViolation('COPY_PASTE', `Attempted to ${e.type}.`);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent F12, Ctrl+Shift+I/J/C, Ctrl+U
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u'))
      ) {
        e.preventDefault();
        addViolation('DEVTOOLS', 'Attempted to open DevTools.');
      }

      // PrintScreen / Screenshot detection
      if (e.key === 'PrintScreen' || e.key === 'Snapshot') {
        e.preventDefault();
        addViolation('SCREENSHOT', 'Attempted to take a screenshot (PrintScreen key).');
      }

      // Prevent Ctrl+P (print)
      if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        addViolation('SCREENSHOT', 'Attempted to print the page.');
      }

      // Prevent Ctrl+S (save)
      if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        addViolation('COPY_PASTE', 'Attempted to save the page.');
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        addViolation('FULLSCREEN_EXIT', 'Exited fullscreen mode.');
      }
    };

    const handleResize = () => {
      const now = Date.now();
      if (now - lastResizeRef.current < 2500) return;
      lastResizeRef.current = now;

      const widthRatio = window.innerWidth / window.screen.width;
      const heightRatio = window.innerHeight / window.screen.height;
      if (widthRatio < 0.7 || heightRatio < 0.7) {
        addViolation('WINDOW_RESIZE', `Window resized to ${window.innerWidth}x${window.innerHeight}. Possible split-screen.`);
      }
    };

    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
    };

    // Inject CSS rule to prevent text selection during exam
    const styleEl = document.createElement('style');
    styleEl.id = 'anti-cheat-no-select';
    styleEl.textContent = `
      .exam-anti-cheat-active {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
      }
      .exam-anti-cheat-active textarea,
      .exam-anti-cheat-active input[type="text"],
      .exam-anti-cheat-active input[type="number"] {
        -webkit-user-select: text !important;
        user-select: text !important;
      }
    `;
    document.head.appendChild(styleEl);
    document.body.classList.add('exam-anti-cheat-active');

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('cut', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('dragstart', handleDragStart);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('cut', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('dragstart', handleDragStart);
      window.removeEventListener('resize', handleResize);
      document.body.classList.remove('exam-anti-cheat-active');
      const el = document.getElementById('anti-cheat-no-select');
      if (el) el.remove();
    };
  }, [enabled, examCancelled, addViolation]);

  return {
    violations,
    violationCount: violations.length,
    deviceInfo,
    leaveCount,
    isCountdownActive,
    countdownSeconds,
    examCancelled,
    multiTabBlocked,
    refreshDeviceInfo,
  };
};
