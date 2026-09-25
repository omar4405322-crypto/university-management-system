import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const gradingModalSrc = readFileSync(
  new URL('../src/components/tasks/SubmissionsGradingModal.tsx', import.meta.url),
  'utf8'
);

test('BUG-5: SubmissionsGradingModal defines row-level saveError state', () => {
  assert.match(
    gradingModalSrc,
    /const\s*\[saveError,\s*setSaveError\]\s*=\s*useState<string\s*\|\s*null>\(null\)/,
    'SubmissionRow must manage isolated saveError state'
  );
});

test('BUG-5: handleSave sets saveError on API failure or network exception', () => {
  assert.match(
    gradingModalSrc,
    /setSaveError\(res\?\.message\s*\|\|\s*t\(['"]tasks\.saveGradeError['"]/,
    'Must set saveError when API response success is falsy'
  );
  assert.match(
    gradingModalSrc,
    /catch\s*\(\s*err:\s*unknown\s*\)\s*\{[\s\S]*?setSaveError\(msg\)/,
    'Must catch exceptions and set saveError'
  );
});

test('BUG-5: saveError is visibly rendered inline to the doctor', () => {
  assert.match(
    gradingModalSrc,
    /\{saveError\s*\?[\s\S]*?<AlertCircle[\s\S]*?<span>\{saveError\}<\/span>/,
    'Must render saveError with AlertCircle icon and error message inline'
  );
});
