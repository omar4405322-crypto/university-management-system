import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

describe('T-7b2 Browser Verification: Attendance Session Points & Exam Quiz Lock (P1-P6 & 24-Config Matrix)', () => {
  let appServer;
  let browser;

  const mockCoursesPayload = [
    {
      id: 10,
      courseCode: 'CS401',
      name: 'Advanced Software Engineering',
      credits: 3,
      year: 4,
      semester: 1,
      departmentId: 1,
      department: {
        id: 1,
        name: 'Computer Science',
        nameAr: 'علوم الحاسب',
        collegeId: 1,
        college: { id: 1, name: 'Engineering', nameAr: 'الهندسة' },
      },
      scheduleSlots: [{ id: 1, studentGroup: { id: 1, name: 'Sec 1' } }],
      _count: { enrollments: 45 },
    },
  ];

  const mockExamDetailPayload = {
    id: 101,
    title: 'Quiz 1',
    type: 'QUIZ',
    date: '2026-11-15',
    startTime: '10:00',
    endTime: '10:30',
    durationMinutes: 30,
    room: 'Hall A',
    courseId: 10,
    course: {
      id: 10,
      name: 'Advanced Software Engineering',
      courseCode: 'CS401',
       year: 4,
      departmentId: 1,
      department: {
        id: 1,
        name: 'Computer Science',
        nameAr: 'علوم الحاسب',
        collegeId: 1,
        college: { id: 1, name: 'Engineering', nameAr: 'الهندسة' },
      },
    },
    questions: [{ id: 501, points: 2 }],
  };

  const mockExamQuestionsPayload = [
    {
      id: 501,
      examId: 101,
      text: 'What is polymorphism in OOP?',
      type: 'MCQ',
      optionA: 'Many forms',
      optionB: 'Single form',
      optionC: 'No form',
      optionD: 'Static binding',
      correctAnswer: 'A',
      points: 2,
      order: 1,
    },
  ];

  async function installFastGeolocation(page) {
    await page.addInitScript(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition = (success) => {
          success({
            coords: {
              latitude: 29.97,
              longitude: 30.94,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          });
        };
      }
    });
  }

  async function setupAttendanceRoutes(page, { startStatus = 200, startErrorMessage = null, startRequests = [] } = {}) {
    let activeSessionData = null;

    await page.route('**/api/attendance/my-courses*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockCoursesPayload }),
      });
    });

    await page.route('**/api/attendance/sessions/active*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: activeSessionData }),
      });
    });

    await page.route('**/api/attendance/sessions/*/current-code*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { token: '654321' } }),
      });
    });

    await page.route('**/api/attendance/sessions/start', async (route) => {
      const req = route.request();
      const postData = req.postDataJSON();
      startRequests.push({
        url: req.url(),
        method: req.method(),
        body: postData,
      });

      if (startStatus !== 200) {
        await route.fulfill({
          status: startStatus,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            status: 'fail',
            message: startErrorMessage || 'Failed to start session',
            errorId: 'err-t7b2-start',
          }),
        });
        return;
      }

      activeSessionData = {
        sessionId: 901,
        courseId: postData?.courseId ?? 10,
        codeStepSeconds: 20,
        createdAt: new Date().toISOString(),
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: activeSessionData }),
      });
    });
  }

  async function setupExamDetailRoutes(
    page,
    {
      addStatus = 409,
      addMessage = 'QUIZ_LOCKED_AFTER_ATTEMPT: Cannot add a question to an exam: student attempts already exist for this exam.',
      deleteStatus = 409,
      deleteMessage = 'QUIZ_LOCKED_AFTER_ATTEMPT: Cannot delete an exam question: student attempts already exist for this exam.',
    } = {}
  ) {
    await page.route('**/api/exams/101', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: mockExamDetailPayload }),
        });
        return;
      }
      await route.fallback();
    });

    await page.route('**/api/exams/101/questions', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: mockExamQuestionsPayload }),
        });
        return;
      }
      if (method === 'POST') {
        if (addStatus >= 400) {
          await route.fulfill({
            status: addStatus,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              status: 'fail',
              message: addMessage,
              errorId: 'err-t7b2-add-q',
            }),
          });
          return;
        }
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { id: 502, examId: 101, text: 'Added Question', type: 'MCQ', points: 1, order: 2 },
          }),
        });
      }
    });

    await page.route('**/api/exams/questions/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        if (deleteStatus >= 400) {
          await route.fulfill({
            status: deleteStatus,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              status: 'fail',
              message: deleteMessage,
              errorId: 'err-t7b2-del-q',
            }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Question deleted' }),
        });
      }
    });
  }

  it('setup server and chromium browser', async () => {
    appServer = await serveBuiltApp();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  });

  // ── P1: Session points input renders; valid value posts numeric sessionPoints; empty posts body without key ──
  it('P1: Session-points input renders on course card; valid value posts numeric sessionPoints; empty posts body without sessionPoints key', async () => {
    // 1. Valid numeric sessionPoints
    const startRequestsValid = [];
    const { context: ctx1, page: page1 } = await mockSessionPage(browser, {
      role: 'DOCTOR',
      language: 'en',
    });
    await installFastGeolocation(page1);
    await setupAttendanceRoutes(page1, { startStatus: 200, startRequests: startRequestsValid });

    await page1.goto(`${appServer.origin}/attendance`, { waitUntil: 'networkidle' });
    await page1.locator('text=CS401').first().waitFor({ state: 'visible', timeout: 8000 });

    const input1 = page1.locator('[data-session-points-input="true"]');
    assert.equal(await input1.count(), 1, 'Course card must render [data-session-points-input="true"]');
    assert.equal(await input1.getAttribute('type'), 'text');
    assert.equal(await input1.getAttribute('inputMode'), 'decimal');

    await input1.fill('2.5');
    await page1.locator('button:has-text("Start Smart Session")').click();

    await assert.doesNotReject(
      page1.waitForSelector('button:has-text("End Session")', { timeout: 5000 })
    );

    assert.equal(startRequestsValid.length, 1, 'Must send 1 start session request');
    assert.equal(
      new URL(startRequestsValid[0].url).pathname,
      '/api/attendance/sessions/start'
    );
    assert.equal(typeof startRequestsValid[0].body.sessionPoints, 'number');
    assert.equal(startRequestsValid[0].body.sessionPoints, 2.5);
    assert.equal(startRequestsValid[0].body.courseId, 10);
    await ctx1.close();

    // 2. Empty input omits sessionPoints key from request body
    const startRequestsEmpty = [];
    const { context: ctx2, page: page2 } = await mockSessionPage(browser, {
      role: 'DOCTOR',
      language: 'en',
    });
    await installFastGeolocation(page2);
    await setupAttendanceRoutes(page2, { startStatus: 200, startRequests: startRequestsEmpty });

    await page2.goto(`${appServer.origin}/attendance`, { waitUntil: 'networkidle' });
    await page2.locator('text=CS401').first().waitFor({ state: 'visible', timeout: 8000 });

    const input2 = page2.locator('[data-session-points-input="true"]');
    assert.equal(await input2.count(), 1);
    await input2.fill('   ');
    await page2.locator('button:has-text("Start Smart Session")').click();

    await assert.doesNotReject(
      page2.waitForSelector('button:has-text("End Session")', { timeout: 5000 })
    );

    assert.equal(startRequestsEmpty.length, 1, 'Must send 1 start session request when empty');
    assert.equal(
      Object.prototype.hasOwnProperty.call(startRequestsEmpty[0].body, 'sessionPoints'),
      false,
      'Empty sessionPoints input must omit sessionPoints key from request body'
    );
    await ctx2.close();
  });

  // ── P2: Invalid values show inline error with ZERO start requests ──
  it('P2: Invalid sessionPoints values ("-1", "1.234", "abc", "1e2") show inline error [data-session-points-error="true"] with role="alert" and send ZERO start requests', async () => {
    const startRequests = [];
    const { context, page } = await mockSessionPage(browser, {
      role: 'DOCTOR',
      language: 'en',
    });
    await installFastGeolocation(page);
    await setupAttendanceRoutes(page, { startStatus: 200, startRequests });

    await page.goto(`${appServer.origin}/attendance`, { waitUntil: 'networkidle' });
    await page.locator('text=CS401').first().waitFor({ state: 'visible', timeout: 8000 });

    const input = page.locator('[data-session-points-input="true"]');
    assert.equal(await input.count(), 1, 'Course card must render [data-session-points-input="true"]');

    for (const invalidVal of ['-1', '1.234', 'abc', '1e2']) {
      await input.fill(invalidVal);
      await page.locator('button:has-text("Start Smart Session")').click();

      const errEl = page.locator('[data-session-points-error="true"]');
      assert.equal(
        await errEl.count(),
        1,
        `Invalid input "${invalidVal}" must render [data-session-points-error="true"]`
      );
      assert.equal(await errEl.getAttribute('role'), 'alert');
      const errText = (await errEl.innerText()).trim();
      assert.ok(
        errText.includes('Enter a non-negative number with up to two decimal places.'),
        `Expected localized inline error for "${invalidVal}", got "${errText}"`
      );
      assert.equal(
        startRequests.length,
        0,
        `Invalid input "${invalidVal}" must send ZERO start requests, got ${startRequests.length}`
      );
    }

    await context.close();
  });

  // ── P3: Three exact server messages from attendance-session.service.ts show localized messages in EN and AR ──
  it('P3: Three server messages from attendance-session.service.ts display distinct localized messages in EN and AR without numbers', async () => {
    const serverErrorCases = [
      {
        serverMessage:
          'Cumulative sessionPoints (12) exceeds AUTO_ATTENDANCE component maxPoints (10)',
        enExpected:
          'Cumulative session points exceed the maximum points allocated for the attendance component.',
        arExpected:
          'مجموع درجات الجلسات يتجاوز الحد الأقصى المخصص لمكون الحضور.',
      },
      {
        serverMessage:
          'sessionPoints 15 exceeds AUTO_ATTENDANCE component maxPoints 10',
        enExpected:
          'Session points exceed the maximum points allocated for the attendance component.',
        arExpected:
          'درجات الجلسة تتجاوز الحد الأقصى المخصص لمكون الحضور.',
      },
      {
        serverMessage:
          'Course term does not have an AUTO_ATTENDANCE component configured',
        enExpected:
          'This course term does not have an automatic attendance grade component configured.',
        arExpected:
          'لم يتم إعداد مكون درجات حضور تلقائي لهذا المقرر في الفصل الدراسي الحالي.',
      },
    ];

    for (const tc of serverErrorCases) {
      for (const lang of ['en', 'ar']) {
        const startRequests = [];
        const { context, page } = await mockSessionPage(browser, {
          role: 'DOCTOR',
          language: lang,
        });
        await page.addInitScript((langVal) => {
          localStorage.setItem('language', langVal);
        }, lang);
        await installFastGeolocation(page);
        await setupAttendanceRoutes(page, {
          startStatus: 422,
          startErrorMessage: tc.serverMessage,
          startRequests,
        });

        await page.goto(`${appServer.origin}/attendance`, { waitUntil: 'networkidle' });
        await page.locator('text=CS401').first().waitFor({ state: 'visible', timeout: 8000 });

        assert.equal(await page.getAttribute('html', 'dir'), lang === 'ar' ? 'rtl' : 'ltr');
        assert.equal(await page.getAttribute('html', 'lang'), lang);

        const startBtnSelector =
          lang === 'ar'
            ? 'button:has-text("بدء جلسة الحضور الذكية")'
            : 'button:has-text("Start Smart Session")';
        await page.locator(startBtnSelector).click();

        const expectedText = lang === 'ar' ? tc.arExpected : tc.enExpected;
        // Wait for error banner to render on dashboard
        const errorBanner = page.locator('div.bg-red-50 span').first();
        await errorBanner.waitFor({ state: 'visible', timeout: 5000 });
        const actualText = (await errorBanner.innerText()).trim();

        assert.equal(
          actualText,
          expectedText,
          `[${lang.toUpperCase()}] For server message "${tc.serverMessage}", expected "${expectedText}", got "${actualText}"`
        );
        assert.doesNotMatch(
          actualText,
          /[0-9٠-٩]/,
          `Localized error "${actualText}" must not contain numbers`
        );

        await context.close();
      }
    }
  });

  // ── P4: ExamDetails 409 QUIZ_LOCKED_AFTER_ATTEMPT on add and delete shows banner; plain 409 does not ──
  it('P4: ExamDetails 409 QUIZ_LOCKED_AFTER_ATTEMPT on question add and delete shows [data-quiz-locked-banner="true"]; a plain 409 does NOT show banner and shows error toast', async () => {
    // 1. Add question 409 QUIZ_LOCKED_AFTER_ATTEMPT -> shows banner
    const { context: addCtx, page: addPage } = await mockSessionPage(browser, {
      role: 'DOCTOR',
      language: 'en',
    });
    await setupExamDetailRoutes(addPage, {
      addStatus: 409,
      addMessage:
        'QUIZ_LOCKED_AFTER_ATTEMPT: Cannot add a question to an exam: student attempts already exist for this exam.',
    });

    await addPage.goto(`${appServer.origin}/exams/101`, { waitUntil: 'networkidle' });
    await addPage.locator('text=CS401').first().waitFor({ state: 'visible', timeout: 8000 });

    assert.equal(
      await addPage.locator('[data-quiz-locked-banner="true"]').count(),
      0,
      'Banner must not be shown before 409 response'
    );

    await addPage.locator('button:has-text("Add New Question")').click();
    await addPage.locator('form textarea').fill('What is encapsulation?');
    const addRespPromise = addPage.waitForResponse(
      (r) => r.url().includes('/api/exams/101/questions') && r.request().method() === 'POST'
    );
    await addPage.locator('form button[type="submit"]').click();
    await addRespPromise;

    const addBanner = addPage.locator('[data-quiz-locked-banner="true"]');
    assert.equal(
      await addBanner.count(),
      1,
      'ExamDetails must show [data-quiz-locked-banner="true"] after 409 QUIZ_LOCKED_AFTER_ATTEMPT on add question'
    );
    assert.ok(
      (await addBanner.innerText()).includes(
        'This quiz is locked because student attempts already exist.'
      )
    );
    await addCtx.close();

    // 2. Delete question 409 QUIZ_LOCKED_AFTER_ATTEMPT -> shows banner and keeps question
    const { context: delCtx, page: delPage } = await mockSessionPage(browser, {
      role: 'DOCTOR',
      language: 'en',
    });
    await setupExamDetailRoutes(delPage, {
      deleteStatus: 409,
      deleteMessage:
        'QUIZ_LOCKED_AFTER_ATTEMPT: Cannot delete an exam question: student attempts already exist for this exam.',
    });

    await delPage.goto(`${appServer.origin}/exams/101`, { waitUntil: 'networkidle' });
    await delPage.locator('text=What is polymorphism in OOP?').waitFor({ state: 'visible', timeout: 8000 });

    await delPage.locator('button[title="Delete"]').first().click();
    await delPage.locator('[role="dialog"] button.bg-rose-600').waitFor({ state: 'visible', timeout: 5000 });
    const delRespPromise = delPage.waitForResponse(
      (r) => r.url().includes('/api/exams/questions/501') && r.request().method() === 'DELETE'
    );
    await delPage.locator('[role="dialog"] button.bg-rose-600').click();
    await delRespPromise;

    const delBanner = delPage.locator('[data-quiz-locked-banner="true"]');
    assert.equal(
      await delBanner.count(),
      1,
      'ExamDetails must show [data-quiz-locked-banner="true"] after 409 QUIZ_LOCKED_AFTER_ATTEMPT on delete question'
    );
    assert.equal(
      await delPage.locator('text=What is polymorphism in OOP?').count(),
      1,
      'Question must remain rendered when delete is locked'
    );
    await delCtx.close();

    // 3. Plain 409 (without QUIZ_LOCKED_AFTER_ATTEMPT) does NOT show banner and shows addQuestionError toast
    const { context: plainCtx, page: plainPage } = await mockSessionPage(browser, {
      role: 'DOCTOR',
      language: 'en',
    });
    await setupExamDetailRoutes(plainPage, {
      addStatus: 409,
      addMessage: 'Conflict: question order already exists.',
    });

    await plainPage.goto(`${appServer.origin}/exams/101`, { waitUntil: 'networkidle' });
    await plainPage.locator('text=CS401').first().waitFor({ state: 'visible', timeout: 8000 });

    await plainPage.locator('button:has-text("Add New Question")').click();
    await plainPage.locator('form textarea').fill('Plain conflict question');
    const plainRespPromise = plainPage.waitForResponse(
      (r) => r.url().includes('/api/exams/101/questions') && r.request().method() === 'POST'
    );
    await plainPage.locator('form button[type="submit"]').click();
    await plainRespPromise;

    assert.equal(
      await plainPage.locator('[data-quiz-locked-banner="true"]').count(),
      0,
      'Plain 409 without QUIZ_LOCKED_AFTER_ATTEMPT must NOT show [data-quiz-locked-banner="true"]'
    );
    const toastAlert = plainPage.locator('[role="region"] [role="alert"]').first();
    await toastAlert.waitFor({ state: 'visible', timeout: 5000 });
    assert.ok(
      (await toastAlert.innerText()).includes('Failed to add question'),
      'Plain 409 on add question must show localized addQuestionError toast'
    );
    await plainCtx.close();
  });

  // ── P5: ExamsList delete 409 QUIZ_LOCKED_AFTER_ATTEMPT shows localized toast and row stays (single & bulk) ──
  it('P5: ExamsList single and bulk delete 409 QUIZ_LOCKED_AFTER_ATTEMPT shows localized toast and exam remains in list', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'SUPER_ADMIN',
      language: 'en',
    });

    await page.route((url) => url.pathname.startsWith('/api/exams'), async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (req.method() === 'GET' && url.pathname === '/api/exams') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [mockExamDetailPayload] }),
        });
        return;
      }
      if (req.method() === 'DELETE' && url.pathname === '/api/exams/101') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            status: 'fail',
            message:
              'QUIZ_LOCKED_AFTER_ATTEMPT: Cannot delete an exam: student attempts already exist for this exam.',
            errorId: 'err-t7b2-exam-del',
          }),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto(`${appServer.origin}/exams`, { waitUntil: 'networkidle' });
    await page.locator('text=CS401').first().waitFor({ state: 'visible', timeout: 8000 });

    // 1. Single delete 409 QUIZ_LOCKED_AFTER_ATTEMPT
    await page.locator('button[title="Delete"]').first().click();
    await page.locator('[role="dialog"] button.bg-rose-600').waitFor({ state: 'visible', timeout: 5000 });
    const singleDelResp = page.waitForResponse(
      (r) => r.url().includes('/api/exams/101') && r.request().method() === 'DELETE'
    );
    await page.locator('[role="dialog"] button.bg-rose-600').click();
    await singleDelResp;

    const toastEl = page.locator('[role="region"] [role="alert"]').first();
    await toastEl.waitFor({ state: 'visible', timeout: 5000 });
    const singleToastText = (await toastEl.innerText()).trim();
    assert.equal(
      singleToastText,
      'Cannot delete an exam that already has student attempts.',
      `Expected localized quizLockedDeleteToast on single delete, got "${singleToastText}"`
    );
    assert.equal(
      await page.locator('text=CS401').count(),
      1,
      'Exam row/card must remain in list after locked single delete'
    );

    // Dismiss toast before testing bulk delete
    await page.locator('[role="region"] [role="alert"] button').first().click();

    // 2. Bulk delete 409 QUIZ_LOCKED_AFTER_ATTEMPT
    await page.locator('button[aria-label*="Select"]').first().click();
    const bulkToolbarDeleteBtn = page.locator('[role="region"][aria-label="Bulk actions"] button:has-text("Delete")');
    await bulkToolbarDeleteBtn.waitFor({ state: 'visible', timeout: 5000 });
    await bulkToolbarDeleteBtn.click();

    await page.locator('[role="dialog"] button.bg-rose-600').waitFor({ state: 'visible', timeout: 5000 });
    const bulkDelResp = page.waitForResponse(
      (r) => r.url().includes('/api/exams/101') && r.request().method() === 'DELETE'
    );
    await page.locator('[role="dialog"] button.bg-rose-600').click();
    await bulkDelResp;

    const bulkToastEl = page.locator('[role="region"] [role="alert"]').first();
    await bulkToastEl.waitFor({ state: 'visible', timeout: 5000 });
    const bulkToastText = (await bulkToastEl.innerText()).trim();
    assert.equal(
      bulkToastText,
      'Cannot delete an exam that already has student attempts.',
      `Expected localized quizLockedDeleteToast on bulk delete, got "${bulkToastText}"`
    );
    assert.equal(
      await page.locator('text=CS401').count(),
      1,
      'Exam row/card must remain in list after locked bulk delete'
    );

    await context.close();
  });

  // ── P6: 24-config matrix (1440/1024/768/430/390/360 x ar/en x light/dark) per OD-97 ──
  const viewports = [1440, 1024, 768, 430, 390, 360];
  const languages = ['en', 'ar'];
  const themes = ['light', 'dark'];

  for (const width of viewports) {
    for (const lang of languages) {
      for (const theme of themes) {
        it(`P6 [${width}px ${lang.toUpperCase()} ${theme.toUpperCase()}]: Dashboard with inline error and ExamDetails with quiz-locked banner pass dir/lang, dark class, no horizontal overflow, and viewport bounds`, async () => {
          const { context, page } = await mockSessionPage(browser, {
            role: 'DOCTOR',
            language: lang,
          });

          await page.addInitScript(
            ({ themeVal, langVal }) => {
              localStorage.setItem('theme', themeVal);
              localStorage.setItem('language', langVal);
            },
            { themeVal: theme, langVal: lang }
          );
          await installFastGeolocation(page);
          await page.setViewportSize({ width, height: 900 });

          const jsErrors = [];
          page.on('pageerror', (err) => jsErrors.push(err.message));

          const startRequests = [];
          await setupAttendanceRoutes(page, { startStatus: 200, startRequests });
          await setupExamDetailRoutes(page);

          // 1. FacultyAttendanceDashboard with inline error
          await page.goto(`${appServer.origin}/attendance`, { waitUntil: 'networkidle' });
          await page.locator('text=CS401').first().waitFor({ state: 'visible', timeout: 8000 });

          assert.equal(await page.getAttribute('html', 'dir'), lang === 'ar' ? 'rtl' : 'ltr');
          assert.equal(await page.getAttribute('html', 'lang'), lang);
          assert.equal(
            await page.evaluate(() => document.documentElement.classList.contains('dark')),
            theme === 'dark'
          );

          const pointsInput = page.locator('[data-session-points-input="true"]');
          assert.equal(await pointsInput.count(), 1, 'Must render [data-session-points-input="true"]');
          await pointsInput.fill('-1');

          const startBtnSelector =
            lang === 'ar'
              ? 'button:has-text("بدء جلسة الحضور الذكية")'
              : 'button:has-text("Start Smart Session")';
          await page.locator(startBtnSelector).click();

          const inlineErr = page.locator('[data-session-points-error="true"]');
          assert.equal(await inlineErr.count(), 1, 'Must render [data-session-points-error="true"]');
          assert.equal(startRequests.length, 0);

          const dashMetrics = await page.evaluate(() => {
            const scrollWidth = document.documentElement.scrollWidth;
            const innerWidth = window.innerWidth;
            const inputEl = document.querySelector('[data-session-points-input="true"]');
            const errEl = document.querySelector('[data-session-points-error="true"]');
            const ir = inputEl.getBoundingClientRect();
            const er = errEl.getBoundingClientRect();
            return {
              scrollWidth,
              innerWidth,
              inputBox: { left: Math.round(ir.left), right: Math.round(ir.right) },
              errBox: { left: Math.round(er.left), right: Math.round(er.right) },
            };
          });

          assert.ok(
            dashMetrics.scrollWidth <= dashMetrics.innerWidth,
            `Attendance scrollWidth (${dashMetrics.scrollWidth}) must be <= innerWidth (${dashMetrics.innerWidth}) at ${width}px ${lang} ${theme}`
          );
          assert.ok(
            dashMetrics.inputBox.left >= 0 && dashMetrics.inputBox.right <= dashMetrics.innerWidth,
            `Input bounds [${dashMetrics.inputBox.left}, ${dashMetrics.inputBox.right}] must be within [0, ${dashMetrics.innerWidth}]`
          );
          assert.ok(
            dashMetrics.errBox.left >= 0 && dashMetrics.errBox.right <= dashMetrics.innerWidth,
            `Error bounds [${dashMetrics.errBox.left}, ${dashMetrics.errBox.right}] must be within [0, ${dashMetrics.innerWidth}]`
          );

          // 2. ExamDetails with quiz-locked banner
          await page.goto(`${appServer.origin}/exams/101`, { waitUntil: 'networkidle' });
          await page.locator('text=CS401').first().waitFor({ state: 'visible', timeout: 8000 });

          assert.equal(await page.getAttribute('html', 'dir'), lang === 'ar' ? 'rtl' : 'ltr');
          assert.equal(await page.getAttribute('html', 'lang'), lang);
          assert.equal(
            await page.evaluate(() => document.documentElement.classList.contains('dark')),
            theme === 'dark'
          );

          const addQBtnSelector =
            lang === 'ar'
              ? 'button:has-text("إضافة سؤال جديد")'
              : 'button:has-text("Add New Question")';
          await page.locator(addQBtnSelector).click();
          await page.locator('form textarea').fill('Matrix test question');
          const addResp = page.waitForResponse(
            (r) => r.url().includes('/api/exams/101/questions') && r.request().method() === 'POST'
          );
          await page.locator('form button[type="submit"]').click();
          await addResp;

          const bannerEl = page.locator('[data-quiz-locked-banner="true"]');
          assert.equal(await bannerEl.count(), 1, 'Must render [data-quiz-locked-banner="true"]');

          const examMetrics = await page.evaluate(() => {
            const scrollWidth = document.documentElement.scrollWidth;
            const innerWidth = window.innerWidth;
            const bEl = document.querySelector('[data-quiz-locked-banner="true"]');
            const br = bEl.getBoundingClientRect();
            return {
              scrollWidth,
              innerWidth,
              bannerBox: { left: Math.round(br.left), right: Math.round(br.right) },
            };
          });

          assert.ok(
            examMetrics.scrollWidth <= examMetrics.innerWidth,
            `ExamDetails scrollWidth (${examMetrics.scrollWidth}) must be <= innerWidth (${examMetrics.innerWidth}) at ${width}px ${lang} ${theme}`
          );
          assert.ok(
            examMetrics.bannerBox.left >= 0 && examMetrics.bannerBox.right <= examMetrics.innerWidth,
            `Banner bounds [${examMetrics.bannerBox.left}, ${examMetrics.bannerBox.right}] must be within [0, ${examMetrics.innerWidth}]`
          );
          assert.equal(jsErrors.length, 0);

          await context.close();
        });
      }
    }
  }

  it('teardown server and browser', async () => {
    if (browser) await browser.close();
    if (appServer) await appServer.close();
  });
});

