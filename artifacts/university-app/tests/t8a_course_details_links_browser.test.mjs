import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

describe('T-8a Browser Tests: CourseDetails Grade Structure Entry Link Gating (M-161)', () => {
  let appServer;
  let browser;

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

  const mockStructure = {
    id: 50,
    courseId: 1,
    termId: 1,
    totalPoints: 100,
    passMark: 50,
    components: [
      { id: 101, name: 'Attendance', nameAr: 'الحضور', maxPoints: 10, source: 'AUTO_ATTENDANCE', displayOrder: 1 },
      { id: 102, name: 'Quiz 1', nameAr: 'اختبار قصير 1', maxPoints: 15, source: 'AUTO_QUIZ', displayOrder: 2 },
      { id: 103, name: 'Midterm Exam', nameAr: 'امتحان نصف الفصل', maxPoints: 25, source: 'MANUAL', displayOrder: 3 },
      { id: 104, name: 'Final Exam', nameAr: 'الامتحان النهائي', maxPoints: 50, source: 'MANUAL', displayOrder: 4 },
    ],
  };

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

  const setupRoutes = async (page) => {
    await page.route('**/api/courses/1/grade-structure*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockStructure }) });
    });
    await page.route('**/api/courses/1/gradebook*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { courseId: 1, termId: 1, structure: mockStructure, students: [] } }) });
    });
    await page.route('**/api/courses/1', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockCourse }) });
    });
    await page.route('**/api/academic-terms/current', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockTerms[0] }) });
    });
    await page.route('**/api/academic-terms', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockTerms }) });
    });
  };

  it('setup server and chromium browser', async () => {
    appServer = await serveBuiltApp();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  });

  it('L1.a [DOCTOR, EN, light theme]: sees grade-structure link and it navigates to /courses/1/grade-structure', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'DOCTOR',
      language: 'en',
      user: { doctor: { id: 1 } },
    });
    await page.addInitScript(() => {
      localStorage.setItem('language', 'en');
      localStorage.setItem('theme', 'light');
    });
    await setupRoutes(page);

    await page.goto(`${appServer.origin}/courses/1`, { waitUntil: 'networkidle' });

    // Assert html lang and dir
    const htmlLang = await page.locator('html').getAttribute('lang');
    const htmlDir = await page.locator('html').getAttribute('dir');
    assert.equal(htmlLang, 'en', 'HTML lang must be en');
    assert.equal(htmlDir, 'ltr', 'HTML dir must be ltr');

    // DOCTOR must see both Grade Structure and Gradebook entry links on CourseDetails
    await page.waitForSelector('[data-testid="course-gradebook-entry-button"]', { timeout: 8000 });
    const structureBtn = page.locator('[data-testid="course-grade-structure-entry-button"]');
    assert.equal(await structureBtn.count(), 1, 'DOCTOR must see Grade Structure entry button on CourseDetails');
    assert.ok(await structureBtn.isVisible(), 'Grade Structure entry button must be visible for DOCTOR');

    // Clicking button navigates to /courses/1/grade-structure
    await structureBtn.click();
    await page.waitForURL('**/courses/1/grade-structure', { timeout: 8000 });
    await page.waitForSelector('[data-grade-structure-page="true"]', { timeout: 8000 });
    assert.ok(page.url().includes('/courses/1/grade-structure'), 'Must navigate to /courses/1/grade-structure');

    await context.close();
  });

  it('L1.b [TEACHING_ASSISTANT, AR, dark theme]: sees grade-structure link and it navigates to /courses/1/grade-structure', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'TEACHING_ASSISTANT',
      language: 'ar',
      user: { teachingAssistant: { id: 1 } },
    });
    await page.addInitScript(() => {
      localStorage.setItem('language', 'ar');
      localStorage.setItem('theme', 'dark');
    });
    await setupRoutes(page);

    await page.goto(`${appServer.origin}/courses/1`, { waitUntil: 'networkidle' });

    // Assert html lang and dir
    const htmlLang = await page.locator('html').getAttribute('lang');
    const htmlDir = await page.locator('html').getAttribute('dir');
    assert.equal(htmlLang, 'ar', 'HTML lang must be ar');
    assert.equal(htmlDir, 'rtl', 'HTML dir must be rtl');

    // TEACHING_ASSISTANT must see Grade Structure entry link on CourseDetails
    await page.waitForSelector('[data-testid="course-gradebook-entry-button"]', { timeout: 8000 });
    const structureBtn = page.locator('[data-testid="course-grade-structure-entry-button"]');
    assert.equal(await structureBtn.count(), 1, 'TEACHING_ASSISTANT must see Grade Structure entry button on CourseDetails');
    assert.ok(await structureBtn.isVisible(), 'Grade Structure entry button must be visible for TEACHING_ASSISTANT');

    // Clicking button navigates to /courses/1/grade-structure
    await structureBtn.click();
    await page.waitForURL('**/courses/1/grade-structure', { timeout: 8000 });
    await page.waitForSelector('[data-grade-structure-page="true"]', { timeout: 8000 });
    assert.ok(page.url().includes('/courses/1/grade-structure'), 'Must navigate to /courses/1/grade-structure');

    await context.close();
  });

  it('L1.c [STUDENT]: sees neither grade-structure nor gradebook link on CourseDetails', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'STUDENT',
      language: 'en',
      user: { student: { id: 7 } },
    });
    await setupRoutes(page);

    await page.goto(`${appServer.origin}/courses/1`, { waitUntil: 'networkidle' });

    assert.equal(
      await page.locator('[data-testid="course-grade-structure-entry-button"]').count(),
      0,
      'STUDENT must never see Grade Structure entry link'
    );
    assert.equal(
      await page.locator('[data-testid="course-gradebook-entry-button"]').count(),
      0,
      'STUDENT must never see Gradebook entry link'
    );

    await context.close();
  });

  it('L1.d [SUPER_ADMIN]: sees grade-structure link with edit capability', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'SUPER_ADMIN',
      language: 'en',
    });
    await setupRoutes(page);

    await page.goto(`${appServer.origin}/courses/1`, { waitUntil: 'networkidle' });

    assert.equal(
      await page.locator('[data-testid="course-grade-structure-entry-button"]').count(),
      1,
      'SUPER_ADMIN must see Grade Structure entry link'
    );
    assert.equal(
      await page.locator('[data-testid="course-gradebook-entry-button"]').count(),
      1,
      'SUPER_ADMIN must see Gradebook entry link'
    );

    await context.close();
  });

  it('teardown server and browser', async () => {
    if (browser) await browser.close();
    if (appServer) await appServer.close();
  });
});
