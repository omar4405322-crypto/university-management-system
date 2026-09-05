import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prismaClient';
import logger from '../utils/logger';

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
  'authorization',
  'answers',
  'correct',
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

function responseSummary(data: any): Record<string, unknown> {
  const responseData = data?.data;
  return {
    success: data?.success === true,
    ...(responseData?.id !== undefined && { resourceId: String(responseData.id) }),
    ...(Array.isArray(responseData) && { affectedCount: responseData.length }),
  };
}

/**
 * Middleware to track user actions and log them to the database
 * @param action - The action being performed (e.g., "CREATE_STUDENT")
 * @param entity - The entity affected (e.g., "Student")
 */
const auditLog = (action: string, entity: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // We want to log AFTER the request is successfully processed
    const originalJson = res.json;

    res.json = function (this: Response, data: any) {
      // Restore the original json function
      res.json = originalJson;

      // If the request was successful (2xx status), log it
      if (res.statusCode >= 200 && res.statusCode < 300 && req.method !== 'GET') {
        const user = (req as any).user;
        const userId = user ? user.id : null;
        const userEmail = user ? user.email : null;
        const userRole = user ? user.role : null;

        // Extract entity ID if possible (from params or response data)
        const entityId = req.params.id || (data?.data?.id ? String(data.data.id) : null);

        const details = {
          method: req.method,
          path: `${req.baseUrl || ''}${req.path || ''}`,
          body: sanitizeAuditValue(req.body),
          params: sanitizeAuditValue(req.params),
          query: sanitizeAuditValue(req.query),
          outcome: responseSummary(data),
        };

        let auditWrite: Promise<unknown>;
        try {
          auditWrite = prisma.auditLog.create({
            data: {
              userId,
              userEmail,
              userRole,
              action,
              entity,
              entityId: entityId ? String(entityId) : null,
              details: details as Prisma.InputJsonObject,
              ipAddress: req.ip,
              userAgent: req.get('User-Agent'),
            },
          });
        } catch (error: any) {
          logger.error('Failed to write request audit log', { error: error?.message || error });
          return originalJson.call(this, data);
        }

        // Delay the success response until the database has accepted the audit
        // event. Audit failure is logged server-side, but does not turn an
        // already-committed academic mutation into a misleading retryable error.
        void Promise.resolve(auditWrite).then(
          () => originalJson.call(this, data),
          (error: any) => {
            logger.error('Failed to write request audit log', {
              error: error?.message || error,
            });
            originalJson.call(this, data);
          }
        );
        return this;
      }

      return originalJson.call(this, data);
    };

    next();
  };
};

export default auditLog;
