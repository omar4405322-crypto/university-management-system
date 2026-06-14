const { verifyToken } = require('../utils/jwt.utils');
const prisma = require('../utils/prismaClient');
const catchAsync = require('../utils/catchAsync');

/**
 * Protect routes - ensures user is authenticated
 */
const protect = catchAsync(async (req, res, next) => {
  let token;
  if (req.cookies?.auth_token) { 
    token = req.cookies.auth_token; 
  } else if (req.headers.authorization?.startsWith('Bearer')) { 
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
    select: {
      id: true,
      email: true,
      role: true,
      adminRole: true,
      collegeId: true,
      departmentId: true,
      managedCollegeId: true,
      managedDepartmentId: true,
      tokenVersion: true,
      profilePicture: true,
      createdAt: true,
      student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
      doctor: { select: { id: true, firstName: true, lastName: true, doctorId: true } },
    },
  });

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'The user belonging to this token no longer exists.',
    });
  }

  if (decoded.tokenVersion !== user.tokenVersion) { 
    return res.status(401).json({ 
      success: false, 
      message: 'Session invalidated. Please login again.', 
    }); 
  } 

  // Attach user (including managedCollegeId) to request for downstream scope checks
  req.user = user;
  next();
});

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

    // Normalize role comparison to be case-insensitive and robust
    const userRole = (req.user.role || '').toString().toUpperCase();

    // SUPER_ADMIN has god-mode access
    if (userRole === 'SUPER_ADMIN') {
      return next();
    }

    const allowed = roles.map(r => r.toString().toUpperCase());
    if (!allowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Your role (${req.user.role}) does not have permission for this action.`,
      });
    }

    next();
  };
};

module.exports = { protect, authorize };
