import logger from './logger.js';

export interface AuditLogEntry {
  action: string;
  resourceType: string;
  resourceId: number | string | null | undefined;
  performedBy?: number | string;
  performedByRole?: string;
  ip?: string;
  timestamp: string;
  changes?: any;
}

export function auditLog(
  action: string,
  resourceType: string,
  resourceId: number | string | null | undefined,
  req: { 
    user?: { 
      id?: number | string; 
      role?: string; 
      [key: string]: any;
    }; 
    ip?: string; 
    [key: string]: any;
  },
  changes?: any
): void {
  const level: 'warn' | 'info' = action.startsWith('DELETE') ? 'warn' : 'info';
  
  const entry: AuditLogEntry = {
    action,
    resourceType,
    resourceId,
    performedBy: req.user?.id,
    performedByRole: req.user?.role,
    ip: req.ip,
    timestamp: new Date().toISOString(),
    ...(changes && { changes }),
  };

  logger[level]('AUDIT', entry);
}
