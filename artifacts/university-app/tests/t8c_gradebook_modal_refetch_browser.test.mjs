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

describe('T-8c Browser Test: Gradebook Correction Modal Field State During GET Refetch', () => {
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

  const mockGradebookDataTerm1 = {
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

  const mockGradebookDataTerm2 = {
    ...mockGradebookDataTerm1,
    termId: 2,
    termName: 'Spring 2027',
  };

  it('setup server and chromium browser', async () => {
    appServer = await serveBuiltApp();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  });

  it('M-155 test: typing in correction modal then triggering held GET refetch does NOT reset reason or score', async () => {
    const { context, page } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'en' });

    // Set theme and language through the real localStorage keys via addInitScript
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('language', 'en');
    });

    let getGradebookCount = 0;
    let heldRefetchDeferred = null;

    // Real URLs and envelopes from gradebook.service.ts and courses.controller.ts
    // 1. GET /api/courses/:courseId -> { success: true, data: mockCourse }
    await page.route('**/api/courses/1', async (route) => {
      if (route.request().url().includes('/gradebook')) {
        return route.fallback();
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockCourse }),
      });
    });

    // 2. GET /api/academic-terms/current -> { success: true, data: mockTerms[0] }
    await page.route('**/api/academic-terms/current', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockTerms[0] }),
      });
    });

    // 3. GET /api/academic-terms -> { success: true, data: mockTerms }
    await page.route('**/api/academic-terms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockTerms }),
      });
    });

    // 4. GET /api/courses/1/gradebook (and /courses/1/gradebook?termId=...) -> { success: true, data: mockGradebookData }
    await page.route('**/api/courses/1/gradebook*', async (route) => {
      const url = route.request().url();
      if (url.includes('/publish') || url.includes('/correct') || url.includes('/draft')) {
        return route.fallback();
      }
      getGradebookCount++;
      const currentDeferred = heldRefetchDeferred;
      if (currentDeferred) {
        heldRefetchDeferred = null;
        await currentDeferred.promise;
      }
      const dataToReturn = url.includes('termId=2') ? mockGradebookDataTerm2 : mockGradebookDataTerm1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: dataToReturn }),
      });
    });

    await page.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page.waitForSelector('button[data-correct-cell="true"]', { timeout: 8000 });
    assert.equal(getGradebookCount, 1, 'Initial load must issue exactly 1 GET gradebook');

    // 1. Open Correction Modal on first published manual cell (student 101, Midterm, maxPoints 25)
    await page.locator('button[data-correct-cell="true"]').first().click();
    await page.waitForSelector('[data-correction-modal="true"]', { timeout: 8000 });

    const scoreInput = page.locator('input[data-correction-score-input="true"]');
    const reasonInput = page.locator('textarea[data-correction-reason-input="true"]');

    // 2. Type reason and score
    const typedReason = 'Valid reason after paper recheck';
    const typedScore = '24.5';
    await reasonInput.fill(typedReason);
    await scoreInput.fill(typedScore);

    assert.equal(await reasonInput.inputValue(), typedReason, 'Reason input must match typed value');
    assert.equal(await scoreInput.inputValue(), typedScore, 'Score input must match typed value');

    // 3. Set up held GET refetch with manually resolved promise (no waitForTimeout, no conditional steps)
    const refetchDeferred = createDeferred();
    heldRefetchDeferred = refetchDeferred;

    const refetchRequestPromise = page.waitForRequest((req) =>
      req.url().includes('/api/courses/1/gradebook') &&
      !req.url().includes('/correct') &&
      !req.url().includes('/publish') &&
      !req.url().includes('/draft') &&
      req.method() === 'GET'
    );

    // 4. Trigger gradebook GET refetch via term switch
    await page.locator('#gradebook-term-select').selectOption('2', { force: true });
    const interceptedRequest = await refetchRequestPromise;
    assert.ok(interceptedRequest, 'Refetch GET request must be sent and intercepted');
    assert.ok(interceptedRequest.url().includes('termId=2'), 'Refetch GET URL must target termId=2');

    // 5. While the refetch GET response is held, verify fields keep their typed values
    assert.equal(await reasonInput.inputValue(), typedReason, 'Reason input must keep value while GET is held');
    assert.equal(await scoreInput.inputValue(), typedScore, 'Score input must keep value while GET is held');

    // 6. Release held GET response
    refetchDeferred.resolve();

    // 7. Wait for the refetch GET response to complete
    await page.waitForResponse((res) =>
      res.url().includes('/api/courses/1/gradebook') &&
      res.request().method() === 'GET'
    );

    // 8. Assert reason and score STILL keep their typed values after refetch completes
    assert.equal(await reasonInput.inputValue(), typedReason, 'Reason input must keep value after GET refetch completes');
    assert.equal(await scoreInput.inputValue(), typedScore, 'Score input must keep value after GET refetch completes');
    assert.ok(await page.locator('[data-correction-modal="true"]').isVisible(), 'Correction modal must remain open');

    await context.close();
  });

  it('teardown server and chromium browser', async () => {
    if (browser) await browser.close();
    if (appServer) await appServer.close();
  });
});

