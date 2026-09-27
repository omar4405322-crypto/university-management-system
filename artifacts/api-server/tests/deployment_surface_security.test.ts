import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../src/app.ts', import.meta.url), 'utf8');
const attendanceRoutes = await readFile(
  new URL('../src/routes/attendance.routes.ts', import.meta.url),
  'utf8'
);
const scheduleRoutes = await readFile(
  new URL('../src/routes/schedules.routes.ts', import.meta.url),
  'utf8'
);

assert.match(
  appSource,
  /if \(process\.env\.NODE_ENV !== 'production'\) \{\s*app\.use\('\/uploads\/profiles'/,
  'Local profile files must never be exposed by the production server'
);

for (const prefix of ['attendance_qr', 'attendance_session', 'attendance_rfid']) {
  assert.match(
    attendanceRoutes,
    new RegExp(`store:\\s*createRedisStore\\(["']${prefix}["']\\)`),
    `Attendance limiter ${prefix} must use the shared Redis-backed store`
  );
}

for (const prefix of ['enrollment', 'api']) {
  assert.match(
    appSource,
    new RegExp(`store:\\s*createRedisStore\\(["']${prefix}["']\\)`),
    `Application limiter ${prefix} must use the shared Redis-backed store`
  );
}

assert.match(
  scheduleRoutes,
  /store:\s*createRedisStore\(["']schedule_sync["']\)/,
  'Schedule bulk-sync limiter must use the shared Redis-backed store'
);

console.log('Deployment surface security checks passed');
