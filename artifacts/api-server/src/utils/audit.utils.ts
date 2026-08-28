import logger from './logger';
import prisma from './prismaClient';

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

  const entry: AuditLogEntry = {
    action,
    resourceType,
    resourceId,
    performedBy: parsedUserId ?? undefined,
    performedByRole: userRole ?? undefined,
    actorEmail: actorEmail ?? undefined,
    ip: ipAddress,
    timestamp: new Date().toISOString(),
    ...(changes && { changes }),
  };

  logger[level]('AUDIT', entry);

  const client = tx || prisma;
  const promise = client.auditLog
    .create({
      data: {
        userId: parsedUserId,
        userEmail: actorEmail,
        actorEmail,
        userRole,
        action,
        entity: resourceType,
        entityId: resourceId !== null && resourceId !== undefined ? String(resourceId) : null,
        details: changes ? changes : undefined,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

  if (tx) {
    await promise;
  } else {
    promise.catch((err: any) => {
      logger.error('Failed to write audit log to database', { error: err?.message || err });
    });
  }
}

