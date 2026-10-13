import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const studentRecordSource = readFileSync(
  new URL('../src/pages/records/StudentRecord.tsx', import.meta.url),
  'utf8'
);
const gpaUtilsSource = readFileSync(
  new URL('../../api-server/src/utils/gpa.utils.ts', import.meta.url),
  'utf8'
);

test('StudentRecord.tsx aligns with server getGradeScale thresholds in gpa.utils.ts', () => {
  // Server standard:
  // grade >= 90 => A
  // grade >= 80 => B
  // grade >= 70 => C
  // grade >= 60 => D
  // < 60 => F (below 60 is F / FAILED)

  // Verify server scale source invariant
  assert.match(gpaUtilsSource, /if\s*\(grade\s*>=\s*90\)\s*return\s*\{\s*letterGrade:\s*['"]A['"],\s*gradePoints:\s*4\.0\s*\};/);
  assert.match(gpaUtilsSource, /if\s*\(grade\s*>=\s*80\)\s*return\s*\{\s*letterGrade:\s*['"]B['"],\s*gradePoints:\s*3\.0\s*\};/);
  assert.match(gpaUtilsSource, /if\s*\(grade\s*>=\s*70\)\s*return\s*\{\s*letterGrade:\s*['"]C['"],\s*gradePoints:\s*2\.0\s*\};/);
  assert.match(gpaUtilsSource, /if\s*\(grade\s*>=\s*60\)\s*return\s*\{\s*letterGrade:\s*['"]D['"],\s*gradePoints:\s*1\.0\s*\};/);

  // StudentRecord must NOT map 50% to a passing D grade
  assert.doesNotMatch(
    studentRecordSource,
    /grade\s*>=\s*50.*Badge.*D/s,
    'StudentRecord must not treat 50% as passing D; passing threshold is 60%'
  );

  // StudentRecord must align with 60% for D, 70% for C, 80% for B, 90% for A
  assert.match(
    studentRecordSource,
    /if\s*\(grade\s*>=\s*90\)\s*return\s*<Badge\s+variant="success">A\s+\(\{grade\}%\)<\/Badge>;/
  );
  assert.match(
    studentRecordSource,
    /if\s*\(grade\s*>=\s*80\)\s*return\s*<Badge\s+variant="info">B\s+\(\{grade\}%\)<\/Badge>;/
  );
  assert.match(
    studentRecordSource,
    /if\s*\(grade\s*>=\s*70\)\s*return\s*<Badge\s+variant="warning">C\s+\(\{grade\}%\)<\/Badge>;/
  );
  assert.match(
    studentRecordSource,
    /if\s*\(grade\s*>=\s*60\)\s*return\s*<Badge\s+variant="warning">D\s+\(\{grade\}%\)<\/Badge>;/
  );
});
