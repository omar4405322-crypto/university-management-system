/**
 * Utility functions for Placement Wizard (UniCore Quality Program WP-3 3B-4)
 * Pure, testable helpers for conflict parsing, cross-department TA authorization,
 * hierarchical group flattening, and bilingual conflict message resolution.
 */

import { ScheduleConflict, ResolvedTerm, ResolvedRoom } from './types';

export interface ParsedConflictResult {
  conflicts: ScheduleConflict[];
  resolvedTerm: ResolvedTerm | null;
  resolvedRoom: ResolvedRoom | null;
}

/**
 * Extracts conflicts, resolvedTerm, and resolvedRoom from top-level or data-wrapped API response envelopes.
 */
export function parseCheckConflictResponse(res: any): ParsedConflictResult {
  const resBody = res || {};
  const rawConflicts =
    resBody.conflicts ||
    resBody.data?.conflicts ||
    (Array.isArray(resBody.data) ? resBody.data : []);
  const rawTerm = resBody.resolvedTerm || resBody.data?.resolvedTerm || null;
  const rawRoom = resBody.resolvedRoom || resBody.data?.resolvedRoom || null;

  const conflicts: ScheduleConflict[] = (Array.isArray(rawConflicts) ? rawConflicts : []).map((c: any) => ({
    type: String(c.type || 'UNKNOWN_CONFLICT'),
    messageAr: String(c.messageAr || ''),
    messageEn: String(c.messageEn || ''),
    conflictingSlot: c.conflictingSlot,
  }));

  const resolvedTerm: ResolvedTerm | null =
    rawTerm && rawTerm.id
      ? {
          id: Number(rawTerm.id),
          name: String(rawTerm.name || ''),
          code: rawTerm.code ? String(rawTerm.code) : undefined,
          isCurrent: Boolean(rawTerm.isCurrent),
        }
      : null;

  const resolvedRoom: ResolvedRoom | null =
    rawRoom && rawRoom.id
      ? {
          id: Number(rawRoom.id),
          name: String(rawRoom.name || ''),
          isActive: rawRoom.isActive !== undefined ? Boolean(rawRoom.isActive) : undefined,
        }
      : null;

  return {
    conflicts,
    resolvedTerm,
    resolvedRoom,
  };
}

export interface TAEvaluationResult {
  isCrossDepartment: boolean;
  isApproved: boolean;
  isDisabled: boolean;
  approvalReason: string;
}

/**
 * Evaluates whether a TA requires cross-department approval and whether they have an APPROVED record.
 */
export function evaluateTAApproval(
  ta: {
    id: string | number;
    departmentId?: number | null;
    department?: { id: number };
    [key: string]: any;
  },
  courseId?: number | string | null,
  courseDeptId?: number | string | null,
  approvals: Array<{
    teachingAssistantId: string | number;
    courseId?: number | string | null;
    status: string;
    reason?: string | null;
    [key: string]: any;
  }> = []
): TAEvaluationResult {
  const cDeptId = courseDeptId ? Number(courseDeptId) : null;
  const taDeptId = ta.departmentId !== undefined ? (ta.departmentId !== null ? Number(ta.departmentId) : null) : (ta.department?.id ? Number(ta.department?.id) : null);
  const isCrossDepartment = Boolean(cDeptId && taDeptId && taDeptId !== cDeptId);

  if (!isCrossDepartment) {
    return {
      isCrossDepartment: false,
      isApproved: true,
      isDisabled: false,
      approvalReason: '',
    };
  }

  const match = (approvals || []).find(
    (a) =>
      String(a.teachingAssistantId) === String(ta.id) &&
      (!courseId || Number(a.courseId) === Number(courseId)) &&
      a.status === 'APPROVED'
  );

  return {
    isCrossDepartment: true,
    isApproved: Boolean(match),
    isDisabled: !match,
    approvalReason: match?.reason || '',
  };
}

/**
 * Recursively flattens nested student groups into a flat array for dropdown selection.
 */
