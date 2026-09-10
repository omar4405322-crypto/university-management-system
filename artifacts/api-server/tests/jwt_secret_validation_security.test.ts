import assert from 'node:assert/strict';
import { getJwtSecretValidationError } from '../src/utils/jwtSecretValidation';
import { getEncryptionKey } from '../src/utils/encryption.utils';

const weakSecrets = [
  'your-super-secret-key-change-this',
  'secret',
  'changeme',
  'replace-with-any-32-char-string-for-tests',
  'your-jwt-secret-key-at-least-32-chars',
  'REPLACE_ME_WITH_A_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS',
];

assert(getJwtSecretValidationError(undefined, 32));
assert(getJwtSecretValidationError('x'.repeat(31), 32));
assert(getJwtSecretValidationError('x'.repeat(32), 32));
assert(getJwtSecretValidationError('abcd'.repeat(8), 32));
assert(getJwtSecretValidationError('abcdefghijklmnopqrstuvwxyzABCDEF', 32));
assert(
  getJwtSecretValidationError(
    Buffer.from('your-jwt-secret-key-at-least-32-chars').toString('base64'),
    32
  )
);

for (const candidate of weakSecrets) {
  const error = getJwtSecretValidationError(candidate, 32);
  assert(error, `Known weak JWT secret must be rejected: ${candidate}`);
  assert(!error.includes(candidate), 'Validation errors must not disclose the configured secret');
  assert(getJwtSecretValidationError(`  ${candidate.toUpperCase()}  `, 32));
}

assert.equal(
  getJwtSecretValidationError('a-unique-secret-with-at-least-32-characters', 32),
  null
);

const originalEncryptionKey = process.env.ENCRYPTION_KEY;
try {
  for (const candidate of [
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    Buffer.from('0123456789abcdef0123456789abcdef', 'utf8').toString('base64'),
    'REPLACE_ME_WITH_64_RANDOM_HEX_CHARACTERS',
    'a'.repeat(64),
    'abcd'.repeat(16),
    '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
  ]) {
    process.env.ENCRYPTION_KEY = candidate;
    assert.throws(() => getEncryptionKey(), /known default|documented example|predictable/);
  }

  process.env.ENCRYPTION_KEY = '9cf47d854120aa8b156fca5d30380dff669751b910f127c98b6a02886755c572';
  assert.equal(getEncryptionKey().length, 32);
} finally {
  if (originalEncryptionKey === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = originalEncryptionKey;
}

console.log('✓ JWT secret validation security checks passed');
