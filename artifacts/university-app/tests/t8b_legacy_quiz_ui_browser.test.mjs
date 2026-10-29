import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp } from './helpers/built-app.mjs';

describe('T-8b Browser Tests: Legacy Quiz Creation Retirement UI', () => {
  let appServer;
  let browser;

  const mockPopulatedQuizzes = [
    {
      id: 101,
      title: 'Database Systems Quiz 1',
      description: 'Introductory relational algebra quiz',
      courseId: 1,
      duration: 25,
      course: { id: 1, name: 'Database Systems', courseCode: 'CS301' },
      _count: { questions: 5 },
    },
  ];

  const setupPageMocks = async (page, { role = 'DOCTOR', language = 'en', theme = 'light', quizzes = mockPopulatedQuizzes } = {}) => {
    await page.addInitScript(({ language, theme }) => {
      localStorage.setItem('language', language);
      localStorage.setItem('theme', theme);
      localStorage.setItem('sidebar_collapsed', 'false');
    }, { language, theme });

    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1') return route.continue();
      return route.abort();
    });

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());

      if (url.pathname.endsWith('/auth/refresh')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              accessToken: 'mock-session-t8b',
              user: {
                id: 1,
                email: role === 'DOCTOR' ? 'doctor@uni.edu' : 'student@uni.edu',
                role,
                firstName: 'Test',
                lastName: role === 'DOCTOR' ? 'Doctor' : 'Student',
                twoFactorEnabled: true,
                student: role === 'STUDENT' ? { id: 77 } : null,
              },
            },
          }),
        });
        return;
      }

      if (url.pathname.includes('/ai/')) {
        await route.abort();
        return;
      }

      if (url.pathname === '/api/quizzes' && route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: quizzes,
          }),
        });
        return;
      }

      if (url.pathname.startsWith('/api/exams')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [],
          }),
        });
        return;
      }

      if (url.pathname.startsWith('/api/courses')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [{ id: 1, name: 'Database Systems', courseCode: 'CS301' }],
          }),
        });
        return;
      }

      const defaultData = url.pathname.startsWith('/api/dashboard/')
        ? { counts: {}, recentActivity: [], collegeDistribution: [], growthData: [], financeOverview: [] }
        : [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: defaultData }),
      });
    });
  };

  it('setup app server and browser', async () => {
    appServer = await serveBuiltApp();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  });

  for (const lang of ['en', 'ar']) {
    it(`DOCTOR on /quizzes sees zero create buttons in populated and empty list (${lang})`, async () => {
      // 1. Populated list
      const contextPopulated = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const pagePopulated = await contextPopulated.newPage();
      await setupPageMocks(pagePopulated, { role: 'DOCTOR', language: lang, quizzes: mockPopulatedQuizzes });

      await pagePopulated.goto(`${appServer.origin}/quizzes`, { waitUntil: 'networkidle' });

      // Assert html dir and lang
      const htmlDir = await pagePopulated.getAttribute('html', 'dir');
      const htmlLang = await pagePopulated.getAttribute('html', 'lang');
      assert.equal(htmlDir, lang === 'ar' ? 'rtl' : 'ltr', `html dir must match ${lang}`);
      assert.equal(htmlLang, lang, `html lang must match ${lang}`);

      // Verify quiz card renders
      await pagePopulated.locator('h2:has-text("Database Systems Quiz 1")').waitFor();

      // View Submissions/Results button still renders for Doctor
      const viewSubmissionsBtn = pagePopulated.locator(
        lang === 'ar' ? 'button:has-text("عرض التسليمات")' : 'button:has-text("View Submissions")'
      );
      await viewSubmissionsBtn.waitFor();
      assert.equal(await viewSubmissionsBtn.count(), 1, 'Doctor should see View Submissions button');

      // Assert zero Create Quiz buttons in populated view
      const createButtonsPopulated = pagePopulated.locator(
        'button:has-text("Create Quiz"), button:has-text("إنشاء اختبار"), a[href*="/quizzes/create"]'
      );
      assert.equal(await createButtonsPopulated.count(), 0, 'Zero Create Quiz buttons in populated view');
      await contextPopulated.close();

      // 2. Empty list
      const contextEmpty = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const pageEmpty = await contextEmpty.newPage();
      await setupPageMocks(pageEmpty, { role: 'DOCTOR', language: lang, quizzes: [] });

      await pageEmpty.goto(`${appServer.origin}/quizzes`, { waitUntil: 'networkidle' });

      // Assert zero Create Quiz buttons in empty state
      const createButtonsEmpty = pageEmpty.locator(
        'button:has-text("Create Quiz"), button:has-text("إنشاء اختبار"), a[href*="/quizzes/create"]'
      );
      assert.equal(await createButtonsEmpty.count(), 0, 'Zero Create Quiz buttons in empty state');
      await contextEmpty.close();
    });

    it(`navigating to /quizzes/create redirects to /exams/create (${lang})`, async () => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      await setupPageMocks(page, { role: 'DOCTOR', language: lang, quizzes: [] });

      await page.goto(`${appServer.origin}/quizzes/create`, { waitUntil: 'networkidle' });
      await page.waitForURL('**/exams/create');
      assert.ok(page.url().includes('/exams/create'), 'URL must redirect to /exams/create');
      await context.close();
    });

    it(`STUDENT on /quizzes still sees Take Quiz button (${lang})`, async () => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      await setupPageMocks(page, { role: 'STUDENT', language: lang, quizzes: mockPopulatedQuizzes });

      await page.goto(`${appServer.origin}/quizzes`, { waitUntil: 'networkidle' });

      // Verify Take Quiz button renders for Student
      const takeQuizBtn = page.locator(
        lang === 'ar' ? 'button:has-text("تقديم الاختبار")' : 'button:has-text("Take Quiz")'
      );
      await takeQuizBtn.waitFor();
      assert.equal(await takeQuizBtn.count(), 1, 'Student should see Take Quiz button');

      // Assert zero Create Quiz buttons for student
      const createButtonsStudent = page.locator(
        'button:has-text("Create Quiz"), button:has-text("إنشاء اختبار"), a[href*="/quizzes/create"]'
      );
      assert.equal(await createButtonsStudent.count(), 0, 'Zero Create Quiz buttons for student');
      await context.close();
    });
  }

  it('teardown app server and browser', async () => {
    if (browser) await browser.close();
    if (appServer) await appServer.close();
  });
});

