import type { TFunction } from 'i18next';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExamQuestion {
  id: number | string;
  text: string;
  type: string;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  correctAnswer: string;
  points?: number;
  order?: number;
}

export interface AnswerMap {
  [questionId: string]: string;
}

// ── Answer Normalization ─────────────────────────────────────────────────────
// The backend may return answers as either:
//   1. An array: [{questionId: "1", answer: "A"}, ...]
//   2. A map/object: {"1": "A", "2": "B", ...}
// This normalizes both to a map for consistent access.

export function normalizeAnswers(
  answers: any
): AnswerMap {
  if (!answers) return {};

  // Already a map/object (not array)
  if (typeof answers === 'object' && !Array.isArray(answers)) {
    return answers as AnswerMap;
  }

  // Array format → convert to map
  if (Array.isArray(answers)) {
    const map: AnswerMap = {};
    for (const item of answers) {
      if (item && item.questionId != null) {
        map[String(item.questionId)] = String(item.answer ?? '');
      }
    }
    return map;
  }

  return {};
}

// ── Exam Status ──────────────────────────────────────────────────────────────

export type ExamStatus = 'TODAY' | 'UPCOMING' | 'COMPLETED';

export function getExamStatus(examOrDate: any): ExamStatus {
  if (!examOrDate) return 'COMPLETED';

  // If passed an exam object
  if (typeof examOrDate === 'object' && examOrDate !== null) {
    if (isExamEnded(examOrDate)) return 'COMPLETED';

    const dateStr = examOrDate.date;
    if (!dateStr) return 'COMPLETED';

    const examDate = new Date(dateStr);
    const today = new Date();
    examDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    if (examDate.getTime() === today.getTime()) return 'TODAY';
    if (examDate > today) return 'UPCOMING';
    return 'COMPLETED';
  }

  // Fallback if passed a string date
  const examDate = new Date(String(examOrDate));
  const today = new Date();
  examDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  if (examDate.getTime() === today.getTime()) return 'TODAY';
  if (examDate > today) return 'UPCOMING';
  return 'COMPLETED';
}

export function getDaysUntil(dateStr: string): number {
  const examDate = new Date(dateStr);
  const today = new Date();
  examDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function isExamStarted(exam: any): boolean {
  if (!exam || !exam.date) return true;
  const now = new Date();
  const examDate = new Date(exam.date);
  
  if (exam.startTime) {
    const [hours, minutes] = String(exam.startTime).split(':').map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
      examDate.setHours(hours, minutes, 0, 0);
      return now.getTime() >= examDate.getTime();
    }
  }

  const todayStart = new Date(exam.date);
  todayStart.setHours(0, 0, 0, 0);
  return now.getTime() >= todayStart.getTime();
}

export function isExamEnded(exam: any): boolean {
  if (!exam || !exam.date) return false;
  
  const now = new Date();
  const examDate = new Date(exam.date);
  
  if (exam.endTime) {
    const [hours, minutes] = String(exam.endTime).split(':').map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
      examDate.setHours(hours, minutes, 0, 0);
      return now.getTime() >= examDate.getTime();
    }
  }

  // Fallback if endTime is not structured
  const todayEnd = new Date(exam.date);
  todayEnd.setHours(23, 59, 59, 999);
  return now.getTime() >= todayEnd.getTime();
}

export type TimeWindowStatus = 'NOT_STARTED' | 'ACTIVE' | 'EXPIRED';

export function getExamTimeWindowStatus(exam: any): TimeWindowStatus {
  if (!isExamStarted(exam)) return 'NOT_STARTED';
  if (isExamEnded(exam)) return 'EXPIRED';
  return 'ACTIVE';
}

// ── Exam Labels ──────────────────────────────────────────────────────────────

export function getExamLabel(examOrType: any, t: TFunction): string {
  if (typeof examOrType === 'object' && examOrType) {
    if (examOrType.title) return examOrType.title;
    const type = examOrType.type;
    if (type === 'FINAL') return t('exams.final');
    if (type === 'MIDTERM') return t('exams.midterm');
    return t('exams.quiz');
  }
  const type = String(examOrType);
  if (type === 'FINAL') return t('exams.final');
  if (type === 'MIDTERM') return t('exams.midterm');
  return t('exams.quiz');
}

// ── Duration Calculation ─────────────────────────────────────────────────────

export interface DurationInfo {
  isValid: boolean;
  minutes: number;
  text: string;
}

