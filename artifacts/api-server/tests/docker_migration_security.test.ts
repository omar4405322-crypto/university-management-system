import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dockerfile = fs.readFileSync(path.resolve(process.cwd(), '../../Dockerfile'), 'utf8');
const command = dockerfile.match(/^CMD\s+(.+)$/m)?.[1] ?? '';

assert.ok(command.includes('prisma migrate deploy'), 'Container startup must deploy pending migrations');
assert.ok(!command.includes('prisma migrate resolve'), 'Container startup must never auto-resolve a migration');
assert.ok(
  command.indexOf('prisma migrate deploy') < command.indexOf('node --enable-source-maps'),
  'Migrations must succeed before the API process starts'
);

console.log('Docker migration startup security checks passed');
