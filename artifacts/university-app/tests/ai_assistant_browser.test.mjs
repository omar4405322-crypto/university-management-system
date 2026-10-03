import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';

import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

const evidenceDir = fileURLToPath(new URL('../../../scratch/phase8-release-gate/', import.meta.url));

test('AI Assistant browser flow uses only mocked API responses', { timeout: 90000 }, async () => {
  const app = await serveBuiltApp();
  const { origin } = app;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  const newPage = (role, language = 'en') => mockSessionPage(browser, { role, language });

  try {
    const unauthenticated = await newPage(null);
    await unauthenticated.page.goto(`${origin}/ai-assistant`);
    await unauthenticated.page.waitForURL('**/login', { timeout: 15000 });
    await unauthenticated.context.close();

    const student = await newPage('STUDENT');
    const { page } = student;
    const requests = [];
    let mode = 'hold';
    let release;
    await page.route('**/api/ai/**', async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();

      if (method === 'GET' && url.pathname.endsWith('/ai/conversations')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { conversations: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } } }) });
        return;
      }

      if (method === 'GET' && url.pathname.endsWith('/ai/quick-actions')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              quickActions: [
                {
                  key: 'attendance_summary',
                  title: 'سجل الحضور والغياب',
                  titleEn: 'Show my attendance summary',
                  description: 'عرض نسبة الحضور والغياب للمقررات.',
                  descriptionEn: 'View attendance percentages.',
                  prompt: 'كيف هو حضوري؟',
                  promptEn: 'Show my attendance summary',
                  promptKey: 'aiAssistant.starters.attendance',
                  icon: 'CalendarCheck',
                  iconBg: 'bg-emerald-50 dark:bg-emerald-950/60',
                  iconColor: 'text-emerald-600 dark:text-emerald-400',
                },
                {
                  key: 'student_academic_summary',
                  title: 'المعدل التراكمي والسجل الأكاديمي',
                  titleEn: 'Summarize my academic standing',
                  description: 'عرض ملخص السجل الأكاديمي.',
                  descriptionEn: 'View academic standing.',
                  prompt: 'لخص مستواي الأكاديمي',
                  promptEn: 'Summarize my academic standing',
                  promptKey: 'aiAssistant.starters.studentAcademicSummary',
                  icon: 'FileText',
                  iconBg: 'bg-blue-50 dark:bg-blue-950/60',
                  iconColor: 'text-blue-600 dark:text-blue-400',
                },
                {
                  key: 'tasks_summary',
                  title: 'المهام والتكليفات',
                  titleEn: 'What tasks do I have?',
                  description: 'عرض المهام الدراسية المعلقة.',
                  descriptionEn: 'View upcoming tasks.',
                  prompt: 'ما المهام والتكليفات القادمة؟',
                  promptEn: 'What tasks do I have?',
                  promptKey: 'aiAssistant.starters.tasksSummary',
                  icon: 'CheckSquare',
                  iconBg: 'bg-amber-50 dark:bg-amber-950/60',
                  iconColor: 'text-amber-600 dark:text-amber-400',
                },
              ],
            },
          }),
        });
        return;
      }

      if (method === 'POST') {
        const body = JSON.parse(route.request().postData() ?? '{}');
        requests.push(body);
        if (mode === 'hold') await new Promise((resolve) => { release = resolve; });
        if (mode === 'error') {
          await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'raw-provider-secret-error' }) });
        } else {
          const reply = `Mock answer ${requests.length}`;
          if (url.pathname.endsWith('/ai/conversations')) {
            await route.fulfill({
              status: 201,
              contentType: 'application/json',
              body: JSON.stringify({
                success: true,
                data: {
                  conversation: { id: 'conv-101', title: body.message?.slice(0, 30) || 'Chat', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), archivedAt: null },
                  reply,
                },
              }),
            });
          } else {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ success: true, data: { reply } }),
            });
          }
        }
        return;
      }
      await route.fallback();
    });
    await page.goto(`${origin}/ai-assistant`);
    await page.getByRole('heading', { name: 'University AI Assistant' }).waitFor();
    const navLink = page.getByRole('link', { name: 'AI Assistant' });
    assert.equal(await navLink.count(), 1);
    assert.equal(await navLink.getAttribute('href'), '/ai-assistant');
    await navLink.click();
    await page.waitForURL('**/ai-assistant');
    assert.equal(await page.getByRole('button', { name: 'Show my attendance summary' }).count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Summarize my academic standing' }).count(), 1);
    assert.equal(await page.getByRole('button', { name: 'What tasks do I have?' }).count(), 1);
    const textarea = page.getByRole('textbox', { name: 'Ask the assistant' });
    const send = page.getByRole('button', { name: 'Send question' });
    assert.equal(await send.isDisabled(), true);
    assert.equal(await textarea.getAttribute('maxlength'), '4000');
    await page.getByRole('button', { name: 'Show my attendance summary' }).click();
    assert.equal(await textarea.inputValue(), 'Show my attendance summary');
    assert.equal(requests.length, 0);
    await textarea.fill('   ');
    await textarea.press('Enter');
    assert.equal(requests.length, 0);
    await textarea.fill('  First question  ');
    await send.click();
    await page.getByRole('status').getByText('Preparing an answer...').waitFor();
    assert.equal(await send.isDisabled(), true);
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0], { message: 'First question' });
    mode = 'success';
    release();
    await page.locator('ol[aria-live="polite"]').getByText('Mock answer 1').waitFor();
    assert.equal(await textarea.inputValue(), '');
    await textarea.fill('Second question');
    await textarea.press('Enter');
    await page.locator('ol[aria-live="polite"]').getByText('Mock answer 2').waitFor();
    assert.deepEqual(requests[1], { message: 'Second question' });
    await textarea.fill('Third question');
    await textarea.press('Shift+Enter');
    assert.equal(requests.length, 2);
    assert.match(await textarea.inputValue(), /\n/);
    await textarea.fill('A failed question');
    mode = 'error';
    await send.click();
    await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').innerText(), /temporarily unavailable/i);
    assert.doesNotMatch(await page.locator('body').innerText(), /raw-provider-secret-error/);
    assert.equal(await textarea.inputValue(), 'A failed question');
    mode = 'success';
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.locator('ol[aria-live="polite"]').getByText('Mock answer 4').waitFor();

    // Verify copy button feedback
    const copyBtn = page.getByRole('button', { name: 'Copy' }).first();
    assert.equal(await copyBtn.isVisible(), true);
    await copyBtn.click();
    await page.getByText('Copied').waitFor();

    // Verify clear chat button is no longer rendered in header (per Requirement 2)
    const clearBtn = page.getByRole('button', { name: 'Clear chat' });
    assert.equal(await clearBtn.count(), 0, 'Clear chat button must no longer be rendered in header');

    // Verify New Conversation button resets conversation
    const newChatBtn = page.getByRole('button', { name: 'New Conversation' }).first();
    await newChatBtn.click();
    await page.getByRole('heading', { name: 'Start with a question' }).waitFor();
    assert.equal(await page.locator('ol[aria-live="polite"]').getByText('Mock answer 4').count(), 0);

    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(await textarea.isVisible(), true);
    assert.equal(await send.isVisible(), true);
    assert.equal(await textarea.evaluate((element) => element.getBoundingClientRect().width <= window.innerWidth), true);
    await page.reload();
    await page.getByRole('heading', { name: 'Start with a question' }).waitFor();
    assert.equal(await page.locator('ol[aria-live="polite"]').getByText('Mock answer 4').count(), 0);
    await student.context.close();

    for (const [role, expected] of [
      ['COLLEGE_ADMIN', 'Show university summary within my scope'],
      ['ADMIN', 'How can I organize a study plan?'],
      ['DOCTOR', 'What courses am I teaching?'],
      ['TEACHING_ASSISTANT', 'What sections and labs are assigned to me?'],
    ]) {
      const view = await newPage(role);
      await view.page.goto(`${origin}/ai-assistant`);
      await view.page.getByRole('heading', { name: 'University AI Assistant' }).waitFor();
      assert.equal(await view.page.getByRole('button', { name: expected }).count(), 1);
      assert.equal(await view.page.getByRole('button', { name: 'Show my attendance summary' }).count(), 0);
      await view.context.close();
    }

    const arabic = await newPage('STUDENT', 'ar');
    await arabic.page.goto(`${origin}/ai-assistant`);
    await arabic.page.getByRole('heading', { name: 'المساعد الذكي للجامعة' }).waitFor();
    assert.equal(await arabic.page.locator('[dir="rtl"]').count() > 0, true);
    await arabic.context.close();
  } finally {
    await browser.close();
    await app.close();
  }
});


