const logger = require('./logger'); // Adjust path if necessary

function auditLog(
  action,
  resourceType,
  resourceId,
  req,
  changes
) {
  const level = action.startsWith('DELETE') ? 'warn' : 'info';
  logger[level]('AUDIT', {
    action,
    resourceType,
    resourceId,
    performedBy: req.user?.id,
    performedByRole: req.user?.role,
    ip: req.ip,
    timestamp: new Date().toISOString(),
    ...(changes && { changes }),
  });
}

module.exports = {
  auditLog
};
