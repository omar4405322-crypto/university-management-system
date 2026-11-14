import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

/*
Verified API routes & envelopes from artifacts/api-server/src:
1. GET /api/tasks
   Route: artifacts/api-server/src/routes/task.routes.ts:29-62 -> router.get('/', ..., getTasks)
   Envelope: { success: true, data: TaskItem[] }
2. GET /api/courses
   Route: artifacts/api-server/src/routes/courses.routes.ts:18 -> router.get('/', coursesController.getAllCourses)
   Envelope: { success: true, data: CourseItem[] }
3. GET /api/courses/:id
   Route: artifacts/api-server/src/routes/courses.routes.ts:71 -> router.get('/:id', ..., coursesController.getCourseById)
   Envelope: { success: true, data: CourseDetailsData }
4. GET /api/tasks/:id/submissions
   Route: artifacts/api-server/src/routes/task.routes.ts:116-140 -> authorize('DOCTOR', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN')
   Envelope: { success: true, data: { rows: [], pagination: { page: 1, limit: 25, totalCount: 0, totalPages: 1 }, summary: { totalEnrolled: 0, submitted: 0, graded: 0, ungraded: 0, late: 0, notSubmitted: 0 } } }
5. GET /api/tasks/:id/similarity-flags
   Route: artifacts/api-server/src/routes/task.routes.ts:150-154 -> authorize('DOCTOR', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN')
   Controller: artifacts/api-server/src/controllers/submissionSimilarity.controller.ts:14 -> { success: true, data: flags }
   Error (403/404): { success: false, status: 'fail', message, errorId }
6. PATCH /api/tasks/:id/similarity-flags/:flagId
   Route: artifacts/api-server/src/routes/task.routes.ts:156-160 -> authorize('DOCTOR', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN')
   Body strict (artifacts/api-server/src/services/submissionSimilarity.service.ts:13-24): { decision: 'CONFIRMED' | 'DISMISSED', note?: string (<=1000) }
   Controller: artifacts/api-server/src/controllers/submissionSimilarity.controller.ts:35 -> { success: true, data: updated }
   Errors (403/404/409/422): { success: false, status: 'fail', message, errorId }
7. POST /api/tasks/:id/submit
   Route: artifacts/api-server/src/routes/task.routes.ts:86-93 -> authorize('STUDENT')
   409 DUPLICATE_SUBMISSION (artifacts/api-server/src/controllers/task.controller.ts:154-162): { success: false, code: 'DUPLICATE_SUBMISSION', message }
   409 already submitted (artifacts/api-server/src/controllers/task.controller.ts:173-177): { success: false, status: 'fail', message, errorId }
8. GET /api/tasks/:id/submission
   Route: artifacts/api-server/src/routes/task.routes.ts:142-148 -> authorize('STUDENT')
*/

const MOCK_TASK = {
  id: 10,
  title: 'Distributed Systems Report',
  description: 'Analyze consensus protocols and submit PDF report',
  dueDate: '2099-01-01T23:59:59.000Z',
  maxScore: 100,
  courseId: 101,
  course: {
    id: 101,
    name: 'Distributed Systems',
    courseCode: 'CS401',
    year: 4,
    _count: { enrollments: 25 },
  },
  doctor: { firstName: 'Ali', lastName: 'Hassan', userId: '1' },
  _count: { submissions: 4 },
  mySubmission: null,
};

const MOCK_COURSE_DETAILS = {
  id: 101,
  name: 'Distributed Systems',
  courseCode: 'CS401',
  year: 4,
  semester: 1,
  credits: 3,
  isPublished: true,
  department: { id: 1, name: 'Computer Science', college: { id: 1, name: 'Engineering' } },
  scheduleSlots: [
    {
      id: 1,
      dayOfWeek: 'SUNDAY',
      startTime: '09:00',
      endTime: '11:00',
      slotType: 'LECTURE',
      doctor: { id: 5, firstName: 'Ali', lastName: 'Hassan', doctorId: 'DOC-005' },
      teachingAssistant: { id: 9, firstName: 'Mona', lastName: 'Adel', employeeId: 'TA-009' },
      room: 'Hall A',
    },
  ],
  sections: [],
  materials: [],
  enrollments: [],
  tasks: [
    {
      id: 10,
      title: 'Distributed Systems Report',
      description: 'Analyze consensus protocols and submit PDF report',
      dueDate: '2099-01-01T23:59:59.000Z',
      maxScore: 100,
      courseId: 101,
      _count: { submissions: 4 },
    },
  ],
  _count: { enrollments: 25 },
};

const EMPTY_SUBMISSIONS_RESPONSE = {
  rows: [
    {
      key: 'row-1',
      student: { id: 7, studentId: 'STU-2026-007', firstName: 'Omar', lastName: 'Mokhtar', year: 4 },
      submission: {
        id: 201,
        studentId: 7,
        fileUrl: null,
        fileName: 'raft_report_omar.pdf',
        fileSize: 102400,
        fileType: 'application/pdf',
        score: null,
        submittedAt: '2026-10-15T10:30:00.000Z',
        notes: null,
        feedback: null,
      },
      isSubmitted: true,
      isGraded: false,
      isLate: false,
      notSubmitted: false,
    },
  ],
  pagination: { page: 1, limit: 25, totalCount: 1, totalPages: 1 },
  summary: { totalEnrolled: 1, submitted: 1, graded: 0, ungraded: 1, late: 0, notSubmitted: 0 },
};