export function calculateDuration(
  startTime: string,
  endTime: string,
  t: TFunction
): DurationInfo | null {
  if (!startTime || !endTime) return null;

  const [h1, m1] = startTime.split(':').map(Number);
  const [h2, m2] = endTime.split(':').map(Number);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return null;

  const mins1 = h1 * 60 + m1;
  const mins2 = h2 * 60 + m2;
  const diff = mins2 - mins1;

  if (diff <= 0) return { isValid: false, minutes: 0, text: '' };

  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  let text = t('exams.durationMinutesOnly', { count: diff });

  if (hours > 0 && mins === 0) {
    text = t('exams.durationHoursOnly', { hours, minutes: diff });
  } else if (hours > 0 && mins > 0) {
    text = t('exams.durationMixed', { hours, mins, minutes: diff });
  }

  return { isValid: true, minutes: diff, text };
}

export function getDurationMinutes(startTime?: string, endTime?: string, durationMinutes?: number): number {
  if (startTime && endTime) {
    const [h1, m1] = startTime.split(':').map(Number);
    const [h2, m2] = endTime.split(':').map(Number);
    if (!isNaN(h1) && !isNaN(m1) && !isNaN(h2) && !isNaN(m2)) {
      const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (diff > 0) return diff;
    }
  }
  return durationMinutes || 120;
}

// ── Answer Normalization & Checking ──────────────────────────────────────────

export function normalizeMcqCode(val: any, q?: ExamQuestion): string {
  if (val == null) return '';
  const str = String(val).trim();
  if (!str) return '';

  // 1. Direct match with option text if question is provided
  if (q) {
    if (q.optionA && str.trim().toLowerCase() === String(q.optionA).trim().toLowerCase()) return 'A';
    if (q.optionB && str.trim().toLowerCase() === String(q.optionB).trim().toLowerCase()) return 'B';
    if (q.optionC && str.trim().toLowerCase() === String(q.optionC).trim().toLowerCase()) return 'C';
    if (q.optionD && str.trim().toLowerCase() === String(q.optionD).trim().toLowerCase()) return 'D';
  }

  // 2. Clean prefixes (e.g. "OPTION_A", "Option A", "A.", "A)", "A")
  const upper = str.toUpperCase();
  if (upper === 'A' || upper === 'B' || upper === 'C' || upper === 'D') return upper;
  if (upper.startsWith('OPTION_') || upper.startsWith('OPTION ')) {
    const code = upper.replace(/^OPTION[_\s]*/, '').charAt(0);
    if (['A', 'B', 'C', 'D'].includes(code)) return code;
  }
  if (upper.length <= 3 && ['A', 'B', 'C', 'D'].includes(upper.charAt(0))) {
    return upper.charAt(0);
  }

  return upper;
}

export function normalizeTrueFalseVal(val: any): string {
  if (val == null) return '';
  const str = String(val).trim().toUpperCase();
  if (['TRUE', 'T', 'A', '1', 'صواب', 'صح'].includes(str)) return 'TRUE';
  if (['FALSE', 'F', 'B', '0', 'خطأ'].includes(str)) return 'FALSE';
  return str;
}

export function checkAnswerIsCorrect(q: ExamQuestion, answerVal: any): boolean {
  if (answerVal == null || answerVal === '') return false;
  const qType = (q.type || '').toUpperCase().replace('-', '_');

  if (qType === 'TRUE_FALSE' || qType === 'TF' || qType === 'TRUEFALSE') {
    const normS = normalizeTrueFalseVal(answerVal);
    const normC = normalizeTrueFalseVal(q.correctAnswer);
    const sAnsStr = String(answerVal).trim().toUpperCase();
    const cAnsStr = String(q.correctAnswer || '').trim().toUpperCase();
    const isStudentTrue = normS === 'TRUE' || sAnsStr === 'TRUE' || sAnsStr === 'A' || sAnsStr === '1' || sAnsStr === 'صواب' || sAnsStr === 'صح';
    const isCorrectTrue = normC === 'TRUE' || cAnsStr === 'TRUE' || cAnsStr === 'A' || cAnsStr === '1' || cAnsStr === 'صواب' || cAnsStr === 'صح';
    return isStudentTrue === isCorrectTrue;
  }

  if (qType === 'SHORT_ANSWER' || qType === 'TEXT' || qType === 'ESSAY') {
    const sAns = String(answerVal).trim().toLowerCase();
    const cAns = String(q.correctAnswer || '').trim().toLowerCase();
    return cAns ? sAns.includes(cAns) || cAns.includes(sAns) : false;
  }

  // MCQ
  const normS = normalizeMcqCode(answerVal, q);
  const normC = normalizeMcqCode(q.correctAnswer, q);
  const sAnsStr = String(answerVal).trim().toUpperCase();
  const cAnsStr = String(q.correctAnswer || '').trim().toUpperCase();
  return normS === normC || sAnsStr === cAnsStr || sAnsStr === cAnsStr.replace('OPTION', '');
}

