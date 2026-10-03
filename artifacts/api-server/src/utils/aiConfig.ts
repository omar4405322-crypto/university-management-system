import type { AuthActor } from '../types/auth.types';

export const isAiAssistantEnabled = (): boolean =>
  process.env.AI_ASSISTANT_ENABLED?.trim().toLowerCase() === 'true';

export function getAiProvider(): 'openai' | 'gemini' {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase() || 'openai';
  if (provider !== 'openai' && provider !== 'gemini') throw new Error('AI provider is not configured');
  return provider;
}

export function getAiFallbackProvider(): 'openai' | 'gemini' | 'none' {
  const raw = process.env.AI_FALLBACK_PROVIDER?.trim().toLowerCase();
  if (!raw || raw === 'none' || raw === 'disabled' || raw === 'off') {
    return 'none';
  }
  if (raw !== 'gemini' && raw !== 'openai') {
    return 'none';
  }

  // Prevent redundant same-provider fallback (e.g. gemini -> gemini, openai -> openai)
  let primary: string | undefined;
  try {
    primary = getAiProvider();
  } catch {
    /* ignore */
  }

  if (primary && raw === primary) {
    return 'none';
  }

  return raw;
}

/**
 * Verifies whether the given actor is authorized to receive detailed AI platform
 * provider diagnostics and circuit health telemetry (SUPER_ADMIN and platform ADMIN).
 *
 * Scoped tenant administrators (COLLEGE_ADMIN, DEPARTMENT_ADMIN) and academic/student
 * roles (STUDENT, DOCTOR, TEACHING_ASSISTANT) are restricted to high-level status only.
 */
export function canAccessAiDiagnostics(actor?: AuthActor): boolean {
  if (!actor) return false;

  const role = (actor.role || '').toString().toUpperCase();
  const adminRole = (actor.adminRole || '').toString().toUpperCase();

  // Scoped tenant administrators do not receive platform infrastructure telemetry
  if (
    adminRole === 'COLLEGE_ADMIN' ||
    adminRole === 'DEPARTMENT_ADMIN' ||
    role === 'COLLEGE_ADMIN' ||
    role === 'DEPARTMENT_ADMIN'
  ) {
    return false;
  }

  // Scoped college or department managers without explicit platform SUPER_ADMIN access
  if (
    (actor.managedCollegeId || actor.managedDepartmentId) &&
    role !== 'SUPER_ADMIN' &&
    adminRole !== 'SUPER_ADMIN'
  ) {
    return false;
  }

  // Academic and student roles receive only status enum
  if (
    role === 'STUDENT' ||
    role === 'DOCTOR' ||
    role === 'TEACHING_ASSISTANT' ||
    role === 'TA'
  ) {
    return false;
  }

  // Platform-level administrators: SUPER_ADMIN or general system ADMIN
  return (
    role === 'SUPER_ADMIN' ||
    adminRole === 'SUPER_ADMIN' ||
    role === 'ADMIN'
  );
}

export function getAiModelForProvider(provider: 'openai' | 'gemini'): string {
  if (provider === 'gemini') {
    return process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
  }
  return process.env.OPENAI_MODEL?.trim() || 'gpt-6-luna';
}

export const getAiModel = (): string => {
  try {
    const provider = getAiProvider();
    return getAiModelForProvider(provider);
  } catch {
    return process.env.GEMINI_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || '';
  }
};

export function isProviderConfigured(provider: 'openai' | 'gemini'): boolean {
  if (provider === 'gemini') {
    return Boolean(process.env.GEMINI_API_KEY?.trim() && (process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash'));
  }
  if (provider === 'openai') {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
  }
  return false;
}

export function getPerAttemptTimeoutMs(): number {
  const val = Number(process.env.AI_ATTEMPT_TIMEOUT_MS);
  return Number.isFinite(val) && val >= 1000 && val <= 60000 ? val : 12_000;
}

export function getTotalRequestBudgetMs(): number {
  const val = Number(process.env.AI_REQUEST_BUDGET_MS);
  return Number.isFinite(val) && val >= 2000 && val <= 120000 ? val : 30_000;
}

export function getMaxRetriesPerProvider(): number {
  const val = Number(process.env.AI_MAX_RETRIES);
  return Number.isFinite(val) && val >= 0 && val <= 5 ? val : 2;
}