function makeFlagsFixture() {
  return [
    {
      id: 'flag-1',
      status: 'PENDING',
      similarityScore: 0.912,
      thresholdUsed: 0.75,
      createdAt: '2026-10-15T11:00:00.000Z',
      reviewedById: null,
      reviewedAt: null,
      reviewNote: null,
      submissionA: {
        submissionId: 201,
        studentId: 'STU-2026-007',
        studentName: 'Omar Mokhtar',
        fileName: 'raft_report_omar.pdf',
        submittedAt: '2026-10-15T10:30:00.000Z',
      },
      submissionB: {
        submissionId: 202,
        studentId: 'STU-2026-008',
        studentName: 'Sara Ahmed',
        fileName: 'raft_report_sara.pdf',
        submittedAt: '2026-10-15T10:45:00.000Z',
      },
    },
    {
      id: 'flag-2',
      status: 'PENDING',
      similarityScore: 0.84,
      thresholdUsed: 0.75,
      createdAt: '2026-10-15T11:15:00.000Z',
      reviewedById: null,
      reviewedAt: null,
      reviewNote: null,
      submissionA: {
        submissionId: 203,
        studentId: 'STU-2026-009',
        studentName: 'Youssef Karim',
        fileName: 'consensus_v1.docx',
        submittedAt: '2026-10-15T09:10:00.000Z',
      },
      submissionB: {
        submissionId: 204,
        studentId: 'STU-2026-010',
        studentName: 'Nour Ibrahim',
        fileName: 'consensus_final.docx',
        submittedAt: '2026-10-15T09:25:00.000Z',
      },
    },
    {
      id: 'flag-3',
      status: 'CONFIRMED',
      similarityScore: 0.965,
      thresholdUsed: 0.75,
      createdAt: '2026-10-14T14:00:00.000Z',
      reviewedById: 1,
      reviewedAt: '2026-10-14T15:20:00.000Z',
      reviewNote: 'Confirmed copied section 3',
      submissionA: {
        submissionId: 205,
        studentId: 'STU-2026-011',
        studentName: 'Khaled Mansour',
        fileName: 'paxos_a.pdf',
        submittedAt: '2026-10-14T12:00:00.000Z',
      },
      submissionB: {
        submissionId: 206,
        studentId: 'STU-2026-012',
        studentName: 'Laila Samir',
        fileName: 'paxos_b.pdf',
        submittedAt: '2026-10-14T12:15:00.000Z',
      },
    },
  ];
}

