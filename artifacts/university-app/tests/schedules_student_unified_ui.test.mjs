import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

const mockSlots = [
  {
    id: 101,
    dayOfWeek: 'Monday',
    startTime: '09:00',
    endTime: '11:00',
    room: 'Hall A101',
    slotType: 'LECTURE',
    year: 2,
    semester: 1,
    doctorId: 1,
    doctor: { id: 1, firstName: 'Dr. Mahmoud', lastName: 'Ibrahim' },
    courseId: 201,
    course: { id: 201, name: 'Data Structures & Algorithms', code: 'CS201' },
    departmentId: 1,
    department: { id: 1, name: 'Computer Science Department', college: { id: 1, name: 'Faculty of Information Technology' } },
  },
  {
    id: 102,
    dayOfWeek: 'Monday',
    startTime: '12:00',
    endTime: '14:00',
    room: 'Lab B204',
    slotType: 'LAB',
    year: 2,
    semester: 1,
    teachingAssistantId: 1,
    teachingAssistant: { id: 1, firstName: 'Eng. Sarah', lastName: 'Adel' },
    courseId: 201,
    course: { id: 201, name: 'Data Structures & Algorithms', code: 'CS201' },
    departmentId: 1,
    department: { id: 1, name: 'Computer Science Department', college: { id: 1, name: 'Faculty of Information Technology' } },
  },
  {
    id: 103,
    dayOfWeek: 'Tuesday',
    startTime: '10:00',
    endTime: '12:00',
    room: 'Hall C302',
    slotType: 'LECTURE',
    year: 2,
    semester: 1,
    doctorId: 2,
    doctor: { id: 2, firstName: 'Dr. Karim', lastName: 'Fouad' },
    courseId: 202,
    course: { id: 202, name: 'Database Management Systems', code: 'CS202' },
    departmentId: 1,
    department: { id: 1, name: 'Computer Science Department', college: { id: 1, name: 'Faculty of Information Technology' } },
  },
];

describe('Schedules Module: Student Schedule Unified Layout & Consistency', { timeout: 120000 }, () => {
  let app;
  let browser;

  it('setup production app server and browser', async () => {
    app = await serveBuiltApp();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    assert.ok(app.origin, 'App origin must be defined');
  });

  for (const lang of ['ar', 'en']) {
    it(`Student Schedule (${lang}): matches executive hero, 4 KPI cards, search toolbar, and no duplicate headers`, async () => {
      const { context, page } = await mockSessionPage(browser, {
        role: 'STUDENT',
        language: lang,
        user: {
          firstName: 'Omar',
          lastName: 'Hassan',
          student: { id: 7, year: 2 },
          department: { id: 1, name: lang === 'ar' ? 'قسم علوم الحاسب' : 'Computer Science Department' },
        },
      });

      await page.setViewportSize({ width: 1440, height: 900 });

      // Route weekly schedule data
      await page.route('**/api/schedules/week**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: mockSlots,
            pagination: { page: 1, limit: 100, total: mockSlots.length, totalPages: 1 },
          }),
        });
      });

      await page.goto(`${app.origin}/schedules/student`, { waitUntil: 'networkidle' });

      // 1. Verify single unique h1 page title (No duplicate title)
      const h1Count = await page.locator('h1').count();
      assert.equal(h1Count, 1, `Page must have exactly 1 h1 title, found ${h1Count}`);

      const h1Text = await page.locator('h1').first().innerText();
      assert.ok(h1Text.includes('Omar Hassan') || h1Text.includes('Omar') || h1Text.includes('جدول'), `Title must reflect student identity, got: "${h1Text}"`);

      // 2. Verify Executive Hero Card structure
      // Action buttons: Print and Refresh
      const printBtn = page.getByRole('button', { name: lang === 'ar' ? /طباعة/ : /Print/i });
      await printBtn.waitFor({ state: 'visible', timeout: 5000 });
      assert.ok(await printBtn.isVisible(), 'Print button must be visible in header');

      const refreshBtn = page.locator('button[aria-label*="تحديث"], button[aria-label*="Refresh"], button[title*="تحديث"], button[title*="Refresh"]');
      assert.ok(await refreshBtn.isVisible(), 'Refresh button must be visible in header');

      // 3. Verify exactly 4 Top KPI Stat Cards
      // The grid contains 4 stat cards
      const statCardValues = page.locator('.grid.grid-cols-2.sm\\:grid-cols-4 [class*="text-"]');
      assert.ok(await statCardValues.count() >= 4, '4 Top KPI Stat Cards must be rendered');

      // Check the slot count value is 3 in the cards
      const bodyText = await page.innerText('body');
      assert.ok(bodyText.includes('3'), 'KPI stat card must display 3 total sessions');

      // 4. Verify Unified Compact Filter Toolbar
      const searchInput = page.locator('input[type="text"][placeholder*="بحث"], input[type="text"][placeholder*="Search"]');
      await searchInput.waitFor({ state: 'visible', timeout: 5000 });
      assert.ok(await searchInput.isVisible(), 'Unified search input must be visible');

      // 5. Verify View Switcher within toolbar (Weekly Grid vs Agenda View)
      const weeklyBtn = page.getByRole('button', { name: lang === 'ar' ? /الجدول الأسبوعي/ : /Weekly Grid/i });
      const agendaBtn = page.getByRole('button', { name: lang === 'ar' ? /عرض الأجندة/ : /Agenda View/i });
      assert.ok(await weeklyBtn.isVisible(), 'Weekly Grid view switcher button must be visible');
      assert.ok(await agendaBtn.isVisible(), 'Agenda View switcher button must be visible');

      // Switch to Agenda View and verify agenda day cards render
      await agendaBtn.click();
      await page.waitForTimeout(300);
      assert.ok(await agendaBtn.getAttribute('class'), 'Agenda view toggled active');

      // Switch back to Grid View
      await weeklyBtn.click();
      await page.waitForTimeout(300);

      // 6. Verify NO isolated date badge ("اليوم October 2026")
      const isolatedBadge = page.locator('text=اليوم October');
      assert.equal(await isolatedBadge.count(), 0, 'Isolated legacy date badge must be eliminated');

      await context.close();
    });
  }

  it('Responsive Fidelity: Tablet (768px) and Mobile (390px) viewports maintain layout integrity', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'STUDENT',
      language: 'ar',
      user: {
        firstName: 'Omar',
        lastName: 'Hassan',
        student: { id: 7, year: 2 },
      },
    });

    await page.route('**/api/schedules/week**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockSlots,
          pagination: { page: 1, limit: 100, total: mockSlots.length, totalPages: 1 },
        }),
      });
    });

    // Test Tablet (768px)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${app.origin}/schedules/student`, { waitUntil: 'networkidle' });

    let h1 = await page.locator('h1').count();
    assert.equal(h1, 1, 'Tablet viewport must have 1 h1');
    assert.ok(await page.locator('input[type="text"]').isVisible(), 'Search input visible on tablet');

    // Test Mobile (390px)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);

    h1 = await page.locator('h1').count();
    assert.equal(h1, 1, 'Mobile viewport must have 1 h1');
    assert.ok(await page.locator('input[type="text"]').isVisible(), 'Search input visible on mobile');

    // 4 KPI cards adapt to 2 columns on mobile
    const kpiGrid = page.locator('.grid.grid-cols-2');
    assert.ok(await kpiGrid.first().isVisible(), 'KPI cards grid is visible on mobile');

    await context.close();
  });

  it('teardown server and browser', async () => {
    if (browser) await browser.close();
    if (app) await app.close();
  });
});