// ── Answer Text Formatting ───────────────────────────────────────────────────

export function getStudentAnswerText(
  q: ExamQuestion,
  answerVal: any,
  t: TFunction
): string | null {
  if (answerVal == null || answerVal === '') return null;

  const qType = (q.type || '').toUpperCase().replace('-', '_');

  if (qType === 'TRUE_FALSE' || qType === 'TF' || qType === 'TRUEFALSE') {
    const normS = normalizeTrueFalseVal(answerVal);
    return normS === 'TRUE' ? t('exams.answerTrue') : t('exams.answerFalse');
  }

  if (q.optionA || qType === 'MCQ') {
    const code = normalizeMcqCode(answerVal, q);
    const optionMap: Record<string, string | null | undefined> = {
      A: q.optionA,
      B: q.optionB,
      C: q.optionC,
      D: q.optionD,
    };
    if (optionMap[code]) {
      return `${t('exams.optionLabel', { code })} ${optionMap[code]}`;
    }
  }

  return String(answerVal).trim();
}

export function getModelAnswerText(q: ExamQuestion, t: TFunction): string {
  const qType = (q.type || '').toUpperCase().replace('-', '_');

  if (qType === 'TRUE_FALSE' || qType === 'TF' || qType === 'TRUEFALSE') {
    const normC = normalizeTrueFalseVal(q.correctAnswer);
    return normC === 'TRUE' ? t('exams.answerTrue') : t('exams.answerFalse');
  }

  if (q.optionA || qType === 'MCQ') {
    const code = normalizeMcqCode(q.correctAnswer, q);
    const optionMap: Record<string, string | null | undefined> = {
      A: q.optionA,
      B: q.optionB,
      C: q.optionC,
      D: q.optionD,
    };
    if (optionMap[code]) {
      return `${t('exams.optionLabel', { code })} ${optionMap[code]}`;
    }
  }

  const normC = normalizeTrueFalseVal(q.correctAnswer);
  if (normC === 'TRUE') return t('exams.answerTrue');
  if (normC === 'FALSE') return t('exams.answerFalse');

  return q.correctAnswer || t('exams.notSpecified');
}

// ── Violation Formatting ─────────────────────────────────────────────────────

export function formatViolationType(type: string, t: TFunction): string {
  const key = `exams.violation_${type}`;
  const result = t(key);
  return result === key ? type : result;
}

// ── Type Badge Config ────────────────────────────────────────────────────────

export function getTypeBadgeConfig(examOrType: any, t: TFunction) {
  const isObj = typeof examOrType === 'object' && examOrType !== null;
  const type = isObj ? examOrType.type : String(examOrType);
  const customLabel = isObj && examOrType.title ? examOrType.title : null;

  const configs: Record<string, { bg: string; text: string; label: string }> = {
    FINAL: {
      bg: 'bg-rose-100 dark:bg-rose-900/25',
      text: 'text-rose-700 dark:text-rose-400',
      label: customLabel || t('exams.finalShort'),
    },
    MIDTERM: {
      bg: 'bg-amber-100 dark:bg-amber-900/25',
      text: 'text-amber-700 dark:text-amber-400',
      label: customLabel || t('exams.midtermShort'),
    },
    QUIZ: {
      bg: 'bg-sky-100 dark:bg-sky-900/25',
      text: 'text-sky-700 dark:text-sky-400',
      label: customLabel || t('exams.quizShort'),
    },
  };
  return configs[type] || {
    bg: 'bg-indigo-100 dark:bg-indigo-900/25',
    text: 'text-indigo-700 dark:text-indigo-400',
    label: customLabel || t('exams.quizShort'),
  };
}

// ── Anti-Cheat: Device Info ──────────────────────────────────────────────────

export interface DeviceInfo {
  deviceType: string;
  browserName: string;
  browserVersion: string;
  operatingSystem: string;
  screenResolution: string;
  userAgent: string;
  language: string;
  timezone: string;
  touchSupport: boolean;
  concurrentScreens: number;
  ipAddress?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  locationDenied?: boolean;
}

