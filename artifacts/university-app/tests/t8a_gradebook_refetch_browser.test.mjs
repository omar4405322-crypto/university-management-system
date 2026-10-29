import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

function createDeferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('T-8a Browser Tests: Gradebook Refetch & Background Loading Gating', () => {
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
    {
      id: 2,
      academicYearId: 1,
      name: 'Spring 2027',
      termType: 'SPRING',
      semesterNumber: 2,
      startDate: '2027-02-01T00:00:00.000Z',
      endDate: '2027-06-30T00:00:00.000Z',
      isCurrent: false,
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

  it('setup server and chromium browser', async () => {
    appServer = await serveBuiltApp();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  });

  it('R1: initial load issues exactly ONE GET gradebook', async () => {
    const { context, page } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'en' });
    let getGradebookCount = 0;

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
      getGradebookCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockGradebookData }),
      });
    });

    await page.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page.waitForSelector('button[data-correct-cell="true"]', { timeout: 8000 });

    assert.equal(getGradebookCount, 1, `Initial load must issue exactly 1 GET gradebook, received ${getGradebookCount}`);
    await context.close();
  });

  it('R2c [GREEN-only]: submit a valid correction, HOLD the refetch GET behind a deferred promise the test releases; while held the correction summary modal and a button[data-correct-cell="true"] stay visible; after release the refetch count increased', async () => {
    const { context, page } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('language', 'en');
    });
    let getGradebookCount = 0;
    let deferredRefetch = null;

    await page.route('**/api/courses/1', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockCourse }) });
    });
    await page.route('**/api/academic-terms/current', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockTerms[0] }) });
    });
    await page.route('**/api/academic-terms', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockTerms }) });
    });
    await page.route('**/api/courses/1/gradebook/correct*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            success: true,
            updatedCount: 1,
            entries: [{
              enrollmentId: 1001,
              componentId: 103,
              before: { score: 22, isAbsent: false, version: 1 },
              after: { score: 24.5, isAbsent: false, version: 2 },
              reason: 'Re-evaluation of exam paper',
            }],
            enrollmentTotals: [{
              enrollmentId: 1001,
              before: { finalPointsEarned: 85, finalPointsMax: 100, finalGrade: 85, status: 'COMPLETED' },
              after: { finalPointsEarned: 87.5, finalPointsMax: 100, finalGrade: 87.5, status: 'COMPLETED' },
            }],
          },
        }),
      });
    });
    await page.route('**/api/courses/1/gradebook*', async (route) => {
      const url = route.request().url();
      if (url.includes('/publish') || url.includes('/correct') || url.includes('/draft')) {
        return route.fallback();
      }
      getGradebookCount++;
      if (deferredRefetch) {
        await deferredRefetch.promise;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockGradebookData }),
      });
    });

    await page.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page.waitForSelector('button[data-correct-cell="true"]', { timeout: 8000 });

    const initialCount = getGradebookCount;

    // Open correction modal
    await page.locator('button[data-correct-cell="true"]').first().click();
    await page.waitForSelector('[data-correction-modal="true"]', { timeout: 8000 });

    await page.locator('textarea[data-correction-reason-input="true"]').fill('Valid reason after paper recheck');
    await page.locator('input[data-correction-score-input="true"]').fill('24.5');

    await page.waitForFunction(() => {
      const btn = document.querySelector('button[data-correction-submit="true"]');
      return btn && !btn.hasAttribute('disabled');
    });

    // Arm deferred promise to HOLD the subsequent refetch GET
    deferredRefetch = createDeferred();

    await page.locator('button[data-correction-submit="true"]').click();

    // Wait for summary modal to open
    await page.waitForSelector('[data-correction-summary-modal="true"]', { timeout: 8000 });

    // WHILE the refetch GET is HELD:
    // [data-correction-summary-modal="true"] and button[data-correct-cell="true"] must stay visible (table not unmounted)
    assert.ok(await page.locator('[data-correction-summary-modal="true"]').isVisible(), 'Summary modal must stay visible while refetch is in flight');
    assert.ok(await page.locator('button[data-correct-cell="true"]').first().isVisible(), 'Table cell button must stay visible while refetch is in flight');
    assert.equal(await page.locator('[data-gradebook-error="true"]').count(), 0);

    // Release deferred promise
    deferredRefetch.resolve();

    // Wait for refetch response
    await page.waitForResponse((res) => res.url().includes('/api/courses/1/gradebook') && !res.url().includes('/correct') && !res.url().includes('/publish'));

    assert.ok(getGradebookCount > initialCount, 'Refetch GET count must have increased after release');
    await context.close();
  });

  it('R3: publish refetch keeps the table mounted and summary modal visible while refetch is in flight', async () => {
    const { context, page } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'en' });
    let getGradebookCount = 0;
    let deferredRefetch = null;

    await page.route('**/api/courses/1', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockCourse }) });
    });
    await page.route('**/api/academic-terms/current', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockTerms[0] }) });
    });
    await page.route('**/api/academic-terms', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockTerms }) });
    });
    await page.route('**/api/courses/1/gradebook/publish*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            courseId: 1,
            termId: 1,
            complete: [{ enrollmentId: 1001, studentId: 101, finalPointsEarned: 85, finalPointsMax: 100, finalGrade: 85, status: 'COMPLETED' }],
            incomplete: [],
            skipped: [],
          },
        }),
      });
    });
    await page.route('**/api/courses/1/gradebook*', async (route) => {
      const url = route.request().url();
      if (url.includes('/publish') || url.includes('/correct') || url.includes('/draft')) {
        return route.fallback();
      }
      getGradebookCount++;
      if (deferredRefetch) {
        await deferredRefetch.promise;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockGradebookData }),
      });
    });

    await page.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page.waitForSelector('button[data-publish-button="true"]', { timeout: 8000 });

    const initialCount = getGradebookCount;

    // Open publish confirmation modal
    await page.locator('button[data-publish-button="true"]').click();
    await page.waitForSelector('[data-publish-modal="true"]', { timeout: 8000 });

    // Arm deferred promise to HOLD refetch
    deferredRefetch = createDeferred();

    // Confirm publish
    await page.locator('button[data-publish-confirm="true"]').click();

    // Wait for publish summary modal
    await page.waitForSelector('[data-publish-summary-modal="true"]', { timeout: 8000 });

    // While refetch is held: publish summary modal stays visible and table stays mounted
    assert.ok(await page.locator('[data-publish-summary-modal="true"]').isVisible(), 'Publish summary modal must stay visible while refetch is in flight');
    assert.ok(await page.locator('button[data-correct-cell="true"]').first().isVisible(), 'Table cell button must stay visible while refetch is in flight');

    deferredRefetch.resolve();

    await page.waitForResponse((res) => res.url().includes('/api/courses/1/gradebook') && !res.url().includes('/publish'));
    assert.ok(getGradebookCount > initialCount, 'Refetch GET count must have increased after release');
    await context.close();
  });

  it('teardown server and browser', async () => {
    if (browser) await browser.close();
    if (appServer) await appServer.close();
  });
});