describe('WP5-T6c-2 Browser Suite: Similarity Flag Review UI, Duplicate 409 Toast & Role Visibility', () => {
  let appServer;
  let browser;

  before(async () => {
    appServer = await serveBuiltApp();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  });

  after(async () => {
    if (browser) await browser.close();
    if (appServer) await appServer.close();
  });

  async function openSession({
    role = 'DOCTOR',
    language = 'en',
    theme = 'light',
    viewport = { width: 1280, height: 800 },
    user = {},
  } = {}) {
    const { context, page } = await mockSessionPage(browser, { role, language, user });
    await page.setViewportSize(viewport);
    await page.addInitScript(
      ({ theme, language }) => {
        localStorage.setItem('theme', theme);
        localStorage.setItem('language', language);
      },
      { theme, language }
    );
    return { context, page };
  }

  async function setupTasksPageRoutes(page, { flagsHandler, patchHandler, submitHandler } = {}) {
    await page.route((url) => url.pathname === '/api/tasks', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [MOCK_TASK] }),
        });
        return;
      }
      await route.abort();
    });

    await page.route((url) => url.pathname === '/api/courses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [MOCK_TASK.course] }),
      });
    });

    await page.route((url) => url.pathname === '/api/tasks/10/submissions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: EMPTY_SUBMISSIONS_RESPONSE }),
      });
    });

    await page.route((url) => url.pathname === '/api/tasks/10/similarity-flags', async (route) => {
      if (flagsHandler) {
        await flagsHandler(route);
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: makeFlagsFixture() }),
      });
    });

    await page.route((url) => /^\/api\/tasks\/10\/similarity-flags\/[^/]+$/.test(url.pathname), async (route) => {
      if (patchHandler) {
        await patchHandler(route);
        return;
      }
      await route.abort();
    });

    if (submitHandler) {
      await page.route((url) => url.pathname === '/api/tasks/10/submit', submitHandler);
    }
  }

  async function openSubmissionsModalOnTasks(page) {
    await page.goto(`${appServer.origin}/tasks`, { waitUntil: 'networkidle' });
    const viewBtn = page.locator('button:has-text("View & Grade"), button:has-text("معاينة ورصد")').first();
    await viewBtn.waitFor({ state: 'visible', timeout: 8000 });
    await viewBtn.click();
    const dialog = page.locator('div[role="dialog"]').first();
    await dialog.waitFor({ state: 'visible', timeout: 8000 });
    return dialog;
  }

  async function switchToSimilarityTab(dialog) {
    const simTab = dialog.locator('#submissions-modal-tab-similarity');
    await simTab.waitFor({ state: 'visible', timeout: 5000 });
    await simTab.click();
    const panel = dialog.getByTestId('similarity-flags-panel');
    await panel.waitFor({ state: 'visible', timeout: 5000 });
    return { simTab, panel };
  }

  it('P1: DOCTOR opens modal -> tab present, exactly 1 GET similarity-flags, pending badge count, and empty state on empty list', async () => {
    const { context, page } = await openSession({ role: 'DOCTOR', language: 'en', theme: 'light' });
    try {
      let getCount = 0;
      await setupTasksPageRoutes(page, {
        flagsHandler: async (route) => {
          getCount += 1;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: makeFlagsFixture() }),
          });
        },
      });

      const dialog = await openSubmissionsModalOnTasks(page);
      const subTab = dialog.locator('#submissions-modal-tab-submissions');
      const simTab = dialog.locator('#submissions-modal-tab-similarity');
      const badge = dialog.getByTestId('similarity-flags-pending-badge');

      await subTab.waitFor({ state: 'visible', timeout: 5000 });
      await simTab.waitFor({ state: 'visible', timeout: 5000 });
      await badge.waitFor({ state: 'visible', timeout: 5000 });

      assert.equal(await subTab.getAttribute('role'), 'tab');
      assert.equal(await subTab.getAttribute('aria-selected'), 'true');
      assert.equal(await simTab.getAttribute('aria-selected'), 'false');
      assert.equal((await badge.textContent())?.trim(), '2');
      assert.equal(getCount, 1, 'Must issue exactly 1 GET similarity-flags on modal open');

      await simTab.click();
      const panel = dialog.getByTestId('similarity-flags-panel');
      await panel.waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(getCount, 1, 'Switching to Similarity Flags tab must not issue another GET');
    } finally {
      await context.close();
    }

    // Empty list check
    const emptySession = await openSession({ role: 'DOCTOR', language: 'en', theme: 'light' });
    try {
      let emptyGetCount = 0;
      await setupTasksPageRoutes(emptySession.page, {
        flagsHandler: async (route) => {
          emptyGetCount += 1;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: [] }),
          });
        },
      });
      const dialog = await openSubmissionsModalOnTasks(emptySession.page);
      const badge = dialog.getByTestId('similarity-flags-pending-badge');
      await badge.waitFor({ state: 'visible', timeout: 5000 });
      assert.equal((await badge.textContent())?.trim(), '0');
      const { panel } = await switchToSimilarityTab(dialog);
      await panel.getByTestId('similarity-flags-empty').waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(emptyGetCount, 1);
    } finally {
      await emptySession.context.close();
    }
  });

  it('P2: Populated list shows whitelisted fields, bdi[dir="ltr"] for studentId/fileName, .tabular-nums, and NEVER renders fileHash/storageKey/path', async () => {
    const { context, page } = await openSession({ role: 'DOCTOR', language: 'en', theme: 'light' });
    try {
      const secretHash = 'deadbeefcafe1234567890secretfilehash';
      const secretStorageKey = 'tasks/secret-storage-key-999.pdf';
      const secretPath = '/var/private/uploads/tasks/hidden-path.pdf';

      await setupTasksPageRoutes(page, {
        flagsHandler: async (route) => {
          const base = makeFlagsFixture();
          const contaminated = [
            {
              ...base[0],
              fileHash: secretHash,
              fileHashA: secretHash,
              fileHashB: 'another-hash-secret',
              storageKey: secretStorageKey,
              path: secretPath,
              submissionA: {
                ...base[0].submissionA,
                fileHash: secretHash,
                storageKey: secretStorageKey,
                filePath: secretPath,
              },
              submissionB: {
                ...base[0].submissionB,
                fileHash: 'hash-b-secret',
                storageKey: 'tasks/key-b.pdf',
                path: '/secret/b/path.pdf',
              },
            },
          ];
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: contaminated }),
          });
        },
      });

      const dialog = await openSubmissionsModalOnTasks(page);
      const { panel } = await switchToSimilarityTab(dialog);
      const card = panel.getByTestId('similarity-flag-card-flag-1');
      await card.waitFor({ state: 'visible', timeout: 5000 });

      const cardText = await card.innerText();
      assert.ok(cardText.includes('Omar Mokhtar'));
      assert.ok(cardText.includes('Sara Ahmed'));
      assert.ok(cardText.includes('STU-2026-007'));
      assert.ok(cardText.includes('STU-2026-008'));
      assert.ok(cardText.includes('raft_report_omar.pdf'));
      assert.ok(cardText.includes('raft_report_sara.pdf'));

      const scoreEl = card.getByTestId('similarity-flag-score-flag-1');
      const thresholdEl = card.getByTestId('similarity-flag-threshold-flag-1');
      assert.ok((await scoreEl.innerText()).includes('91.2%'));
      assert.ok((await scoreEl.getAttribute('class'))?.includes('tabular-nums'));
      assert.ok((await thresholdEl.innerText()).includes('0.75'));
      assert.ok((await thresholdEl.getAttribute('class'))?.includes('tabular-nums'));

      const bdiValues = await card.locator('bdi[dir="ltr"]').allInnerTexts();
      assert.ok(bdiValues.includes('STU-2026-007'), 'studentId A must be inside bdi[dir="ltr"]');
      assert.ok(bdiValues.includes('STU-2026-008'), 'studentId B must be inside bdi[dir="ltr"]');
      assert.ok(bdiValues.includes('raft_report_omar.pdf'), 'fileName A must be inside bdi[dir="ltr"]');
      assert.ok(bdiValues.includes('raft_report_sara.pdf'), 'fileName B must be inside bdi[dir="ltr"]');

      const statusBadge = card.getByTestId('similarity-flag-status-flag-1');
      assert.ok((await statusBadge.innerText()).includes('Pending'));

      const domSnapshot = await panel.evaluate((el) => ({
        html: el.innerHTML,
        text: el.textContent || '',
      }));
      assert.equal(domSnapshot.html.includes(secretHash), false, 'fileHash must never appear in DOM');
      assert.equal(domSnapshot.html.includes(secretStorageKey), false, 'storageKey must never appear in DOM');
      assert.equal(domSnapshot.html.includes(secretPath), false, 'path must never appear in DOM');
      assert.equal(domSnapshot.text.includes('another-hash-secret'), false);
    } finally {
      await context.close();
    }
  });

  it('P3: Status filters ALL / PENDING / CONFIRMED / DISMISSED show matching cards and filter-empty state', async () => {
    const { context, page } = await openSession({ role: 'DOCTOR', language: 'en', theme: 'light' });
    try {
      await setupTasksPageRoutes(page);
      const dialog = await openSubmissionsModalOnTasks(page);
      const { panel } = await switchToSimilarityTab(dialog);

      await panel.getByTestId('similarity-flag-card-flag-1').waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(await panel.locator('article[data-testid^="similarity-flag-card-"]').count(), 3);

      await panel.getByTestId('similarity-filter-PENDING').click();
      assert.equal(await panel.locator('article[data-testid^="similarity-flag-card-"]').count(), 2);

      await panel.getByTestId('similarity-filter-CONFIRMED').click();
      assert.equal(await panel.locator('article[data-testid^="similarity-flag-card-"]').count(), 1);
      await panel.getByTestId('similarity-flag-card-flag-3').waitFor({ state: 'visible', timeout: 5000 });

      await panel.getByTestId('similarity-filter-DISMISSED').click();
      assert.equal(await panel.locator('article[data-testid^="similarity-flag-card-"]').count(), 0);
      await panel.getByTestId('similarity-flags-filter-empty').waitFor({ state: 'visible', timeout: 5000 });

      await panel.getByTestId('similarity-filter-ALL').click();
      assert.equal(await panel.locator('article[data-testid^="similarity-flag-card-"]').count(), 3);
    } finally {
      await context.close();
    }
  });

  it('P4: Confirm with padded note sends strict trimmed PATCH body, updates card, decrements badge, moves focus, announces live region, and shows toast', async () => {
    const { context, page } = await openSession({ role: 'DOCTOR', language: 'en', theme: 'light' });
    try {
      const patchCalls = [];
      await setupTasksPageRoutes(page, {
        patchHandler: async (route) => {
          const url = new URL(route.request().url());
          const body = JSON.parse(route.request().postData() || '{}');
          patchCalls.push({ method: route.request().method(), pathname: url.pathname, body });
          const base = makeFlagsFixture()[0];
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                ...base,
                status: 'CONFIRMED',
                reviewedById: 1,
                reviewedAt: '2026-10-16T08:00:00.000Z',
                reviewNote: body.note ?? null,
              },
            }),
          });
        },
      });

      const dialog = await openSubmissionsModalOnTasks(page);
      const { panel } = await switchToSimilarityTab(dialog);

      const noteInput = panel.locator('#similarity-note-flag-1');
      await noteInput.fill('   Verified matching code blocks   ');
      await panel.getByTestId('similarity-confirm-flag-1').click();

      const statusBadge = panel.getByTestId('similarity-flag-status-flag-1');
      await statusBadge.waitFor({ state: 'visible', timeout: 5000 });
      await page.waitForFunction(() => {
        const badge = document.querySelector('[data-testid="similarity-flag-status-flag-1"]');
        return badge && badge.textContent?.includes('Confirmed');
      });

      assert.equal(patchCalls.length, 1);
      assert.equal(patchCalls[0].method, 'PATCH');
      assert.equal(patchCalls[0].pathname, '/api/tasks/10/similarity-flags/flag-1');
      assert.deepEqual(patchCalls[0].body, {
        decision: 'CONFIRMED',
        note: 'Verified matching code blocks',
      });

      // Badge decremented from 2 to 1
      assert.equal((await dialog.getByTestId('similarity-flags-pending-badge').textContent())?.trim(), '1');
      // Buttons & textarea removed on decided card
      assert.equal(await panel.locator('#similarity-note-flag-1').count(), 0);
      assert.equal(await panel.getByTestId('similarity-confirm-flag-1').count(), 0);
      // Toast visible
      await page.locator('[role="status"]:has-text("Similarity flag confirmed.")').waitFor({ state: 'visible', timeout: 5000 });
      // Focus moved to stable card heading
      const activeTestId = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
      assert.equal(activeTestId, 'similarity-flag-heading-flag-1');
      // Live region announced
      const liveText = await panel.getByTestId('similarity-flags-live-region').textContent();
      assert.ok(liveText && liveText.includes('Omar Mokhtar') && liveText.includes('Sara Ahmed'));
    } finally {
      await context.close();
    }
  });

  it('P5: Dismiss with empty or whitespace-only note omits note key from PATCH body', async () => {
    const { context, page } = await openSession({ role: 'DOCTOR', language: 'en', theme: 'light' });
    try {
      const patchCalls = [];
      await setupTasksPageRoutes(page, {
        patchHandler: async (route) => {
          const body = JSON.parse(route.request().postData() || '{}');
          patchCalls.push(body);
          const base = makeFlagsFixture()[0];
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                ...base,
                status: 'DISMISSED',
                reviewedById: 1,
                reviewedAt: '2026-10-16T08:00:00.000Z',
                reviewNote: null,
              },
            }),
          });
        },
      });

      const dialog = await openSubmissionsModalOnTasks(page);
      const { panel } = await switchToSimilarityTab(dialog);

      await panel.locator('#similarity-note-flag-1').fill('    ');
      await panel.getByTestId('similarity-dismiss-flag-1').click();

      await page.waitForFunction(() => {
        const badge = document.querySelector('[data-testid="similarity-flag-status-flag-1"]');
        return badge && badge.textContent?.includes('Dismissed');
      });

      assert.equal(patchCalls.length, 1);
      assert.deepEqual(patchCalls[0], { decision: 'DISMISSED' });
      assert.equal('note' in patchCalls[0], false, 'note key must be omitted when trimmed note is empty');
    } finally {
      await context.close();
    }
  });

  it('P6: Note textarea enforces maxLength 1000 and updates tabular-nums live counter', async () => {
    const { context, page } = await openSession({ role: 'DOCTOR', language: 'en', theme: 'light' });
    try {
      const patchBodies = [];
      await setupTasksPageRoutes(page, {
        patchHandler: async (route) => {
          const body = JSON.parse(route.request().postData() || '{}');
          patchBodies.push(body);
          const base = makeFlagsFixture()[0];
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                ...base,
                status: 'CONFIRMED',
                reviewedById: 1,
                reviewedAt: '2026-10-16T08:00:00.000Z',
                reviewNote: body.note ?? null,
              },
            }),
          });
        },
      });

      const dialog = await openSubmissionsModalOnTasks(page);
      const { panel } = await switchToSimilarityTab(dialog);

      const noteInput = panel.locator('#similarity-note-flag-1');
      const counter = panel.getByTestId('similarity-note-counter-flag-1');
      assert.equal(await noteInput.getAttribute('maxlength'), '1000');
      assert.ok((await counter.getAttribute('class'))?.includes('tabular-nums'));
      assert.equal((await counter.textContent())?.trim(), '0 / 1000');

      const exact1000 = 'x'.repeat(1000);
      await noteInput.fill(exact1000);
      assert.equal((await counter.textContent())?.trim(), '1000 / 1000');

      await panel.getByTestId('similarity-confirm-flag-1').click();
      await page.waitForFunction(() => {
        const badge = document.querySelector('[data-testid="similarity-flag-status-flag-1"]');
        return badge && badge.textContent?.includes('Confirmed');
      });
      assert.equal(patchBodies[0].note.length, 1000);
    } finally {
      await context.close();
    }
  });

  it('P7: PATCH 409 shows conflict message and re-fetches list (GET count = 2) reflecting server state', async () => {
    const { context, page } = await openSession({ role: 'DOCTOR', language: 'en', theme: 'light' });
    try {
      let getCount = 0;
      await setupTasksPageRoutes(page, {
        flagsHandler: async (route) => {
          getCount += 1;
          const items = makeFlagsFixture();
          if (getCount >= 2) {
            items[0] = {
              ...items[0],
              status: 'CONFIRMED',
              reviewedById: 2,
              reviewedAt: '2026-10-16T08:05:00.000Z',
              reviewNote: 'Decided by another reviewer',
            };
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: items }),
          });
        },
        patchHandler: async (route) => {
          await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              status: 'fail',
              message: 'Similarity flag has already been decided',
              errorId: 'err-409',
            }),
          });
        },
      });

      const dialog = await openSubmissionsModalOnTasks(page);
      const { panel } = await switchToSimilarityTab(dialog);
      assert.equal(getCount, 1);

      await panel.getByTestId('similarity-confirm-flag-1').click();

      const conflictAlert = panel.getByTestId('similarity-flags-conflict-alert');
      await conflictAlert.waitFor({ state: 'visible', timeout: 5000 });
      assert.ok((await conflictAlert.innerText()).includes('Similarity flag has already been decided'));

      await page.waitForFunction(() => {
        const badge = document.querySelector('[data-testid="similarity-flag-status-flag-1"]');
        return badge && badge.textContent?.includes('Confirmed');
      });
      assert.equal(getCount, 2, '409 must trigger re-fetch of similarity flags');
      assert.equal((await dialog.getByTestId('similarity-flags-pending-badge').textContent())?.trim(), '1');
    } finally {
      await context.close();
    }
  });

  it('P8: GET 403 and GET 500 show role="alert" + Retry (Retry succeeds); PATCH 404 and 422 show raw inline error and keep draft', async () => {
    // 1. GET 403 -> localized forbidden + Retry -> succeeds
    const s403 = await openSession({ role: 'DOCTOR', language: 'en', theme: 'light' });
    try {
      let getCount = 0;
      await setupTasksPageRoutes(s403.page, {
        flagsHandler: async (route) => {
          getCount += 1;
          if (getCount === 1) {
            await route.fulfill({
              status: 403,
              contentType: 'application/json',
              body: JSON.stringify({
                success: false,
                status: 'fail',
                message: 'Forbidden from server',
                errorId: 'err-403',
              }),
            });
            return;
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: makeFlagsFixture() }),
          });
        },
      });

      const dialog = await openSubmissionsModalOnTasks(s403.page);
      const { panel } = await switchToSimilarityTab(dialog);
      const alertBox = panel.getByTestId('similarity-flags-load-error');
      await alertBox.waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(await alertBox.getAttribute('role'), 'alert');
      assert.ok((await alertBox.innerText()).includes('You do not have permission to perform this action.'));

      await panel.getByTestId('similarity-flags-retry-button').click();
      await panel.getByTestId('similarity-flag-card-flag-1').waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(getCount, 2);
    } finally {
      await s403.context.close();
    }

    // 2. GET 500 -> inline alert + Retry -> succeeds, plus PATCH 404 and PATCH 422 preserve draft
    const s500 = await openSession({ role: 'DOCTOR', language: 'en', theme: 'light' });
    try {
      let getCount = 0;
      let patchCount = 0;
      await setupTasksPageRoutes(s500.page, {
        flagsHandler: async (route) => {
          getCount += 1;
          if (getCount === 1) {
            await route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({
                success: false,
                status: 'error',
                message: 'Database timeout Ref: err-500',
                errorId: 'err-500',
              }),
            });
            return;
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: makeFlagsFixture() }),
          });
        },
        patchHandler: async (route) => {
          patchCount += 1;
          if (patchCount === 1) {
            await route.fulfill({
              status: 404,
              contentType: 'application/json',
              body: JSON.stringify({
                success: false,
                status: 'fail',
                message: 'Similarity flag not found',
                errorId: 'err-404',
              }),
            });
            return;
          }
          await route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              status: 'fail',
              message: 'Note cannot exceed 1000 characters',
              errorId: 'err-422',
            }),
          });
        },
      });

      const dialog = await openSubmissionsModalOnTasks(s500.page);
      const { panel } = await switchToSimilarityTab(dialog);
      const alertBox = panel.getByTestId('similarity-flags-load-error');
      await alertBox.waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(await alertBox.getAttribute('role'), 'alert');

      await panel.getByTestId('similarity-flags-retry-button').click();
      await panel.getByTestId('similarity-flag-card-flag-1').waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(getCount, 2);

      const noteInput = panel.locator('#similarity-note-flag-1');
      await noteInput.fill('Draft that must stay');
      await panel.getByTestId('similarity-confirm-flag-1').click();

      const cardError = panel.getByTestId('similarity-card-error-flag-1');
      await cardError.waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(await cardError.getAttribute('role'), 'alert');
      assert.ok((await cardError.innerText()).includes('Similarity flag not found'));
      assert.equal(await noteInput.inputValue(), 'Draft that must stay');

      await panel.getByTestId('similarity-dismiss-flag-1').click();
      await s500.page.waitForFunction(() => {
        const el = document.querySelector('[data-testid="similarity-card-error-flag-1"]');
        return el && el.textContent?.includes('Note cannot exceed 1000 characters');
      });
      assert.equal(await noteInput.inputValue(), 'Draft that must stay');
    } finally {
      await s500.context.close();
    }
  });

  it('P9: Double-click Confirm while PATCH is held in flight fires exactly 1 PATCH and disables card controls', async () => {
    const { context, page } = await openSession({ role: 'DOCTOR', language: 'en', theme: 'light' });
    try {
      let patchCount = 0;
      let releasePatch;
      const patchReached = new Promise((resolve) => {
        releasePatch = resolve;
      });
      let unlockResponse;
      const responseGate = new Promise((resolve) => {
        unlockResponse = resolve;
      });

      await setupTasksPageRoutes(page, {
        patchHandler: async (route) => {
          patchCount += 1;
          releasePatch();
          await responseGate;
          const base = makeFlagsFixture()[0];
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                ...base,
                status: 'CONFIRMED',
                reviewedById: 1,
                reviewedAt: '2026-10-16T09:00:00.000Z',
                reviewNote: null,
              },
            }),
          });
        },
      });

      const dialog = await openSubmissionsModalOnTasks(page);
      const { panel } = await switchToSimilarityTab(dialog);

      const confirmBtn = panel.getByTestId('similarity-confirm-flag-1');
      const dismissBtn = panel.getByTestId('similarity-dismiss-flag-1');
      const noteInput = panel.locator('#similarity-note-flag-1');

      await confirmBtn.dblclick();
      await patchReached;

      assert.equal(await confirmBtn.isDisabled(), true, 'Confirm button must be disabled while in flight');
      assert.equal(await dismissBtn.isDisabled(), true, 'Dismiss button must be disabled while in flight');
      assert.equal(await noteInput.isDisabled(), true, 'Note textarea must be disabled while in flight');
      assert.equal(patchCount, 1, 'Double-click while in flight must send exactly 1 PATCH');

      unlockResponse();
      await page.waitForFunction(() => {
        const badge = document.querySelector('[data-testid="similarity-flag-status-flag-1"]');
        return badge && badge.textContent?.includes('Confirmed');
      });
      assert.equal(patchCount, 1);
    } finally {
      await context.close();
    }
  });

  it('P10: Role visibility across SUPER_ADMIN, ADMIN, COLLEGE_ADMIN, DEPARTMENT_ADMIN vs TEACHING_ASSISTANT and STUDENT (plus CourseDetails TA guard)', async () => {
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN']) {
      const { context, page } = await openSession({ role, language: 'en', theme: 'light' });
      try {
        let getCount = 0;
        await setupTasksPageRoutes(page, {
          flagsHandler: async (route) => {
            getCount += 1;
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ success: true, data: makeFlagsFixture() }),
            });
          },
        });
        const dialog = await openSubmissionsModalOnTasks(page);
        const { panel } = await switchToSimilarityTab(dialog);
        await panel.getByTestId('similarity-flag-card-flag-1').waitFor({ state: 'visible', timeout: 5000 });
        assert.equal(getCount, 1, `${role} must trigger 1 GET similarity-flags`);
      } finally {
        await context.close();
      }
    }

    // TEACHING_ASSISTANT on /tasks AND /courses/101
    const taSession = await openSession({ role: 'TEACHING_ASSISTANT', language: 'en', theme: 'light' });
    try {
      let similarityRequests = 0;
      let submissionsRequests = 0;
      await setupTasksPageRoutes(taSession.page, {
        flagsHandler: async (route) => {
          similarityRequests += 1;
          await route.abort();
        },
      });
      await taSession.page.route((url) => url.pathname === '/api/tasks/10/submissions', async (route) => {
        submissionsRequests += 1;
        await route.abort();
      });
      await taSession.page.route((url) => url.pathname === '/api/courses/101', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: MOCK_COURSE_DETAILS }),
        });
      });

      await taSession.page.goto(`${appServer.origin}/tasks`, { waitUntil: 'networkidle' });
      assert.equal(
        await taSession.page.locator('button:has-text("View & Grade"), button:has-text("معاينة ورصد")').count(),
        0,
        'TA must not see View & Grade on /tasks'
      );

      await taSession.page.goto(`${appServer.origin}/courses/101`, { waitUntil: 'networkidle' });
      const tasksTabBtn = taSession.page.locator('button:has-text("Tasks & Assignments"), button:has-text("التكاليف والواجبات")').first();
      await tasksTabBtn.waitFor({ state: 'visible', timeout: 5000 });
      await tasksTabBtn.click();
      await taSession.page.locator('h4:has-text("Distributed Systems Report")').waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(
        await taSession.page.locator('button:has-text("View Submissions"), button:has-text("معاينة التسليمات")').count(),
        0,
        'TA must not see View Submissions on CourseTasksTab'
      );
      assert.equal(similarityRequests, 0, 'TA must make 0 similarity-flags requests');
      assert.equal(submissionsRequests, 0, 'TA must make 0 submissions requests');
    } finally {
      await taSession.context.close();
    }

    // STUDENT on /tasks AND /courses/101
    const studentSession = await openSession({ role: 'STUDENT', language: 'en', theme: 'light' });
    try {
      let similarityRequests = 0;
      await setupTasksPageRoutes(studentSession.page, {
        flagsHandler: async (route) => {
          similarityRequests += 1;
          await route.abort();
        },
      });
      await studentSession.page.route((url) => url.pathname === '/api/courses/101', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: MOCK_COURSE_DETAILS }),
        });
      });
      await studentSession.page.route((url) => url.pathname === '/api/tasks/10/submission', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: null }) });
      });

      await studentSession.page.goto(`${appServer.origin}/tasks`, { waitUntil: 'networkidle' });
      assert.equal(await studentSession.page.locator('#submissions-modal-tab-similarity').count(), 0);
      await studentSession.page.goto(`${appServer.origin}/courses/101`, { waitUntil: 'networkidle' });
      const tasksTabBtn = studentSession.page.locator('button:has-text("Tasks & Assignments")').first();
      await tasksTabBtn.click();
      await studentSession.page.locator('h4:has-text("Distributed Systems Report")').waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(await studentSession.page.locator('button:has-text("View Submissions")').count(), 0);
      assert.equal(similarityRequests, 0);
    } finally {
      await studentSession.context.close();
    }

    // DOCTOR on /courses/101 opens modal via View Submissions
    const docCourseSession = await openSession({ role: 'DOCTOR', language: 'en', theme: 'light' });
    try {
      let courseFlagGets = 0;
      await setupTasksPageRoutes(docCourseSession.page, {
        flagsHandler: async (route) => {
          courseFlagGets += 1;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: makeFlagsFixture() }),
          });
        },
      });
      await docCourseSession.page.route((url) => url.pathname === '/api/courses/101', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: MOCK_COURSE_DETAILS }),
        });
      });
      await docCourseSession.page.goto(`${appServer.origin}/courses/101`, { waitUntil: 'networkidle' });
      const tasksTabBtn = docCourseSession.page.locator('button:has-text("Tasks & Assignments")').first();
      await tasksTabBtn.click();
      const viewSubsBtn = docCourseSession.page.locator('button:has-text("View Submissions")').first();
      await viewSubsBtn.waitFor({ state: 'visible', timeout: 5000 });
      await viewSubsBtn.click();
      const dialog = docCourseSession.page.locator('div[role="dialog"]').first();
      await dialog.waitFor({ state: 'visible', timeout: 5000 });
      const { panel } = await switchToSimilarityTab(dialog);
      await panel.getByTestId('similarity-flag-card-flag-1').waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(courseFlagGets, 1);
    } finally {
      await docCourseSession.context.close();
    }
  });

  it('P11: Student submit 409 DUPLICATE_SUBMISSION vs generic 409 on both /tasks and /courses/:id', async () => {
    const EXPECTED_DUP =
      'This file cannot be accepted because an identical submission already exists for this assignment. Please submit your own original work.';
    const EXPECTED_CONFLICT =
      'You have already submitted this task. Only one submission per task is allowed.';

    for (const scenario of [
      { routePath: '/tasks', code: 'DUPLICATE_SUBMISSION', expectedText: EXPECTED_DUP },
      { routePath: '/tasks', code: undefined, expectedText: EXPECTED_CONFLICT },
      { routePath: '/courses/101', code: 'DUPLICATE_SUBMISSION', expectedText: EXPECTED_DUP },
      { routePath: '/courses/101', code: undefined, expectedText: EXPECTED_CONFLICT },
    ]) {
      const { context, page } = await openSession({ role: 'STUDENT', language: 'en', theme: 'light' });
      try {
        await setupTasksPageRoutes(page, {
          submitHandler: async (route) => {
            await route.fulfill({
              status: 409,
              contentType: 'application/json',
              body: JSON.stringify(
                scenario.code
                  ? { success: false, code: scenario.code, message: EXPECTED_DUP }
                  : { success: false, status: 'fail', message: EXPECTED_CONFLICT, errorId: 'err-c' }
              ),
            });
          },
        });
        await page.route((url) => url.pathname === '/api/courses/101', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: MOCK_COURSE_DETAILS }),
          });
        });
        await page.route((url) => url.pathname === '/api/tasks/10/submission', async (route) => {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: null }) });
        });

        await page.goto(`${appServer.origin}${scenario.routePath}`, { waitUntil: 'networkidle' });
        if (scenario.routePath.startsWith('/courses/')) {
          const tasksTabBtn = page.locator('button:has-text("Tasks & Assignments")').first();
          await tasksTabBtn.waitFor({ state: 'visible', timeout: 5000 });
          await tasksTabBtn.click();
        }

        const submitBtn = page.locator('button:has-text("Submit Assignment")').first();
        await submitBtn.waitFor({ state: 'visible', timeout: 5000 });
        await submitBtn.click();

        const submitDialog = page.locator('div[role="dialog"]').first();
        await submitDialog.waitFor({ state: 'visible', timeout: 5000 });
        await submitDialog.locator('input[type="file"]').setInputFiles({
          name: 'submission.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4 sample submission content'),
        });
        await submitDialog.locator('button[type="submit"]').click();

        const msgLocator = page.locator(`text="${scenario.expectedText}"`);
        await assert.doesNotReject(msgLocator.waitFor({ state: 'visible', timeout: 5000 }));
      } finally {
        await context.close();
      }
    }
  });

  it('P12: Keyboard arrow navigation on modal tablist in EN (LTR) and AR (RTL) + accessible label/input names', async () => {
    for (const language of ['en', 'ar']) {
      const { context, page } = await openSession({ role: 'DOCTOR', language, theme: 'light' });
      try {
        await setupTasksPageRoutes(page);
        const dialog = await openSubmissionsModalOnTasks(page);
        const subTab = dialog.locator('#submissions-modal-tab-submissions');
        const simTab = dialog.locator('#submissions-modal-tab-similarity');

        await subTab.focus();
        assert.equal(await subTab.getAttribute('aria-selected'), 'true');

        await page.keyboard.press(language === 'ar' ? 'ArrowLeft' : 'ArrowRight');
        assert.equal(await simTab.getAttribute('aria-selected'), 'true', `Next key in ${language} must activate Similarity Flags tab`);

        const panel = dialog.getByTestId('similarity-flags-panel');
        await panel.waitFor({ state: 'visible', timeout: 5000 });

        const labelText = language === 'ar' ? 'ملاحظة المراجعة (اختياري)' : 'Review note (optional)';
        const labeledInput = panel.getByLabel(labelText).first();
        await labeledInput.waitFor({ state: 'visible', timeout: 5000 });
        assert.equal(await labeledInput.getAttribute('id'), 'similarity-note-flag-1');

        await simTab.focus();
        await page.keyboard.press(language === 'ar' ? 'ArrowRight' : 'ArrowLeft');
        assert.equal(await subTab.getAttribute('aria-selected'), 'true', `Prev key in ${language} must return to Submissions tab`);
      } finally {
        await context.close();
      }
    }
  });

  // P13: 24-config matrix (1440/1024/768/430/390/360 x ar/en x light/dark)
  const longArabicFlags = [
    {
      id: 'flag-long',
      status: 'PENDING',
      similarityScore: 0.884,
      thresholdUsed: 0.75,
      createdAt: '2026-10-15T11:00:00.000Z',
      reviewedById: null,
      reviewedAt: null,
      reviewNote: null,
      submissionA: {
        submissionId: 301,
        studentId: 'STU-2026-0000101',
        studentName: 'عبدالرحمن محمد إبراهيم مصطفى السعيد الشافعي',
        fileName: 'very_long_assignment_submission_filename_without_spaces_for_overflow_verification_2026_final_v3.pdf',
        submittedAt: '2026-10-15T10:30:00.000Z',
      },
      submissionB: {
        submissionId: 302,
        studentId: 'STU-2026-0000202',
        studentName: 'فاطمة الزهراء أحمد محمود عبدالمجيد الأنصاري',
        fileName: 'another_extremely_long_arabic_and_latin_submission_file_name_2026_revision_4.docx',
        submittedAt: '2026-10-15T10:45:00.000Z',
      },
    },
  ];

  for (const width of [1440, 1024, 768, 430, 390, 360]) {
    for (const language of ['ar', 'en']) {
      for (const theme of ['light', 'dark']) {
        it(`P13 Matrix [${width}px ${language.toUpperCase()} ${theme.toUpperCase()}]: html lang/dir, dark class, scrollWidth <= innerWidth, modal & buttons in viewport`, async () => {
          const viewport = { width, height: width <= 430 ? 844 : 800 };
          const { context, page } = await openSession({
            role: 'DOCTOR',
            language,
            theme,
            viewport,
          });
          try {
            await setupTasksPageRoutes(page, {
              flagsHandler: async (route) => {
                await route.fulfill({
                  status: 200,
                  contentType: 'application/json',
                  body: JSON.stringify({ success: true, data: longArabicFlags }),
                });
              },
            });

            const dialog = await openSubmissionsModalOnTasks(page);
            const { panel } = await switchToSimilarityTab(dialog);
            const card = panel.getByTestId('similarity-flag-card-flag-long');
            await card.waitFor({ state: 'visible', timeout: 5000 });

            const htmlLang = await page.getAttribute('html', 'lang');
            const htmlDir = await page.getAttribute('html', 'dir');
            const htmlClass = (await page.getAttribute('html', 'class')) || '';
            assert.equal(htmlLang, language);
            assert.equal(htmlDir, language === 'ar' ? 'rtl' : 'ltr');
            if (theme === 'dark') {
              assert.ok(htmlClass.includes('dark'), 'Expected dark class on html in dark mode');
            } else {
              assert.ok(!htmlClass.includes('dark'), 'Expected dark class absent on html in light mode');
            }

            const metrics = await page.evaluate(() => ({
              scrollWidth: document.documentElement.scrollWidth,
              innerWidth: window.innerWidth,
            }));
            assert.ok(
              metrics.scrollWidth <= metrics.innerWidth,
              `scrollWidth (${metrics.scrollWidth}) must be <= innerWidth (${metrics.innerWidth})`
            );

            const panelBox = await panel.boundingBox();
            assert.ok(panelBox && panelBox.width > 0 && panelBox.height > 0, 'Expected non-zero size for panel');
            assert.ok(panelBox.x >= 0, `panel left (${panelBox.x}) must be >= 0`);
            assert.ok(
              panelBox.x + panelBox.width <= viewport.width,
              `panel right (${panelBox.x + panelBox.width}) must be <= viewport width (${viewport.width})`
            );

            const tablist = dialog.getByRole('tablist');
            const confirmBtn = panel.getByTestId('similarity-confirm-flag-long');
            const dismissBtn = panel.getByTestId('similarity-dismiss-flag-long');
            for (const [name, locator] of [
              ['dialog', dialog],
              ['tablist', tablist],
              ['confirmButton', confirmBtn],
              ['dismissButton', dismissBtn],
            ]) {
              await locator.scrollIntoViewIfNeeded();
              const box = await locator.boundingBox();
              assert.ok(box, `Expected boundingBox for ${name}`);
              assert.ok(box.width > 0 && box.height > 0, `Expected non-zero size for ${name}`);
              assert.ok(box.x >= 0, `${name} left (${box.x}) must be >= 0`);
              assert.ok(
                box.x + box.width <= viewport.width,
                `${name} right (${box.x + box.width}) must be <= viewport width (${viewport.width})`
              );
              assert.ok(box.y >= 0, `${name} top (${box.y}) must be >= 0`);
              assert.ok(
                box.y + box.height <= viewport.height,
                `${name} bottom (${box.y + box.height}) must be <= viewport height (${viewport.height})`
              );
            }
          } finally {
            await context.close();
          }
        });
      }
    }
  }
});
