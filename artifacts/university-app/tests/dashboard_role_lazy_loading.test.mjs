import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(
  new URL('../src/pages/dashboard/DashboardContainer.tsx', import.meta.url),
  'utf8'
);

for (const roleDashboard of ['AdminDashboard', 'DoctorDashboard', 'StudentDashboard']) {
  assert.match(
    source,
    new RegExp(`const ${roleDashboard} = lazy\\(\\(\\) => import\\('\\./${roleDashboard}'\\)\\)`),
    `F6: ${roleDashboard} must be a role-selected lazy import`
  );
  assert.doesNotMatch(
    source,
    new RegExp(`import ${roleDashboard} from`),
    `F6: ${roleDashboard} must not be eagerly imported`
  );
}

console.log('F6 role-based dashboard lazy-loading source checks passed');
