import assert from 'node:assert/strict';
import {
  APPROVED_TASK_SUBMISSION_DOMAINS,
  validateTaskSubmissionUrl,
} from '../src/utils/taskSubmissionUrl.utils';
import { ValidationError } from '../src/utils/appError';

assert.equal(
  validateTaskSubmissionUrl('  https://drive.google.com/file/d/approved  '),
  'https://drive.google.com/file/d/approved',
  'approved domain URL must be accepted and trimmed'
);
assert.equal(
  validateTaskSubmissionUrl('https://gist.github.com/example/submission'),
  'https://gist.github.com/example/submission',
  'approved subdomains must be accepted'
);

for (const rejectedUrl of [
  'https://example.com/submission',
  'https://github.com.evil.com/submission',
  'https://evil.com/github.com',
]) {
  assert.throws(
    () => validateTaskSubmissionUrl(rejectedUrl),
    (error: unknown) =>
      error instanceof ValidationError &&
      error.message.includes('approved domain') &&
      error.message.includes('github.com'),
    `non-whitelisted URL must be rejected clearly: ${rejectedUrl}`
  );
}

assert.deepEqual(APPROVED_TASK_SUBMISSION_DOMAINS, [
  'drive.google.com',
  'docs.google.com',
  'github.com',
  'raw.githubusercontent.com',
  'dropbox.com',
  'onedrive.live.com',
  '1drv.ms',
]);

console.log('Task submission URL whitelist security checks passed');
