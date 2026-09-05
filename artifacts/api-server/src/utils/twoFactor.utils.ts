import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import type Redis from 'ioredis';
import { redis, RedisOperationError } from './redis.utils';

type RedisEvalClient = Pick<Redis, 'eval'>;
const acceptedCounters = new Map<string, number>();
const COUNTER_TTL_SECONDS = 5 * 60;

const CLAIM_COUNTER_SCRIPT = `
local previous = redis.call('GET', KEYS[1])
if previous and tonumber(previous) >= tonumber(ARGV[1]) then
  return 0
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
return 1
`;

export const generateTOTPSecret = (userEmail: string): speakeasy.GeneratedSecret => {
  return speakeasy.generateSecret({
    name: `Smart University (${userEmail})`,
    issuer: 'Smart University Platform',
    length: 20,
  });
};

export const claimTotpCounter = async (
  userId: number,
  counter: number,
  client: RedisEvalClient | null = redis,
  secretScope: string = 'current'
): Promise<boolean> => {
  const counterKey = `${userId}:${secretScope}`;
  if (client) {
    try {
      const claimed = await client.eval(
        CLAIM_COUNTER_SCRIPT,
        1,
        `auth:totp:last-counter:${counterKey}`,
        String(counter),
        String(COUNTER_TTL_SECONDS)
      );
      return Number(claimed) === 1;
    } catch {
      throw new RedisOperationError(
        'Two-factor verification is temporarily unavailable'
      );
    }
  }

  const previous = acceptedCounters.get(counterKey);
  if (previous !== undefined && previous >= counter) return false;
  acceptedCounters.set(counterKey, counter);
  setTimeout(() => {
    if (acceptedCounters.get(counterKey) === counter) {
      acceptedCounters.delete(counterKey);
    }
  }, COUNTER_TTL_SECONDS * 1000).unref?.();
  return true;
};

export const verifyTOTP = async (
  secret: string,
  token: string,
  userId: number
): Promise<boolean> => {
  const step = 30;
  const verified = speakeasy.totp.verifyDelta({
    secret,
    encoding: 'base32',
    token,
    step,
    window: 1,
  });
  if (!verified) return false;

  const currentCounter = Math.floor(Date.now() / 1000 / step);
  const secretScope = crypto
    .createHash('sha256')
    .update(secret)
    .digest('hex')
    .slice(0, 16);
  return claimTotpCounter(
    userId,
    currentCounter + verified.delta,
    redis,
    secretScope
  );
};

export const generateQRCodeURL = async (otpAuthUrl: string): Promise<string> => {
  return QRCode.toDataURL(otpAuthUrl);
};
