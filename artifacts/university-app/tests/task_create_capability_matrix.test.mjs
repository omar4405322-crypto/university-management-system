import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const capabilitiesSource = readFileSync(
  new URL('../src/config/capabilities.ts', import.meta.url),
  'utf8'
);

const transpiledJs = ts.transpileModule(capabilitiesSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;

const dataUri = `data:text/javascript;base64,${Buffer.from(transpiledJs).toString('base64')}`;
const {
  hasCapability,
  getRolesForCapability,
} = await import(dataUri);

test('Item D: tasks.create is restricted to DOCTOR only across all roles in capability matrix', () => {
  assert.equal(hasCapability('DOCTOR', 'tasks.create'), true, 'DOCTOR must have tasks.create capability');
  assert.equal(hasCapability('SUPER_ADMIN', 'tasks.create'), false, 'SUPER_ADMIN must not have tasks.create capability');
  assert.equal(hasCapability('ADMIN', 'tasks.create'), false, 'ADMIN must not have tasks.create capability');
  assert.equal(hasCapability('COLLEGE_ADMIN', 'tasks.create'), false, 'COLLEGE_ADMIN must not have tasks.create capability');
  assert.equal(hasCapability('DEPARTMENT_ADMIN', 'tasks.create'), false, 'DEPARTMENT_ADMIN must not have tasks.create capability');
  assert.equal(hasCapability('TEACHING_ASSISTANT', 'tasks.create'), false, 'TEACHING_ASSISTANT must not have tasks.create capability');
  assert.equal(hasCapability('STUDENT', 'tasks.create'), false, 'STUDENT must not have tasks.create capability');

  const roles = getRolesForCapability('tasks.create');
  assert.deepEqual(roles, ['DOCTOR'], 'Only DOCTOR role can possess tasks.create capability');
});

