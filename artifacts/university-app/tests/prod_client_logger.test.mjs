import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const loggerSource = readFileSync(
  new URL('../src/lib/logger.ts', import.meta.url),
  'utf8'
);

test('university-app logger.ts: logger.error must never suppress errors in production', () => {
  // Ensure logger.error is not conditionally gated on isDev
  assert.doesNotMatch(
    loggerSource,
    /error:\s*\([^)]*\)\s*:\s*void\s*=>\s*\{\s*if\s*\(\s*isDev\s*\)\s*console\.error/,
    'logger.error must not be wrapped in if (isDev); client errors must always reach console.error for production observability'
  );

  // Ensure logger.error unconditionally calls console.error
  assert.match(
    loggerSource,
    /error:\s*\([^)]*\)\s*:\s*void\s*=>\s*\{\s*console\.error/,
    'logger.error must unconditionally call console.error'
  );
});

test('university-app logger.ts: debug, log, info, and warn remain gated by development environment', () => {
  assert.match(
    loggerSource,
    /log:\s*\([^)]*\)\s*:\s*void\s*=>\s*\{\s*if\s*\(\s*isDev\s*\)\s*console\.log/,
    'logger.log must be gated by isDev'
  );
  assert.match(
    loggerSource,
    /info:\s*\([^)]*\)\s*:\s*void\s*=>\s*\{\s*if\s*\(\s*isDev\s*\)\s*console\.info/,
    'logger.info must be gated by isDev'
  );
  assert.match(
    loggerSource,
    /warn:\s*\([^)]*\)\s*:\s*void\s*=>\s*\{\s*if\s*\(\s*isDev\s*\)\s*console\.warn/,
    'logger.warn must be gated by isDev'
  );
});
