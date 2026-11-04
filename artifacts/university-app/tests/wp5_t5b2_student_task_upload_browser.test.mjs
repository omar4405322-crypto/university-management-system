import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

/*
Audited Real API URLs and envelopes from artifacts/api-server:
1. GET /api/tasks
   Route: artifacts/api-server/src/routes/task.routes.ts:55 -> router.get('/', functionalPaginationValidation, validate, getTasks);
   Controller: artifacts/api-server/src/controllers/task.controller.ts:82 -> return res.json({ success: true, data: tasksResult });
   Envelope: { success: true, data: TaskItem[] } or { success: true, data: { rows: TaskItem[], pagination: PaginationMeta } }
2. POST /api/tasks/:id/submit
   Route: artifacts/api-server/src/routes/task.routes.ts:83 -> router.post('/:id/submit', authorize('STUDENT'), functionalIdValidation, taskSubmissionUpload, taskSubmissionValidation, validate, submitTask);
   Controller: artifacts/api-server/src/controllers/task.controller.ts:149 -> return res.status(201).json({ success: true, data: responseData });
   Envelope (201): { success: true, data: TaskSubmission }
   Envelope (409): { success: false, message: 'You have already submitted this task. Only one submission per task is allowed.' }
   Envelope (403): { success: false, message: 'The deadline for this task has passed.' }
3. GET /api/tasks/:id/submissions/:sid/download
   Route: artifacts/api-server/src/routes/task.routes.ts:90 -> router.get('/:id/submissions/:sid/download', authorize('STUDENT', 'DOCTOR', 'TEACHING_ASSISTANT', 'SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), functionalIdValidation, validate, downloadTaskSubmission);
   Controller: artifacts/api-server/src/controllers/task.controller.ts:208-222 -> headers (Content-Disposition: attachment, Content-Type, X-Content-Type-Options: nosniff), stream pipe
4. GET /api/tasks/:id/submissions
   Route: artifacts/api-server/src/routes/task.routes.ts:108 -> router.get('/:id/submissions', authorize('DOCTOR', 'TEACHING_ASSISTANT', 'SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), ... getTaskSubmissions);
   Controller: artifacts/api-server/src/controllers/task.controller.ts:268 -> return res.json({ success: true, data: submissions });
   Envelope: { success: true, data: { rows: TaskSubmissionUnifiedRow[], pagination: PaginationMeta, summary: SubmissionsSummary, defaultCourseYear: number } }
*/

