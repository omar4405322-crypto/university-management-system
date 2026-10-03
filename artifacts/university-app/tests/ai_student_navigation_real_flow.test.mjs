import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';

import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

test('AI Student Card Navigation — Real Click Flow & Data Contract Verification', { timeout: 60000 }, async () => {
  const app = await serveBuiltApp();
  const { origin } = app;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  try {
    // Session with students.view capability (SUPER_ADMIN)
    const session = await mockSessionPage(browser, { role: 'SUPER_ADMIN', language: 'ar' });
    const { page } = session;

    // AI assistant reply with discrete internal ID 42 for student 1, and missing ID for student 2
    const runtimeReply = [
      'بناءً على نتائج البحث الأكاديمي، إليك بيانات الطلاب المصرح بها:',
      '',
      '1. **أحمد محمد علي** <!-- id: 42 -->',
      '   - الرقم الجامعي: STU-2024-001',
      '   - الفرقة: الفرقة الثالثة',
      '   - القسم: Computer Science',
      '   - الكلية: كلية الحاسبات والمعلومات',
      '   - الحالة: ACTIVE',
      '',
      '2. **سارة خالد العتيبي**',
      '   - الرقم الجامعي: STU-2024-042',
      '   - الفرقة: الفرقة الثانية',
      '   - القسم: Information Systems',
      '   - الكلية: كلية الحاسبات والمعلومات',
      '   - الحالة: ACTIVE',
    ].join('\n');

    await page.route('**/api/ai/conversations**', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              conversation: {
                id: 'conv-nav-flow-test',
                title: body.message?.slice(0, 30) || 'محادثة',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                archivedAt: null,
              },
              reply: runtimeReply,
              citations: [],
              actionProposals: [],
            },
          }),
        });
      } else if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              conversations: [],
              pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock student details endpoint for the canonical route /students/42
    await page.route('**/api/students/42', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 42,
            studentId: 'STU-2024-001',
            firstName: 'أحمد',
            lastName: 'محمد علي',
            year: 3,
            isActive: true,
            department: { name: 'Computer Science' },
          },
        }),
      });
    });

    await page.goto(`${origin}/ai-assistant`);
    await page.getByRole('heading', { name: 'المساعد الذكي للجامعة' }).waitFor();

    const textarea = page.locator('#ai-assistant-message');
    await textarea.fill('البحث عن الطلاب');
    await page.getByRole('button', { name: 'إرسال السؤال' }).click();

    const cardsContainer = page.locator('[data-testid="student-cards-container"]');
    await cardsContainer.waitFor({ timeout: 10000 });

    const cards = page.locator('[data-testid="student-result-card"]');
    assert.equal(await cards.count(), 2);

    const card1 = cards.nth(0);
    const card2 = cards.nth(1);

    // ── Card 1: Verified numeric ID present & user authorized ──
    const card1Nav = await card1.getAttribute('data-navigable');
    assert.equal(card1Nav, 'true', 'Card 1 with valid positive numeric id 42 must be navigable');
    assert.equal(await card1.getAttribute('role'), 'button', 'Navigable card must have role="button"');

    // Public student ID is visibly rendered
    const publicId1 = await card1.locator('[data-testid="student-id"]').textContent();
    assert.equal(publicId1?.trim(), 'STU-2024-001');

    // Internal numeric ID is NOT visibly rendered as text anywhere on the card
    const card1AllText = await card1.innerText();
    assert.ok(
      !/\b42\b/.test(card1AllText),
      'Internal numeric database ID (42) must NOT be visibly rendered in card text'
    );

    // ── Card 2: Missing numeric ID -> Non-interactive fallback ──
    const card2Nav = await card2.getAttribute('data-navigable');
    assert.equal(card2Nav, 'false', 'Card 2 without numeric id must be safely non-navigable');
    assert.equal(await card2.getAttribute('role'), null, 'Non-navigable card must NOT have button role');

    // ── Action: Click Card 1 to navigate ──
    await card1.click();

    // Verify browser navigated to the canonical route /students/42
    await page.waitForURL(`**/students/42`, { timeout: 10000 });
    const currentUrl = page.url();
    assert.ok(
      currentUrl.endsWith('/students/42'),
      `URL must navigate to canonical /students/42, but was ${currentUrl}`
    );
    assert.ok(
      !currentUrl.includes('STU-2024-001'),
      'URL must NOT use public alphanumeric studentId as route parameter'
    );

    await session.context.close();
  } finally {
    await browser.close();
    await app.close();
  }
});