test('AI responsive release gate: usable input, navigation, scoped prompts and no overflow in English/LTR and Arabic/RTL', { timeout: 90000 }, async () => {
  const app = await serveBuiltApp();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const language of ['en', 'ar']) {
      const { context, page } = await mockSessionPage(browser, { role: 'STUDENT', language });
      try {
        let chatRequests = 0;
        const answer = 'Mock answer ' + 'x'.repeat(240);
        await page.route('**/api/ai/**', async (route) => {
          const url = new URL(route.request().url());
          if (route.request().method() === 'GET') {
            if (url.pathname.endsWith('/ai/conversations')) {
              await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { conversations: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } } }) });
              return;
            }
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                success: true,
                data: {
                  conversation: { id: 'conv-resp', title: 'Resp Test', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), archivedAt: null },
                  messages: [],
                },
              }),
            });
            return;
          }
          chatRequests++;
          if (url.pathname.endsWith('/ai/conversations')) {
            await route.fulfill({
              status: 201,
              contentType: 'application/json',
              body: JSON.stringify({
                success: true,
                data: {
                  conversation: { id: 'conv-resp', title: 'Resp Test', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), archivedAt: null },
                  reply: answer,
                },
              }),
            });
          } else {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { reply: answer } }) });
          }
        });
        await page.goto(`${app.origin}/ai-assistant`);
        await page.getByRole('heading', { name: language === 'ar' ? 'المساعد الذكي للجامعة' : 'University AI Assistant', exact: true }).waitFor();
        assert.equal(await page.locator('html').getAttribute('dir'), language === 'ar' ? 'rtl' : 'ltr');
        const textarea = page.getByRole('textbox', { name: language === 'ar' ? 'اسأل المساعد' : 'Ask the assistant' });
        const send = page.getByRole('button', { name: language === 'ar' ? 'إرسال السؤال' : 'Send question', exact: true });
        for (const width of [320, 375, 430, 768, 1024, 1440]) {
          await page.setViewportSize({ width, height: 812 });
          await textarea.scrollIntoViewIfNeeded();
          await textarea.fill(language === 'ar' ? 'سؤال تجريبي' : 'Test question');
          assert.equal(await textarea.isEditable(), true);
          const inputBox = await textarea.boundingBox();
          assert.ok(inputBox && inputBox.width >= 120 && inputBox.x >= 0 && inputBox.x + inputBox.width <= width + 1, `Input usable within ${width}px (${language})`);
          await send.scrollIntoViewIfNeeded();
          const sendBox = await send.boundingBox();
          assert.ok(sendBox && sendBox.x >= 0 && sendBox.x + sendBox.width <= width + 1 && sendBox.y >= 0 && sendBox.y + sendBox.height <= 813, 'Send control reachable without clipping');
          assert.equal(await send.isEnabled(), true);
          const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
          assert.ok(overflow <= 2, `AI page overflow ${overflow}px at ${width}px (${language})`);
        }
        await page.setViewportSize({ width: 375, height: 812 });
        await send.click();
        await page.getByText(answer, { exact: true }).waitFor();
        assert.equal(chatRequests, 1, 'Input submits exactly one mocked request');
        assert.ok(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 2), 'Long unbroken answer does not overflow');
        await mkdir(evidenceDir, { recursive: true });
        await page.screenshot({ path: `${evidenceDir}ai-mobile-${language}.png`, fullPage: true });
        const menu = page.locator('[data-testid="mobile-menu-button"]');
        await menu.click();
        await page.waitForFunction(() => document.querySelector('[data-testid="mobile-menu-button"]').getAttribute('aria-expanded') === 'true');
        await page.locator('#app-sidebar a[href="/dashboard"]').first().click();
        await page.waitForURL('**/dashboard');
        await page.waitForFunction(() => document.querySelector('[data-testid="mobile-menu-button"]').getAttribute('aria-expanded') === 'false');
        assert.equal(chatRequests, 1, 'Navigation makes no additional AI request');
      } finally { await context.close(); }
    }

    // These authenticated roles lack a data scope; neither student nor administrative data prompts are advertised.
    for (const role of ['ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'STUDENT']) {
      const view = await mockSessionPage(browser, { role, user: { managedCollegeId: null, managedDepartmentId: null, student: null } });
      try {
        await view.page.goto(`${app.origin}/ai-assistant`);
        await view.page.getByRole('heading', { name: 'University AI Assistant', exact: true }).waitFor();
        for (const name of ['Show my attendance summary', 'Summarize my academic standing', 'Summarize my grades', 'What tasks do I have?', 'Show university summary within my scope', 'Give me a summary within my scope']) {
          assert.equal(await view.page.getByRole('button', { name, exact: true }).count(), 0, `${role} must not advertise unauthorized data prompt: ${name}`);
        }
        assert.equal(await view.page.getByRole('button', { name: 'How can I organize a study plan?', exact: true }).count(), 1);
      } finally { await view.context.close(); }
    }
  } finally { await browser.close(); await app.close(); }
});

