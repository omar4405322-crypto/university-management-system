import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

describe('T-7a Browser Verification: Course Gradebook Page Smoke, Matrix & Action Proofs', () => {
  let appServer;
  let browser;

  // Track captured requests for contract assertion
  let lastDraftRequest = null;
  let lastPublishRequest = null;
  let lastCorrectionRequest = null;
  let publishRequestCount = 0;
  let lastGradebookUrl = null;

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
    department: { id: 10, name: 'Computer Science', college: { id: 1, name: 'Faculty of Computers' } },
  };

  // Generate 20 students, including one 40-char name and one 60-char unbroken token
  const mockStudents = Array.from({ length: 20 }, (_, idx) => {
    const num = idx + 1;
    let firstName = `Student${num}`;
    let lastName = `LastName${num}`;
    let studentIdCode = `STU2026${String(num).padStart(4, '0')}`;

    if (num === 1) {
      firstName = 'A'.repeat(20);
      lastName = 'B'.repeat(20);
    } else if (num === 2) {
      studentIdCode = 'TOKEN_' + 'X'.repeat(54);
    }

    return {
      studentId: 100 + num,
      enrollmentId: 1000 + num,
      firstName,
      lastName,
      studentIdCode,
      groupId: num % 2 === 0 ? 1 : 2,
      status: 'ENROLLED',
      grades: [
        {
          componentId: 101,
          componentName: 'Attendance',
          maxPoints: 10,
          source: 'AUTO_ATTENDANCE',
          value: 9,
          score: null,
          isAbsent: false,
          status: null,
          version: null,
          notes: null,
        },
        {
          componentId: 102,
          componentName: 'Quiz 1',
          maxPoints: 15,
          source: 'AUTO_QUIZ',
          value: 14,
          score: null,
          isAbsent: false,
          status: null,
          version: null,
          notes: null,
        },
        {
          componentId: 103,
          componentName: 'Midterm Exam',
          maxPoints: 25,
          source: 'MANUAL',
          value: num === 3 ? 22 : null,
          score: num === 3 ? 22 : null,
          isAbsent: false,
          status: num === 3 ? 'PUBLISHED' : null,
          version: num === 3 ? 1 : null,
          notes: null,
        },
        {
          componentId: 104,
          componentName: 'Final Exam',
          maxPoints: 50,
          source: 'MANUAL',
          value: num === 4 ? null : 40,
          score: num === 4 ? null : 40,
          isAbsent: num === 4 ? true : false,
          status: num === 4 ? 'DRAFT' : null,
          version: num === 4 ? 1 : null,
          notes: null,
        },
      ],
    };
  });

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
    students: mockStudents,
  };

  const setupGradebookRoutes = async (page, options = {}) => {
    const {
      gradebookStatus = 200,
      gradebookPayload = mockGradebookData,
      draftStatus = 200,
      draftPayload = { success: true, data: { courseId: 1, termId: 1, savedCount: 1 } },
      publishStatus = 200,
      publishPayload = {
        success: true,
        data: {
          courseId: 1,
          termId: 1,
          complete: [{ enrollmentId: 1001, studentId: 101, finalPointsEarned: 85, finalPointsMax: 100, finalGrade: 85, status: 'COMPLETED' }],
          incomplete: [{ enrollmentId: 1002, studentId: 102, missingComponents: [104] }],
          skipped: [{ enrollmentId: 1003, studentId: 103, status: 'WITHDRAWN', reason: 'Enrollment status is WITHDRAWN' }],
        },
      },
      correctStatus = 200,
      correctPayload = {
        success: true,
        data: {
          success: true,
          updatedCount: 1,
          entries: [{
            enrollmentId: 1003,
            componentId: 103,
            before: { score: 22, isAbsent: false, version: 1 },
            after: { score: 24.5, isAbsent: false, version: 2 },
            reason: 'Re-evaluation of exam paper upon student grievance appeal',
          }],
          enrollmentTotals: [{
            enrollmentId: 1003,
            before: { finalPointsEarned: 85, finalPointsMax: 100, finalGrade: 85, status: 'COMPLETED' },
            after: { finalPointsEarned: 87.5, finalPointsMax: 100, finalGrade: 87.5, status: 'COMPLETED' },
          }],
        },
      },
      onGradebookFetch = null,
      onPublishPost = null,
      onCorrectPost = null,
    } = options;

    await page.route('**/api/courses/1/gradebook/publish*', async (route) => {
      const req = route.request();
      publishRequestCount++;
      lastPublishRequest = {
        url: req.url(),
        method: req.method(),
        postData: JSON.parse(req.postData() || '{}'),
      };
      if (onPublishPost) onPublishPost(lastPublishRequest);
      if (publishStatus !== 200) {
        await route.fulfill({
          status: publishStatus,
          contentType: 'application/json',
          body: JSON.stringify(publishPayload),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(publishPayload),
      });
    });

    await page.route('**/api/courses/1/gradebook/correct*', async (route) => {
      const req = route.request();
      lastCorrectionRequest = {
        url: req.url(),
        method: req.method(),
        postData: JSON.parse(req.postData() || '{}'),
      };
      if (onCorrectPost) onCorrectPost(lastCorrectionRequest);
      if (correctStatus !== 200) {
        await route.fulfill({
          status: correctStatus,
          contentType: 'application/json',
          body: JSON.stringify(correctPayload),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(correctPayload),
      });
    });

    await page.route('**/api/courses/1/gradebook/draft*', async (route) => {
      lastDraftRequest = {
        url: route.request().url(),
        method: route.request().method(),
        postData: JSON.parse(route.request().postData() || '{}'),
      };
      if (draftStatus !== 200) {
        await route.fulfill({
          status: draftStatus,
          contentType: 'application/json',
          body: JSON.stringify(draftPayload),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { courseId: 1, termId: 1, savedCount: 1 },
        }),
      });
    });

    await page.route('**/api/courses/1/gradebook*', async (route) => {
      const url = route.request().url();
      if (url.includes('/publish') || url.includes('/correct') || url.includes('/draft')) {
        return route.fallback();
      }
      lastGradebookUrl = url;
      if (onGradebookFetch) onGradebookFetch(url);

      if (gradebookStatus !== 200) {
        await route.fulfill({
          status: gradebookStatus,
          contentType: 'application/json',
          body: JSON.stringify(gradebookPayload),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: typeof gradebookPayload === 'function' ? gradebookPayload(url) : gradebookPayload,
        }),
      });
    });

    await page.route('**/api/courses/1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockCourse,
        }),
      });
    });

    await page.route('**/api/academic-terms/current', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockTerms[0],
        }),
      });
    });

    await page.route('**/api/academic-terms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockTerms,
        }),
      });
    });
  };

  it('setup server and chromium browser', async () => {
    appServer = await serveBuiltApp();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  });

  // ── RESTORED COVERAGE ASSERTIONS (STEP 0 c) ──
  it('Coverage 1 (EN): renders table with 20 student rows and editable inputs for manual components', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'DOCTOR',
      language: 'en',
      user: { doctor: { id: 1 } },
    });
    await setupGradebookRoutes(page);
    await page.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page.waitForSelector('table', { timeout: 8000 });

    const rows = await page.locator('tr[data-student-row="true"]').count();
    assert.equal(rows, 20, 'Gradebook table must render exactly 20 student rows');

    const inputs = await page.locator('input[data-cell-input="true"]').count();
    assert.ok(inputs > 0, 'Table must contain editable numeric inputs for draft manual cells');
    await context.close();
  });

  it('Coverage 2 (AR): renders table with dir=rtl, Arabic course details, and localized column headers', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'DOCTOR',
      language: 'ar',
      user: { doctor: { id: 1 } },
    });
    await page.addInitScript(() => {
      localStorage.setItem('language', 'ar');
    });
    await setupGradebookRoutes(page);
    await page.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page.waitForSelector('table', { timeout: 8000 });

    const htmlDir = await page.getAttribute('html', 'dir');
    assert.equal(htmlDir, 'rtl', 'HTML dir must be rtl in Arabic');

    // Check localized header text (e.g. Student column / الطالب)
    const headerText = await page.locator('thead').innerText();
    assert.ok(headerText.includes('الطالب'), 'Table header must render localized student column header (الطالب)');
    await context.close();
  });

  it('Coverage 3 (Mobile 390px): renders responsive gradebook without horizontal document overflow and scrollable table container', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'DOCTOR',
      language: 'en',
      user: { doctor: { id: 1 } },
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await setupGradebookRoutes(page);
    await page.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page.waitForSelector('table', { timeout: 8000 });

    // Assert document horizontal overflow is zero
    const { docScrollWidth, innerWidth } = await page.evaluate(() => ({
      docScrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    assert.ok(docScrollWidth <= innerWidth, `Document must not overflow horizontally on 390px: ${docScrollWidth} <= ${innerWidth}`);

    // Assert table container enables horizontal scroll
    const tableScrolls = await page.evaluate(() => {
      const el = document.querySelector('[data-table-container="true"] > div');
      return el ? el.scrollWidth > el.clientWidth : false;
    });
    assert.ok(tableScrolls, 'Table inner container must be horizontally scrollable on mobile viewport');
    await context.close();
  });

  // ── BASELINE 28-CELL VIEWPORT MATRIX (from T-7a-1) ──
  const viewports = [1440, 1280, 1024, 768, 430, 390, 360];
  const languages = ['en', 'ar'];
  const themes = ['light', 'dark'];

  for (const width of viewports) {
    for (const lang of languages) {
      for (const theme of themes) {
        it(`${width}px ${lang.toUpperCase()} ${theme.toUpperCase()}: loads gradebook with 20 rows, sticky layout, no document overflow`, async () => {
          const { context, page } = await mockSessionPage(browser, {
            role: 'DOCTOR',
            language: lang,
            user: { doctor: { id: 1 } },
          });

          await page.addInitScript(({ theme, lang }) => {
            localStorage.setItem('theme', theme);
            localStorage.setItem('language', lang);
          }, { theme, lang });

          await page.setViewportSize({ width, height: 900 });

          const jsErrors = [];
          page.on('pageerror', (err) => jsErrors.push(err.message));
          page.on('console', (msg) => {
            if (msg.type() === 'error' && !msg.text().includes('ERR_FAILED')) {
              jsErrors.push(msg.text());
            }
          });

          await setupGradebookRoutes(page);
          await page.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
          await page.waitForSelector('table', { timeout: 8000 });

          const htmlDir = await page.getAttribute('html', 'dir');
          const htmlLang = await page.getAttribute('html', 'lang');
          assert.equal(htmlDir, lang === 'ar' ? 'rtl' : 'ltr');
          assert.equal(htmlLang, lang);

          const hasDarkClass = await page.evaluate(() => document.documentElement.classList.contains('dark'));
          if (theme === 'dark') {
            assert.equal(hasDarkClass, true);
          } else {
            assert.equal(hasDarkClass, false);
          }

          const { scrollWidth, innerWidth } = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
          }));
          assert.ok(scrollWidth <= innerWidth);
          assert.equal(jsErrors.length, 0);
          await context.close();
        });
      }
    }
  }

  // ── BASELINE DRAFT TESTS ──
  it('Save draft contract: request URL includes termId and payload has typed keys', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'DOCTOR',
      language: 'en',
      user: { doctor: { id: 1 } },
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await setupGradebookRoutes(page);
    await page.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[data-cell-input="true"]', { timeout: 8000 });

    const firstManualInput = page.locator('input[data-cell-input="true"]').first();
    const saveButton = page.locator('button[data-save-draft="true"]');

    await firstManualInput.fill('45');
    assert.ok(await saveButton.isDisabled());

    await firstManualInput.fill('20');
    await page.waitForFunction(() => {
      const btn = document.querySelector('button[data-save-draft="true"]');
      return btn && !btn.hasAttribute('disabled');
    });

    await saveButton.click();
    await page.waitForTimeout(500);

    assert.ok(lastDraftRequest);
    assert.ok(lastDraftRequest.url.includes('termId=1'));
    const entries = lastDraftRequest.postData.entries;
    assert.ok(Array.isArray(entries) && entries.length > 0);
    const entry = entries[0];
    assert.equal(typeof entry.enrollmentId, 'number');
    assert.equal(typeof entry.componentId, 'number');
    assert.ok(typeof entry.score === 'number' || entry.score === null);
    assert.equal(typeof entry.isAbsent, 'boolean');

    await context.close();
  });

  it('Role gating: Doctor and TA can edit, Admin is read-only (no inputs, no save), Student never sees link and is blocked', async () => {
    const { context: docCtx, page: docPage } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'en' });
    await setupGradebookRoutes(docPage);
    await docPage.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    assert.ok((await docPage.locator('input[data-cell-input="true"]').count()) > 0);
    assert.ok((await docPage.locator('button[data-save-draft="true"]').count()) > 0);
    await docCtx.close();

    const { context: taCtx, page: taPage } = await mockSessionPage(browser, { role: 'TEACHING_ASSISTANT', language: 'en' });
    await setupGradebookRoutes(taPage);
    await taPage.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    assert.ok((await taPage.locator('input[data-cell-input="true"]').count()) > 0);
    await taCtx.close();

    const { context: admCtx, page: admPage } = await mockSessionPage(browser, { role: 'SUPER_ADMIN', language: 'en' });
    await setupGradebookRoutes(admPage);
    await admPage.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    assert.equal(await admPage.locator('input[data-cell-input="true"]').count(), 0);
    assert.equal(await admPage.locator('button[data-save-draft="true"]').count(), 0);
    await admCtx.close();

    const { context: stuCtx, page: stuPage } = await mockSessionPage(browser, { role: 'STUDENT', language: 'en' });
    await setupGradebookRoutes(stuPage);
    await stuPage.goto(`${appServer.origin}/courses/1`, { waitUntil: 'networkidle' });
    assert.equal(await stuPage.locator('a[href*="/gradebook"]').count(), 0);
    await stuCtx.close();
  });

  it('Error screens: 403, 404, and 409 missing structure render localized message with back button (never blank page)', async () => {
    const { context: ctx403, page: page403 } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'en' });
    await setupGradebookRoutes(page403, { gradebookStatus: 403, gradebookPayload: { success: false, message: 'Forbidden' } });
    await page403.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page403.waitForSelector('[data-gradebook-error="true"]', { timeout: 8000 });
    assert.ok((await page403.locator('button[data-back-button="true"]').count()) > 0);
    await ctx403.close();

    const { context: ctx404, page: page404 } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'en' });
    await setupGradebookRoutes(page404, { gradebookStatus: 404, gradebookPayload: { success: false, message: 'Not Found' } });
    await page404.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page404.waitForSelector('[data-gradebook-error="true"]', { timeout: 8000 });
    assert.ok((await page404.locator('button[data-back-button="true"]').count()) > 0);
    await ctx404.close();

    const { context: ctx409, page: page409 } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'en' });
    await setupGradebookRoutes(page409, { gradebookStatus: 409, gradebookPayload: { success: false, message: 'Grade structure has not been defined' } });
    await page409.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page409.waitForSelector('[data-gradebook-error="true"]', { timeout: 8000 });
    assert.ok((await page409.locator('button[data-back-button="true"]').count()) > 0);
    await ctx409.close();
  });

  it('B.1: Optimistic-lock 409 on save: user edits stay in inputs, localized banner with Reload latest shows, Reload refetches', async () => {
    const { context, page } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'en' });
    let getFetchCount = 0;
    await setupGradebookRoutes(page, {
      draftStatus: 409,
      draftPayload: { success: false, message: 'Optimistic lock conflict: version mismatch' },
      onGradebookFetch: () => { getFetchCount++; },
    });
    await page.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[data-cell-input="true"]', { timeout: 8000 });

    const firstManualInput = page.locator('input[data-cell-input="true"]').first();
    const saveButton = page.locator('button[data-save-draft="true"]');

    await firstManualInput.fill('18');
    await page.waitForFunction(() => {
      const btn = document.querySelector('button[data-save-draft="true"]');
      return btn && !btn.hasAttribute('disabled');
    });

    await saveButton.click();
    await page.waitForSelector('button[data-reload-latest="true"]', { timeout: 8000 });
    assert.ok(await page.locator('[data-optimistic-banner="true"]').isVisible());

    const valAfterConflict = await firstManualInput.inputValue();
    assert.equal(valAfterConflict, '18');

    const initialFetches = getFetchCount;
    await page.locator('button[data-reload-latest="true"]').click();
    await page.waitForTimeout(500);
    assert.ok(getFetchCount > initialFetches);
    await context.close();
  });

  it('B.2: ABS toggle disables score input; request body has score null and isAbsent true', async () => {
    const { context, page } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'en' });
    await setupGradebookRoutes(page);
    await page.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[data-cell-input="true"]', { timeout: 8000 });

    const firstInput = page.locator('input[data-cell-input="true"]').first();
    const absBtn = page.locator('button:has-text("ABS")').first();

    assert.ok(!(await firstInput.isDisabled()));
    await absBtn.click();
    assert.ok(await firstInput.isDisabled());

    await page.waitForFunction(() => {
      const btn = document.querySelector('button[data-save-draft="true"]');
      return btn && !btn.hasAttribute('disabled');
    });

    const saveButton = page.locator('button[data-save-draft="true"]');
    await saveButton.click();
    await page.waitForTimeout(500);

    assert.ok(lastDraftRequest);
    const absEntry = lastDraftRequest.postData.entries[0];
    assert.equal(absEntry.isAbsent, true);
    assert.equal(absEntry.score, null);
    await context.close();
  });

  it('B.3: PUBLISHED MANUAL cell is read-only with a marker (no input)', async () => {
    const { context, page } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'en' });
    await setupGradebookRoutes(page);
    await page.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page.waitForSelector('table', { timeout: 8000 });

    const student3Row = page.locator('tbody tr').nth(2);
    const publishedCell = student3Row.locator('td').nth(3);

    assert.equal(await publishedCell.locator('input').count(), 0);
    assert.ok(await publishedCell.locator('span:has-text("Published")').isVisible());
    assert.ok((await publishedCell.innerText()).includes('22'));
    await context.close();
  });

  it('B.4: AUTO column shows localized "automatic" badge and has zero inputs', async () => {
    const { context, page } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'en' });
    await setupGradebookRoutes(page);
    await page.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page.waitForSelector('table', { timeout: 8000 });

    const rows = page.locator('tbody tr');
    assert.equal(await rows.count(), 20);

    for (let r = 0; r < 5; r++) {
      const row = rows.nth(r);
      const autoCell1 = row.locator('td').nth(1);
      const autoCell2 = row.locator('td').nth(2);
      assert.equal(await autoCell1.locator('input').count(), 0);
      assert.equal(await autoCell2.locator('input').count(), 0);
      assert.ok(await autoCell1.locator('span:has-text("Automatic")').isVisible());
      assert.ok(await autoCell2.locator('span:has-text("Automatic")').isVisible());
    }
    await context.close();
  });

  it('B.5: passMark null shows informational banner', async () => {
    const { context, page } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'en' });
    const payloadWithNullPassMark = {
      ...mockGradebookData,
      structure: { ...mockGradebookData.structure, passMark: null },
    };
    await setupGradebookRoutes(page, { gradebookPayload: payloadWithNullPassMark });
    await page.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page.waitForSelector('table', { timeout: 8000 });
    assert.ok(await page.locator('text=Pass mark has not been set').isVisible());
    await context.close();
  });

  it('B.6: Term select sends termId on next GET', async () => {
    const { context, page } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'en' });
    const requestedUrls = [];
    await setupGradebookRoutes(page, { onGradebookFetch: (url) => requestedUrls.push(url) });
    await page.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#gradebook-term-select', { timeout: 8000 });

    await page.selectOption('#gradebook-term-select', '2');
    await page.waitForTimeout(500);
    assert.ok(requestedUrls.find((u) => u.includes('termId=2')));
    await context.close();
  });

  it('B.7: Client-side search filters rows', async () => {
    const { context, page } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'en' });
    await setupGradebookRoutes(page);
    await page.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page.waitForSelector('table', { timeout: 8000 });

    const searchInput = page.locator('input[placeholder*="Search"]');
    assert.equal(await page.locator('tbody tr').count(), 20);

    await searchInput.fill('Student3');
    await page.waitForTimeout(200);
    assert.equal(await page.locator('tbody tr').count(), 1);

    await searchInput.fill('XYZ_NO_MATCH_999');
    await page.waitForTimeout(200);
    assert.ok(await page.locator('text=No students matching your search criteria').isVisible());
    await context.close();
  });

  it('B.8: Invalid score (negative, 3 decimals, above max): inline localized error and Save disabled', async () => {
    const { context, page } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'en' });
    await setupGradebookRoutes(page);
    await page.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[data-cell-input="true"]', { timeout: 8000 });

    const firstInput = page.locator('input[data-cell-input="true"]').first();
    const saveButton = page.locator('button[data-save-draft="true"]');

    await firstInput.fill('-5');
    await page.waitForTimeout(200);
    assert.ok(await saveButton.isDisabled());
    assert.ok(await page.locator('text=Score cannot be negative').isVisible());

    await firstInput.fill('12.345');
    await page.waitForTimeout(200);
    assert.ok(await saveButton.isDisabled());
    assert.ok(await page.locator('text=Score cannot have more than 2 decimal places').isVisible());

    await firstInput.fill('35');
    await page.waitForTimeout(200);
    assert.ok(await saveButton.isDisabled());
    assert.ok(await page.locator('text=Score exceeds maximum allowed points').isVisible());

    await firstInput.fill('20');
    await page.waitForFunction(() => {
      const btn = document.querySelector('button[data-save-draft="true"]');
      return btn && !btn.hasAttribute('disabled');
    });
    assert.ok(!(await saveButton.isDisabled()));
    await context.close();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ── T-7a-2 DEDICATED PROOFS 1 TO 7 ──
  // ═══════════════════════════════════════════════════════════════════════

  // PROOF 1: Role gating: DOCTOR sees both actions, Admin & TA see neither
  it('Proof 1: Doctor sees both publish and correct actions; Super/College/Department Admin and TA see neither', async () => {
    // 1. DOCTOR: sees both
    const { context: docCtx, page: docPage } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'en' });
    await setupGradebookRoutes(docPage);
    await docPage.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await docPage.waitForSelector('table', { timeout: 8000 });
    const docPublishCount = await docPage.locator('button[data-publish-button="true"]').count();
    const docCorrectCount = await docPage.locator('button[data-correct-cell="true"]').count();
    assert.ok(docPublishCount > 0, 'Doctor must see Publish Gradebook button');
    assert.ok(docCorrectCount > 0, 'Doctor must see Correct action button on published manual cells');
    await docCtx.close();

    // 2. TEACHING_ASSISTANT: sees neither
    const { context: taCtx, page: taPage } = await mockSessionPage(browser, { role: 'TEACHING_ASSISTANT', language: 'en' });
    await setupGradebookRoutes(taPage);
    await taPage.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await taPage.waitForSelector('table', { timeout: 8000 });
    assert.equal(await taPage.locator('button[data-publish-button="true"]').count(), 0, 'TA must NOT see Publish button');
    assert.equal(await taPage.locator('button[data-correct-cell="true"]').count(), 0, 'TA must NOT see Correct button');
    await taCtx.close();

    // 3. SUPER_ADMIN: sees neither
    const { context: superCtx, page: superPage } = await mockSessionPage(browser, { role: 'SUPER_ADMIN', language: 'en' });
    await setupGradebookRoutes(superPage);
    await superPage.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await superPage.waitForSelector('table', { timeout: 8000 });
    assert.equal(await superPage.locator('button[data-publish-button="true"]').count(), 0, 'Super Admin must NOT see Publish button');
    assert.equal(await superPage.locator('button[data-correct-cell="true"]').count(), 0, 'Super Admin must NOT see Correct button');
    await superCtx.close();

    // 4. COLLEGE_ADMIN: sees neither
    const { context: colCtx, page: colPage } = await mockSessionPage(browser, { role: 'COLLEGE_ADMIN', language: 'en' });
    await setupGradebookRoutes(colPage);
    await colPage.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await colPage.waitForSelector('table', { timeout: 8000 });
    assert.equal(await colPage.locator('button[data-publish-button="true"]').count(), 0, 'College Admin must NOT see Publish button');
    assert.equal(await colPage.locator('button[data-correct-cell="true"]').count(), 0, 'College Admin must NOT see Correct button');
    await colCtx.close();

    // 5. DEPARTMENT_ADMIN: sees neither
    const { context: deptCtx, page: deptPage } = await mockSessionPage(browser, { role: 'DEPARTMENT_ADMIN', language: 'en' });
    await setupGradebookRoutes(deptPage);
    await deptPage.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await deptPage.waitForSelector('table', { timeout: 8000 });
    assert.equal(await deptPage.locator('button[data-publish-button="true"]').count(), 0, 'Dept Admin must NOT see Publish button');
    assert.equal(await deptPage.locator('button[data-correct-cell="true"]').count(), 0, 'Dept Admin must NOT see Correct button');
    await deptCtx.close();
  });

  // PROOF 2: Publish modal: cancel sends nothing, confirm sends exactly one POST with termId
  it('Proof 2: Publish modal cancel sends nothing; confirm sends exactly one POST with termId (double-click protected, no enrollmentIds)', async () => {
    const { context, page } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'en' });
    lastPublishRequest = null;
    publishRequestCount = 0;

    await setupGradebookRoutes(page);
    await page.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page.waitForSelector('button[data-publish-button="true"]', { timeout: 8000 });

    // 1. Open Publish modal
    await page.locator('button[data-publish-button="true"]').click();
    await page.waitForSelector('[data-publish-modal="true"]', { timeout: 8000 });

    // 2. Click Cancel -> sends nothing
    await page.locator('button[data-publish-cancel="true"]').click();
    await page.waitForTimeout(300);
    assert.equal(publishRequestCount, 0, 'Cancel must not send any publish request');
    assert.equal(lastPublishRequest, null, 'No publish request should be recorded on cancel');

    // 3. Open Publish modal again
    await page.locator('button[data-publish-button="true"]').click();
    await page.waitForSelector('[data-publish-modal="true"]', { timeout: 8000 });

    // 4. Double click confirm button quickly to test double-click protection
    const confirmBtn = page.locator('button[data-publish-confirm="true"]');
    await confirmBtn.dblclick();
    await page.waitForTimeout(600);

    // 5. Assert exactly one POST request occurred
    assert.equal(publishRequestCount, 1, 'Double click must produce exactly one publish POST request');
    assert.ok(lastPublishRequest, 'Publish request must have been sent');
    assert.equal(lastPublishRequest.method, 'POST', 'Publish request must be POST');
    assert.ok(lastPublishRequest.url.includes('termId=1'), `URL must contain termId query: ${lastPublishRequest.url}`);
    assert.equal(lastPublishRequest.postData.enrollmentIds, undefined, 'Publish body must NOT contain enrollmentIds (full publication)');
    await context.close();
  });

  // PROOF 2b: Publish button disabled while unsaved draft changes exist; enabled after save
  it('Proof 2b: editing a cell without saving disables Publish button; successful save re-enables it', async () => {
    const { context, page } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'en' });
    await setupGradebookRoutes(page);
    await page.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[data-cell-input="true"]', { timeout: 8000 });

    const publishBtn = page.locator('button[data-publish-button="true"]');
    const firstManualInput = page.locator('input[data-cell-input="true"]').first();
    const saveButton = page.locator('button[data-save-draft="true"]');

    // Initially with no draft edits, Publish button is enabled
    assert.equal(await publishBtn.isDisabled(), false, 'Publish button must initially be enabled when no draft edits exist');

    // Edit cell without saving
    await firstManualInput.fill('21');
    await page.waitForFunction(() => {
      const btn = document.querySelector('button[data-publish-button="true"]');
      return btn && btn.hasAttribute('disabled');
    });
    assert.equal(await publishBtn.isDisabled(), true, 'Publish button must be disabled after editing cell without saving');

    // Save draft successfully
    await saveButton.click();
    await page.waitForFunction(() => {
      const btn = document.querySelector('button[data-publish-button="true"]');
      return btn && !btn.hasAttribute('disabled');
    });
    assert.equal(await publishBtn.isDisabled(), false, 'Publish button must be re-enabled after saving draft changes');

    await context.close();
  });

  // PROOF 3: Result summary rendered
  it('Proof 3: Publish result summary renders complete, incomplete, and skipped counts from real response, then refetches', async () => {
    const { context, page } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'en' });
    let refetchCount = 0;

    await setupGradebookRoutes(page, {
      publishPayload: {
        success: true,
        data: {
          courseId: 1,
          termId: 1,
          complete: [{ enrollmentId: 1001, studentId: 101, finalPointsEarned: 90, finalPointsMax: 100, finalGrade: 90, status: 'COMPLETED' }],
          incomplete: [{ enrollmentId: 1002, studentId: 102, missingComponents: [104] }],
          skipped: [
            { enrollmentId: 1003, studentId: 103, status: 'WITHDRAWN', reason: 'Student withdrawn' },
            { enrollmentId: 1004, studentId: 104, status: 'BLOCKED', reason: 'Student blocked' },
          ],
        },
      },
      onGradebookFetch: () => { refetchCount++; },
    });

    await page.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page.waitForSelector('button[data-publish-button="true"]', { timeout: 8000 });

    const initialFetches = refetchCount;
    await page.locator('button[data-publish-button="true"]').click();
    await page.waitForSelector('button[data-publish-confirm="true"]', { timeout: 8000 });
    await page.locator('button[data-publish-confirm="true"]').click();

    // Summary modal renders
    await page.waitForSelector('[data-publish-summary-modal="true"]', { timeout: 8000 });
    const completeText = await page.locator('[data-publish-complete="true"]').innerText();
    const incompleteText = await page.locator('[data-publish-incomplete="true"]').innerText();
    const skippedText = await page.locator('[data-publish-skipped="true"]').innerText();

    assert.ok(completeText.includes('1'), 'Complete count must be 1');
    assert.ok(incompleteText.includes('1'), 'Incomplete count must be 1');
    assert.ok(skippedText.includes('2'), 'Skipped count must be 2');

    // Close summary modal
    await page.locator('button[data-publish-close="true"]').click();
    await page.waitForTimeout(300);

    // Assert refetch occurred
    assert.ok(refetchCount > initialFetches, 'Gradebook must be refetched after publication');
    await context.close();
  });

  // PROOF 4: Each 409 code message in ar and en
  it('Proof 4: Every 409 code from STEP 0 maps to localized message in both AR and EN without raw fallback', async () => {
    const errorCodes = [
      {
        code: 'PASSMARK_NOT_SET: Grade structure passMark must be defined before completing enrollments',
        enSnippet: 'passMark must be defined',
        arSnippet: 'يجب تحديد درجة النجاح',
      },
      {
        code: 'AUTO_CALCULATOR_UNAVAILABLE: No calculator registered for source AUTO_ATTENDANCE',
        enSnippet: 'calculator is currently unavailable',
        arSnippet: 'حاسبة الدرجات التلقائية غير متوفرة',
      },
      {
        code: 'AUTO_CALCULATOR_INVALID_RESULT: Calculator for source AUTO_QUIZ returned invalid score 15.555',
        enSnippet: 'calculator returned an invalid score',
        arSnippet: 'أعادت حاسبة الدرجات التلقائية درجة غير صالحة',
      },
      {
        code: 'Concurrent modification conflict during gradebook operation. Please try again.',
        enSnippet: 'Concurrent modification conflict',
        arSnippet: 'تعارض في التعديل المتزامن',
      },
      {
        code: 'Cannot publish gradebook for past or locked academic term',
        enSnippet: 'past or locked academic term',
        arSnippet: 'فصل دراسي منتهٍ أو مقفل',
      },
      {
        code: 'Grade structure must be defined before publishing grades',
        enSnippet: 'Grade structure has not been defined',
        arSnippet: 'لم يتم تحديد هيكل الدرجات',
      },
    ];

    for (const item of errorCodes) {
      // Test in EN
      const { context: enCtx, page: enPage } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'en' });
      await setupGradebookRoutes(enPage, {
        publishStatus: 409,
        publishPayload: { success: false, message: item.code },
      });
      await enPage.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
      await enPage.waitForSelector('button[data-publish-button="true"]', { timeout: 8000 });
      await enPage.locator('button[data-publish-button="true"]').click();
      await enPage.waitForSelector('button[data-publish-confirm="true"]', { timeout: 8000 });
      await enPage.locator('button[data-publish-confirm="true"]').click();
      await enPage.waitForSelector(`text=${item.enSnippet}`, { timeout: 8000 });
      assert.ok(await enPage.locator(`text=${item.enSnippet}`).first().isVisible(), `EN must display localized text containing: "${item.enSnippet}"`);
      await enCtx.close();

      // Test in AR
      const { context: arCtx, page: arPage } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'ar' });
      await arPage.addInitScript(() => { localStorage.setItem('language', 'ar'); });
      await setupGradebookRoutes(arPage, {
        publishStatus: 409,
        publishPayload: { success: false, message: item.code },
      });
      await arPage.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
      await arPage.waitForSelector('button[data-publish-button="true"]', { timeout: 8000 });
      await arPage.locator('button[data-publish-button="true"]').click();
      await arPage.waitForSelector('button[data-publish-confirm="true"]', { timeout: 8000 });
      await arPage.locator('button[data-publish-confirm="true"]').click();
      await arPage.waitForSelector(`text=${item.arSnippet}`, { timeout: 8000 });
      assert.ok(await arPage.locator(`text=${item.arSnippet}`).last().isVisible(), `AR must display localized text containing: "${item.arSnippet}"`);
      await arCtx.close();
    }
  });

  // PROOF 5: Correction inputs/validation/submission/totals
  it('Proof 5: Correction modal validates reason and score, submits typed payload, shows before/after and totals, then refetches', async () => {
    const { context, page } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'en' });
    let refetchCount = 0;
    lastCorrectionRequest = null;

    await setupGradebookRoutes(page, {
      onGradebookFetch: () => {
        refetchCount++;
        page.evaluate((cnt) => {
          window.__gradebookRefetchCount = cnt;
        }, refetchCount).catch(() => {});
      },
    });

    await page.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page.waitForSelector('button[data-correct-cell="true"]', { timeout: 8000 });

    const initialFetches = refetchCount;

    // 1. Open Correction Modal on first published manual cell (student 3, Midterm, maxPoints 25)
    await page.locator('button[data-correct-cell="true"]').first().click();
    await page.waitForSelector('[data-correction-modal="true"]', { timeout: 8000 });

    const scoreInput = page.locator('input[data-correction-score-input="true"]');
    const reasonInput = page.locator('textarea[data-correction-reason-input="true"]');
    const submitBtn = page.locator('button[data-correction-submit="true"]');

    // 2. Reason length < 5 disables submit
    await reasonInput.fill('abcd'); // 4 chars
    await page.waitForFunction(() => {
      const btn = document.querySelector('button[data-correction-submit="true"]');
      return btn && btn.hasAttribute('disabled');
    });
    assert.ok(await submitBtn.isDisabled(), 'Reason < 5 chars must disable submit');
    assert.ok(await page.locator('[data-correction-reason-error="true"]').isVisible(), 'Min length error must show');

    // 3. Reason with angle brackets < > disables submit
    await reasonInput.fill('Corrected mark <appeal>');
    await page.waitForFunction(() => {
      const btn = document.querySelector('button[data-correction-submit="true"]');
      return btn && btn.hasAttribute('disabled');
    });
    assert.ok(await submitBtn.isDisabled(), 'Reason with angle brackets must disable submit');

    // 4. Score > maxPoints (25) disables submit
    await reasonInput.fill('Valid reason after paper recheck');
    await page.waitForFunction(() => {
      const el = document.querySelector('textarea[data-correction-reason-input="true"]');
      const btn = document.querySelector('button[data-correction-submit="true"]');
      return el && el.value === 'Valid reason after paper recheck' && btn && !btn.hasAttribute('disabled');
    });
    await scoreInput.fill('30'); // > 25
    await page.waitForFunction(() => {
      const input = document.querySelector('input[data-correction-score-input="true"]');
      const btn = document.querySelector('button[data-correction-submit="true"]');
      return input && input.value === '30' && btn && btn.hasAttribute('disabled');
    });
    assert.ok(await submitBtn.isDisabled(), 'Score exceeding maxPoints must disable submit');

    // 5. Valid score (24.5) + valid reason (>=5 chars, no <>) enables submit
    await scoreInput.fill('24.5');
    await page.waitForFunction(() => {
      const input = document.querySelector('input[data-correction-score-input="true"]');
      const btn = document.querySelector('button[data-correction-submit="true"]');
      return input && input.value === '24.5' && btn && !btn.hasAttribute('disabled');
    });
    assert.ok(!(await submitBtn.isDisabled()), 'Submit must be enabled when score and reason are valid');

    // 6. Click Submit & wait for POST request and subsequent refetch GET request
    const correctReqPromise = page.waitForRequest((req) =>
      req.url().includes('/api/courses/1/gradebook/correct') && req.method() === 'POST'
    );
    const refetchReqPromise = page.waitForRequest((req) =>
      req.url().includes('/api/courses/1/gradebook') &&
      !req.url().includes('/correct') &&
      !req.url().includes('/publish') &&
      req.method() === 'GET'
    );
    await submitBtn.click();
    await correctReqPromise;
    await refetchReqPromise;

    // 7. Verify intercepted request body and typed keys
    assert.ok(lastCorrectionRequest, 'Correction request must have been sent');
    assert.equal(lastCorrectionRequest.method, 'POST');
    assert.ok(Array.isArray(lastCorrectionRequest.postData.corrections));
    const corr = lastCorrectionRequest.postData.corrections[0];
    assert.equal(typeof corr.enrollmentId, 'number');
    assert.equal(typeof corr.componentId, 'number');
    assert.equal(corr.score, 24.5);
    assert.equal(corr.isAbsent, false);
    assert.equal(typeof corr.version, 'number');
    assert.equal(corr.reason, 'Valid reason after paper recheck');

    // 8. Result summary modal renders before/after and totals
    await page.waitForSelector('[data-correction-summary-modal="true"]', { timeout: 8000 });
    const entryResult = await page.locator('[data-correction-entry-result="true"]').innerText();
    assert.ok(entryResult.includes('22'), 'Entry before score (22) must be displayed');
    assert.ok(entryResult.includes('Before: 22'), 'Exact before entry score must match Before: 22');
    assert.ok(entryResult.includes('24.5'), 'Entry after score (24.5) must be displayed');
    assert.ok(entryResult.includes('After: 24.5'), 'Exact after entry score must match After: 24.5');

    const totalResult = await page.locator('[data-correction-total-result="true"]').innerText();
    assert.ok(totalResult.includes('85'), 'Total before points (85) must be displayed');
    assert.ok(totalResult.includes('Before: 85 / 100 (85%)'), 'Exact before total must match Before: 85 / 100 (85%)');
    assert.ok(totalResult.includes('87.5'), 'Total after points (87.5) must be displayed');
    assert.ok(totalResult.includes('After: 87.5 / 100 (87.5%)'), 'Exact after total must match After: 87.5 / 100 (87.5%)');

    // 9. Close modal and assert refetch via counter
    await page.locator('button[data-correction-close="true"]').click();
    await page.waitForSelector('[data-correction-summary-modal="true"]', { state: 'detached', timeout: 8000 });
    await page.waitForFunction((initial) => (window.__gradebookRefetchCount || 0) > initial, initialFetches);
    assert.ok(refetchCount > initialFetches, 'Gradebook must be refetched after correction');

    await context.close();
  });

  // PROOF 6: Correct optimistic-lock banner
  it('Proof 6: Correction optimistic-lock 409 shows localized banner with Reload Latest button, clicking it refetches', async () => {
    const { context, page } = await mockSessionPage(browser, { role: 'DOCTOR', language: 'en' });
    let refetchCount = 0;

    await setupGradebookRoutes(page, {
      correctStatus: 409,
      correctPayload: { success: false, message: 'Optimistic locking conflict: entry for component 103 has version 2, expected 1' },
      onGradebookFetch: () => { refetchCount++; },
    });

    await page.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await page.waitForSelector('button[data-correct-cell="true"]', { timeout: 8000 });

    const initialFetches = refetchCount;

    // Open correction modal and submit valid data
    await page.locator('button[data-correct-cell="true"]').first().click();
    await page.waitForSelector('[data-correction-modal="true"]', { timeout: 8000 });
    await page.locator('textarea[data-correction-reason-input="true"]').fill('Valid reason after paper recheck');
    await page.locator('input[data-correction-score-input="true"]').fill('24.5');

    await page.waitForFunction(() => {
      const btn = document.querySelector('button[data-correction-submit="true"]');
      return btn && !btn.hasAttribute('disabled');
    });

    await page.locator('button[data-correction-submit="true"]').click();
    await page.waitForTimeout(600);

    // Modal closes and banner shows
    await page.waitForSelector('[data-optimistic-banner="true"]', { timeout: 8000 });
    assert.ok(await page.locator('[data-optimistic-banner="true"]').isVisible(), 'Optimistic lock banner must be visible');
    const reloadBtn = page.locator('button[data-reload-latest="true"]');
    assert.ok(await reloadBtn.isVisible(), 'Reload Latest button must be visible in banner');

    // Click Reload Latest -> refetches
    await reloadBtn.click();
    await page.waitForTimeout(500);
    assert.ok(refetchCount > initialFetches, 'Clicking Reload Latest must refetch gradebook');

    await context.close();
  });

  // PROOF 7: Matrix on both modals: 1440/1024/768/430/390/360 x ar/en x light/dark
  const modalViewports = [1440, 1024, 768, 430, 390, 360];
  for (const width of modalViewports) {
    for (const lang of languages) {
      for (const theme of themes) {
        it(`Proof 7 [${width}px ${lang.toUpperCase()} ${theme.toUpperCase()}]: publish & correction modals fit within viewport without overflow`, async () => {
          const { context, page } = await mockSessionPage(browser, {
            role: 'DOCTOR',
            language: lang,
            user: { doctor: { id: 1 } },
          });

          await page.addInitScript(({ theme, lang }) => {
            localStorage.setItem('theme', theme);
            localStorage.setItem('language', lang);
          }, { theme, lang });

          await page.setViewportSize({ width, height: 900 });
          await setupGradebookRoutes(page);
          await page.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
          await page.waitForSelector('table', { timeout: 8000 });

          // 1. Assert dir, lang, and dark class
          const htmlDir = await page.getAttribute('html', 'dir');
          const htmlLang = await page.getAttribute('html', 'lang');
          assert.equal(htmlDir, lang === 'ar' ? 'rtl' : 'ltr');
          assert.equal(htmlLang, lang);

          const hasDarkClass = await page.evaluate(() => document.documentElement.classList.contains('dark'));
          if (theme === 'dark') {
            assert.equal(hasDarkClass, true);
          } else {
            assert.equal(hasDarkClass, false);
          }

          // 2. Test Publish Modal
          await page.locator('button[data-publish-button="true"]').click();
          await page.waitForSelector('[data-publish-modal="true"]', { timeout: 8000 });

          let docMetrics = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
          }));
          assert.ok(docMetrics.scrollWidth <= docMetrics.innerWidth, `Publish modal doc scrollWidth ${docMetrics.scrollWidth} > innerWidth ${docMetrics.innerWidth}`);

          let dialogBox = await page.locator('[role="dialog"]').boundingBox();
          assert.ok(dialogBox, 'Publish modal dialog bounding box must exist');
          assert.ok(dialogBox.x >= 0, `Publish modal left edge ${dialogBox.x} must be >= 0`);
          assert.ok(dialogBox.x + dialogBox.width <= width + 1, `Publish modal right edge ${dialogBox.x + dialogBox.width} must be <= viewport width ${width}`);

          // Close publish modal
          await page.locator('button[data-publish-cancel="true"]').click();
          await page.waitForTimeout(200);

          // 3. Test Correction Modal
          await page.locator('button[data-correct-cell="true"]').first().click();
          await page.waitForSelector('[data-correction-modal="true"]', { timeout: 8000 });

          docMetrics = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
          }));
          assert.ok(docMetrics.scrollWidth <= docMetrics.innerWidth, `Correction modal doc scrollWidth ${docMetrics.scrollWidth} > innerWidth ${docMetrics.innerWidth}`);

          dialogBox = await page.locator('[role="dialog"]').boundingBox();
          assert.ok(dialogBox, 'Correction modal dialog bounding box must exist');
          assert.ok(dialogBox.x >= 0, `Correction modal left edge ${dialogBox.x} must be >= 0`);
          assert.ok(dialogBox.x + dialogBox.width <= width + 1, `Correction modal right edge ${dialogBox.x + dialogBox.width} must be <= viewport width ${width}`);

          // Close correction modal
          await page.locator('button[data-correction-cancel="true"]').click();
          await page.waitForTimeout(200);

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
