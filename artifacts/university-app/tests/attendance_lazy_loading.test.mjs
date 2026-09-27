import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [pageSource, scannerSource] = await Promise.all([
  readFile(new URL('../src/pages/attendance/AttendancePage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/attendance/StudentAttendanceScanner.tsx', import.meta.url), 'utf8'),
]);

assert.match(pageSource, /const StudentAttendanceDashboard = lazy\(\(\) =>[\s\S]*import\('\.\/StudentAttendanceDashboard'\)/);
assert.match(pageSource, /const FacultyAttendanceDashboard = lazy\(\(\) => import\('\.\/FacultyAttendanceDashboard'\)\)/);
assert.doesNotMatch(pageSource, /import \{ StudentAttendanceDashboard \} from/);
assert.doesNotMatch(pageSource, /import \{ FacultyAttendanceDashboard \} from/);

const fingerprintMatches = scannerSource.match(/await import\('@fingerprintjs\/fingerprintjs'\)/g);
assert.equal(
  fingerprintMatches?.length,
  1,
  'StudentAttendanceScanner must lazily load FingerprintJS through one shared device identity helper'
);
assert.doesNotMatch(scannerSource, /crypto\.randomUUID|Math\.random/);
assert.doesNotMatch(scannerSource, /attendance_device_id/);
assert.match(scannerSource, /Device verification is unavailable/);
assert.match(scannerSource, /await import\('jsqr'\)/);
assert.doesNotMatch(scannerSource, /^import .* from ['"](?:jsqr|@fingerprintjs\/fingerprintjs)['"];?$/m);

// Verify production bundle chunks if built
try {
  const { readdir } = await import('node:fs/promises');
  const assets = await readdir(new URL('../dist/public/assets/', import.meta.url));
  const expectedChunks = [
    'AttendancePage-',
    'FacultyAttendanceDashboard-',
    'StudentAttendanceDashboard-',
    'jsQR-',
    'fp.esm-',
  ];
  for (const prefix of expectedChunks) {
    assert.ok(
      assets.some((asset) => asset.startsWith(prefix) && asset.endsWith('.js')),
      `Production output must contain separate chunk for ${prefix.slice(0, -1)}`
    );
  }
  console.log('Production bundle chunk verification passed');
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}

console.log('F6 attendance role and scanner-library lazy-loading source checks passed');
