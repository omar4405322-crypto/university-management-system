import assert from 'node:assert/strict';
import { getJwtSecretValidationError } from '../src/utils/jwtSecretValidation';

const weakSecrets = [
  'your-super-secret-key-change-this',
  'secret',
  'changeme',
  'replace-with-any-32-char-string-for-tests',
];

assert(getJwtSecretValidationError(undefined, 32));
assert(getJwtSecretValidationError('x'.repeat(31), 32));
assert.equal(getJwtSecretValidationError('x'.repeat(32), 32), null);

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

console.log('✓ JWT secret validation security checks passed');