export interface AntiCheatSettings {
  antiCheatEnabled: boolean;
  maxLeavesBeforeCancel: number;
  leaveGraceSeconds: number;
  leaveWarningMessage: string;
  shuffleQuestions: boolean;
  requireGeolocation: boolean;
  blockMultipleTabs: boolean;
  enableGeofencing?: boolean;
  allowedLat?: number | null;
  allowedLng?: number | null;
  allowedRadiusMeters?: number;
}

export const DEFAULT_ANTI_CHEAT_SETTINGS: AntiCheatSettings = {
  antiCheatEnabled: true,
  maxLeavesBeforeCancel: 1,
  leaveGraceSeconds: 5,
  leaveWarningMessage: '',
  shuffleQuestions: true,
  requireGeolocation: true,
  blockMultipleTabs: true,
  enableGeofencing: false,
  allowedLat: null,
  allowedLng: null,
  allowedRadiusMeters: 200, // 200 meters default radius
};

export function getDefaultLeaveWarningMessage(t: TFunction): string {
  return t('exams.defaultLeaveWarning');
}

// ── Geofencing Helper (Haversine Formula) ───────────────────────────────────

export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radius of the Earth in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// ── Deterministic Question Shuffling ─────────────────────────────────────────
// Uses a seeded PRNG (xorshift32) so the same student always gets the same order.

function seededRandom(seed: number): () => number {
  let s = seed | 0;
  if (s === 0) s = 1;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

export function shuffleQuestionsForStudent<T>(questions: T[], studentId: string | number): T[] {
  if (!questions || questions.length <= 1) return questions;
  const seed = typeof studentId === 'number' ? studentId : hashString(String(studentId));
  const rng = seededRandom(seed);
  const shuffled = [...questions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ── Device Info Formatting ───────────────────────────────────────────────────

export function formatDeviceInfo(info: DeviceInfo | null, t: TFunction): Array<{ label: string; value: string }> {
  if (!info) return [];
  return [
    { label: t('exams.deviceType'), value: info.deviceType },
    { label: t('exams.browserInfo'), value: `${info.browserName} ${info.browserVersion}` },
    { label: t('exams.osInfo'), value: info.operatingSystem },
    { label: t('exams.screenRes'), value: info.screenResolution },
    { label: t('exams.ipAddress'), value: info.ipAddress || t('exams.notAvailable') },
    { label: t('exams.locationInfo'), value: info.latitude != null
        ? `${info.latitude.toFixed(4)}, ${info.longitude?.toFixed(4)} (±${info.locationAccuracy?.toFixed(0)}m)`
        : info.locationDenied ? t('exams.locationDenied') : t('exams.notAvailable') },
    { label: t('exams.timezoneInfo'), value: info.timezone },
    { label: t('exams.languageInfo'), value: info.language },
    { label: t('exams.touchScreen'), value: info.touchSupport ? t('common.yes') : t('common.no') },
  ];
}

// ── Parse Anti-Cheat Settings from Exam ──────────────────────────────────────

export function getAntiCheatSettings(exam: any): AntiCheatSettings {
  if (!exam) return { ...DEFAULT_ANTI_CHEAT_SETTINGS };
  return {
    antiCheatEnabled: exam.antiCheatEnabled !== false,
    maxLeavesBeforeCancel: exam.maxLeavesBeforeCancel != null ? Number(exam.maxLeavesBeforeCancel) : DEFAULT_ANTI_CHEAT_SETTINGS.maxLeavesBeforeCancel,
    leaveGraceSeconds: exam.leaveGraceSeconds != null ? Number(exam.leaveGraceSeconds) : DEFAULT_ANTI_CHEAT_SETTINGS.leaveGraceSeconds,
    leaveWarningMessage: exam.leaveWarningMessage || '',
    shuffleQuestions: exam.shuffleQuestions !== false,
    requireGeolocation: exam.requireGeolocation !== false,
    blockMultipleTabs: exam.blockMultipleTabs !== false,
    enableGeofencing: exam.enableGeofencing === true,
    allowedLat: exam.allowedLat != null ? Number(exam.allowedLat) : null,
    allowedLng: exam.allowedLng != null ? Number(exam.allowedLng) : null,
    allowedRadiusMeters: exam.allowedRadiusMeters != null ? Number(exam.allowedRadiusMeters) : 200,
  };
}
