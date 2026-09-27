import logger from './logger';
import prisma from './prismaClient';

const REDACTED = '[REDACTED]';
const SENSITIVE_FIELDS = new Set([
  'password',
  'newpassword',
  'currentpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'secretkey',
  'twofactorsecret',
  'authorization',
  'answers',
  'correct',
  'correctanswer',
  'questions',
  'rfidtag',
]);

function normalizeFieldName(field: string): string {
  return field.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

export function sanitizeAuditValue(value: any): any {
  if (Array.isArray(value)) return value.map((entry) => sanitizeAuditValue(entry));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([field, fieldValue]) => [
      field,
      SENSITIVE_FIELDS.has(normalizeFieldName(field))
        ? REDACTED
        : sanitizeAuditValue(fieldValue),
    ])
  );
}

export const SYSTEM_AUDIT_ACTORS = {
  ATTENDANCE_CRON: {
    actorEmail: 'system:attendance-cron',
    userRole: 'SYSTEM',
  },
  ATTENDANCE_ENGINE: {
    actorEmail: 'system:attendance-engine',
    userRole: 'SYSTEM',
  },
} as const;

export interface AuditLogEntry {
  action: string;
  resourceType: string;
  resourceId: number | string | null | undefined;
  performedBy?: number | string;
  performedByRole?: string;
  actorEmail?: string;
  ip?: string;
  timestamp: string;
  changes?: any;
}

export async function auditLog(
  action: string,
  resourceType: string,
  resourceId: number | string | null | undefined,
  req: {
    user?: {
      id?: number | string;
      email?: string;
      role?: string;
      [key: string]: any;
    };
    ip?: string;
    userAgent?: string;
    get?: (header: string) => string | undefined;
    [key: string]: any;
  },
  changes?: any,
  tx?: any
): Promise<void> {
  const level: 'warn' | 'info' = action.startsWith('DELETE') ? 'warn' : 'info';
  const actorEmail = req.user?.email || req.actorEmail || req.userEmail || req.email || null;
  const parsedUserId =
    typeof req.user?.id === 'number'
      ? req.user.id
      : typeof req.userId === 'number'
      ? req.userId
      : req.user?.id
      ? parseInt(String(req.user.id), 10) || null
      : null;
  const userRole = req.user?.role || req.userRole || null;
  const ipAddress = req.ip || (typeof req.get === 'function' ? req.get('x-forwarded-for') : undefined);
  const userAgent = typeof req.get === 'function' ? req.get('User-Agent') : req.userAgent;
  const safeChanges = changes ? sanitizeAuditValue(changes) : undefined;

  const entry: AuditLogEntry = {
    action,
    resourceType,
    resourceId,
    performedBy: parsedUserId ?? undefined,
    performedByRole: userRole ?? undefined,
    actorEmail: actorEmail ?? undefined,
    ip: ipAddress,
    timestamp: new Date().toISOString(),
    ...(safeChanges && { changes: safeChanges }),
  };

  logger[level]('AUDIT', entry);

  const client = tx || prisma;
  req.auditLogWritten = true;
  try {
    await client.auditLog.create({
      data: {
        userId: parsedUserId,
        userEmail: actorEmail,
        actorEmail,
        userRole,
        action,
        entity: resourceType,
        entityId: resourceId !== null && resourceId !== undefined ? String(resourceId) : null,
        details: safeChanges,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });
  } catch (err: any) {
    logger.error('Failed to write audit log to database', {
      error: err?.message || err,
      action,
      entity: resourceType,
      entityId: resourceId !== null && resourceId !== undefined ? String(resourceId) : null,
      actorUserId: parsedUserId,
      actorEmail,
      actorRole: userRole,
      transactional: Boolean(tx),
    });
    if (tx) throw err;
  }
}

