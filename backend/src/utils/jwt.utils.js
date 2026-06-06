const jwt = require('jsonwebtoken');

/**
 * Generate a JWT token for a user
 * @param {number} userId - The user ID
 * @param {number} tokenVersion - The version of the token for invalidation
 * @returns {string} - Signed JWT
 */
const generateToken = (userId, tokenVersion = 0) => { 
  return jwt.sign( 
    { id: userId, tokenVersion }, 
    process.env.JWT_SECRET, 
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d', issuer: 'Smart University Platform', audience: 'University Users' } 
  ); 
}; 


/**
 * Verify a JWT token
 * @param {string} token - Token to verify
 * @returns {Object} - Decoded payload
 * @throws {Error} - If token is invalid or expired
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'Smart University Platform',
      audience: 'University Users'
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Session expired, please login again');
    }
    throw new Error('Invalid or corrupted security token');
  }
};

/**
 * Decode a JWT token without verification
 * @param {string} token - Token to decode
 * @returns {Object|null} - Decoded payload or null
 */
const decodeToken = (token) => {
  return jwt.decode(token);
};

module.exports = {
  generateToken,
  verifyToken,
  decodeToken,
};
