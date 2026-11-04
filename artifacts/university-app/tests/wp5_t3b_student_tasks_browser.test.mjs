import assert from 'node:assert/strict';
import { describe, it, after } from 'node:test';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

/*
Real URLs and response envelopes audited from api-server:
1. GET /api/tasks
   Route: artifacts/api-server/src/routes/task.routes.ts:55 -> router.get('/', functionalPaginationValidation, validate, getTasks);
   Controller: artifacts/api-server/src/controllers/task.controller.ts:63 -> return res.json({ success: true, data: { rows: result.tasks, pagination: result.pagination } });
   Service: artifacts/api-server/src/services/task/taskQueries.service.ts:16-279
   Envelope: { success: true, data: { rows: TaskQueryResultItem[], pagination: PaginationMeta } }
2. POST /api/tasks/:id/submit
   Route: artifacts/api-server/src/routes/task.routes.ts:80 -> router.post('/:id/submit', authorize('STUDENT'), functionalIdValidation, taskSubmissionValidation, validate, submitTask);
   Controller: artifacts/api-server/src/controllers/task.controller.ts:133 -> return res.status(201).json({ success: true, data: submission, message: 'Task submitted successfully' });
   Service: artifacts/api-server/src/services/task/taskGrading.service.ts:39-183
   Envelope: { success: true, data: TaskSubmission, message: 'Task submitted successfully' }
3. GET /api/courses
   Route: artifacts/api-server/src/routes/courses.routes.ts:18 -> router.get('/', coursesController.getAllCourses);
   Controller: artifacts/api-server/src/controllers/courses.controller.ts:152-163 -> res.json({ success: true, data: { courses, pagination: { total, page, limit, totalPages } } });
   Envelope: { success: true, data: { courses: Course[], pagination: PaginationMeta } }
4. GET /api/courses/:id
   Route: artifacts/api-server/src/routes/courses.routes.ts:71 -> router.get('/:id', idParamValidation, validate, coursesController.getCourseById);
   Controller: artifacts/api-server/src/controllers/courses.controller.ts:269-275 -> res.json({ success: true, data: { ...course, scheduleSlots: normalizedSlots, sections: normalizedSlots } });
   Envelope: { success: true, data: CourseDetails }
5. GET /api/tasks/:id/submission
   Route: artifacts/api-server/src/routes/task.routes.ts:121-127 -> router.get('/:id/submission', authorize('STUDENT'), functionalIdValidation, validate, getMySubmission);
   Controller: artifacts/api-server/src/controllers/task.controller.ts:200 -> return res.json({ success: true, data: submission });
   Service: artifacts/api-server/src/services/task/taskGrading.service.ts:309-380 -> return submission;
   Envelope: { success: true, data: TaskSubmission | null }
*/

