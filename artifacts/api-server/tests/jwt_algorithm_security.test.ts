import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'jwt-algorithm-test-secret-that-is-long-enough-1234567890';

const { generateAccessToken, verifyToken } = await import('../src/utils/jwt.utils');

const valid = generateAccessToken(41, 3);
const payload = verifyToken(valid);
assert.equal(payload.id, 41);
assert.equal(payload.tokenVersion, 3);

for (const algorithm of ['HS384', 'HS512'] as const) {
  const token = jwt.sign(
    { id: 41, tokenVersion: 3 },
    process.env.JWT_SECRET,
    {
      algorithm,
      issuer: 'Smart University Platform',
      audience: 'University Users',
      expiresIn: '15m',
    }
  );
  assert.throws(() => verifyToken(token), /Invalid or corrupted security token/);
}

console.log('JWT algorithm allowlist security checks passed');
