const prisma = require('../utils/prismaClient');

const SENSITIVE_FIELDS = ['password', 'newPassword', 'currentPassword', 'token', 'secret']; 
const sanitizeBody = (body) => { 
  if (!body || typeof body !== 'object') return body; 
  const sanitized = { ...body }; 
  SENSITIVE_FIELDS.forEach(field => { 
    if (sanitized[field] !== undefined) sanitized[field] = '[REDACTED]'; 
  }); 
  return sanitized; 
}; 

/**
 * Middleware to track user actions and log them to the database
 * @param {string} action - The action being performed (e.g., "CREATE_STUDENT")
 * @param {string} entity - The entity affected (e.g., "Student")
 */
const auditLog = (action, entity) => {
  return async (req, res, next) => {
    // We want to log AFTER the request is successfully processed
    const originalJson = res.json;
    
    res.json = function(data) {
      // Restore the original json function
      res.json = originalJson;
      
      // If the request was successful (2xx status), log it
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const userId = req.user ? req.user.id : null;
        const userEmail = req.user ? req.user.email : null;
        const userRole = req.user ? req.user.role : null;
        
        // Extract entity ID if possible (from params or response data)
        const entityId = req.params.id || (data.data && data.data.id ? String(data.data.id) : null);

        // Async logging - don't block the response
        prisma.auditLog.create({
          data: {
            userId,
            userEmail,
            userRole,
            action,
            entity,
            entityId: entityId ? String(entityId) : null,
            details: {
              method: req.method,
              url: req.originalUrl,
              body: req.method !== 'GET' ? sanitizeBody(req.body) : undefined,
              params: req.params,
              query: req.query
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          }
        }).catch(err => {
          console.error('[AUDIT LOG ERROR]', err);
        });
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
};

module.exports = auditLog;
