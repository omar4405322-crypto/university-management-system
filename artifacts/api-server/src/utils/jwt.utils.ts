import jwt from 'jsonwebtoken';
import { AuthenticationError } from './appError';
import prisma from './prismaClient';
import crypto from 'crypto';

export interface TokenPayload {
  id: number;
  tokenVersion: number;
}

export interface RefreshTokenMetadata {
  userId: number;
  tokenVersion: number;
  familyId: string;
}

const REFRESH_TOKEN_FORMAT_VERSION = 'v1';
const REFRESH_TOKEN_FAMILY_BYTES = 24;
const REFRESH_TOKEN_RANDOM_BYTES = 40;

const getTokenSigningSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required for token generation');
  }
  return secret;
};

export const createRefreshTokenValue = (
  userId: number,
  tokenVersion: number,
  familyId: string = crypto.randomBytes(REFRESH_TOKEN_FAMILY_BYTES).toString('hex')
): string => {
  const randomValue = crypto.randomBytes(REFRESH_TOKEN_RANDOM_BYTES).toString('hex');
  const payload = [
    REFRESH_TOKEN_FORMAT_VERSION,
    String(userId),
    String(tokenVersion),
    familyId,
    randomValue,
  ].join('.');
  const signature = crypto
    .createHmac('sha256', getTokenSigningSecret())
    .update(`refresh-token:${payload}`)
    .digest('hex');

  return `${payload}.${signature}`;
};

export const parseRefreshTokenMetadata = (token: string): RefreshTokenMetadata | null => {
  const parts = token.split('.');
  if (parts.length !== 6 || parts[0] !== REFRESH_TOKEN_FORMAT_VERSION) {
    return null;
  }

  const [formatVersion, rawUserId, rawTokenVersion, familyId, randomValue, signature] = parts;
  if (
    !/^\d+$/.test(rawUserId) ||
    !/^\d+$/.test(rawTokenVersion) ||
    !/^[a-f0-9]{48}$/.test(familyId) ||
    !/^[a-f0-9]{80}$/.test(randomValue) ||
    !/^[a-f0-9]{64}$/.test(signature)
  ) {
    return null;
  }

  const payload = [formatVersion, rawUserId, rawTokenVersion, familyId, randomValue].join('.');
  const expectedSignature = crypto
    .createHmac('sha256', getTokenSigningSecret())
    .update(`refresh-token:${payload}`)
    .digest();
  const suppliedSignature = Buffer.from(signature, 'hex');

  if (
    suppliedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    return null;
  }

  const userId = Number(rawUserId);
  const tokenVersion = Number(rawTokenVersion);
  if (!Number.isSafeInteger(userId) || userId <= 0 || !Number.isSafeInteger(tokenVersion) || tokenVersion < 0) {
    return null;
  }

  return { userId, tokenVersion, familyId };
};

export const getRefreshTokenFamilyPrefix = (metadata: RefreshTokenMetadata): string =>
  `${REFRESH_TOKEN_FORMAT_VERSION}.${metadata.userId}.${metadata.tokenVersion}.${metadata.familyId}.`;

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
export const generateRefreshToken = async (
  userId: number,
  tokenVersion: number
): Promise<string> => {
  const token = createRefreshTokenValue(userId, tokenVersion);
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
