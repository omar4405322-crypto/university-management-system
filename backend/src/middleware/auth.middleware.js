const { verifyToken } = require('../utils/jwt.utils');
const prisma = require('../utils/prismaClient');

/**
 * Protect routes - ensures user is authenticated
 */
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No security token provided.',
      });
    }

    // Verify token
    const decoded = verifyToken(token);

    // Check if user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, studentId: true }
        },
        doctor: {
          select: { id: true, firstName: true, lastName: true, doctorId: true }
        },
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.',
      });
    }

    // Grant access to protected route
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || 'Not authorized to access this resource',
    });
  }
};

/**
 * Authorize roles - ensures user has required permissions
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(500).json({
        success: false,
        message: 'Authorization check failed. User not authenticated.',
      });
    }

    // SUPER_ADMIN has god-mode access
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Your role (${req.user.role}) does not have permission for this action.`,
      });
    }

    next();
  };
};

module.exports = { protect, authorize };
