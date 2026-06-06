const jwt = require('jsonwebtoken');
const { AuthenticationError } = require('./appError');
const prisma = require('./prismaClient');
const crypto = require('crypto');

/**
 * Generate a short-lived access token
 */
const generateAccessToken = (userId, tokenVersion = 0) => { 
  return jwt.sign( 
    { id: userId, tokenVersion }, 
    process.env.JWT_SECRET, 
    { 
      expiresIn: '15m', 
      issuer: 'Smart University Platform', 
      audience: 'University Users' 
    } 
  ); 
}; 

/**
 * Generate a long-lived refresh token and store it in DB
 */
const generateRefreshToken = async (userId) => {
  const token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt
    }
  });

  return token;
};

/**
 * Verify a JWT access token
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'Smart University Platform',
      audience: 'University Users'
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Session expired, please login again');
    }
    throw new AuthenticationError('Invalid or corrupted security token');
  }
};

/**
 * Decode a JWT token without verification
 */
const decodeToken = (token) => {
  return jwt.decode(token);
};

module.exports = {
  generateToken: generateAccessToken, // Keep original name for compatibility if needed
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  decodeToken,
};
