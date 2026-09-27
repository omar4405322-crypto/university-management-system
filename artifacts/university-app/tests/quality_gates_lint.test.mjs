import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ESLint } from 'eslint';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '../../..');
const eslint = new ESLint({ cwd: rootDir });

test('TEST-002: ESLint catches conditional React Hook violation (FE-001 regression guard)', async () => {
  const badSnippet = [
    "import React from 'react';",
    "export function C({ x }: { x: boolean }) {",
    "  if (x) return null;",
    "  React.useEffect(() => {}, []);",
    "  return null;",
    "}",
  ].join('\n');

  const results = await eslint.lintText(badSnippet, {
    filePath: path.join(rootDir, 'artifacts/university-app/src/components/ui/TestComponent.tsx'),
  });

  const ruleIds = results.flatMap((r) => r.messages.map((m) => m.ruleId));
  assert.ok(
    ruleIds.includes('react-hooks/rules-of-hooks'),
    `Expected lint messages to include react-hooks/rules-of-hooks, got: ${JSON.stringify(ruleIds)}`
  );
});

test('TEST-002: Modal.tsx passes React Hook and accessibility linting cleanly', async () => {
  const modalPath = path.join(rootDir, 'artifacts/university-app/src/components/ui/Modal.tsx');
  const results = await eslint.lintFiles([modalPath]);
  const errorCount = results.reduce((acc, r) => acc + r.errorCount, 0);
  assert.equal(errorCount, 0, 'Modal.tsx should pass ESLint with 0 errors');
});

test('TEST-002: ESLint catches missing alt attribute on img (jsx-a11y/alt-text)', async () => {
  const badImgSnippet = [
    "import React from 'react';",
    "export function Avatar() {",
    "  return <img src='user.png' />;",
    "}",
  ].join('\n');

  const results = await eslint.lintText(badImgSnippet, {
    filePath: path.join(rootDir, 'artifacts/university-app/src/components/ui/Avatar.tsx'),
  });

  const ruleIds = results.flatMap((r) => r.messages.map((m) => m.ruleId));
  assert.ok(
    ruleIds.includes('jsx-a11y/alt-text'),
    `Expected lint messages to include jsx-a11y/alt-text, got: ${JSON.stringify(ruleIds)}`
  );
});
