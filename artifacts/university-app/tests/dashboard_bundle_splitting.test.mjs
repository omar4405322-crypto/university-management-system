import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';

const assets = await readdir(new URL('../dist/public/assets/', import.meta.url));
const expectedChunks = [
  'DashboardContainer-',
  'AdminDashboard-',
  'DoctorDashboard-',
  'StudentDashboard-',
];

for (const prefix of expectedChunks) {
  assert.ok(
    assets.some((asset) => asset.startsWith(prefix) && asset.endsWith('.js')),
    `F6: production output must contain a separate ${prefix.slice(0, -1)} chunk`
  );
}

console.log('F6 production bundle-splitting output checks passed');