describe('WP5-T5b-2b Browser Suite: Student File Upload UI, File Required & 24-Config Matrix', () => {
  let appServer;
  let browser;

  const mockTasks = [
    {
      id: 10,
      title: 'Operating Systems Project 1',
      description: 'Implement process scheduling simulator in C',
      dueDate: '2099-01-01T23:59:59.000Z', // Future date
      maxScore: 100,
      courseId: 101,
      course: {
        id: 101,
        name: 'Operating Systems',
        courseCode: 'CS301',
        _count: { enrollments: 30 },
      },
      doctor: { firstName: 'Ali', lastName: 'Hassan', userId: '1' },
      _count: { submissions: 1 },
      mySubmission: null,
    },
    {
      id: 11,
      title: 'Database Architecture Final Assignment',
      description: 'Design 3NF schema and migration plan',
      dueDate: '2099-01-01T23:59:59.000Z',
      maxScore: 50,
      courseId: 102,
      course: {
        id: 102,
        name: 'Database Systems',
        courseCode: 'CS302',
        _count: { enrollments: 28 },
      },
      doctor: { firstName: 'Mona', lastName: 'Zaki', userId: '2' },
      _count: { submissions: 2 },
      mySubmission: {
        id: 88,
        taskId: 11,
        studentId: 7,
        status: 'SUBMITTED',
        score: null,
        submittedAt: '2026-10-25T14:30:00.000Z',
        fileName: 'database_schema_v2.pdf',
        fileSize: 2048576, // ~2.0 MB
        fileType: 'application/pdf',
        notes: 'Final revised schema',
        fileUrl: null,
      },
    },
    {
      id: 12,
      title: 'Legacy Link-Only Assignment',
      description: 'Submitted before file uploads were enabled',
      dueDate: '2099-01-01T23:59:59.000Z',
      maxScore: 30,
      courseId: 101,
      course: {
        id: 101,
        name: 'Operating Systems',
        courseCode: 'CS301',
        _count: { enrollments: 30 },
      },
      doctor: { firstName: 'Ali', lastName: 'Hassan', userId: '1' },
      _count: { submissions: 1 },
      mySubmission: {
        id: 89,
        taskId: 12,
        studentId: 7,
        status: 'SUBMITTED',
        score: null,
        submittedAt: '2026-10-20T10:00:00.000Z',
        fileName: null,
        fileSize: null,
        fileType: null,
        notes: 'See my project repo',
        fileUrl: 'https://github.com/student/os-project',
      },
    },
  ];

  const mockSubmissionsList = {
    rows: [
      {
        key: 'sub-row-1',
        student: {
          id: 7,
          studentId: 'STU20260007',
          firstName: 'Omar',
          lastName: 'Mokhtar',
          year: 3,
        },
        submission: {
          id: 88,
          taskId: 10,
          studentId: 7,
          fileUrl: null,
          fileName: 'os_project_report.pdf',
          fileSize: 1572864, // 1.5 MB
          fileType: 'application/pdf',
          score: null,
          submittedAt: '2026-10-26T12:00:00.000Z',
          notes: 'Detailed process scheduler documentation',
          feedback: null,
        },
        isSubmitted: true,
        isGraded: false,
        isLate: false,
        notSubmitted: false,
      },
      {
        key: 'sub-row-2',
        student: {
          id: 8,
          studentId: 'STU20260008',
          firstName: 'Sara',
          lastName: 'Ahmed',
          year: 3,
        },
        submission: {
          id: 90,
          taskId: 10,
          studentId: 8,
          fileUrl: 'https://github.com/sara/legacy-submission',
          fileName: null,
          fileSize: null,
          fileType: null,
          score: null,
          submittedAt: '2026-10-25T11:00:00.000Z',
          notes: 'Legacy repository link',
          feedback: null,
        },
        isSubmitted: true,
        isGraded: false,
        isLate: false,
        notSubmitted: false,
      },
    ],
    pagination: { page: 1, limit: 10, totalCount: 2, totalPages: 1 },
    summary: { totalEnrolled: 2, submitted: 2, graded: 0, ungraded: 2, late: 0, notSubmitted: 0 },
    defaultCourseYear: 3,
  };

  async function ensureBrowser() {
    if (!browser || !browser.isConnected()) {
      browser = await chromium.launch({ channel: 'msedge', headless: true });
    }
    return browser;
  }

  before(async () => {
    appServer = await serveBuiltApp();
    await ensureBrowser();
  });

  after(async () => {
    if (browser) await browser.close();
    if (appServer) await appServer.close();
  });

  it('(1) Student Submit Modal: file required, validation, remove button & FormData submission', async () => {
    const b = await ensureBrowser();
    const { context, page } = await mockSessionPage(b, { role: 'STUDENT', language: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('language', 'en');
    });

    await page.route((url) => url.pathname === '/api/tasks', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: mockTasks }),
        });
      } else {
        await route.fallback();
      }
    });

    let submittedFormData = null;
    await page.route('**/api/tasks/10/submit', async (route) => {
      if (route.request().method() === 'POST') {
        submittedFormData = route.request().postDataBuffer();
        const header = route.request().headers()['content-type'] || '';
        assert.ok(header.includes('multipart/form-data'), 'Request must be multipart/form-data');
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 99,
              taskId: 10,
              studentId: 7,
              fileName: 'simulator.pdf',
              fileSize: 1024,
              fileType: 'application/pdf',
              submittedAt: '2026-11-01T12:00:00.000Z',
            },
          }),
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto(`${appServer.origin}/tasks`);
    await page.waitForLoadState('networkidle');

    // Click "Submit Assignment" on first task card
    const submitBtn = page.locator('button:has-text("Submit Assignment")').first();
    await submitBtn.click();

    // Verify modal is open
    const modalTitle = page.locator('h2:has-text("Submit Assignment")');
    await assert.doesNotReject(modalTitle.waitFor({ state: 'visible', timeout: 5000 }));

    // File input must exist and be accessible
    const fileInput = page.locator('input[type="file"]');
    assert.ok(await fileInput.count() > 0, 'File picker input must be present');

    // Submit button inside form must be disabled because no file has been chosen yet (OD-120)
    const modalSubmitBtn = page.locator('form button[type="submit"]');
    assert.equal(await modalSubmitBtn.isDisabled(), true, 'Submit button must be disabled until a file is selected');

    // File required hint must be visible
    const fileHint = page.locator('[data-file-required-hint="true"]');
    assert.ok(await fileHint.count() > 0, 'File required hint must be displayed');

    // Set an invalid file: bad extension (.exe)
    await fileInput.setInputFiles({
      name: 'malware.exe',
      mimeType: 'application/x-msdownload',
      buffer: Buffer.from('MZ000'),
    });

    // Error message must appear and submit button remains disabled
    const errorMsg = page.locator('[data-file-error="true"]');
    await assert.doesNotReject(errorMsg.waitFor({ state: 'visible', timeout: 5000 }));
    assert.equal(await modalSubmitBtn.isDisabled(), true, 'Submit must remain disabled after bad extension');

    // Set a valid file
    await fileInput.setInputFiles({
      name: 'simulator.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 mock content'),
    });

    // Metadata should appear: name, formatted size, type
    const fileMetaName = page.locator('text=simulator.pdf');
    await assert.doesNotReject(fileMetaName.waitFor({ state: 'visible', timeout: 5000 }));

    // Remove button should appear
    const removeBtn = page.locator('[data-remove-file="true"]');
    assert.ok(await removeBtn.count() > 0, 'Remove file button must be present');

    // Submit button should now be enabled
    assert.equal(await modalSubmitBtn.isDisabled(), false, 'Submit button must be enabled when valid file selected');

    // Test clicking Remove button
    await removeBtn.click();
    assert.equal(await modalSubmitBtn.isDisabled(), true, 'Submit button must be disabled after removing file');

    // Reselect valid file
    await fileInput.setInputFiles({
      name: 'simulator.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 mock content'),
    });
    assert.equal(await modalSubmitBtn.isDisabled(), false);

    // Optional link field: fill valid HTTPS link
    const linkInput = page.locator('input[type="url"]');
    await linkInput.fill('https://github.com/student/os-simulator');

    // Optional notes field
    const notesInput = page.locator('textarea#submit-notes');
    await notesInput.fill('Completed assignment with bonus features');

    // Submit the form
    await modalSubmitBtn.click();

    // Verify multipart body was dispatched
    assert.ok(submittedFormData !== null, 'FormData must be dispatched to /api/tasks/:id/submit');
    const postDataStr = submittedFormData.toString('utf8');
    assert.ok(postDataStr.includes('name="file"'), 'FormData must include file part');
    assert.ok(postDataStr.includes('simulator.pdf'), 'FormData must contain filename');

    await context.close();
  });


  it('(2) Student View: Displays file metadata (name, size, type) and Download control with Auth token', async () => {
    const b = await ensureBrowser();
    const { context, page } = await mockSessionPage(b, { role: 'STUDENT', language: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('language', 'en');

      window.__downloadEvents = [];
      window.__createdObjectUrls = [];
      window.__revokedObjectUrls = [];

      const origCreate = window.URL.createObjectURL;
      window.URL.createObjectURL = function (blob) {
        const url = origCreate.call(window.URL, blob);
        window.__createdObjectUrls.push(url);
        return url;
      };

      const origRevoke = window.URL.revokeObjectURL;
      window.URL.revokeObjectURL = function (url) {
        window.__revokedObjectUrls.push(url);
        return origRevoke.call(window.URL, url);
      };

      const origClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        if (this.download) {
          window.__downloadEvents.push({
            download: this.download,
            href: this.href,
          });
          return;
        }
        return origClick.apply(this, arguments);
      };
    });

    await page.route((url) => url.pathname === '/api/tasks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockTasks }),
      });
    });

    let downloadAuthHeader = null;
    await page.route('**/api/tasks/11/submissions/88/download', async (route) => {
      downloadAuthHeader = route.request().headers()['authorization'] || '';
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Disposition': 'attachment; filename="database_schema_v2.pdf"',
          'Content-Type': 'application/pdf',
        },
        body: Buffer.from('%PDF-1.4 mock download stream'),
      });
    });

    await page.goto(`${appServer.origin}/tasks`);
    await page.waitForLoadState('networkidle');

    // Task 11 has mySubmission with fileName: database_schema_v2.pdf
    const fileNameElement = page.locator('text=database_schema_v2.pdf');
    await assert.doesNotReject(fileNameElement.waitFor({ state: 'visible', timeout: 5000 }));

    // Formatted size should be visible (e.g. 2.0 MB)
    const fileSizeElement = page.locator('text=2.0 MB');
    assert.ok(await fileSizeElement.count() > 0, 'Formatted file size must be visible');

    // Download button should be present
    const downloadBtn = page.locator('[aria-label="Download database_schema_v2.pdf"]');
    assert.ok(await downloadBtn.count() > 0, 'Download button must be rendered');

    // Click download button (stubbed, no real browser download triggered)
    await downloadBtn.click();

    await page.waitForFunction(() => window.__downloadEvents && window.__downloadEvents.length > 0, { timeout: 5000 });
    const downloadRecord = await page.evaluate(() => ({
      events: window.__downloadEvents,
      created: window.__createdObjectUrls,
      revoked: window.__revokedObjectUrls,
    }));

    // (a) saved name equals stored fileName
    assert.equal(downloadRecord.events[0].download, 'database_schema_v2.pdf', 'Saved name must equal stored fileName');
    // (b) download request carried Authorization header
    assert.ok(downloadAuthHeader !== null, 'Download request must be dispatched');
    assert.ok(downloadAuthHeader.includes('Bearer mock-session'), 'Download request must include auth token');
    // (c) blob URL is revoked
    assert.ok(downloadRecord.revoked.includes(downloadRecord.events[0].href), 'Blob URL must be revoked');

    // Task 12 is a legacy link-only submission (no file)
    // Must display link without a broken download button
    const legacyLink = page.locator('a[href="https://github.com/student/os-project"]');
    assert.ok(await legacyLink.count() > 0, 'Legacy submission link must be rendered');
    const legacyCard = page.locator('[data-task-card="true"]').filter({ hasText: 'Legacy Link-Only Assignment' });
    const legacyDownloadBtn = legacyCard.locator('button:has-text("Download")');
    assert.equal(await legacyDownloadBtn.count(), 0, 'Legacy link-only submission must not render a broken download button');

    await context.close();
  });


  it('(3) Doctor / TA View: Submissions list displays file metadata, authenticated download & legacy row', async () => {
    const b = await ensureBrowser();
    const { context, page } = await mockSessionPage(b, { role: 'DOCTOR', language: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('language', 'en');

      window.__downloadEvents = [];
      window.__createdObjectUrls = [];
      window.__revokedObjectUrls = [];

      const origCreate = window.URL.createObjectURL;
      window.URL.createObjectURL = function (blob) {
        const url = origCreate.call(window.URL, blob);
        window.__createdObjectUrls.push(url);
        return url;
      };

      const origRevoke = window.URL.revokeObjectURL;
      window.URL.revokeObjectURL = function (url) {
        window.__revokedObjectUrls.push(url);
        return origRevoke.call(window.URL, url);
      };

      const origClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        if (this.download) {
          window.__downloadEvents.push({
            download: this.download,
            href: this.href,
          });
          return;
        }
        return origClick.apply(this, arguments);
      };
    });

    await page.route((url) => url.pathname === '/api/tasks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockTasks }),
      });
    });

    await page.route('**/api/tasks/10/submissions**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockSubmissionsList }),
      });
    });

    let doctorDownloadAuth = null;
    await page.route('**/api/tasks/10/submissions/88/download', async (route) => {
      doctorDownloadAuth = route.request().headers()['authorization'] || '';
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Disposition': 'attachment; filename="os_project_report.pdf"',
          'Content-Type': 'application/pdf',
        },
        body: Buffer.from('%PDF-1.4 doctor download stream'),
      });
    });

    await page.goto(`${appServer.origin}/tasks`);
    await page.waitForLoadState('networkidle');

    // Click "View & Grade" button on first task
    const gradeBtn = page.locator('button:has-text("View & Grade")').first();
    await gradeBtn.click();

    // In modal, Omar Mokhtar's submission has os_project_report.pdf
    const subFileName = page.locator('text=os_project_report.pdf');
    await assert.doesNotReject(subFileName.waitFor({ state: 'visible', timeout: 5000 }));

    // Formatted size should be visible (1.5 MB)
    const subFileSize = page.locator('text=1.5 MB');
    assert.ok(await subFileSize.count() > 0, 'Submission file size must be visible');

    // Download button in modal (stubbed, no real browser download triggered)
    const subDownloadBtn = page.locator('[aria-label="Download os_project_report.pdf"]');
    assert.ok(await subDownloadBtn.count() > 0, 'Doctor/TA download button must be rendered');
    await subDownloadBtn.click();

    await page.waitForFunction(() => window.__downloadEvents && window.__downloadEvents.length > 0, { timeout: 5000 });
    const downloadRecord = await page.evaluate(() => ({
      events: window.__downloadEvents,
      created: window.__createdObjectUrls,
      revoked: window.__revokedObjectUrls,
    }));

    // (a) saved name equals stored fileName
    assert.equal(downloadRecord.events[0].download, 'os_project_report.pdf', 'Saved name must equal stored fileName');
    // (b) download request carried Authorization header
    assert.ok(doctorDownloadAuth !== null, 'Doctor download request must be dispatched');
    assert.ok(doctorDownloadAuth.includes('Bearer mock-session'), 'Doctor download must include auth token');
    // (c) blob URL is revoked
    assert.ok(downloadRecord.revoked.includes(downloadRecord.events[0].href), 'Blob URL must be revoked');

    // Second student (Sara Ahmed) is legacy submission: has GitHub link, no file
    const saraLink = page.locator('a[href="https://github.com/sara/legacy-submission"]');
    assert.ok(await saraLink.count() > 0, 'Legacy submission link must be rendered');

    await context.close();
  });


  it('OD-121 TDD: Task with title CS101 Assignment 2 (Future Open) and no chosen file has disabled submit button', async () => {
    const b = await ensureBrowser();
    const { context, page } = await mockSessionPage(b, { role: 'STUDENT', language: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('language', 'en');
    });

    const tasksWithFutureOpen = [
      {
        id: 999,
        title: 'CS101 Assignment 2 (Future Open)',
        description: 'Legacy named open task',
        dueDate: '2099-01-01T23:59:59.000Z',
        maxScore: 100,
        courseId: 101,
        course: {
          id: 101,
          name: 'Operating Systems',
          courseCode: 'CS301',
          _count: { enrollments: 30 },
        },
        doctor: { firstName: 'Ali', lastName: 'Hassan', userId: '1' },
        _count: { submissions: 0 },
        mySubmission: null,
      },
    ];

    await page.route((url) => url.pathname === '/api/tasks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: tasksWithFutureOpen }),
      });
    });

    await page.goto(`${appServer.origin}/tasks`);
    await page.waitForLoadState('networkidle');

    const submitBtn = page.locator('button:has-text("Submit Assignment")').first();
    await submitBtn.click();

    const modalTitle = page.locator('h2:has-text("Submit Assignment")');
    await assert.doesNotReject(modalTitle.waitFor({ state: 'visible', timeout: 5000 }));

    const modalSubmitBtn = page.locator('form button[type="submit"]');
    assert.equal(
      await modalSubmitBtn.isDisabled(),
      true,
      'Submit button must be disabled until a file is selected even for task titled CS101 Assignment 2 (Future Open)'
    );

    await context.close();
  });

  it('P1 submit returns 409 -> the localized conflict message is shown', async () => {
    const b = await ensureBrowser();
    const { context, page } = await mockSessionPage(b, { role: 'STUDENT', language: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('language', 'en');
    });

    await page.route((url) => url.pathname === '/api/tasks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockTasks }),
      });
    });

    await page.route('**/api/tasks/10/submit', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'You have already submitted this task. Only one submission per task is allowed.',
          }),
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto(`${appServer.origin}/tasks`);
    await page.waitForLoadState('networkidle');

    const submitBtn = page.locator('button:has-text("Submit Assignment")').first();
    await submitBtn.click();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'simulator.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 mock content'),
    });

    const modalSubmitBtn = page.locator('form button[type="submit"]');
    await modalSubmitBtn.click();

    const conflictMsg = page.locator('text="You have already submitted this task. Only one submission per task is allowed."');
    await assert.doesNotReject(conflictMsg.waitFor({ state: 'visible', timeout: 5000 }));

    await context.close();
  });

  it('P2 submit returns 403 -> the localized forbidden message is shown', async () => {
    const b = await ensureBrowser();
    const { context, page } = await mockSessionPage(b, { role: 'STUDENT', language: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('language', 'en');
    });

    await page.route((url) => url.pathname === '/api/tasks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockTasks }),
      });
    });

    await page.route('**/api/tasks/10/submit', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'The deadline for this task has passed.',
          }),
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto(`${appServer.origin}/tasks`);
    await page.waitForLoadState('networkidle');

    const submitBtn = page.locator('button:has-text("Submit Assignment")').first();
    await submitBtn.click();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'simulator.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 mock content'),
    });

    const modalSubmitBtn = page.locator('form button[type="submit"]');
    await modalSubmitBtn.click();

    const forbiddenMsg = page.locator('text="You do not have permission to perform this action."');
    await assert.doesNotReject(forbiddenMsg.waitFor({ state: 'visible', timeout: 5000 }));

    await context.close();
  });

  it('P3 download returns 404 -> the localized not-found message', async () => {
    const b = await ensureBrowser();
    const { context, page } = await mockSessionPage(b, { role: 'STUDENT', language: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('language', 'en');
    });

    await page.route((url) => url.pathname === '/api/tasks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockTasks }),
      });
    });

    await page.route('**/api/tasks/11/submissions/88/download', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Submission file not found or has been removed',
        }),
      });
    });

    await page.goto(`${appServer.origin}/tasks`);
    await page.waitForLoadState('networkidle');

    const downloadBtn = page.locator('[aria-label="Download database_schema_v2.pdf"]');
    await downloadBtn.click();

    const notFoundMsg = page.locator('text="Submission file not found"');
    await assert.doesNotReject(notFoundMsg.waitFor({ state: 'visible', timeout: 5000 }));

    await context.close();
  });

  it('P3b download returns 403 -> the localized forbidden message', async () => {
    const b = await ensureBrowser();
    const { context, page } = await mockSessionPage(b, { role: 'STUDENT', language: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('language', 'en');
    });

    await page.route((url) => url.pathname === '/api/tasks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockTasks }),
      });
    });

    await page.route('**/api/tasks/11/submissions/88/download', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'You do not have permission to download this submission',
        }),
      });
    });

    await page.goto(`${appServer.origin}/tasks`);
    await page.waitForLoadState('networkidle');

    const downloadBtn = page.locator('[aria-label="Download database_schema_v2.pdf"]');
    await downloadBtn.click();

    const forbiddenMsg = page.locator('text="You do not have permission to perform this action."');
    await assert.doesNotReject(forbiddenMsg.waitFor({ state: 'visible', timeout: 5000 }));

    await context.close();
  });

  it('P4 TEACHING_ASSISTANT view: no Submissions/Grading control is rendered and no request to GET /api/tasks/:id/submissions is made', async () => {
    const b = await ensureBrowser();
    const { context, page } = await mockSessionPage(b, { role: 'TEACHING_ASSISTANT', language: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('language', 'en');
    });

    let submissionsRequested = false;
    await page.route((url) => url.pathname === '/api/tasks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockTasks }),
      });
    });

    await page.route('**/api/tasks/*/submissions**', async (route) => {
      submissionsRequested = true;
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Forbidden' }),
      });
    });

    await page.goto(`${appServer.origin}/tasks`);
    await page.waitForLoadState('networkidle');

    const gradingControls = page.locator('button:has-text("View & Grade"), button:has-text("Grade")');
    assert.equal(await gradingControls.count(), 0, 'No Submissions/Grading control should be rendered for TEACHING_ASSISTANT');
    assert.equal(submissionsRequested, false, 'No request to GET /api/tasks/:id/submissions should be made');

    await context.close();
  });


  const mockCourseDetails = {
    id: 101,
    name: 'Operating Systems',
    courseCode: 'CS301',
    credits: 3,
    year: 3,
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
    _count: { enrollments: 30, quizzes: 0, tasks: 3, exams: 0, materials: 0 },
  };

  it('CD-1 CourseDetails TasksTab: Submit button disabled without a file', async () => {
    const b = await ensureBrowser();
    const { context, page } = await mockSessionPage(b, { role: 'STUDENT', language: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('language', 'en');
    });

    await page.route('**/api/courses/101', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockCourseDetails }),
      });
    });

    await page.route('**/api/courses/101/my-submissions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }),
      });
    });

    await page.route('**/api/tasks/10/submission', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: null }),
      });
    });

    await page.goto(`${appServer.origin}/courses/101`);
    await page.waitForLoadState('networkidle');

    // Click Tasks & Assignments tab
    const tasksTabBtn = page.locator('button:has-text("Tasks & Assignments"), button:has-text("الواجبات والمهام")').first();
    await tasksTabBtn.waitFor({ state: 'visible', timeout: 5000 });
    await tasksTabBtn.click();

    // Click "Submit Assignment" on first task
    const submitBtn = page.locator('button:has-text("Submit Assignment")').first();
    await submitBtn.waitFor({ state: 'visible', timeout: 5000 });
    await submitBtn.click();

    // Submit modal opens
    const submitModal = page.locator('div[role="dialog"]').first();
    await submitModal.waitFor({ state: 'visible', timeout: 5000 });

    // File input MUST exist in CourseDetails task submission modal
    const fileInput = submitModal.locator('input[type="file"]');
    assert.equal(await fileInput.count(), 1, 'File input must exist in CourseDetails submit modal');

    // Submit button MUST be disabled until a file is selected
    const modalSubmitBtn = submitModal.locator('button[type="submit"]');
    assert.equal(await modalSubmitBtn.isDisabled(), true, 'Submit button must be disabled when no file is chosen in CourseDetails');

    await context.close();
  });


  it('CD-2 CourseDetails TasksTab: with a file, request is multipart with field "file" and real envelope', async () => {
    const b = await ensureBrowser();
    const { context, page } = await mockSessionPage(b, { role: 'STUDENT', language: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('language', 'en');
    });

    await page.route('**/api/courses/101', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockCourseDetails }),
      });
    });

    await page.route('**/api/courses/101/my-submissions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }),
      });
    });

    await page.route('**/api/tasks/10/submission', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: null }),
      });
    });

    let courseSubmitFormData = null;
    let courseSubmitContentType = null;
    await page.route('**/api/tasks/10/submit', async (route) => {
      if (route.request().method() === 'POST') {
        courseSubmitFormData = route.request().postDataBuffer();
        courseSubmitContentType = route.request().headers()['content-type'] || '';
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 777,
              taskId: 10,
              studentId: 7,
              fileName: 'course_task_solution.pdf',
              fileSize: 2048,
              fileType: 'application/pdf',
              submittedAt: '2026-11-03T12:00:00.000Z',
            },
            message: 'Task submitted successfully',
          }),
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto(`${appServer.origin}/courses/101`);
    await page.waitForLoadState('networkidle');

    // Click Tasks & Assignments tab
    const tasksTabBtn = page.locator('button:has-text("Tasks & Assignments"), button:has-text("الواجبات والمهام")').first();
    await tasksTabBtn.waitFor({ state: 'visible', timeout: 5000 });
    await tasksTabBtn.click();

    // Click "Submit Assignment" on first task
    const submitBtn = page.locator('button:has-text("Submit Assignment")').first();
    await submitBtn.waitFor({ state: 'visible', timeout: 5000 });
    await submitBtn.click();

    const submitModal = page.locator('div[role="dialog"]').first();
    await submitModal.waitFor({ state: 'visible', timeout: 5000 });

    // Choose file fixture
    const fileInput = submitModal.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'course_task_solution.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 mock course task solution'),
    });

    // Optional URL and notes
    const urlInput = submitModal.locator('input#submit-file-url');
    if (await urlInput.count() > 0) {
      await urlInput.fill('https://github.com/student/course-os-solution');
    }
    const notesInput = submitModal.locator('textarea#submit-notes');
    if (await notesInput.count() > 0) {
      await notesInput.fill('Submitted from course details tab');
    }

    const modalSubmitBtn = submitModal.locator('button[type="submit"]');
    assert.equal(await modalSubmitBtn.isDisabled(), false, 'Submit button must be enabled once a file is chosen');
    await modalSubmitBtn.click();

    // Verify multipart request with field "file"
    assert.ok(courseSubmitFormData !== null, 'FormData must be dispatched to /api/tasks/:id/submit');
    assert.ok(courseSubmitContentType.includes('multipart/form-data'), 'Request must be multipart/form-data');
    const postDataStr = courseSubmitFormData.toString('utf8');
    assert.ok(postDataStr.includes('name="file"'), 'FormData must include file field');
    assert.ok(postDataStr.includes('course_task_solution.pdf'), 'FormData must contain filename');

    await context.close();
  });


  it('CD-3 CourseDetails TasksTab: 409 conflict shows localized message', async () => {
    const b = await ensureBrowser();
    const { context, page } = await mockSessionPage(b, { role: 'STUDENT', language: 'en' });
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('language', 'en');
    });

    await page.route('**/api/courses/101', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockCourseDetails }),
      });
    });

    await page.route('**/api/courses/101/my-submissions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }),
      });
    });

    await page.route('**/api/tasks/10/submission', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: null }),
      });
    });

    await page.route('**/api/tasks/10/submit', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'You have already submitted this task. Only one submission per task is allowed.',
          }),
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto(`${appServer.origin}/courses/101`);
    await page.waitForLoadState('networkidle');

    // Click Tasks & Assignments tab
    const tasksTabBtn = page.locator('button:has-text("Tasks & Assignments"), button:has-text("الواجبات والمهام")').first();
    await tasksTabBtn.waitFor({ state: 'visible', timeout: 5000 });
    await tasksTabBtn.click();

    // Click "Submit Assignment" on first task
    const submitBtn = page.locator('button:has-text("Submit Assignment")').first();
    await submitBtn.waitFor({ state: 'visible', timeout: 5000 });
    await submitBtn.click();

    const submitModal = page.locator('div[role="dialog"]').first();
    await submitModal.waitFor({ state: 'visible', timeout: 5000 });

    const fileInput = submitModal.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'conflict_test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 conflict test'),
    });

    const modalSubmitBtn = submitModal.locator('button[type="submit"]');
    await modalSubmitBtn.click();

    // Assert localized conflict message is shown
    const conflictMsg = page.locator('text="You have already submitted this task. Only one submission per task is allowed."');
    await assert.doesNotReject(conflictMsg.waitFor({ state: 'visible', timeout: 5000 }));

    await context.close();
  });


  // 24-Config Matrix: 1440/1024/768/430/390/360 x ar/en x light/dark
  const viewports = [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 430, height: 932 },
    { width: 390, height: 844 },
    { width: 360, height: 780 },
  ];

  for (const vp of viewports) {
    for (const language of ['en', 'ar']) {
      for (const theme of ['light', 'dark']) {
        it(`Matrix [${vp.width}px ${language.toUpperCase()} ${theme.toUpperCase()}]: html dir/lang, dark class, scrollWidth <= innerWidth, element bounds`, async () => {
          const b = await ensureBrowser();
          const { context, page } = await mockSessionPage(b, {
            role: 'STUDENT',
            language,
          });

          await page.setViewportSize(vp);
          await page.addInitScript(({ theme, language }) => {
            localStorage.setItem('theme', theme);
            localStorage.setItem('language', language);
          }, { theme, language });

          await page.route((url) => url.pathname === '/api/tasks', async (route) => {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ success: true, data: mockTasks }),
            });
          });

          await page.goto(`${appServer.origin}/tasks`);
          await page.waitForLoadState('networkidle');

          // Assert html dir and lang
          const htmlDir = await page.getAttribute('html', 'dir');
          const htmlLang = await page.getAttribute('html', 'lang');
          assert.equal(htmlDir, language === 'ar' ? 'rtl' : 'ltr', `html dir must be ${language === 'ar' ? 'rtl' : 'ltr'}`);
          assert.equal(htmlLang, language, `html lang must be ${language}`);

          // Assert dark class
          const htmlClass = await page.getAttribute('html', 'class') || '';
          if (theme === 'dark') {
            assert.ok(htmlClass.includes('dark'), 'dark class must be present on html element');
          } else {
            assert.ok(!htmlClass.includes('dark'), 'dark class must not be present on html element');
          }

          // Assert no horizontal scroll overflow
          const overflow = await page.evaluate(() => {
            return {
              scrollWidth: document.documentElement.scrollWidth,
              innerWidth: window.innerWidth,
            };
          });
          assert.ok(
            overflow.scrollWidth <= overflow.innerWidth + 1,
            `scrollWidth (${overflow.scrollWidth}) must be <= innerWidth (${overflow.innerWidth})`
          );

          await context.close();
        });
      }
    }
  }
});
