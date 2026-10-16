import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_DIR = path.resolve(__dirname, '../src');

describe('WP-3 Batch 2 Tasks 6 & 7: Shared Timetable Header & Toolbar Components', () => {
  test('T6 & T7 components exist on disk', () => {
    const headerPath = path.join(APP_DIR, 'components/timetable/ScheduleHeader.tsx');
    const toolbarPath = path.join(APP_DIR, 'components/timetable/ScheduleToolbar.tsx');

    assert.ok(fs.existsSync(headerPath), 'ScheduleHeader.tsx component must exist');
    assert.ok(fs.existsSync(toolbarPath), 'ScheduleToolbar.tsx component must exist');
  });

  test('T6: ScheduleHeader.tsx satisfies logical CSS, accessibility, and props contract', () => {
    const headerPath = path.join(APP_DIR, 'components/timetable/ScheduleHeader.tsx');
    assert.ok(fs.existsSync(headerPath), 'ScheduleHeader.tsx must exist');

    const content = fs.readFileSync(headerPath, 'utf8');

    // Props contract
    assert.match(content, /title/, 'Props must include title');
    assert.match(content, /subtitle/, 'Props must include subtitle');
    assert.match(content, /canManage/, 'Props must include canManage');
    assert.match(content, /showPrint/, 'Props must include showPrint');
    assert.match(content, /onRefresh/, 'Props must include onRefresh');

    // Touch targets >= 40px
    assert.ok(
      content.includes('min-h-[40px]') || content.includes('h-10') || content.includes('min-w-[40px]'),
      'Action buttons must have >= 40px touch targets'
    );

    // Accessibility aria-labels
    assert.match(content, /aria-label=/, 'Icon and action buttons must include aria-labels');

    // Logical CSS check (no mr- / ml- / pl- / pr- without logical start/end equivalents)
    assert.ok(!content.includes('ml-') && !content.includes('mr-'), 'Must use logical start/end (ms-/me-) instead of physical margins');
  });

  test('T7: ScheduleToolbar.tsx satisfies layout, accessibility, and view switch contract', () => {
    const toolbarPath = path.join(APP_DIR, 'components/timetable/ScheduleToolbar.tsx');
    assert.ok(fs.existsSync(toolbarPath), 'ScheduleToolbar.tsx must exist');

    const content = fs.readFileSync(toolbarPath, 'utf8');

    // View switch contract
    assert.match(content, /scheduleViewMode/, 'Must accept scheduleViewMode prop');
    assert.match(content, /onViewModeChange/, 'Must accept onViewModeChange prop');
    assert.match(content, /grid/, 'Must support grid mode');
    assert.match(content, /agenda/, 'Must support agenda mode');

    // Logical CSS & layout
    assert.ok(content.includes('ms-auto') || content.includes('justify-between'), 'View switcher must be placed cleanly via logical spacing');
  });

  test('T6 & T7: Personal timetable pages (Doctor, TA, Weekly) import and use shared components', () => {
    const pages = [
      'pages/schedules/DoctorSchedule.tsx',
      'pages/schedules/TASchedule.tsx',
      'pages/schedules/WeeklySchedule.tsx',
    ];

    for (const pageRel of pages) {
      const fullPath = path.join(APP_DIR, pageRel);
      assert.ok(fs.existsSync(fullPath), `${pageRel} must exist`);
      const content = fs.readFileSync(fullPath, 'utf8');

      // Shared components usage
      assert.match(content, /import\s+.*ScheduleHeader\s+from/, `${pageRel} must import ScheduleHeader`);
      assert.match(content, /<ScheduleHeader/, `${pageRel} must render ScheduleHeader`);

      assert.match(content, /import\s+.*ScheduleToolbar\s+from/, `${pageRel} must import ScheduleToolbar`);
      assert.match(content, /<ScheduleToolbar/, `${pageRel} must render ScheduleToolbar`);

      // KPI ribbons removed
      assert.ok(
        !content.includes('StatCard') && !content.includes('EXECUTIVE 4-METRIC RIBBON'),
        `${pageRel} must have KPI ribbons removed`
      );
    }
  });

  test('T3 UI: No SECTION or TUTORIAL slot type cases or labels in schedule components', () => {
    const scheduleFiles = [
      'components/timetable/ScheduleView.tsx',
      'components/timetable/InstructorSelector.tsx',
      'pages/schedules/DoctorSchedule.tsx',
      'pages/schedules/TASchedule.tsx',
      'pages/schedules/WeeklySchedule.tsx',
      'pages/schedules/SchedulesList.tsx',
    ];

    for (const fileRel of scheduleFiles) {
      const fullPath = path.join(APP_DIR, fileRel);
      if (!fs.existsSync(fullPath)) continue;
      const content = fs.readFileSync(fullPath, 'utf8');

      assert.ok(!content.includes("case 'SECTION':"), `${fileRel} must not have case 'SECTION'`);
      assert.ok(!content.includes("case 'TUTORIAL':"), `${fileRel} must not have case 'TUTORIAL'`);
      assert.ok(!content.includes("slotType === 'SECTION'"), `${fileRel} must not check slotType === 'SECTION'`);
    }
  });

  test('C4(a) & C5(d): Static translation keys in schedule components exist in winning ar and en blocks', () => {
    const arPath = path.join(APP_DIR, 'i18n/ar.json');
    const enPath = path.join(APP_DIR, 'i18n/en.json');

    const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));
    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

    function getNestedValue(obj, keyPath) {
      const parts = keyPath.split('.');
      let cur = obj;
      for (const part of parts) {
        if (cur === undefined || cur === null) return undefined;
        cur = cur[part];
      }
      return cur;
    }

    const scheduleFiles = [
      'components/timetable/ScheduleHeader.tsx',
      'components/timetable/ScheduleToolbar.tsx',
      'pages/schedules/DoctorSchedule.tsx',
      'pages/schedules/TASchedule.tsx',
      'pages/schedules/WeeklySchedule.tsx',
    ];

    const keyRegex = /\bt\(\s*['"]([a-zA-Z0-9_.-]+)['"]/g;
    const missingKeys = [];

    for (const fileRel of scheduleFiles) {
      const fullPath = path.join(APP_DIR, fileRel);
      assert.ok(fs.existsSync(fullPath), `${fileRel} must exist`);
      const content = fs.readFileSync(fullPath, 'utf8');

      let match;
      while ((match = keyRegex.exec(content)) !== null) {
        const key = match[1];
        const valAr = getNestedValue(ar, key);
        const valEn = getNestedValue(en, key);

        if (typeof valAr !== 'string') {
          missingKeys.push(`Missing in ar.json: "${key}" (used in ${fileRel})`);
        }
        if (typeof valEn !== 'string') {
          missingKeys.push(`Missing in en.json: "${key}" (used in ${fileRel})`);
        }
      }
    }

    assert.deepEqual(missingKeys, [], `All static t(...) keys must exist in both ar.json and en.json:\n${missingKeys.join('\n')}`);

    // Verify search placeholder keys exist in winning schedules block
    assert.equal(typeof ar.schedules?.searchDoctorSchedulePlaceholder, 'string', 'ar.schedules.searchDoctorSchedulePlaceholder must exist');
    assert.equal(typeof en.schedules?.searchDoctorSchedulePlaceholder, 'string', 'en.schedules.searchDoctorSchedulePlaceholder must exist');
    assert.equal(typeof ar.schedules?.searchTASchedulePlaceholder, 'string', 'ar.schedules.searchTASchedulePlaceholder must exist');
    assert.equal(typeof en.schedules?.searchTASchedulePlaceholder, 'string', 'en.schedules.searchTASchedulePlaceholder must exist');
    assert.equal(typeof ar.schedules?.searchWeeklySchedulePlaceholder, 'string', 'ar.schedules.searchWeeklySchedulePlaceholder must exist');
    assert.equal(typeof en.schedules?.searchWeeklySchedulePlaceholder, 'string', 'en.schedules.searchWeeklySchedulePlaceholder must exist');
    assert.equal(typeof ar.schedules?.searchSchedulePlaceholder, 'string', 'ar.schedules.searchSchedulePlaceholder must exist');
    assert.equal(typeof en.schedules?.searchSchedulePlaceholder, 'string', 'en.schedules.searchSchedulePlaceholder must exist');
  });

  test('C4(b) & C5(d): Dynamic slotType translation sites use formatSlotType helper', () => {
    const slotTypeSites = [
      'components/timetable/ScheduleView.tsx',
      'components/timetable/TimeSlotCell.tsx',
      'pages/schedules/SchedulesList.tsx',
      'pages/teaching-assistants/TeachingAssistantDetails.tsx',
    ];

    for (const fileRel of slotTypeSites) {
      const fullPath = path.join(APP_DIR, fileRel);
      assert.ok(fs.existsSync(fullPath), `${fileRel} must exist`);
      const content = fs.readFileSync(fullPath, 'utf8');

      assert.match(
        content,
        /formatSlotType/,
        `${fileRel} must import and use formatSlotType helper for slotType translation`
      );

      // Must not use broken dynamic templates like t(`schedule.${...}`)
      assert.ok(
        !content.includes('t(`schedule.${'),
        `${fileRel} must not use broken dynamic template t(\`schedule.\${...}\`)`
      );
    }
  });
});
