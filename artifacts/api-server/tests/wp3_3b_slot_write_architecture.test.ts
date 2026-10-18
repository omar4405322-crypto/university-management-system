import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * T5 Architecture Guard: ScheduleSlot write architecture test
 * Scans src and scripts for ScheduleSlot writes.
 * Each writing file must either import SchedulePlacementService or be present
 * in the explicit allowlist with a mandatory justification.
 * Unwired files are marked TEMPORARY(3B-3).
 * A new unlisted writer must fail this test.
 */

const PRISMA_WRITE_PATTERNS = [
  'scheduleSlot.create',
  'scheduleSlot.createMany',
  'scheduleSlot.update',
  'scheduleSlot.updateMany',
  'scheduleSlot.upsert',
  'scheduleSlot.delete',
  'scheduleSlot.deleteMany',
  'scheduleOverride.create',
  'scheduleOverride.createMany',
  'scheduleOverride.update',
  'scheduleOverride.updateMany',
  'scheduleOverride.upsert',
  'scheduleOverride.delete',
  'scheduleOverride.deleteMany',
];

const NESTED_WRITE_REGEX =
  /(?:scheduleSlots|scheduleOverrides)\s*:\s*\{\s*(?:create|createMany|update|updateMany|upsert|delete|deleteMany|connect|disconnect|set)\b/;

const RAW_SQL_WRITE_REGEX =
  /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE)\s+(?:ONLY\s+)?["`]?Schedule(?:Slot|Override)["`]?/i;

const EXECUTE_RAW_WRITE_REGEX =
  /\$executeRaw(?:Unsafe)?\s*(?:<[^>]*>)?\s*\([^)]*Schedule(?:Slot|Override)/i;

const SCRIPT_TABLE_PATTERN = /['"`]Schedule(?:Slot|Override)['"`]/;

// 3B-3 allowlist: shrunk to non-placing writers only (deletes, group detach, benchmark script)
const EXPLICIT_ALLOWLIST: Record<string, string> = {
  'artifacts/api-server/src/controllers/courses.controller.ts':
    'Cascading deletion of linked schedule slots on deleteCourse',
  'artifacts/api-server/src/controllers/studentGroups.controller.ts':
    'Clears slot groupIds on student group detachment/deletion',
  'artifacts/api-server/src/controllers/timetable.controller.ts':
    'Cascading deletion of timetable schedule slots on deleteTimetable',
  'scripts/db_explain_runner.mjs':
    'Read-only benchmark runner EXPLAIN ANALYZE on ScheduleSlot',
};

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

function findRepoRoot(startDir: string): string {
  let cur = startDir;
  while (cur && cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, 'pnpm-workspace.yaml'))) {
      return cur;
    }
    cur = path.dirname(cur);
  }
  return path.resolve(startDir, '../../..');
}

function scanForScheduleSlotWrites(
  targetDirs: string[],
  repoRoot: string
): Map<string, { patterns: string[]; lines: number[] }> {
  const writers = new Map<string, { patterns: string[]; lines: number[] }>();

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith('.ts') ||
          entry.name.endsWith('.js') ||
          entry.name.endsWith('.mjs'))
      ) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        const matchedPatterns = new Set<string>();
        const matchedLines: number[] = [];
        const isScript = normalizePath(fullPath).includes('/scripts/');

        lines.forEach((line, idx) => {
          for (const pattern of PRISMA_WRITE_PATTERNS) {
            if (line.includes(pattern)) {
              matchedPatterns.add(pattern);
              matchedLines.push(idx + 1);
            }
          }
          if (NESTED_WRITE_REGEX.test(line)) {
            matchedPatterns.add('nested-relation-write');
            matchedLines.push(idx + 1);
          }
          if (RAW_SQL_WRITE_REGEX.test(line) || EXECUTE_RAW_WRITE_REGEX.test(line)) {
            matchedPatterns.add('raw-sql-write');
            matchedLines.push(idx + 1);
          }
          if (isScript && SCRIPT_TABLE_PATTERN.test(line)) {
            matchedPatterns.add('script-table-reference');
            matchedLines.push(idx + 1);
          }
        });

        if (matchedPatterns.size > 0) {
          const relPath = normalizePath(path.relative(repoRoot, fullPath));
          writers.set(relPath, {
            patterns: Array.from(matchedPatterns),
            lines: matchedLines,
          });
        }
      }
    }
  }

  for (const d of targetDirs) {
    walk(d);
  }

  return writers;
}

