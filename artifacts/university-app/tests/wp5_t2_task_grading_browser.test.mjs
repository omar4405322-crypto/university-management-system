import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

/*
Real URLs and response envelopes:
1. GET /api/tasks (artifacts/api-server/src/routes/task.routes.ts:23-56, task.controller.ts:23-69, task.service.ts:41-42)
   Envelope: { success: true, data: TaskItem[] }
2. GET /api/tasks/:id/submissions (artifacts/api-server/src/routes/task.routes.ts:95-119, task.controller.ts:161-187, taskSubmissions.service.ts:34-51, task.service.ts:72-76)
   Envelope: { success: true, data: { rows: TaskSubmissionUnifiedRow[], pagination: PaginationMeta, summary: SubmissionsSummary, defaultCourseYear: number } }
3. PUT /api/tasks/:id/submissions/:sid/grade (artifacts/api-server/src/routes/task.routes.ts:82-93, task.controller.ts:142-159, taskGrading.service.ts:180-255, task.service.ts:63-70)
   Envelope (200): { success: true, data: TaskSubmission }
   Envelope (409): { success: false, status: 'fail', message: 'The task submission changed while it was being graded. Reload the latest revision and retry.', errorId: 'uuid' }
*/

describe('WP5-T2 Browser Suite: Assignment Grading Modal & Role Wiring', () => {
  let appServer;
  let browser;

  const mockTask = {
    id: 1,
    title: 'CS101 Assignment 1',
    description: 'First assignment description',
    dueDate: '2026-11-15T23:59:59.000Z',
    maxScore: 100,
    courseId: 1,
    doctorId: 10,
    course: {
      id: 1,
      name: 'Introduction to Computer Science',
      courseCode: 'CS101',
      year: 1,
      _count: { enrollments: 25 },
    },
    doctor: { firstName: 'Tariq', lastName: 'Doctor', userId: '1' },
    _count: { submissions: 1 },
  };

  const mockSubmissions = {
    rows: [
      {
        key: 'submission-1',
        student: {
          id: 101,
          firstName: 'Ahmed',
          lastName: 'Ali',
          studentId: 'STU20260001',
          year: 1,
        },
        submission: {
          id: 501,
          taskId: 1,
          studentId: 101,
          content: 'Completed assignment work',
          fileUrl: null,
          submittedAt: '2026-10-25T14:30:00.000Z',
          score: null,
          feedback: null,
          isLate: false,
        },
        isSubmitted: true,
        isGraded: false,
        isLate: false,
        notSubmitted: false,
      },
    ],
    pagination: { page: 1, limit: 10, totalCount: 1, totalPages: 1 },
    summary: { totalEnrolled: 1, submitted: 1, graded: 0, ungraded: 1, late: 0, notSubmitted: 0 },
    defaultCourseYear: 1,
  };

  it('setup server and chromium browser', async () => {
    appServer = await serveBuiltApp();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  });

  for (const language of ['en', 'ar']) {
    it(`(a) DOCTOR opens grading modal, saves score with expectedSubmittedAt, sees saved state [${language}]`, async () => {
      const { context, page } = await mockSessionPage(browser, { role: 'DOCTOR', language });

      await page.addInitScript(({ language }) => {
        localStorage.setItem('theme', 'light');
        localStorage.setItem('language', language);
      }, { language });

      let interceptedPutBody = null;

      await page.route((url) => url.pathname === '/api/tasks', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: [mockTask] }),
          });
        } else {
          await route.fallback();
        }
      });

      await page.route((url) => url.pathname === '/api/tasks/1/submissions', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: mockSubmissions }),
          });
        } else {
          await route.fallback();
        }
      });

      await page.route((url) => url.pathname === '/api/tasks/1/submissions/501/grade', async (route) => {
        if (route.request().method() === 'PUT') {
          interceptedPutBody = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                ...mockSubmissions.rows[0].submission,
                score: interceptedPutBody.score,
                feedback: interceptedPutBody.feedback,
              },
            }),
          });
        } else {
          await route.fallback();
        }
      });

      await page.goto(`${appServer.origin}/tasks`, { waitUntil: 'networkidle' });

      // Assert html dir and lang
      const htmlDir = await page.locator('html').getAttribute('dir');
      const htmlLang = await page.locator('html').getAttribute('lang');
      assert.strictEqual(htmlDir, language === 'ar' ? 'rtl' : 'ltr');
      assert.strictEqual(htmlLang, language);

      // Open grading modal
      const gradeBtn = page.getByRole('button', {
        name: /معاينة ورصد|View & Grade/,
      });
      await gradeBtn.click();

      // Type score 85
      const scoreInput = page.locator('input[type="number"]').first();
      await scoreInput.waitFor();
      await scoreInput.fill('85');

      // Click Save Grade with response promise
      const saveBtn = page.getByRole('button', {
        name: language === 'ar' ? /حفظ الدرجة/ : /Save Grade/,
      });
      const putResponsePromise = page.waitForResponse(
        (res) =>
          res.url().includes('/api/tasks/1/submissions/501/grade') &&
          res.request().method() === 'PUT'
      );
      await saveBtn.click();
      await putResponsePromise;

      // Assert PUT body has numeric score and expectedSubmittedAt matching GET submittedAt
      assert.ok(interceptedPutBody, 'PUT body must have been intercepted');
      assert.strictEqual(typeof interceptedPutBody.score, 'number');
      assert.strictEqual(interceptedPutBody.score, 85);
      assert.strictEqual(
        interceptedPutBody.expectedSubmittedAt,
        mockSubmissions.rows[0].submission.submittedAt
      );

      // Assert row shows saved state
      const savedBadge = page.locator(
        `text=${language === 'ar' ? 'الدرجة: 85/100' : 'Graded: 85/100'}`
      );
      await savedBadge.waitFor();
      assert.ok(await savedBadge.isVisible(), 'Saved grade badge must be visible');

      await context.close();
    });

    it(`(b) PUT mock answers 409: assert 2nd GET submissions request and localized conflict message [${language}]`, async () => {
      const { context, page } = await mockSessionPage(browser, { role: 'DOCTOR', language });

      await page.addInitScript(({ language }) => {
        localStorage.setItem('theme', 'light');
        localStorage.setItem('language', language);
      }, { language });

      let getSubmissionsCount = 0;

      await page.route((url) => url.pathname === '/api/tasks', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: [mockTask] }),
          });
        } else {
          await route.fallback();
        }
      });

      await page.route((url) => url.pathname === '/api/tasks/1/submissions', async (route) => {
        if (route.request().method() === 'GET') {
          getSubmissionsCount++;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: mockSubmissions }),
          });
        } else {
          await route.fallback();
        }
      });

      await page.route((url) => url.pathname === '/api/tasks/1/submissions/501/grade', async (route) => {
        if (route.request().method() === 'PUT') {
          await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              status: 'fail',
              message:
                'The task submission changed while it was being graded. Reload the latest revision and retry.',
              errorId: 'mock-conflict-id-409',
            }),
          });
        } else {
          await route.fallback();
        }
      });

      await page.goto(`${appServer.origin}/tasks`, { waitUntil: 'networkidle' });

      // Assert html dir and lang
      assert.strictEqual(
        await page.locator('html').getAttribute('dir'),
        language === 'ar' ? 'rtl' : 'ltr'
      );
      assert.strictEqual(
        await page.locator('html').getAttribute('lang'),
        language
      );

      // Open grading modal
      const gradeBtn = page.getByRole('button', {
        name: /معاينة ورصد|View & Grade/,
      });
      await gradeBtn.click();

      // Wait for modal & initial GET submissions
      const scoreInput = page.locator('input[type="number"]').first();
      await scoreInput.waitFor();
      assert.ok(getSubmissionsCount >= 1, 'Initial GET submissions must have occurred at least once');
      const countBeforeSave = getSubmissionsCount;

      // Type score 90
      await scoreInput.fill('90');

      // Click Save Grade with response promise
      const saveBtn = page.getByRole('button', {
        name: language === 'ar' ? /حفظ الدرجة/ : /Save Grade/,
      });
      const putResponsePromise = page.waitForResponse(
        (res) =>
          res.url().includes('/api/tasks/1/submissions/501/grade') &&
          res.request().method() === 'PUT'
      );
      const refetchResponsePromise = page.waitForResponse(
        (res) =>
          res.url().includes('/api/tasks/1/submissions') &&
          res.request().method() === 'GET'
      );
      await saveBtn.click();
      await putResponsePromise;
      await refetchResponsePromise;

      // On 409, a second GET submissions must have been triggered
      assert.strictEqual(
        getSubmissionsCount,
        countBeforeSave + 1,
        'Submissions GET must be called a second time (refetched) on 409 conflict'
      );

      // Assert localized conflict message is visible
      const expectedConflictMessage =
        language === 'ar'
          ? 'تم تعديل تسليم الواجب أثناء رصد الدرجة. يرجى إعادة تحميل أحدث نسخة وإعادة المحاولة.'
          : 'The task submission changed while it was being graded. Reload the latest revision and retry.';

      const conflictElement = page.locator(`text=${expectedConflictMessage}`);
      await conflictElement.waitFor();
      assert.ok(
        await conflictElement.isVisible(),
        `Localized conflict message must be visible: ${expectedConflictMessage}`
      );

      await context.close();
    });

    it(`(c) Role check on /tasks: SUPER_ADMIN lacks Create button but sees Grade; DOCTOR sees Create [${language}]`, async () => {
      // 1. Check SUPER_ADMIN
      const adminSession = await mockSessionPage(browser, { role: 'SUPER_ADMIN', language });
      await adminSession.page.addInitScript(({ language }) => {
        localStorage.setItem('theme', 'light');
        localStorage.setItem('language', language);
      }, { language });

      await adminSession.page.route((url) => url.pathname === '/api/tasks', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: [mockTask] }),
          });
        } else {
          await route.fallback();
        }
      });

      await adminSession.page.goto(`${appServer.origin}/tasks`, { waitUntil: 'networkidle' });

      // Assert html dir and lang
      assert.strictEqual(
        await adminSession.page.locator('html').getAttribute('dir'),
        language === 'ar' ? 'rtl' : 'ltr'
      );
      assert.strictEqual(
        await adminSession.page.locator('html').getAttribute('lang'),
        language
      );

      const adminCreateBtn = adminSession.page.getByRole('button', {
        name: language === 'ar' ? /إنشاء تكليف/ : /Create Assignment/,
      });
      assert.strictEqual(
        await adminCreateBtn.count(),
        0,
        'SUPER_ADMIN must NOT see Create Assignment button'
      );

      const adminGradeBtn = adminSession.page.getByRole('button', {
        name: /معاينة ورصد|View & Grade/,
      });
      assert.ok(
        (await adminGradeBtn.count()) > 0,
        'SUPER_ADMIN must see Grade/Submissions action button'
      );

      await adminSession.context.close();

      // 2. Check DOCTOR
      const doctorSession = await mockSessionPage(browser, { role: 'DOCTOR', language });
      await doctorSession.page.addInitScript(({ language }) => {
        localStorage.setItem('theme', 'light');
        localStorage.setItem('language', language);
      }, { language });

      await doctorSession.page.route((url) => url.pathname === '/api/tasks', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: [mockTask] }),
          });
        } else {
          await route.fallback();
        }
      });

      await doctorSession.page.goto(`${appServer.origin}/tasks`, { waitUntil: 'networkidle' });

      const doctorCreateBtn = doctorSession.page.getByRole('button', {
        name: language === 'ar' ? /إنشاء تكليف/ : /Create Assignment/,
      });
      assert.ok(
        (await doctorCreateBtn.count()) > 0,
        'DOCTOR must see Create Assignment button'
      );

      await doctorSession.context.close();
    });
  }

  it('teardown server and chromium browser', async () => {
    if (browser) await browser.close();
    if (appServer) await appServer.close();
  });
});
