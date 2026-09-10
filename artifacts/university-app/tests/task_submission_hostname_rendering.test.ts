import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getSubmissionDestinationHostname } from '../src/utils/taskSubmissionUrl';

assert.equal(
  getSubmissionDestinationHostname('https://drive.google.com/file/d/approved'),
  'drive.google.com'
);

const source = await readFile(
  new URL('../src/components/tasks/SubmissionsGradingModal.tsx', import.meta.url),
  'utf8'
);
assert.match(source, /getSubmissionDestinationHostname\(sub\.fileUrl\)/);
assert.match(source, /\{destinationHostname\}/);
assert.match(source, /rel="noopener noreferrer"/);

console.log('Task submission hostname rendering checks passed');