test('AI Persistent Conversations, Drawer, Search, Rename, Archive, Delete & Transcript restoration', { timeout: 90000 }, async () => {
  const app = await serveBuiltApp();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const { context, page } = await mockSessionPage(browser, { role: 'STUDENT', language: 'en' });
    try {
      let conversationsList = [
        {
          id: 'conv-1',
          title: 'Physics 101 Discussion',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          archivedAt: null,
          messageCount: 2,
          lastMessagePreview: 'Midterm is Oct 15 in Hall B',
          lastMessageRole: 'ASSISTANT',
          lastMessageAt: new Date().toISOString(),
        },
        {
          id: 'conv-2',
          title: 'Attendance Inquiries',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          archivedAt: null,
          messageCount: 2,
          lastMessagePreview: 'Your attendance is 92%',
          lastMessageRole: 'ASSISTANT',
          lastMessageAt: new Date().toISOString(),
        },
      ];

      // Route mock for conversations endpoints
      await page.route('**/api/ai/conversations**', async (route) => {
        const url = new URL(route.request().url());
        const method = route.request().method();

        if (method === 'GET' && url.pathname.endsWith('/ai/conversations')) {
          const search = url.searchParams.get('search');
          const isArchived = url.searchParams.get('archived') === 'true';
          let filtered = conversationsList.filter((c) => (isArchived ? c.archivedAt !== null : c.archivedAt === null));
          if (search) {
            filtered = filtered.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                conversations: filtered,
                pagination: { page: 1, limit: 20, total: filtered.length, totalPages: 1 },
              },
            }),
          });
          return;
        }

        if (method === 'GET' && url.pathname.includes('/ai/conversations/conv-1')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                conversation: {
                  id: 'conv-1',
                  title: conversationsList.find((c) => c.id === 'conv-1')?.title || 'Physics 101 Discussion',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  archivedAt: null,
                  messages: [
                    { id: 'm-1', role: 'USER', content: 'What is the physics exam date?', sequence: 1, createdAt: new Date().toISOString() },
                    { id: 'm-2', role: 'ASSISTANT', content: 'The physics midterm exam is on October 15th at 10:00 AM in Hall B.', sequence: 2, createdAt: new Date().toISOString() },
                  ],
                },
              },
            }),
          });
          return;
        }

        if (method === 'PATCH' && url.pathname.includes('/ai/conversations/conv-1')) {
          const body = JSON.parse(route.request().postData() ?? '{}');
          const target = conversationsList.find((c) => c.id === 'conv-1');
          if (target) {
            if (body.title) target.title = body.title;
            if (body.isArchived !== undefined) target.archivedAt = body.isArchived ? new Date().toISOString() : null;
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: { conversation: target } }),
          });
          return;
        }

        if (method === 'DELETE' && url.pathname.includes('/ai/conversations/conv-1')) {
          conversationsList = conversationsList.filter((c) => c.id !== 'conv-1');
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, message: 'Conversation deleted' }),
          });
          return;
        }

        await route.fallback();
      });

      await page.goto(`${app.origin}/ai-assistant`);
      await page.getByRole('heading', { name: 'University AI Assistant' }).waitFor();

      // Verify conversation items are displayed inside drawer (default visible on desktop)
      const drawer = page.getByRole('complementary', { name: 'Conversations' });
      await drawer.getByText('Physics 101 Discussion').waitFor();
      assert.equal(await drawer.getByText('Attendance Inquiries').count(), 1);

      // Verify boundary toggle button is accessible
      const boundaryToggle = page.getByTestId('ai-history-boundary-toggle');
      assert.equal(await boundaryToggle.isVisible(), true);

      // Test Search Debounce in History Drawer
      const searchInput = page.getByPlaceholder('Search conversations...');
      await searchInput.fill('Physics');
      // Wait for debounce and filtered list
      await page.waitForTimeout(600);
      assert.equal(await drawer.getByText('Physics 101 Discussion').count(), 1);
      assert.equal(await drawer.getByText('Attendance Inquiries').count(), 0);

      // Clear search
      await searchInput.fill('');
      await page.waitForTimeout(600);
      assert.equal(await drawer.getByText('Attendance Inquiries').count(), 1);

      // Select conversation 'conv-1'
      await drawer.getByText('Physics 101 Discussion').click();
      await page.waitForURL('**/ai-assistant/conv-1');

      // Verify restored transcript
      await page.getByText('What is the physics exam date?').waitFor();
      await page.getByText('The physics midterm exam is on October 15th at 10:00 AM in Hall B.').waitFor();

      // Test Rename Flow
      await drawer.getByText('Physics 101 Discussion').waitFor();
      const actionsBtn = page.getByRole('button', { name: 'Conversation actions' }).first();
      await actionsBtn.click();
      const renameOption = page.getByRole('button', { name: 'Rename' });
      await renameOption.click();

      // Rename modal appears
      await page.getByRole('heading', { name: 'Rename Conversation' }).waitFor();
      const renameInput = page.locator('input[maxlength="60"]');
      await renameInput.fill('Advanced Physics 2026');
      await page.getByRole('button', { name: 'Save' }).click();

      // Verify title updated
      await drawer.getByText('Advanced Physics 2026').waitFor();

      // Test Delete Flow
      const actionsBtn2 = page.getByRole('button', { name: 'Conversation actions' }).first();
      await actionsBtn2.click();
      const deleteOption = page.getByRole('button', { name: 'Delete' });
      await deleteOption.click();

      // Confirmation modal appears
      await page.getByRole('heading', { name: 'Delete Conversation' }).waitFor();
      await page.getByRole('button', { name: 'Delete' }).click();

      // Verify deleted from list and new conversation started
      await page.waitForFunction(() => !document.body.innerText.includes('Advanced Physics 2026'));
      await page.getByRole('heading', { name: 'Start with a question' }).waitFor();

      // Test "New Conversation" button
      const newChatBtn = page.getByRole('button', { name: 'New Conversation' }).first();
      await newChatBtn.click();
      assert.equal(await page.getByRole('heading', { name: 'Start with a question' }).isVisible(), true);
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
    await app.close();
  }
});


