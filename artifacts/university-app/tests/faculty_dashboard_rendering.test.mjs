import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(
  new URL('../src/pages/attendance/FacultyAttendanceDashboard.tsx', import.meta.url),
  'utf8'
);

const dashboardStart = source.indexOf('export function FacultyAttendanceDashboard');
const dashboardSource = source.slice(dashboardStart);

assert.match(source, /const RotatingQrCode = memo\(function RotatingQrCode/);
assert.match(source, /<RotatingQrCode[\s\S]*sessionId=\{activeSession\.sessionId\}/);
assert.doesNotMatch(dashboardSource, /setTimeLeft\(/, 'F4: the parent dashboard must not own the 500ms countdown');
assert.doesNotMatch(dashboardSource, /setInterval\([^]*500\)/, 'F4: the parent dashboard must not run the QR timer');
assert.match(source, /const \{ presentCount, lateCount, absentCount \} = useMemo/);
assert.match(source, /const filteredStudents = useMemo/);

console.log('F4 faculty dashboard render-isolation regression checks passed');
