import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

describe('T-8a Browser Tests: Modal Focus Race & Step 4 Hypothesis (H1 & H2)', () => {
  let appServer;
  let browser;

  const mockTerms = [
    {
      id: 1,
      academicYearId: 1,
      name: 'Fall 2026',
      termType: 'FALL',
      semesterNumber: 1,
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2027-01-31T00:00:00.000Z',
      isCurrent: true,
    },
  ];

  const mockCourse = {
    id: 1,
    name: 'Advanced Software Engineering',
    courseCode: 'CS401',
    credits: 3,
    year: 4,
    semester: 1,
    isPublished: true,
    department: { id: 10, name: 'Computer Science', college: { id: 1, name: 'Faculty of Computers' } },
    scheduleSlots: [],
  };

  const mockGradebookData = {
    courseId: 1,
    termId: 1,
    termName: 'Fall 2026',
    structure: {
      id: 50,
      totalPoints: 100,
      passMark: 50,
      components: [
        { id: 101, name: 'Attendance', nameAr: 'الحضور', maxPoints: 10, source: 'AUTO_ATTENDANCE', displayOrder: 1 },
        { id: 102, name: 'Quiz 1', nameAr: 'اختبار قصير 1', maxPoints: 15, source: 'AUTO_QUIZ', displayOrder: 2 },
        { id: 103, name: 'Midterm Exam', nameAr: 'امتحان نصف الفصل', maxPoints: 25, source: 'MANUAL', displayOrder: 3 },
        { id: 104, name: 'Final Exam', nameAr: 'الامتحان النهائي', maxPoints: 50, source: 'MANUAL', displayOrder: 4 },
      ],
    },
    students: [
      {
        studentId: 101,
        enrollmentId: 1001,
        firstName: 'Ahmed',
        lastName: 'Ali',
        studentIdCode: 'STU20260001',
        groupId: 1,
        status: 'ENROLLED',
        grades: [
          { componentId: 101, componentName: 'Attendance', maxPoints: 10, source: 'AUTO_ATTENDANCE', value: 9, score: null, isAbsent: false, status: null, version: null, notes: null },
          { componentId: 102, componentName: 'Quiz 1', maxPoints: 15, source: 'AUTO_QUIZ', value: 14, score: null, isAbsent: false, status: null, version: null, notes: null },
          { componentId: 103, componentName: 'Midterm Exam', maxPoints: 25, source: 'MANUAL', value: 22, score: 22, isAbsent: false, status: 'PUBLISHED', version: 1, notes: null },
          { componentId: 104, componentName: 'Final Exam', maxPoints: 50, source: 'MANUAL', value: 40, score: 40, isAbsent: false, status: 'DRAFT', version: 1, notes: null },
        ],
      },
    ],
  };

  const setupRoutes = async (page) => {
    await page.route('**/api/courses/1', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockCourse }) });
    });
    await page.route('**/api/academic-terms/current', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockTerms[0] }) });
    });
    await page.route('**/api/academic-terms', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockTerms }) });
    });
    await page.route('**/api/courses/1/gradebook*', async (route) => {
      const url = route.request().url();
      if (url.includes('/publish') || url.includes('/correct') || url.includes('/draft')) {
        return route.fallback();
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockGradebookData }),
      });
    });
  };

  it('setup server and chromium browser', async () => {
    appServer = await serveBuiltApp();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  });

  it('Candidate H1: open correction modal, apply CPU throttling 6, immediately fill reason and score, assert values and enabled submit', async () => {
    const { context, page } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('language', 'en');
      localStorage.setItem('theme', 'light');
    });
    await setupRoutes(page);

    await page.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page.waitForSelector('button[data-correct-cell="true"]', { timeout: 8000 });

    const cdp = await context.newCDPSession(page);

    // Open the correction modal
    await page.locator('button[data-correct-cell="true"]').first().click();

    // Apply CDP Emulation.setCPUThrottlingRate 6
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });

    // Immediately fill reason and score WITHOUT waiting for focus
    const reasonInput = page.locator('textarea[data-correction-reason-input="true"]');
    const scoreInput = page.locator('input[data-correction-score-input="true"]');
    const submitBtn = page.locator('button[data-correction-submit="true"]');

    await reasonInput.fill('Valid reason after paper recheck');
    await scoreInput.fill('24.5');

    // Assert both values and the enabled submit
    const reasonValue = await reasonInput.inputValue();
    const scoreValue = await scoreInput.inputValue();
    assert.equal(reasonValue, 'Valid reason after paper recheck', `Expected reason value to match, got: "${reasonValue}"`);
    assert.equal(scoreValue, '24.5', `Expected score value to match, got: "${scoreValue}"`);
    assert.ok(!(await submitBtn.isDisabled()), 'Submit button must be enabled when score and reason are valid');

    await context.close();
  });

  it('Candidate H2: Step 4 of Proof 5 rapid fill sequence under CPU throttling rate 6', async () => {
    const { context, page } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('language', 'en');
      localStorage.setItem('theme', 'light');
    });
    await setupRoutes(page);

    await page.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page.waitForSelector('button[data-correct-cell="true"]', { timeout: 8000 });

    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });

    // Open correction modal
    await page.locator('button[data-correct-cell="true"]').first().click();
    await page.waitForSelector('[data-correction-modal="true"]', { timeout: 8000 });

    const scoreInput = page.locator('input[data-correction-score-input="true"]');
    const reasonInput = page.locator('textarea[data-correction-reason-input="true"]');
    const submitBtn = page.locator('button[data-correction-submit="true"]');

    // Step 2: Reason length < 5 disables submit
    await reasonInput.fill('abcd');
    await page.waitForFunction(() => {
      const btn = document.querySelector('button[data-correction-submit="true"]');
      return btn && btn.hasAttribute('disabled');
    });

    // Step 3: Reason with angle brackets disables submit
    await reasonInput.fill('Corrected mark <appeal>');
    await page.waitForFunction(() => {
      const btn = document.querySelector('button[data-correction-submit="true"]');
      return btn && btn.hasAttribute('disabled');
    });

    // Step 4: Reason valid, score > maxPoints disables submit
    await reasonInput.fill('Valid reason after paper recheck');
    await page.waitForFunction(() => {
      const el = document.querySelector('textarea[data-correction-reason-input="true"]');
      const btn = document.querySelector('button[data-correction-submit="true"]');
      return el && el.value === 'Valid reason after paper recheck' && btn && !btn.hasAttribute('disabled');
    });

    await scoreInput.fill('30');
    await page.waitForFunction(() => {
      const input = document.querySelector('input[data-correction-score-input="true"]');
      const btn = document.querySelector('button[data-correction-submit="true"]');
      return input && input.value === '30' && btn && btn.hasAttribute('disabled');
    }, { timeout: 5000 });

    assert.ok(await submitBtn.isDisabled(), 'Score exceeding maxPoints must disable submit');
    await context.close();
  });

  it('teardown server and browser', async () => {
    if (browser) await browser.close();
    if (appServer) await appServer.close();
  });
});
