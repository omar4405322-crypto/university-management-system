import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

describe('T-7b1 Browser Verification: Student My Grades (/my-grades) Smoke, Proofs 1-8 & 24-Cell Matrix', () => {
  let appServer;
  let browser;

  let myGradesRequests = [];

  const fullyPublishedCoursesPayload = [
    {
      enrollmentId: 501,
      courseId: 10,
      termId: 1,
      course: {
        id: 10,
        code: 'CS401',
        name: 'Advanced Software Engineering',
        credits: 3,
      },
      term: {
        id: 1,
        name: 'Fall 2026',
      },
      passMark: 50,
      components: [
        {
          componentId: 101,
          name: 'Attendance',
          nameAr: 'الحضور',
          maxPoints: 10,
          source: 'AUTO_ATTENDANCE',
          score: 9,
          isAbsent: false,
          isPublished: true,
        },
        {
          componentId: 102,
          name: 'Quiz 1',
          nameAr: 'اختبار قصير 1',
          maxPoints: 15,
          source: 'AUTO_QUIZ',
          score: 14,
          isAbsent: false,
          isPublished: true,
        },
        {
          componentId: 103,
          name: 'Midterm Exam',
          nameAr: 'امتحان منتصف الفصل',
          maxPoints: 25,
          source: 'MANUAL',
          score: 22.5,
          isAbsent: false,
          isPublished: true,
        },
        {
          componentId: 104,
          name: 'Final Exam',
          nameAr: 'الامتحان النهائي',
          maxPoints: 50,
          source: 'MANUAL',
          score: 40,
          isAbsent: false,
          isPublished: true,
        },
      ],
      finalPointsEarned: 85.5,
      finalPointsMax: 100,
      finalGrade: 85.5,
      status: 'COMPLETED',
    },
    {
      enrollmentId: 502,
      courseId: 11,
      termId: 1,
      course: {
        id: 11,
        code: 'CS405',
        name: 'Distributed Systems',
        credits: 3,
      },
      term: {
        id: 1,
        name: 'Fall 2026',
      },
      passMark: null,
      components: [
        {
          componentId: 201,
          name: 'Coursework',
          nameAr: 'أعمال السنة',
          maxPoints: 40,
          source: 'MANUAL',
          score: 15,
          isAbsent: false,
          isPublished: true,
        },
        {
          componentId: 202,
          name: 'Final Exam',
          nameAr: 'الامتحان النهائي',
          maxPoints: 60,
          source: 'MANUAL',
          score: 20,
          isAbsent: false,
          isPublished: true,
        },
      ],
      finalPointsEarned: 35,
      finalPointsMax: 100,
      finalGrade: 35,
      status: 'FAILED',
    },
  ];

  const partiallyPublishedPayload = [
    {
      enrollmentId: 601,
      courseId: 20,
      termId: 1,
      course: {
        id: 20,
        code: 'CS302',
        name: 'Database Management Systems',
        credits: 3,
      },
      term: {
        id: 1,
        name: 'Fall 2026',
      },
      passMark: 50,
      components: [
        {
          componentId: 301,
          name: 'Midterm Exam',
          nameAr: 'امتحان منتصف الفصل',
          maxPoints: 30,
          source: 'MANUAL',
          score: 24,
          isAbsent: false,
          isPublished: true,
        },
        {
          componentId: 302,
          name: 'Final Exam',
          nameAr: 'الامتحان النهائي',
          maxPoints: 70,
          source: 'MANUAL',
          score: null,
          isAbsent: false,
          isPublished: false,
        },
      ],
      finalPointsEarned: null,
      finalPointsMax: null,
      finalGrade: null,
      status: null,
    },
  ];

  const absentComponentPayload = [
    {
      enrollmentId: 701,
      courseId: 30,
      termId: 1,
      course: {
        id: 30,
        code: 'CS210',
        name: 'Computer Networks',
        credits: 3,
      },
      term: {
        id: 1,
        name: 'Fall 2026',
      },
      passMark: 50,
      components: [
        {
          componentId: 401,
          name: 'Midterm Exam',
          nameAr: 'امتحان منتصف الفصل',
          maxPoints: 25,
          source: 'MANUAL',
          score: 0, // Backend sets score: 0 when entry.isAbsent is true
          isAbsent: true,
          isPublished: true,
        },
        {
          componentId: 402,
          name: 'Final Exam',
          nameAr: 'الامتحان النهائي',
          maxPoints: 75,
          source: 'MANUAL',
          score: 60,
          isAbsent: false,
          isPublished: true,
        },
      ],
      finalPointsEarned: 60,
      finalPointsMax: 100,
      finalGrade: 60,
      status: 'COMPLETED',
    },
  ];

  const noGradeStructurePayload = [
    {
      enrollmentId: 801,
      courseId: 40,
      termId: 1,
      course: {
        id: 40,
        code: 'CS101',
        name: 'Introduction to Computer Science',
        credits: 3,
      },
      term: {
        id: 1,
        name: 'Fall 2026',
      },
      passMark: null,
      components: [],
      finalPointsEarned: null,
      finalPointsMax: null,
      finalGrade: null,
      status: null,
    },
  ];

  const setupMyGradesRoute = async (page, options = {}) => {
    const {
      status = 200,
      data = fullyPublishedCoursesPayload,
      errorBody = null,
    } = options;

    await page.route('**/api/enrollments/my-grades*', async (route) => {
      const req = route.request();
      myGradesRequests.push({
        url: req.url(),
        method: req.method(),
      });

      if (status !== 200) {
        await route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(
            errorBody || {
              success: false,
              message: 'Error loading grades',
            }
          ),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data,
        }),
      });
    });
  };

  it('setup server and chromium browser', async () => {
    appServer = await serveBuiltApp();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  });

  // ── PROOF 1: Role matrix ──
  it('Proof 1: Role matrix: STUDENT sees sidebar entry and /my-grades page; Super/College/Department Admin, Doctor, TA have no sidebar entry and are redirected to /unauthorized', async () => {
    // 1. STUDENT sees sidebar link and loads /my-grades
    const { context: stuCtx, page: stuPage } = await mockSessionPage(browser, {
      role: 'STUDENT',
      language: 'en',
    });
    await setupMyGradesRoute(stuPage);
    await stuPage.goto(`${appServer.origin}/my-grades`, { waitUntil: 'networkidle' });
    await stuPage.waitForSelector('[data-my-grades-page="true"]', { timeout: 8000 });

    assert.equal(
      await stuPage.locator('#app-sidebar a[href="/my-grades"]').count(),
      1,
      'STUDENT must see /my-grades link in the sidebar'
    );
    assert.equal(
      await stuPage.locator('[data-my-grades-page="true"]').count(),
      1,
      'STUDENT must render MyGradesPage'
    );
    await stuCtx.close();

    // 2. Non-student roles: no sidebar entry and redirected to /unauthorized
    const blockedRoles = [
      'SUPER_ADMIN',
      'COLLEGE_ADMIN',
      'DEPARTMENT_ADMIN',
      'DOCTOR',
      'TEACHING_ASSISTANT',
    ];
    for (const role of blockedRoles) {
      const { context, page } = await mockSessionPage(browser, {
        role,
        language: 'en',
      });
      await setupMyGradesRoute(page);

      await page.goto(`${appServer.origin}/dashboard`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#app-sidebar', { timeout: 8000 });
      assert.equal(
        await page.locator('#app-sidebar a[href="/my-grades"]').count(),
        0,
        `${role} must NOT see /my-grades sidebar entry`
      );

      await page.goto(`${appServer.origin}/my-grades`, { waitUntil: 'networkidle' });
      await page.waitForURL('**/unauthorized', { timeout: 8000 });
      assert.ok(
        page.url().endsWith('/unauthorized'),
        `${role} navigating to /my-grades must be redirected to /unauthorized`
      );
      assert.equal(
        await page.locator('[data-my-grades-page="true"]').count(),
        0,
        `${role} must NOT render MyGradesPage`
      );
      await context.close();
    }
  });

  // ── PROOF 2: Fully published course renders components, total, status ──
  it('Proof 2: Fully published course renders components with score / maxPoints, passMark when returned, course total, percentage, and pass/fail status', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'STUDENT',
      language: 'en',
    });
    await setupMyGradesRoute(page, { data: fullyPublishedCoursesPayload });
    await page.goto(`${appServer.origin}/my-grades`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-course-card="true"]', { timeout: 8000 });

    assert.equal(
      (await page.locator('[data-term-name="true"]').first().innerText()).trim(),
      'Fall 2026'
    );

    const firstCard = page.locator('[data-course-card="true"]').nth(0);
    assert.equal(
      (await firstCard.locator('[data-course-code="true"]').innerText()).trim(),
      'CS401'
    );
    assert.equal(
      (await firstCard.locator('[data-course-name="true"]').innerText()).trim(),
      'Advanced Software Engineering'
    );
    assert.ok(
      (await firstCard.locator('[data-course-passmark="true"]').innerText()).includes('50'),
      'First course must show passMark 50'
    );

    const compScores = await firstCard.locator('[data-component-score="true"]').allInnerTexts();
    assert.deepEqual(
      compScores.map((s) => s.trim()),
      ['9 / 10', '14 / 15', '22.5 / 25', '40 / 50'],
      'All 4 published components must render formatted score / maxPoints'
    );

    assert.equal(
      (await firstCard.locator('[data-course-total="true"]').innerText()).trim(),
      '85.5 / 100'
    );
    assert.equal(
      (await firstCard.locator('[data-course-percentage="true"]').innerText()).trim(),
      '85.5%'
    );
    assert.equal(
      await firstCard.locator('[data-course-status="true"]').getAttribute('data-status-value'),
      'COMPLETED'
    );
    assert.equal(
      (await firstCard.locator('[data-course-status="true"]').innerText()).trim(),
      'Passed'
    );
    assert.equal(
      await firstCard.locator('[data-course-totals-pending="true"]').count(),
      0,
      'Fully published course must not show totals pending message'
    );

    // Second card has passMark: null and status: FAILED
    const secondCard = page.locator('[data-course-card="true"]').nth(1);
    assert.equal(
      await secondCard.locator('[data-course-passmark="true"]').count(),
      0,
      'Course with null passMark must not render passMark badge'
    );
    assert.equal(
      (await secondCard.locator('[data-course-total="true"]').innerText()).trim(),
      '35 / 100'
    );
    assert.equal(
      (await secondCard.locator('[data-course-percentage="true"]').innerText()).trim(),
      '35%'
    );
    assert.equal(
      await secondCard.locator('[data-course-status="true"]').getAttribute('data-status-value'),
      'FAILED'
    );
    assert.equal(
      (await secondCard.locator('[data-course-status="true"]').innerText()).trim(),
      'Failed'
    );

    await context.close();
  });

  // ── PROOF 3: Partially published course shows pending text and NO total/status ──
  it('Proof 3: Partially published course shows component pending publication badge, course totals pending text, and NO course total, percentage, or status', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'STUDENT',
      language: 'en',
    });
    await setupMyGradesRoute(page, { data: partiallyPublishedPayload });
    await page.goto(`${appServer.origin}/my-grades`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-course-card="true"]', { timeout: 8000 });

    const card = page.locator('[data-course-card="true"]').first();
    const rows = card.locator('tr[data-component-row="true"]');
    assert.equal(await rows.count(), 2);

    // Row 0 is published (24 / 30)
    assert.equal(
      (await rows.nth(0).locator('[data-component-score="true"]').innerText()).trim(),
      '24 / 30'
    );

    // Row 1 is unpublished -> shows Pending publication and no score
    assert.equal(await rows.nth(1).locator('[data-component-score="true"]').count(), 0);
    assert.equal(await rows.nth(1).locator('[data-component-pending="true"]').count(), 1);
    assert.ok(
      (await rows.nth(1).locator('[data-component-pending="true"]').innerText()).includes(
        'Pending publication'
      )
    );

    // Course totals footer shows pending text and NO total, NO percentage, NO status
    assert.equal(
      await card.locator('[data-course-totals-pending="true"]').count(),
      1,
      'Partially published course must show totals pending text'
    );
    assert.ok(
      (await card.locator('[data-course-totals-pending="true"]').innerText()).includes(
        'pending publication'
      )
    );
    assert.equal(
      await card.locator('[data-course-total="true"]').count(),
      0,
      'Partially published course must NEVER render course total'
    );
    assert.equal(
      await card.locator('[data-course-percentage="true"]').count(),
      0,
      'Partially published course must NEVER render course percentage'
    );
    assert.equal(
      await card.locator('[data-course-status="true"]').count(),
      0,
      'Partially published course must NEVER render pass/fail status'
    );

    await context.close();
  });

  // ── PROOF 3b: Course without grade structure shows empty-structure state and never a total ──
  it('Proof 3b: Course without grade structure (components [] and null totals) shows localized empty-structure state and never a total, never NaN', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'STUDENT',
      language: 'en',
    });
    await setupMyGradesRoute(page, { data: noGradeStructurePayload });

    await page.goto(`${appServer.origin}/my-grades`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-course-card="true"]', { timeout: 8000 });

    const card = page.locator('article[data-course-card="true"]').first();
    assert.equal(await card.count(), 1, 'Course card must be rendered');

    // Localized empty-structure state
    assert.equal(
      await card.locator('[data-course-no-components="true"]').count(),
      1,
      'Course card without components must render [data-course-no-components="true"]'
    );
    const noComponentsText = (
      await card.locator('[data-course-no-components="true"]').innerText()
    ).trim();
    assert.ok(
      noComponentsText.includes('No published grade components are available for this course yet.'),
      `Must display localized noComponentsYet message, got: ${noComponentsText}`
    );

    // Totals pending state
    assert.equal(
      await card.locator('[data-course-totals-pending="true"]').count(),
      1,
      'Course card without components must render totals pending banner'
    );

    // NEVER a total, NEVER percentage, NEVER status, NEVER NaN
    assert.equal(
      await card.locator('[data-course-total="true"]').count(),
      0,
      'Course without grade structure must NEVER render a course total'
    );
    assert.equal(
      await card.locator('[data-course-percentage="true"]').count(),
      0,
      'Course without grade structure must NEVER render course percentage'
    );
    assert.equal(
      await card.locator('[data-course-status="true"]').count(),
      0,
      'Course without grade structure must NEVER render course status'
    );

    const cardFullText = await card.innerText();
    assert.equal(
      cardFullText.includes('NaN'),
      false,
      `Course card must NEVER contain "NaN", got card text: ${cardFullText}`
    );

    await context.close();
  });

  // ── PROOF 4: An absent entry renders ABS and never "0/" ──
  it('Proof 4: An absent entry (isAbsent: true, score: 0) renders ABS and never renders "0/"', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'STUDENT',
      language: 'en',
    });
    await setupMyGradesRoute(page, { data: absentComponentPayload });
    await page.goto(`${appServer.origin}/my-grades`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-course-card="true"]', { timeout: 8000 });

    const absentRow = page.locator('tr[data-component-row="true"]').first();
    assert.equal(
      await absentRow.locator('[data-component-absent="true"]').count(),
      1,
      'Absent component row must render [data-component-absent="true"] badge'
    );
    assert.equal(
      await absentRow.locator('[data-component-score="true"]').count(),
      0,
      'Absent component row must NOT render numeric score element'
    );

    const absentBadgeText = (
      await absentRow.locator('[data-component-absent="true"]').innerText()
    ).trim();
    assert.equal(absentBadgeText, 'ABS');

    const resultCellText = await absentRow.locator('[data-component-result="true"]').innerText();
    assert.equal(
      resultCellText.includes('0/') || resultCellText.includes('0 /'),
      false,
      `Absent component cell "${resultCellText}" must NEVER render "0/" or "0 /"`
    );

    await context.close();
  });

  // ── PROOF 5: Empty state ──
  it('Proof 5: Empty state renders friendly localized message when no published grades exist', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'STUDENT',
      language: 'en',
    });
    await setupMyGradesRoute(page, { data: [] });
    await page.goto(`${appServer.origin}/my-grades`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-my-grades-empty="true"]', { timeout: 8000 });

    assert.equal(await page.locator('[data-my-grades-empty="true"]').count(), 1);
    assert.equal(await page.locator('[data-course-card="true"]').count(), 0);
    const emptyText = await page.locator('[data-my-grades-empty="true"]').innerText();
    assert.ok(emptyText.includes('No published grades yet'));

    await context.close();
  });

  // ── PROOF 6: 401/403/500 localized in ar and en and a retry that refetches ──
  it('Proof 6: 401, 403, and 500 errors render localized messages in EN and AR, and Retry button refetches and loads grades', async () => {
    const errorCases = [
      {
        status: 401,
        message: 'Authentication required',
        enSnippet: 'Your session could not be verified',
        arSnippet: 'تعذر التحقق من جلستك الحالية',
      },
      {
        status: 403,
        message: 'Only students can access their personal grades',
        enSnippet: 'Only students can view personal course grades',
        arSnippet: 'يمكن للطلاب فقط الاطلاع على صفحة الدرجات الشخصية',
      },
      {
        status: 500,
        message: 'RAW_INTERNAL_DB_FAILURE_STACK',
        enSnippet: 'An error occurred while loading your published grades',
        arSnippet: 'حدث خطأ أثناء تحميل درجاتك المنشورة',
      },
    ];

    for (const tc of errorCases) {
      // EN verification + retry refetch
      const { context: enCtx, page: enPage } = await mockSessionPage(browser, {
        role: 'STUDENT',
        language: 'en',
      });
      let enCallCount = 0;
      let enRetried = false;
      await enPage.route('**/api/enrollments/my-grades*', async (route) => {
        enCallCount++;
        if (!enRetried) {
          await route.fulfill({
            status: tc.status,
            contentType: 'application/json',
            body: JSON.stringify({ success: false, message: tc.message }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: fullyPublishedCoursesPayload }),
        });
      });

      await enPage.goto(`${appServer.origin}/my-grades`, { waitUntil: 'networkidle' });
      await enPage.waitForSelector('[data-my-grades-error="true"]', { timeout: 8000 });
      const enErrText = await enPage.locator('[data-error-description="true"]').innerText();
      assert.ok(
        enErrText.includes(tc.enSnippet),
        `EN ${tc.status} error "${enErrText}" must include "${tc.enSnippet}"`
      );
      assert.equal(
        enErrText.includes('RAW_INTERNAL_DB_FAILURE_STACK'),
        false,
        'Must never leak raw backend 500 message'
      );

      // Click Retry -> refetches and renders course cards
      enRetried = true;
      const enPreRetryCalls = enCallCount;
      await enPage.locator('button[data-retry-button="true"]').click();
      await enPage.waitForSelector('[data-course-card="true"]', { timeout: 8000 });
      assert.ok(enCallCount > enPreRetryCalls, `Retry on ${tc.status} in EN must refetch GET /api/enrollments/my-grades`);
      assert.equal(await enPage.locator('[data-course-card="true"]').count(), 2);
      await enCtx.close();

      // AR verification + retry refetch
      const { context: arCtx, page: arPage } = await mockSessionPage(browser, {
        role: 'STUDENT',
        language: 'ar',
      });
      await arPage.addInitScript(() => {
        localStorage.setItem('language', 'ar');
      });
      let arCallCount = 0;
      let arRetried = false;
      await arPage.route('**/api/enrollments/my-grades*', async (route) => {
        arCallCount++;
        if (!arRetried) {
          await route.fulfill({
            status: tc.status,
            contentType: 'application/json',
            body: JSON.stringify({ success: false, message: tc.message }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: fullyPublishedCoursesPayload }),
        });
      });

      await arPage.goto(`${appServer.origin}/my-grades`, { waitUntil: 'networkidle' });
      await arPage.waitForSelector('[data-my-grades-error="true"]', { timeout: 8000 });
      const arErrText = await arPage.locator('[data-error-description="true"]').innerText();
      assert.ok(
        arErrText.includes(tc.arSnippet),
        `AR ${tc.status} error "${arErrText}" must include "${tc.arSnippet}"`
      );
      assert.equal(
        arErrText.includes('RAW_INTERNAL_DB_FAILURE_STACK'),
        false,
        'Must never leak raw English backend 500 message in AR'
      );

      arRetried = true;
      const arPreRetryCalls = arCallCount;
      await arPage.locator('button[data-retry-button="true"]').click();
      await arPage.waitForSelector('[data-course-card="true"]', { timeout: 8000 });
      assert.ok(arCallCount > arPreRetryCalls, `Retry on ${tc.status} in AR must refetch GET /api/enrollments/my-grades`);
      assert.equal(await arPage.locator('[data-course-card="true"]').count(), 2);
      await arCtx.close();
    }
  });

  // ── PROOF 7: Request URL exact and called once per load ──
  it('Proof 7: GET /api/enrollments/my-grades request URL is exact (no extra query params) and called exactly once per page load', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'STUDENT',
      language: 'en',
    });
    myGradesRequests = [];
    await setupMyGradesRoute(page);

    await page.goto(`${appServer.origin}/my-grades`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-course-card="true"]', { timeout: 8000 });

    assert.equal(
      myGradesRequests.length,
      1,
      `Expected exactly 1 request to /api/enrollments/my-grades per load, got ${myGradesRequests.length}`
    );
    assert.equal(myGradesRequests[0].method, 'GET');
    const parsedReqUrl = new URL(myGradesRequests[0].url);
    assert.equal(
      parsedReqUrl.pathname + parsedReqUrl.search,
      '/api/enrollments/my-grades',
      `Request URL path+search must be exact (/api/enrollments/my-grades): ${myGradesRequests[0].url}`
    );
    assert.equal(
      parsedReqUrl.search,
      '',
      `Request URL must not include any query string: ${myGradesRequests[0].url}`
    );
    assert.equal(
      myGradesRequests[0].url,
      'http://localhost:5000/api/enrollments/my-grades',
      `Request URL must be exact: ${myGradesRequests[0].url}`
    );

    await context.close();
  });

  // ── PROOF 8: Matrix 1440/1024/768/430/390/360 x ar/en x light/dark (24 tests) ──
  const viewports = [1440, 1024, 768, 430, 390, 360];
  const languages = ['en', 'ar'];
  const themes = ['light', 'dark'];

  for (const width of viewports) {
    for (const lang of languages) {
      for (const theme of themes) {
        it(`Proof 8 [${width}px ${lang.toUpperCase()} ${theme.toUpperCase()}]: dir/lang, dark class, scrollWidth <= innerWidth, and tables/cards bounds inside viewport`, async () => {
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

          await setupMyGradesRoute(page, { data: fullyPublishedCoursesPayload });
          await page.goto(`${appServer.origin}/my-grades`, { waitUntil: 'networkidle' });
          await page.waitForSelector('[data-my-grades-page="true"]', { timeout: 8000 });
          await page.waitForSelector('[data-course-card="true"]', { timeout: 8000 });

          const htmlDir = await page.getAttribute('html', 'dir');
          const htmlLang = await page.getAttribute('html', 'lang');
          assert.equal(htmlDir, lang === 'ar' ? 'rtl' : 'ltr');
          assert.equal(htmlLang, lang);

          const hasDarkClass = await page.evaluate(() =>
            document.documentElement.classList.contains('dark')
          );
          assert.equal(hasDarkClass, theme === 'dark');

          const layoutMetrics = await page.evaluate(() => {
            const scrollWidth = document.documentElement.scrollWidth;
            const innerWidth = window.innerWidth;
            const cards = Array.from(document.querySelectorAll('[data-course-card="true"]')).map(
              (el) => {
                const r = el.getBoundingClientRect();
                return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
              }
            );
            const tables = Array.from(
              document.querySelectorAll('table[data-components-table="true"]')
            ).map((el) => {
              const r = el.getBoundingClientRect();
              return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
            });
            return { scrollWidth, innerWidth, cards, tables };
          });

          assert.ok(
            layoutMetrics.scrollWidth <= layoutMetrics.innerWidth,
            `scrollWidth (${layoutMetrics.scrollWidth}) must be <= innerWidth (${layoutMetrics.innerWidth}) at ${width}px ${lang} ${theme}`
          );
          assert.ok(layoutMetrics.cards.length >= 2, 'Must render course cards');
          for (const cardBox of layoutMetrics.cards) {
            assert.ok(
              cardBox.left >= 0 && cardBox.right <= layoutMetrics.innerWidth,
              `Course card bounds [${cardBox.left}, ${cardBox.right}] must be inside viewport [0, ${layoutMetrics.innerWidth}] at ${width}px ${lang} ${theme}`
            );
          }
          assert.ok(layoutMetrics.tables.length >= 2, 'Must render component tables');
          for (const tableBox of layoutMetrics.tables) {
            assert.ok(
              tableBox.left >= 0 && tableBox.right <= layoutMetrics.innerWidth,
              `Component table bounds [${tableBox.left}, ${tableBox.right}] must be inside viewport [0, ${layoutMetrics.innerWidth}] at ${width}px ${lang} ${theme}`
            );
          }
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