describe('WP5-T3b Browser Suite: Student Tasks UI, Guards & 24-Cell Matrix', () => {
  let appServer;
  let browser;

  const mockTasks = [
    {
      id: 1,
      title: 'CS101 Assignment 1 (Past Due)',
      description: 'First assignment with past deadline',
      dueDate: '2020-01-01T00:00:00.000Z', // Fixed past date
      maxScore: 100,
      courseId: 1,
      academicYear: 2026,
      semester: 'FALL',
      course: {
        id: 1,
        name: 'Introduction to Computer Science',
        courseCode: 'CS101',
        _count: { enrollments: 25 },
      },
      doctor: { firstName: 'Tariq', lastName: 'Doctor', userId: '10' },
      _count: { submissions: 15 },
      mySubmission: null,
    },
    {
      id: 2,
      title: 'CS101 Assignment 2 (Future Open)',
      description: 'Second assignment with future deadline',
      dueDate: '2099-01-01T00:00:00.000Z', // Fixed future date
      maxScore: 100,
      courseId: 1,
      academicYear: 2026,
      semester: 'FALL',
      course: {
        id: 1,
        name: 'Introduction to Computer Science',
        courseCode: 'CS101',
        _count: { enrollments: 25 },
      },
      doctor: { firstName: 'Tariq', lastName: 'Doctor', userId: '10' },
      _count: { submissions: 5 },
      mySubmission: null,
    },
    {
      id: 3,
      title: 'CS101 Assignment 3 (Graded)',
      description: 'Third assignment already graded',
      dueDate: '2099-01-01T00:00:00.000Z',
      maxScore: 100,
      courseId: 1,
      academicYear: 2026,
      semester: 'FALL',
      course: {
        id: 1,
        name: 'Introduction to Computer Science',
        courseCode: 'CS101',
        _count: { enrollments: 25 },
      },
      doctor: { firstName: 'Tariq', lastName: 'Doctor', userId: '10' },
      _count: { submissions: 20 },
      mySubmission: {
        id: 501,
        taskId: 3,
        studentId: 7,
        notes: 'Submitted on time',
        fileUrl: 'https://drive.google.com/file/d/submitted-grade',
        submittedAt: '2026-10-25T14:30:00.000Z',
        score: 95,
        feedback: 'Excellent work',
      },
    },
  ];

  const mockCourses = [
    {
      id: 1,
      name: 'Introduction to Computer Science',
      code: 'CS101',
      year: 1,
    },
  ];

  const mockCourseDetails = {
    id: 1,
    name: 'Introduction to Computer Science',
    courseCode: 'CS101',
    credits: 3,
    year: 1,
    semester: 'FALL',
    isPublished: true,
    department: {
      id: 1,
      name: 'Computer Science',
      nameAr: 'علوم الحاسب',
      college: { id: 1, name: 'Engineering', nameAr: 'الهندسة' },
    },
    tasks: mockTasks,
    materials: [],
    scheduleSlots: [],
    sections: [],
    _count: { enrollments: 25, quizzes: 0, tasks: 3, exams: 0, materials: 0 },
  };

  it('setup built app server and chromium browser', async () => {
    appServer = await serveBuiltApp();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  });

  async function setupTasksMocks(page) {
    let capturedSubmitRequest = null;

    await page.route('**/api/tasks**', async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();

      const subMatch = url.pathname.match(/\/api\/tasks\/(\d+)\/submission$/);
      if (method === 'GET' && subMatch) {
        const taskId = parseInt(subMatch[1], 10);
        const sub = taskId === 3 ? mockTasks[2].mySubmission : null;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: sub }),
        });
        return;
      }

      const submitMatch = url.pathname.match(/\/api\/tasks\/(\d+)\/submit$/);
      if (method === 'POST' && submitMatch) {
        const taskId = parseInt(submitMatch[1], 10);
        let postData = {};
        const rawPost = route.request().postData() || '';
        if (rawPost.startsWith('{')) {
          try { postData = JSON.parse(rawPost); } catch {}
        } else {
          const fileUrlMatch = rawPost.match(/name="fileUrl"\r?\n\r?\n([^\r\n]+)/);
          const notesMatch = rawPost.match(/name="notes"\r?\n\r?\n([^\r\n]+)/);
          postData = {
            fileUrl: fileUrlMatch ? fileUrlMatch[1] : undefined,
            notes: notesMatch ? notesMatch[1] : undefined,
          };
        }
        capturedSubmitRequest = {
          taskId,
          method: 'POST',
          url: url.pathname,
          body: postData,
        };

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 999,
              taskId,
              studentId: 7,
              notes: postData.notes || null,
              fileUrl: postData.fileUrl || null,
              submittedAt: '2026-10-31T18:00:00.000Z',
              score: null,
              feedback: null,
            },
            message: 'Task submitted successfully',
          }),
        });
        return;
      }

      if (method === 'GET' && (url.pathname === '/api/tasks' || url.pathname === '/api/tasks/')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              rows: mockTasks,
              pagination: { page: 1, limit: 24, totalCount: mockTasks.length, totalPages: 1 },
            },
          }),
        });
        return;
      }

      await route.fallback();
    });

    await page.route('**/api/courses**', async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();

      const courseMatch = url.pathname.match(/\/api\/courses\/(\d+)$/);
      if (method === 'GET' && courseMatch) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: mockCourseDetails }),
        });
        return;
      }

      if (method === 'GET' && (url.pathname === '/api/courses' || url.pathname === '/api/courses/')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              courses: mockCourses,
              pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
            },
          }),
        });
        return;
      }

      await route.fallback();
    });

    return {
      getCapturedSubmit: () => capturedSubmitRequest,
    };
  }

  it('(1) /tasks Cards layout: past-due overdue state, graded score state, and future clickable submit', async () => {
    const { context, page } = await mockSessionPage(browser, { role: 'STUDENT', language: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('language', 'en');
    });

    await setupTasksMocks(page);
    await page.goto(`${appServer.origin}/tasks`, { waitUntil: 'networkidle' });

    // Past-due task card (id 1): overdue badge visible, action button disabled
    const pastDueCard = page.locator('[data-task-card="true"]:has-text("CS101 Assignment 1 (Past Due)")').first();
    await pastDueCard.waitFor({ state: 'visible', timeout: 8000 });

    const overdueBadge = pastDueCard.locator(':text("Overdue")').first();
    await overdueBadge.waitFor({ state: 'visible', timeout: 5000 });

    const pastDueActionBtn = pastDueCard.locator('button').last();
    await pastDueActionBtn.waitFor({ state: 'visible', timeout: 5000 });
    const isPastDueDisabled = await pastDueActionBtn.isDisabled();
    const pastDueAriaDisabled = await pastDueActionBtn.getAttribute('aria-disabled');
    assert.ok(isPastDueDisabled || pastDueAriaDisabled === 'true', 'Action button on past-due task card must be disabled');
    assert.match(await pastDueActionBtn.textContent(), /Overdue/);

    // Graded task card (id 3): graded score badge visible, resubmit action disabled
    const gradedCard = page.locator('[data-task-card="true"]:has-text("CS101 Assignment 3 (Graded)")').first();
    await gradedCard.waitFor({ state: 'visible', timeout: 8000 });

    const gradedBadge = gradedCard.locator(':text("95/100"), :text("95 / 100")').first();
    await gradedBadge.waitFor({ state: 'visible', timeout: 5000 });

    const gradedActionBtn = gradedCard.locator('button').last();
    await gradedActionBtn.waitFor({ state: 'visible', timeout: 5000 });
    const isGradedDisabled = await gradedActionBtn.isDisabled();
    const gradedAriaDisabled = await gradedActionBtn.getAttribute('aria-disabled');
    assert.ok(isGradedDisabled || gradedAriaDisabled === 'true', 'Action button on graded task card must be disabled');
    assert.match(await gradedActionBtn.textContent(), /95/);

    // Future open task card (id 2): submit button enabled and clickable
    const futureCard = page.locator('[data-task-card="true"]:has-text("CS101 Assignment 2 (Future Open)")').first();
    await futureCard.waitFor({ state: 'visible', timeout: 8000 });
    const submitBtn = futureCard.locator('button:has-text("Submit")').first();
    await submitBtn.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(await submitBtn.isDisabled(), false, 'Submit button on future task card must be enabled');

    await context.close();
  });

  it('(2) /tasks Table layout (TasksTable): past-due overdue state, graded score state, and future clickable submit', async () => {
    const { context, page } = await mockSessionPage(browser, { role: 'STUDENT', language: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('language', 'en');
    });

    await setupTasksMocks(page);
    await page.goto(`${appServer.origin}/tasks`, { waitUntil: 'networkidle' });

    // Switch view mode to table via filter bar toggle
    const tableToggle = page.locator('button[aria-label="Table View"], button[aria-label="عرض الجدول"], button[title="Table"], button[title="عرض الجدول"]').first();
    await tableToggle.waitFor({ state: 'visible', timeout: 5000 });
    await tableToggle.click();

    const tableEl = page.locator('table');
    await tableEl.waitFor({ state: 'visible', timeout: 5000 });

    // Past-due task row: overdue badge visible and disabled action button
    const pastDueRow = page.locator('tbody tr:has-text("CS101 Assignment 1 (Past Due)")').first();
    await pastDueRow.waitFor({ state: 'visible', timeout: 5000 });
    const overdueBadge = pastDueRow.locator(':text("Overdue")').first();
    await overdueBadge.waitFor({ state: 'visible', timeout: 5000 });
    const pastDueBtn = pastDueRow.locator('button').last();
    await pastDueBtn.waitFor({ state: 'visible', timeout: 5000 });
    const isPastDueDisabled = await pastDueBtn.isDisabled();
    const pastDueAriaDisabled = await pastDueBtn.getAttribute('aria-disabled');
    assert.ok(isPastDueDisabled || pastDueAriaDisabled === 'true', 'Action button on past-due row must be disabled');
    assert.match(await pastDueBtn.textContent(), /Overdue/);

    // Graded task row: graded score badge visible and disabled action button
    const gradedRow = page.locator('tbody tr:has-text("CS101 Assignment 3 (Graded)")').first();
    await gradedRow.waitFor({ state: 'visible', timeout: 5000 });
    const gradedBadge = gradedRow.locator(':text("95/100"), :text("95 / 100")').first();
    await gradedBadge.waitFor({ state: 'visible', timeout: 5000 });
    const gradedBtn = gradedRow.locator('button').last();
    await gradedBtn.waitFor({ state: 'visible', timeout: 5000 });
    const isGradedDisabled = await gradedBtn.isDisabled();
    const gradedAriaDisabled = await gradedBtn.getAttribute('aria-disabled');
    assert.ok(isGradedDisabled || gradedAriaDisabled === 'true', 'Action button on graded row must be disabled');
    assert.match(await gradedBtn.textContent(), /95/);

    // Future open task row: submit button enabled and opens modal
    const futureRow = page.locator('tbody tr:has-text("CS101 Assignment 2 (Future Open)")').first();
    await futureRow.waitFor({ state: 'visible', timeout: 5000 });
    const submitBtn = futureRow.locator('button:has-text("Submit"), button:has-text("تسليم")').first();
    await submitBtn.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(await submitBtn.isDisabled(), false, 'Submit button on future task row must be enabled');

    await submitBtn.click();
    const submitModal = page.locator('div[role="dialog"]').first();
    await submitModal.waitFor({ state: 'visible', timeout: 5000 });
    await page.keyboard.press('Escape');
    await submitModal.waitFor({ state: 'hidden', timeout: 5000 });

    await context.close();
  });

  it('(3) /courses/:id (CourseTasksTab): past-due overdue state, graded score state, future clickable submit, and envelope assertion', async () => {
    const { context, page } = await mockSessionPage(browser, { role: 'STUDENT', language: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('language', 'en');
    });

    const { getCapturedSubmit } = await setupTasksMocks(page);
    await page.goto(`${appServer.origin}/courses/1`, { waitUntil: 'networkidle' });

    // Click Tasks & Assignments tab
    const tasksTabBtn = page.locator('button:has-text("Tasks & Assignments"), button:has-text("الواجبات والمهام")').first();
    await tasksTabBtn.waitFor({ state: 'visible', timeout: 8000 });
    await tasksTabBtn.click();

    // 1. Past-due task card in CourseTasksTab
    const pastDueTask = page.locator('div.rounded-2xl:has-text("CS101 Assignment 1 (Past Due)")').first();
    await pastDueTask.waitFor({ state: 'visible', timeout: 5000 });
    const overdueBadge = pastDueTask.locator(':text("Overdue"), :text("متأخر")').first();
    await overdueBadge.waitFor({ state: 'visible', timeout: 5000 });
    const overdueBtn = pastDueTask.locator('button').last();
    await overdueBtn.waitFor({ state: 'visible', timeout: 5000 });
    const isOverdueDisabled = await overdueBtn.isDisabled();
    const overdueAriaDisabled = await overdueBtn.getAttribute('aria-disabled');
    assert.ok(isOverdueDisabled || overdueAriaDisabled === 'true', 'Overdue action button in CourseTasksTab must be disabled');
    assert.match(await overdueBtn.textContent(), /Overdue/);

    // 2. Graded task card in CourseTasksTab
    const gradedTask = page.locator('div.rounded-2xl:has-text("CS101 Assignment 3 (Graded)")').first();
    await gradedTask.waitFor({ state: 'visible', timeout: 5000 });
    const scoreBadge = gradedTask.locator(':text("95/100"), :text("95 / 100")').first();
    await scoreBadge.waitFor({ state: 'visible', timeout: 5000 });
    const gradedBtn = gradedTask.locator('button').last();
    await gradedBtn.waitFor({ state: 'visible', timeout: 5000 });
    const isGradedDisabled = await gradedBtn.isDisabled();
    const gradedAriaDisabled = await gradedBtn.getAttribute('aria-disabled');
    assert.ok(isGradedDisabled || gradedAriaDisabled === 'true', 'Graded action button in CourseTasksTab must be disabled');
    assert.match(await gradedBtn.textContent(), /95/);

    // 3. Future open task card in CourseTasksTab
    const futureTask = page.locator('div.rounded-2xl:has-text("CS101 Assignment 2 (Future Open)")').first();
    await futureTask.waitFor({ state: 'visible', timeout: 5000 });
    const submitBtn = futureTask.locator('button:has-text("Submit Assignment")').first();
    await submitBtn.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(await submitBtn.isDisabled(), false, 'Submit button in CourseTasksTab must be enabled');
    await submitBtn.click();

    // Verify submit modal opens, fill valid URL, click submit and assert request key names and id types
    const submitModal = page.locator('div[role="dialog"]').first();
    await submitModal.waitFor({ state: 'visible', timeout: 5000 });

    const fileInput = submitModal.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'report.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test report content'),
    });

    const urlInput = submitModal.locator('input#submit-file-url');
    await urlInput.fill('https://drive.google.com/file/d/submitted-course-task-2');
    const notesInput = submitModal.locator('textarea#submit-notes');
    await notesInput.fill('Submitted from CourseTasksTab');
    const modalSubmitBtn = submitModal.locator('button[type="submit"]');
    await modalSubmitBtn.click();
    await page.waitForFunction(() => document.querySelector('div[role="dialog"]') === null, { timeout: 8000 });

    const captured = getCapturedSubmit();
    assert.ok(captured, 'Must capture submit request from CourseTasksTab');
    assert.equal(typeof captured.taskId, 'number', 'taskId must be an integer number');
    assert.equal(captured.taskId, 2, 'taskId must be 2');
    assert.equal(captured.method, 'POST');
    assert.equal(captured.url, '/api/tasks/2/submit');
    assert.equal(captured.body.fileUrl, 'https://drive.google.com/file/d/submitted-course-task-2');
    assert.equal(captured.body.notes, 'Submitted from CourseTasksTab');

    await context.close();
  });

  it('(4) Client-side submission validation: blank submission and non-HTTPS inline errors', async () => {
    const { context, page } = await mockSessionPage(browser, { role: 'STUDENT', language: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('language', 'en');
    });

    await setupTasksMocks(page);
    await page.goto(`${appServer.origin}/tasks`, { waitUntil: 'networkidle' });

    // Open submit modal on future open task
    const futureCard = page.locator('[data-task-card="true"]:has-text("CS101 Assignment 2 (Future Open)")').first();
    await futureCard.waitFor({ state: 'visible', timeout: 8000 });
    await futureCard.locator('button:has-text("Submit")').first().click();

    const submitModal = page.locator('div[role="dialog"]').first();
    await submitModal.waitFor({ state: 'visible', timeout: 5000 });

    // Test Submit is disabled when no file is chosen (OD-121)
    const modalSubmitBtn = submitModal.locator('button[type="submit"]');
    assert.equal(await modalSubmitBtn.isDisabled(), true, 'Submit button must be disabled when no file is chosen');

    // Choose file fixture
    const fileInput = submitModal.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'report.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test report content'),
    });
    assert.equal(await modalSubmitBtn.isDisabled(), false, 'Submit button must be enabled once a file is chosen');

    const blankError = submitModal.locator('p#submit-file-url-error');

    // Test non-HTTPS link error
    const fileUrlInput = submitModal.locator('input#submit-file-url');
    await fileUrlInput.fill('http://drive.google.com/unsecured-link');
    await modalSubmitBtn.click();

    // Inline error for HTTPS requirement must appear
    await page.waitForFunction(() => {
      const el = document.getElementById('submit-file-url-error');
      return el && /HTTPS/i.test(el.textContent || '');
    }, { timeout: 5000 });

    const httpsErrorText = await blankError.textContent();
    assert.match(httpsErrorText, /HTTPS/i, 'Must display inline error requiring HTTPS');

    await context.close();
  });

  // ── 24-CONFIGURATION MATRIX (1440/1024/768/430/390/360 x ar/en x light/dark) ──
  const viewports = [1440, 1024, 768, 430, 390, 360];
  const languages = ['en', 'ar'];
  const themes = ['light', 'dark'];

  for (const width of viewports) {
    for (const lang of languages) {
      for (const theme of themes) {
        it(`Matrix [${width}px ${lang.toUpperCase()} ${theme.toUpperCase()}]: html dir/lang, dark class, scrollWidth <= innerWidth, element bounds inside viewport`, async () => {
          const { context, page } = await mockSessionPage(browser, {
            role: 'STUDENT',
            language: lang,
          });

          await page.addInitScript(
            ({ themeVal, langVal }) => {
              localStorage.setItem('theme', themeVal);
              localStorage.setItem('language', langVal);
            },
            { themeVal: theme, langVal: lang }
          );

          await page.setViewportSize({ width, height: 900 });

          const jsErrors = [];
          page.on('pageerror', (err) => jsErrors.push(err.message));

          await setupTasksMocks(page);
          await page.goto(`${appServer.origin}/tasks`, { waitUntil: 'networkidle' });

          // Wait for tasks container to render
          await page.waitForSelector('h1, h2, h3', { timeout: 8000 });

          // Assert html dir and lang
          const htmlDir = await page.getAttribute('html', 'dir');
          const htmlLang = await page.getAttribute('html', 'lang');
          assert.equal(htmlDir, lang === 'ar' ? 'rtl' : 'ltr', `HTML dir must be ${lang === 'ar' ? 'rtl' : 'ltr'}`);
          assert.equal(htmlLang, lang, `HTML lang must be ${lang}`);

          // Assert dark class present in dark and absent in light
          const hasDarkClass = await page.evaluate(() =>
            document.documentElement.classList.contains('dark')
          );
          assert.equal(hasDarkClass, theme === 'dark', `Dark class must be ${theme === 'dark'} for theme ${theme}`);

          // Assert document.documentElement.scrollWidth <= window.innerWidth
          const layoutMetrics = await page.evaluate(() => {
            const scrollWidth = document.documentElement.scrollWidth;
            const innerWidth = window.innerWidth;
            const cards = Array.from(document.querySelectorAll('[data-task-card="true"]')).map((el) => {
              const r = el.getBoundingClientRect();
              return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
            });
            return { scrollWidth, innerWidth, cards };
          });

          assert.ok(
            layoutMetrics.scrollWidth <= layoutMetrics.innerWidth,
            `scrollWidth (${layoutMetrics.scrollWidth}) must be <= innerWidth (${layoutMetrics.innerWidth}) at ${width}px ${lang} ${theme}`
          );

          // Assert element bounds inside viewport and count > 0 (not vacuous)
          assert.ok(layoutMetrics.cards.length >= 3, `Cards count must be >= 3 at ${width}px ${lang} ${theme} (got ${layoutMetrics.cards.length})`);
          for (const card of layoutMetrics.cards) {
            assert.ok(
              card.left >= 0 && card.right <= layoutMetrics.innerWidth,
              `Element bounds [${card.left}, ${card.right}] must be inside viewport [0, ${layoutMetrics.innerWidth}] at ${width}px ${lang} ${theme}`
            );
          }

          // Test table layout on this config: count > 0
          const tableToggle = page.locator('button[aria-label="Table View"], button[aria-label="عرض الجدول"], button[title="Table"], button[title="عرض الجدول"]').first();
          await tableToggle.waitFor({ state: 'visible', timeout: 5000 });
          await tableToggle.click();
          await page.locator('table').waitFor({ state: 'visible', timeout: 5000 });
          const tableRowsCount = await page.locator('tbody tr').count();
          assert.ok(tableRowsCount >= 3, `Table rows count must be >= 3 at ${width}px ${lang} ${theme} (got ${tableRowsCount})`);

          // Test CourseTasksTab on this config: count > 0
          await page.goto(`${appServer.origin}/courses/1`, { waitUntil: 'networkidle' });
          const tasksTabBtn = page.locator('button:has-text("Tasks & Assignments"), button:has-text("الواجبات والمهام")').first();
          await tasksTabBtn.waitFor({ state: 'visible', timeout: 8000 });
          await tasksTabBtn.click();
          const courseCards = page.locator('div.rounded-2xl:has-text("CS101 Assignment")');
          const courseCardsCount = await courseCards.count();
          assert.ok(courseCardsCount >= 3, `Course tasks count must be >= 3 at ${width}px ${lang} ${theme} (got ${courseCardsCount})`);

          const courseScrollMetrics = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
          }));
          assert.ok(
            courseScrollMetrics.scrollWidth <= courseScrollMetrics.innerWidth,
            `Course page scrollWidth (${courseScrollMetrics.scrollWidth}) must be <= innerWidth (${courseScrollMetrics.innerWidth}) at ${width}px ${lang} ${theme}`
          );

          assert.equal(jsErrors.length, 0, `No JS runtime errors expected, got: ${jsErrors.join(', ')}`);

          await context.close();
        });
      }
    }
  }

  after(async () => {
    try {
      if (browser) {
        await browser.close();
      }
    } finally {
      if (appServer) {
        await appServer.close();
      }
    }
  });
});
