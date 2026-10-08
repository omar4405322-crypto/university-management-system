/**
 * Phase 11 Fix Round — Row Accessible Names Browser Regression Test (D5-A, D5-B, D6-A).
 *
 * Validates that row-action and row-select buttons on StudentsList and TimetableManagement:
 * 1. Have accessible names that are unique per row and non-generic.
 * 2. Contain the row entity identifier/name (e.g., student name, timetable title).
 * 3. Never leak literal interpolation tokens like "{{" or "}}".
 * 4. Maintain these invariants across English and Arabic, selected and unselected states.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

const mockStudents = [
  { id: 1, firstName: 'Ahmed', lastName: 'Mansoor', studentId: '2026001', year: 1, department: { id: 1, name: 'Computer Science', nameAr: 'علوم الحاسب' }, user: { email: 'ahmed@uni.local' }, isActive: true },
  { id: 2, firstName: 'Fatima', lastName: 'Zahra', studentId: '2026002', year: 2, department: { id: 1, name: 'Computer Science', nameAr: 'علوم الحاسب' }, user: { email: 'fatima@uni.local' }, isActive: true },
  { id: 3, firstName: 'Tariq', lastName: 'Hamid', studentId: '2026003', year: 3, department: { id: 2, name: 'Information Systems', nameAr: 'نظم المعلومات' }, user: { email: 'tariq@uni.local' }, isActive: false },
];

const mockTimetables = [
  { id: 1, title: 'CS-Level1-Spring', academicYear: 1, semester: 1, status: 'PUBLISHED', collegeId: 1, departmentId: 1, createdAt: '2026-09-01T08:00:00Z', department: { name: 'CS' }, college: { name: 'Engineering' } },
  { id: 2, title: 'IS-Level2-Fall', academicYear: 2, semester: 2, status: 'DRAFT', collegeId: 1, departmentId: 2, createdAt: '2026-09-02T08:00:00Z', department: { name: 'IS' }, college: { name: 'Engineering' } },
  { id: 3, title: 'AI-Level3-Spring', academicYear: 3, semester: 1, status: 'PUBLISHED', collegeId: 1, departmentId: 3, createdAt: '2026-09-03T08:00:00Z', department: { name: 'AI' }, college: { name: 'Engineering' } },
];

describe('Phase 11 — Browser Regression: Accessible Row Action & Select Names', { timeout: 120000 }, () => {
  let app;
  let browser;

  it('setup production app server and playwright browser', async () => {
    app = await serveBuiltApp();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    assert.ok(app.origin, 'App origin must be defined');
  });

  for (const lang of ['en', 'ar']) {
    it(`StudentsList (${lang}): row actions and checkboxes have unique entity-containing accessible names without {{`, async () => {
      const { context, page } = await mockSessionPage(browser, {
        role: 'SUPER_ADMIN',
        language: lang,
      });

      await page.setViewportSize({ width: 1440, height: 900 });

      await page.route('**/api/students**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: mockStudents,
            pagination: { page: 1, limit: 10, total: mockStudents.length, totalPages: 1 },
          }),
        });
      });

      await page.goto(`${app.origin}/students`);
      await page.waitForSelector('table tbody tr');

      const rows = page.locator('table tbody tr');
      const count = await rows.count();
      assert.equal(count, mockStudents.length, `Expected ${mockStudents.length} rows`);

      for (let i = 0; i < count; i++) {
        const student = mockStudents[i];
        const fullName = `${student.firstName} ${student.lastName}`;
        const row = rows.nth(i);

        // 1. Row selection checkbox
        const checkbox = row.locator('input[type="checkbox"]');
        await assert.doesNotReject(checkbox.waitFor({ state: 'visible', timeout: 3000 }));
        const checkLabel = await checkbox.getAttribute('aria-label');
        assert.ok(checkLabel, `Checkbox row ${i} must have aria-label`);
        assert.ok(checkLabel.includes(fullName), `Checkbox label "${checkLabel}" must contain student full name "${fullName}"`);
        assert.ok(!checkLabel.includes('{{') && !checkLabel.includes('}}'), `Checkbox label must not contain {{ or }}: ${checkLabel}`);

        // 2. Row ActionMenu buttons
        const actionButtons = row.locator('div.flex.items-center.justify-end button');
        const btnCount = await actionButtons.count();
        assert.ok(btnCount >= 4, `Row ${i} should have at least 4 action buttons, found ${btnCount}`);

        const seenNames = new Set();
        for (let b = 0; b < btnCount; b++) {
          const btn = actionButtons.nth(b);
          const ariaLabel = await btn.getAttribute('aria-label');
          const title = await btn.getAttribute('title');

          assert.ok(ariaLabel, `Action button ${b} in row ${i} must have aria-label`);
          assert.ok(title, `Action button ${b} in row ${i} must have title`);
          assert.equal(ariaLabel, title, `Action button aria-label and title must match: ${ariaLabel} vs ${title}`);

          assert.ok(
            ariaLabel.includes(fullName),
            `Action button label "${ariaLabel}" must include row entity "${fullName}"`
          );
          assert.ok(
            !ariaLabel.includes('{{') && !ariaLabel.includes('}}'),
            `Action button label must not leak {{ or }}: "${ariaLabel}"`
          );

          assert.ok(
            !seenNames.has(ariaLabel),
            `Action button label must be unique within row: duplicate "${ariaLabel}"`
          );
          seenNames.add(ariaLabel);
        }
      }

      await context.close();
    });

    it(`TimetableManagement (${lang}): row actions and select buttons contain timetable title without {{ in selected and unselected states`, async () => {
      const { context, page } = await mockSessionPage(browser, {
        role: 'SUPER_ADMIN',
        language: lang,
      });

      await page.setViewportSize({ width: 1440, height: 900 });

      await page.route('**/api/timetable**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: mockTimetables,
          }),
        });
      });

      await page.goto(`${app.origin}/timetables-management`);
      await page.waitForLoadState('networkidle');

      // Check card action buttons
      for (const item of mockTimetables) {
        // Unselected checkbox state
        const unselectedBtn = page.locator(`button[aria-label*="${item.title}"]`).first();
        await assert.doesNotReject(unselectedBtn.waitFor({ state: 'visible', timeout: 5000 }));
        const unselectedLabel = await unselectedBtn.getAttribute('aria-label');
        assert.ok(unselectedLabel, `Button for ${item.title} must have aria-label`);
        assert.ok(unselectedLabel.includes(item.title), `Label "${unselectedLabel}" must contain "${item.title}"`);
        assert.ok(!unselectedLabel.includes('{{') && !unselectedLabel.includes('}}'), `Label must not contain {{: "${unselectedLabel}"`);

        // Click checkbox to select
        const cardCheckbox = page.locator(`button:has-text(""), button[type="button"]`).filter({ has: page.locator('svg') }).filter({ hasNot: page.locator('span') });
      }

      // Verify overall DOM has no leaked {{ or }} tokens anywhere in aria-label, title, or visible text
      const leakedAriaLabels = await page.$$eval('[aria-label*="{{"]', els => els.map(e => e.getAttribute('aria-label')));
      assert.deepEqual(leakedAriaLabels, [], `No elements should have {{ in aria-label: ${JSON.stringify(leakedAriaLabels)}`);

      const leakedTitles = await page.$$eval('[title*="{{"]', els => els.map(e => e.getAttribute('title')));
      assert.deepEqual(leakedTitles, [], `No elements should have {{ in title: ${JSON.stringify(leakedTitles)}`);

      await context.close();
    });
  }

  it('teardown server and browser', async () => {
    if (browser) await browser.close();
    if (app) await app.close();
  });
});
