import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';

const rolesPath = new URL('../src/constants/roles.ts', import.meta.url);
const dashboardContainerPath = new URL('../src/pages/dashboard/DashboardContainer.tsx', import.meta.url);
const cardPath = new URL('../src/components/ui/card.tsx', import.meta.url);
const adminDashboardPath = new URL('../src/pages/dashboard/AdminDashboard.tsx', import.meta.url);
const doctorDashboardPath = new URL('../src/pages/dashboard/DoctorDashboard.tsx', import.meta.url);
const loginPath = new URL('../src/pages/Login.tsx', import.meta.url);
const enJsonPath = new URL('../src/i18n/en.json', import.meta.url);
const arJsonPath = new URL('../src/i18n/ar.json', import.meta.url);

describe('Scorecard #25: Commercial/Investor Presentation Invariants', () => {
  it('INV-01: USER_ROLES and DashboardContainer support all 6 roles including TEACHING_ASSISTANT', async () => {
    const rolesSrc = await readFile(rolesPath, 'utf8');
    assert.match(
      rolesSrc,
      /TEACHING_ASSISTANT:\s*['"]TEACHING_ASSISTANT['"]/,
      'roles.ts must include TEACHING_ASSISTANT in USER_ROLES',
    );

    const containerSrc = await readFile(dashboardContainerPath, 'utf8');
    assert.match(
      containerSrc,
      /const TADashboard = lazy\(\(\) => import\('\.\/TADashboard'\)\)/,
      'DashboardContainer.tsx must lazy-load TADashboard',
    );
    assert.match(
      containerSrc,
      /\[USER_ROLES\.TEACHING_ASSISTANT\]:\s*TADashboard/,
      'DashboardContainer.tsx dashboardMap must bind TEACHING_ASSISTANT to TADashboard',
    );
  });

  it('INV-02: 4-color institutional KPI sequence (#8BB83C, #132231, #2F6B87, #D6BA34) in card.tsx', async () => {
    const cardSrc = await readFile(cardPath, 'utf8');
    assert.match(
      cardSrc,
      /bg-\[#132231\]/,
      'card.tsx colorStyles.navy must use institutional brand navy #132231',
    );
    assert.doesNotMatch(
      cardSrc,
      /bg-\[#1B2E42\]/,
      'card.tsx must not use non-brand #1B2E42 in iconWrapper',
    );
    assert.match(
      cardSrc,
      /STAT_CARD_BRAND_SEQUENCE:\s*StatCardColor\[\]\s*=\s*\['green',\s*'navy',\s*'cyan',\s*'gold'\]/,
      'card.tsx must define 4-color brand sequence [green, navy, cyan, gold]',
    );
  });

  it('INV-03: AdminDashboard adapts KPI cards dynamically to avoid unauthorized route navigation', async () => {
    const adminSrc = await readFile(adminDashboardPath, 'utf8');
    // Department admin must not have dead link to /colleges or /finance
    assert.match(
      adminSrc,
      /user\?\.role === ['"]DEPARTMENT_ADMIN['"]/,
      'AdminDashboard.tsx must differentiate DEPARTMENT_ADMIN KPIs',
    );
    assert.match(
      adminSrc,
      /user\?\.role === ['"]COLLEGE_ADMIN['"]/,
      'AdminDashboard.tsx must differentiate COLLEGE_ADMIN KPIs',
    );
  });

  it('INV-04: DoctorDashboard uses standard i18n translation keys and colorIndex for KPI cards', async () => {
    const doctorSrc = await readFile(doctorDashboardPath, 'utf8');
    assert.match(
      doctorSrc,
      /colorIndex=\{idx\}/,
      'DoctorDashboard.tsx must pass colorIndex={idx} to StatCard to guarantee the 4-color cycle',
    );
    assert.doesNotMatch(
      doctorSrc,
      /title=\{isRTL \? 'المقررات الدراسية' : 'My Courses'\}/,
      'DoctorDashboard.tsx must use t(...) instead of hardcoded isRTL ternaries for KPI titles',
    );
  });

  it('INV-05: Login.tsx 2FA challenge contains localized translations in both en.json and ar.json', async () => {
    const loginSrc = await readFile(loginPath, 'utf8');
    assert.doesNotMatch(
      loginSrc,
      /<p className="text-sm font-bold text-brand-primary-700 dark:text-brand-primary-400">\s*Two-Factor Authentication\s*<\/p>/,
      'Login.tsx must not contain hardcoded English 2FA title',
    );

    const en = JSON.parse(readFileSync(enJsonPath, 'utf8'));
    const ar = JSON.parse(readFileSync(arJsonPath, 'utf8'));

    assert.ok(en.auth?.twoFactorChallengeTitle, 'en.json must define auth.twoFactorChallengeTitle');
    assert.ok(ar.auth?.twoFactorChallengeTitle, 'ar.json must define auth.twoFactorChallengeTitle');
    assert.ok(en.auth?.twoFactorCodeLabel, 'en.json must define auth.twoFactorCodeLabel');
    assert.ok(ar.auth?.twoFactorCodeLabel, 'ar.json must define auth.twoFactorCodeLabel');
  });

  it('INV-06: TADashboard.tsx contains no invented fallback counts or fake sessions in source', async () => {
    const taPath = new URL('../src/pages/dashboard/TADashboard.tsx', import.meta.url);
    const taSrc = await readFile(taPath, 'utf8');

    assert.doesNotMatch(
      taSrc,
      /todaySchedule\.length\s*\|\|\s*\d+/,
      'TADashboard.tsx must not fall back to an invented non-zero number for lab sessions'
    );
    assert.doesNotMatch(
      taSrc,
      /assignedCourses\.length\s*\|\|\s*\d+/,
      'TADashboard.tsx must not fall back to an invented non-zero number for assisted courses'
    );
    assert.doesNotMatch(
      taSrc,
      /value:\s*6\b/,
      'TADashboard.tsx must not hardcode literal count 6 for quizzes'
    );
    assert.doesNotMatch(
      taSrc,
      /value:\s*12\b/,
      'TADashboard.tsx must not hardcode literal count 12 for submissions'
    );
    assert.doesNotMatch(
      taSrc,
      /Circuit Simulation Lab/,
      'TADashboard.tsx must not render fake unseeded mock session names'
    );
    assert.doesNotMatch(
      taSrc,
      /taskService\.getTasks/,
      'TADashboard.tsx must not call getTasks which returns platform-wide tasks'
    );
    assert.doesNotMatch(
      taSrc,
      /timetableService\.getTimetables/,
      'TADashboard.tsx must not call getTimetables which lacks slots and violates TA scope'
    );
    assert.doesNotMatch(
      taSrc,
      /coursesService\.getCourses/,
      'TADashboard.tsx must not call getCourses which returns department-wide courses'
    );
  });

  it('INV-07 (Behavioral): TADashboard renders verified TA-scoped data with realistic non-empty responses, honest zeros on empty, and honest error on 403/500', async () => {
    const { chromium } = await import('file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs');
    const { serveBuiltApp, mockSessionPage } = await import('./helpers/built-app.mjs');
    const app = await serveBuiltApp();
    const browser = await chromium.launch({ channel: 'msedge', headless: true });

    try {
      // 1. Realistic non-empty TA-scoped scenario
      const { context: ctx1, page: page1 } = await mockSessionPage(browser, {
        role: 'TEACHING_ASSISTANT',
        language: 'en',
        user: { role: 'TEACHING_ASSISTANT', firstName: 'Ramy', lastName: 'Staff' },
      });

      await page1.route('**/api/schedules**', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 101,
                slotType: 'LAB',
                dayOfWeek: 1,
                startTime: '09:00',
                endTime: '11:00',
                room: 'Network Lab 204',
                course: { id: 55, name: 'Data Communications Lab', courseCode: 'NET201' },
              },
              {
                id: 102,
                slotType: 'SECTION',
                dayOfWeek: 3,
                startTime: '12:00',
                endTime: '14:00',
                room: 'Embedded Systems Lab 102',
                course: { id: 56, name: 'Microprocessor Lab', courseCode: 'ECE302' },
              },
            ],
            pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
          }),
        })
      );
      await page1.route('**/api/quizzes**', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 88,
                title: 'Network Topologies Quiz 1',
                course: { name: 'Data Communications Lab', courseCode: 'NET201' },
                _count: { submissions: 15 },
              },
            ],
          }),
        })
      );

      await page1.goto(`${app.origin}/dashboard`);
      await page1.waitForSelector('h1');

      const statValues = await page1.$$eval('.font-mono', (els) => els.map((e) => e.innerText.trim()));
      // Must show exactly 2 KPIs: Lab Sessions = '2', Quizzes = '1'
      assert.deepStrictEqual(statValues, ['2', '1'], `Expected KPI values ['2', '1'] for TA, got ${JSON.stringify(statValues)}`);

      const bodyText1 = await page1.evaluate(() => document.body.innerText);
      assert.match(bodyText1, /Data Communications Lab/i, 'Real assigned lab course must render');
      assert.match(bodyText1, /Network Lab 204/i, 'Real lab room must render');
      assert.doesNotMatch(bodyText1, /Student Lab Submissions/i, 'Removed un-scoped card must not appear');
      assert.doesNotMatch(bodyText1, /Assisted Courses/i, 'Removed un-scoped card must not appear');

      await ctx1.close();

      // 2. Empty data scenario
      const { context: ctx2, page: page2 } = await mockSessionPage(browser, {
        role: 'TEACHING_ASSISTANT',
        language: 'en',
        user: { role: 'TEACHING_ASSISTANT', firstName: 'Sarah', lastName: 'Ali' },
      });

      await page2.route('**/api/schedules**', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } }),
        })
      );
      await page2.route('**/api/quizzes**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
      );

      await page2.goto(`${app.origin}/dashboard`);
      await page2.waitForSelector('h1');

      const emptyStatValues = await page2.$$eval('.font-mono', (els) => els.map((e) => e.innerText.trim()));
      assert.ok(emptyStatValues.every((val) => val === '0'), `All KPI cards must display "0" on empty data, got ${JSON.stringify(emptyStatValues)}`);

      const bodyText2 = await page2.evaluate(() => document.body.innerText);
      assert.doesNotMatch(bodyText2, /Circuit Simulation Lab/, 'Fake session must not appear');
      assert.match(bodyText2, /No active laboratory sections assigned/i, 'Honest empty state must appear');

      await ctx2.close();

      // 3. Error state scenario (403 on schedules)
      const { context: ctx3, page: page3 } = await mockSessionPage(browser, {
        role: 'TEACHING_ASSISTANT',
        language: 'en',
        user: { role: 'TEACHING_ASSISTANT', firstName: 'Sarah', lastName: 'Ali' },
      });

      await page3.route('**/api/schedules**', (route) =>
        route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Forbidden access' }) })
      );
      await page3.route('**/api/quizzes**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
      );

      await page3.goto(`${app.origin}/dashboard`);
      await page3.waitForTimeout(500);

      const bodyText3 = await page3.evaluate(() => document.body.innerText);
      assert.match(bodyText3, /permission|Forbidden|Something went wrong|Failed to load/i, 'Honest error state must be shown on 403');

      await ctx3.close();

      // 4. Error state scenario (500 on quizzes)
      const { context: ctx4, page: page4 } = await mockSessionPage(browser, {
        role: 'TEACHING_ASSISTANT',
        language: 'en',
        user: { role: 'TEACHING_ASSISTANT', firstName: 'Sarah', lastName: 'Ali' },
      });

      await page4.route('**/api/schedules**', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } }),
        })
      );
      await page4.route('**/api/quizzes**', (route) =>
        route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Server error' }) })
      );

      await page4.goto(`${app.origin}/dashboard`);
      await page4.waitForTimeout(500);

      const bodyText4 = await page4.evaluate(() => document.body.innerText);
      assert.match(bodyText4, /permission|Forbidden|Something went wrong|Failed to load|Server error/i, 'Honest error state must be shown on 500');

      await ctx4.close();
    } finally {
      await browser.close();
      await app.close();
    }
  });
});