export function flattenGroupTree(nodes: any[]): any[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.flatMap((n) => [n, ...flattenGroupTree(n.children || [])]);
}

/**
 * Complete bilingual fallback dictionary for all 12 conflict types reachable via check-conflict.
 */
export const CONFLICT_I18N_FALLBACKS: Record<string, { ar: string; en: string }> = {
  ROOM_OCCUPIED: {
    ar: 'القاعة محجوزة بالفعل لحصة أخرى في هذا التوقيت.',
    en: 'Room is already booked for another session at this time.',
  },
  DOCTOR_BUSY: {
    ar: 'المحاضر لديه محاضرة أخرى مجدولة في نفس الوقت.',
    en: 'Doctor is already scheduled for another class at this time.',
  },
  TA_BUSY: {
    ar: 'المعيد لديه سكشن آخر مجدول في نفس التوقيت.',
    en: 'Teaching assistant is already assigned to another session at this time.',
  },
  GROUP_CONFLICT: {
    ar: 'المجموعة الطلابية لديها حصة أخرى مجدولة في نفس التوقيت.',
    en: 'Student group has another session scheduled at this time.',
  },
  AMBIGUOUS_DOCTOR: {
    ar: 'يوجد أكثر من عضو هيئة تدريس يطابق الاسم المحدد. يرجى التحديد لتفادي الالتباس.',
    en: 'Multiple faculty members match the specified instructor name. Please disambiguate.',
  },
  AMBIGUOUS_TA: {
    ar: 'يوجد أكثر من معيد/مدرس مساعد يطابق الاسم المحدد. يرجى التحديد لتفادي الالتباس.',
    en: 'Multiple teaching assistants match the specified assistant name. Please disambiguate.',
  },
  INVALID_TERM: {
    ar: 'الفصل الدراسي المحدد غير موجود.',
    en: 'Specified academic term was not found.',
  },
  NO_ACTIVE_TERM: {
    ar: 'لا يوجد فصل دراسي حالي نشط للجدولة.',
    en: 'No active academic term exists for schedule placement.',
  },
  PAST_TERM_LOCKED: {
    ar: 'لا يمكن التعديل أو الجدولة في فصل دراسي منتهٍ.',
    en: 'Cannot schedule in a past academic term.',
  },
  ROOM_NOT_FOUND: {
    ar: 'القاعة المحددة غير موجودة في النظام.',
    en: 'Specified room was not found in the system.',
  },
  ROOM_INACTIVE: {
    ar: 'القاعة المحددة غير مفعلة ولا يمكن جدولتها.',
    en: 'Specified room is inactive and cannot be scheduled.',
  },
  UNAPPROVED_CROSS_DEPARTMENT_TA: {
    ar: 'المعيد غير معتمد للتدريس بقسم آخر لهذه المادة.',
    en: 'Teaching assistant requires an approved cross-department authorization.',
  },
};

/**
 * Returns a bilingual conflict message respecting RTL language preference.
 * Priority:
 * 1. Backend-provided message in the requested language (messageAr or messageEn)
 * 2. Backend-provided alternative language message
 * 3. Client-side fallback dictionary for the conflict type
 * 4. Generic fallback with the conflict type code
 */
export function formatConflictMessage(
  conflict: { type?: string; messageAr?: string; messageEn?: string; [key: string]: any },
  isRTL: boolean
): string {
  const type = conflict?.type || 'UNKNOWN_CONFLICT';
  const msgAr = conflict?.messageAr?.trim();
  const msgEn = conflict?.messageEn?.trim();

  if (isRTL) {
    if (msgAr) return msgAr;
    if (msgEn) return msgEn;
    if (CONFLICT_I18N_FALLBACKS[type]?.ar) return CONFLICT_I18N_FALLBACKS[type].ar;
    return `تعارض في الجدولة (${type})`;
  } else {
    if (msgEn) return msgEn;
    if (msgAr) return msgAr;
    if (CONFLICT_I18N_FALLBACKS[type]?.en) return CONFLICT_I18N_FALLBACKS[type].en;
    return `Schedule conflict (${type})`;
  }
}
