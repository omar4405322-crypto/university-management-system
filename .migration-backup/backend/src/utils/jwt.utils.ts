import jwt from 'jsonwebtoken';
import { AuthenticationError } from './appError';
import prisma from './prismaClient';
import crypto from 'crypto';

export interface TokenPayload {
  id: number;
  tokenVersion: number;
}

/**
 * Generate a short-lived access token
 */
export const generateAccessToken = (userId: number, tokenVersion: number = 0): string => {
  return jwt.sign({ id: userId, tokenVersion }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as jwt.SignOptions['expiresIn'],
    issuer: 'Smart University Platform',
    audience: 'University Users',
  });
};

// Keep original name for compatibility if needed
export const generateToken = generateAccessToken;

/**
 * Generate a long-lived refresh token and store it in DB
 */
export const generateRefreshToken = async (userId: number): Promise<string> => {
  const token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return token;
};

/**
 * Verify a JWT access token
 */
export const verifyToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET as string, {
      issuer: 'Smart University Platform',
      audience: 'University Users',
    }) as TokenPayload;
  } catch (error: any) {
    if (error?.name === 'TokenExpiredError') {
      throw new AuthenticationError('Session expired, please login again');
    }
    throw new AuthenticationError('Invalid or corrupted security token');
  }
};

/**
 * Decode a JWT token without verification
 */
export const decodeToken = (token: string): any => {
  return jwt.decode(token);
};
