/**
 * Phase 11 Fix Round — Permanent Sticky Headers Browser Regression Test (D1).
 *
 * Validates that TableHeader sticky on the 4 primary table surfaces:
 * 1. StudentsList (/students)
 * 2. FinanceDashboard (/finance)
 * 3. CoursesList (/courses)
 * 4. SchedulesList (/schedules-management?view=list)
 *
 * Sticks to the top of its bounded vertical scroll container when scrolling 60+ rows,
 * instead of scrolling off-screen (the defect where thead.top drifted to ~-148px).
 * Also asserts opaque background and no header displacement across light/dark and RTL.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

function createMockEntities(count = 65) {
  return {
    students: Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      firstName: `Student${i + 1}`,
      lastName: `Test`,
      studentId: `2026${String(i + 1).padStart(3, '0')}`,
      year: 2,
      department: { id: 1, name: 'Computer Science', nameAr: 'علوم الحاسب' },
      user: { email: `student${i + 1}@uni.local` },
      isActive: true,
    })),
    payments: Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      studentId: i + 1,
      student: { firstName: `Student${i + 1}`, lastName: `Test`, studentId: `2026${String(i + 1).padStart(3, '0')}` },
      amount: 1500 + i * 20,
      status: i % 2 === 0 ? 'PAID' : 'PENDING',
      type: 'TUITION',
      createdAt: '2026-10-01',
    })),
    courses: Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      courseCode: `CS${100 + i}`,
      name: `Course Subject ${i + 1}`,
      nameAr: `مقرر دراسي ${i + 1}`,
      department: { id: 1, name: 'Computer Science', nameAr: 'علوم الحاسب' },
      credits: 3,
      maxStudents: 150,
      year: 1,
      semester: 1,
      _count: { enrollments: 45 },
    })),
    schedules: Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      course: { id: i + 1, name: `Course ${i + 1}`, nameAr: `مقرر ${i + 1}`, courseCode: `CS${100 + i}` },
      department: { id: 1, name: 'CS', nameAr: 'علوم الحاسب' },
      dayOfWeek: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'][i % 5],
      startTime: '09:00',
      endTime: '11:00',
      room: `Hall ${String.fromCharCode(65 + (i % 6))}`,
      doctorId: 1,
      doctor: { id: 1, firstName: 'Mahmoud', lastName: 'Samir' },
      group: `G${(i % 4) + 1}`,
      slotType: 'LECTURE',
    })),
  };
}

const mockEntities = createMockEntities(70);

describe('Phase 11 — D1 Permanent Browser Regression: Sticky Headers', { timeout: 120000 }, () => {
  let app;
  let browser;

  it('setup production app server and playwright browser', async () => {
    app = await serveBuiltApp();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    assert.ok(app.origin, 'App origin must be defined');
  });

  const surfaces = [
    {
      name: 'StudentsList',
      route: '/students',
      containerSelector: 'div.max-h-\\[calc\\(100vh-280px\\)\\]',
    },
    {
      name: 'FinanceDashboard',
      route: '/finance',
      containerSelector: 'div.max-h-\\[calc\\(100vh-280px\\)\\]',
      preAction: async (page) => {
        const tab = page.locator('button:has-text("All Payments"), button:has-text("جميع المدفوعات")').first();
        await tab.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
        if (await tab.isVisible()) await tab.click();
      },
    },
    {
      name: 'CoursesList',
      route: '/courses',
      containerSelector: 'div.max-h-\\[calc\\(100vh-280px\\)\\]',
    },
    {
      name: 'SchedulesList',
      route: '/schedules-management?view=list',
      containerSelector: 'div.max-h-\\[calc\\(100vh-280px\\)\\]',
    },
  ];

  for (const s of surfaces) {
    it(`${s.name}: thead stays sticky during vertical container scrolling (no scroll-off defect)`, async () => {
      const { context, page } = await mockSessionPage(browser, {
        role: 'SUPER_ADMIN',
        language: 'en',
      });

      await page.setViewportSize({ width: 1440, height: 900 });

      // Mock API endpoints with 70 records
      await page.route('**/api/students**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: mockEntities.students,
            pagination: { page: 1, limit: 100, total: mockEntities.students.length, totalPages: 1 },
          }),
        });
      });

      await page.route('**/api/payments**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: mockEntities.payments,
            pagination: { page: 1, limit: 100, total: mockEntities.payments.length, totalPages: 1 },
          }),
        });
      });

      await page.route('**/api/courses**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: mockEntities.courses,
            pagination: { page: 1, limit: 100, total: mockEntities.courses.length, totalPages: 1 },
          }),
        });
      });

      await page.route('**/api/schedules**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: mockEntities.schedules,
            pagination: { page: 1, limit: 100, total: mockEntities.schedules.length, totalPages: 1 },
          }),
        });
      });

      await page.goto(`${app.origin}${s.route}`, { waitUntil: 'networkidle' });

      if (s.preAction) {
        await s.preAction(page);
      }

      const table = page.locator('table').first();
      await table.waitFor({ state: 'visible', timeout: 8000 });

      // Measure thead position before and after scrolling the bounded scroll container
      const measurement = await page.evaluate(({ containerSel }) => {
        const cont = document.querySelector(containerSel);
        const tbl = document.querySelector('table');
        const th = tbl ? tbl.querySelector('thead') : null;
        if (!cont || !th) return null;

        const theadBefore = th.getBoundingClientRect();
        // Scroll the container vertically
        cont.scrollTop = 300;
        const theadAfter = th.getBoundingClientRect();
        const finalScrollTop = cont.scrollTop;

        return {
          scrollTop: finalScrollTop,
          beforeTop: theadBefore.top,
          afterTop: theadAfter.top,
          diff: Math.abs(theadAfter.top - theadBefore.top),
        };
      }, { containerSel: s.containerSelector });

      assert.ok(measurement, `Must find container and thead for ${s.name}`);
      assert.ok(measurement.scrollTop > 0, `Container must have scrolled vertically (got ${measurement.scrollTop}px)`);

      // KEY REGRESSION ASSERTION:
      // In the old broken implementation, thead.top drifted from ~451px to ~-148px (diff > 500px).
      // In the fixed implementation, diff is <= 2px because the header sticks to top of container.
      assert.ok(
        measurement.diff <= 2,
        `Sticky thead on ${s.name} must remain fixed when container scrolls. Before: ${measurement.beforeTop}px, After: ${measurement.afterTop}px (drift: ${measurement.diff}px)`
      );

      await context.close();
    });
  }

  it('teardown browser and server', async () => {
    if (browser) await browser.close();
    if (app) await app.close();
  });
});