test('wp3_3b_slot_write_architecture: scans src and scripts for ScheduleSlot writes', async (t) => {
  const repoRoot = findRepoRoot(__dirname);
  const scanDirs = [
    path.join(repoRoot, 'artifacts/api-server/src'),
    path.join(repoRoot, 'scripts'),
  ];

  const actualWriters = scanForScheduleSlotWrites(scanDirs, repoRoot);

  await t.test('all detected writers either import SchedulePlacementService or are in allowlist', () => {
    const unapprovedWriters: string[] = [];

    for (const [relPath] of actualWriters.entries()) {
      const fullPath = path.join(repoRoot, relPath);
      const content = fs.readFileSync(fullPath, 'utf8');
      const importsService = content.includes('SchedulePlacementService');
      const inAllowlist = Object.prototype.hasOwnProperty.call(EXPLICIT_ALLOWLIST, relPath);

      if (!importsService && !inAllowlist) {
        unapprovedWriters.push(relPath);
      }
    }

    assert.equal(
      unapprovedWriters.length,
      0,
      `Detected unauthorized ScheduleSlot writers not importing SchedulePlacementService and not in allowlist:\n${unapprovedWriters.join(
        '\n'
      )}`
    );
  });

  await t.test('all placing writers are detected and import SchedulePlacementService', () => {
    const placingControllers = [
      'artifacts/api-server/src/controllers/schedulesMutation.controller.ts',
      'artifacts/api-server/src/controllers/schedulesSync.controller.ts',
      'artifacts/api-server/src/controllers/doctors.controller.ts',
      'artifacts/api-server/src/controllers/teachingAssistants.controller.ts',
      'artifacts/api-server/src/controllers/requests.controller.ts',
      'artifacts/api-server/src/controllers/overrides.controller.ts',
    ];

    for (const placer of placingControllers) {
      assert.ok(actualWriters.has(placer), `Placing controller ${placer} must be detected as a writer`);
      const fullPath = path.join(repoRoot, placer);
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.ok(content.includes('SchedulePlacementService'), `${placer} must import SchedulePlacementService`);
    }
  });

  await t.test('allowlist entries are valid and restricted to non-placing writers only', () => {
    const placingControllers = [
      'schedulesMutation.controller.ts',
      'schedulesSync.controller.ts',
      'doctors.controller.ts',
      'teachingAssistants.controller.ts',
      'requests.controller.ts',
      'overrides.controller.ts',
    ];

    for (const [file, reason] of Object.entries(EXPLICIT_ALLOWLIST)) {
      assert.ok(reason && reason.length > 0, `File ${file} must have a non-empty allowlist reason`);
      for (const placer of placingControllers) {
        assert.ok(!file.includes(placer), `Placing controller ${placer} must NOT be in the allowlist in 3B-3`);
      }
    }
  });

  await t.test('hypothetical unlisted writer is rejected by validation function', () => {
    const mockWriters = new Map<string, { patterns: string[]; lines: number[] }>([
      [
        'artifacts/api-server/src/controllers/unauthorized.controller.ts',
        { patterns: ['scheduleSlot.create'], lines: [42] },
      ],
    ]);

    const unapproved: string[] = [];
    for (const [relPath] of mockWriters.entries()) {
      const inAllowlist = Object.prototype.hasOwnProperty.call(EXPLICIT_ALLOWLIST, relPath);
      if (!inAllowlist) {
        unapproved.push(relPath);
      }
    }

    assert.equal(unapproved.length, 1);
    assert.equal(unapproved[0], 'artifacts/api-server/src/controllers/unauthorized.controller.ts');
  });
});
