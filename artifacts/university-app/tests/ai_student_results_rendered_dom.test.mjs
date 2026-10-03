import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';

import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

test('AI Student Search — Rendered DOM Grouping & Contract Verification', { timeout: 60000 }, async () => {
  const app = await serveBuiltApp();
  const { origin } = app;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  try {
    const session = await mockSessionPage(browser, { role: 'SUPER_ADMIN', language: 'ar' });
    const { page } = session;

    // The EXACT structural format produced by real student-search runtime responses
    const runtimeStudentSearchReply = [
      'بناءً على سجلات الجامعة ضمن نطاق صلاحياتك الأكاديمية، تم العثور على الطلاب التاليين:',
      '',
      '1. **أحمد محمد علي**',
      '   - الرقم الجامعي: STU-2024-001',
      '   - الفرقة الدراسية: الفرقة الثالثة',
      '   - القسم: Computer Science',
      '   - الكلية: كلية الحاسبات والمعلومات',
      '   - الحالة: ACTIVE',
      '',
      '2. **سارة خالد العتيبي**',
      '   - الرقم الجامعي: STU-2024-042',
      '   - الفرقة الدراسية: الفرقة الثانية',
      '   - القسم: Information Systems',
      '   - الكلية: كلية الحاسبات والمعلومات',
      '   - الحالة: ACTIVE',
      '',
      'يرجى العلم أن هذه البيانات مسترجعة مباشرة من السجلات الأكاديمية الرسمية.',
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
                id: 'conv-test-cards',
                title: body.message?.slice(0, 30) || 'محادثة',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                archivedAt: null,
              },
              reply: runtimeStudentSearchReply,
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

    await page.goto(`${origin}/ai-assistant`);
    await page.getByRole('heading', { name: 'المساعد الذكي للجامعة' }).waitFor();

    const textarea = page.locator('#ai-assistant-message');
    await textarea.fill('البحث عن الطلاب ضمن صلاحياتي');
    await page.getByRole('button', { name: 'إرسال السؤال' }).click();

    // Wait for the student result cards container to render in the DOM
    const cardsContainer = page.locator('[data-testid="student-cards-container"]');
    await cardsContainer.waitFor({ timeout: 10000 });

    const cards = page.locator('[data-testid="student-result-card"]');
    const cardCount = await cards.count();
    assert.equal(cardCount, 2, 'Must render exactly 2 grouped StudentResultCard elements');

    // ── Check Card 1: أحمد محمد علي ──
    const card1 = cards.nth(0);
    const name1 = await card1.locator('[data-testid="student-name"]').textContent();
    const id1 = await card1.locator('[data-testid="student-id"]').textContent();
    const year1 = await card1.locator('[data-testid="student-year"]').textContent();
    const dept1 = await card1.locator('[data-testid="student-department"]').textContent();
    const college1 = await card1.locator('[data-testid="student-college"]').textContent();
    const status1 = await card1.locator('[data-testid="student-status"]').textContent();

    assert.equal(name1?.trim(), 'أحمد محمد علي', 'Card 1 must contain student name');
    assert.equal(id1?.trim(), 'STU-2024-001', 'Card 1 must contain student ID');
    assert.ok(year1?.includes('الفرقة الثالثة'), 'Card 1 must contain year');
    assert.ok(dept1?.includes('Computer Science'), 'Card 1 must contain department');
    assert.ok(college1?.includes('كلية الحاسبات والمعلومات'), 'Card 1 must contain college');
    assert.equal(status1?.trim(), 'منتظم', 'Status ACTIVE must be safely mapped to authoritative Arabic "منتظم"');

    // ── Check Card 2: سارة خالد العتيبي ──
    const card2 = cards.nth(1);
    const name2 = await card2.locator('[data-testid="student-name"]').textContent();
    const id2 = await card2.locator('[data-testid="student-id"]').textContent();
    const year2 = await card2.locator('[data-testid="student-year"]').textContent();
    const dept2 = await card2.locator('[data-testid="student-department"]').textContent();
    const college2 = await card2.locator('[data-testid="student-college"]').textContent();
    const status2 = await card2.locator('[data-testid="student-status"]').textContent();

    assert.equal(name2?.trim(), 'سارة خالد العتيبي', 'Card 2 must contain student name');
    assert.equal(id2?.trim(), 'STU-2024-042', 'Card 2 must contain student ID');
    assert.ok(year2?.includes('الفرقة الثانية'), 'Card 2 must contain year');
    assert.ok(dept2?.includes('Information Systems'), 'Card 2 must contain department');
    assert.ok(college2?.includes('كلية الحاسبات والمعلومات'), 'Card 2 must contain college');
    assert.equal(status2?.trim(), 'منتظم', 'Card 2 status must be authoritative "منتظم"');

    // ── Invariant: Safety Guard when only alphanumeric code is present ──
    const card1Nav = await card1.getAttribute('data-navigable');
    assert.equal(card1Nav, 'false', 'Card with alphanumeric code STU-2024-001 must safely be non-navigable to prevent broken NaN/400 routes');
    assert.equal(await card1.getAttribute('role'), null, 'Non-navigable card must not have button role');

    // ── Invariant: NO detached student names elsewhere in transcript lists ──
    const detachedNamesInList = await page.locator('ol.space-y-5 ol li, ol.space-y-6 ol li').allTextContents();
    for (const text of detachedNamesInList) {
      assert.ok(!text.includes('أحمد محمد علي'), 'Student name must not be detached in a raw list item');
      assert.ok(!text.includes('سارة خالد العتيبي'), 'Student name must not be detached in a raw list item');
    }

    // ── Invariant: NO invented statuses anywhere in the rendered page ──
    const inventedStatus1 = await page.locator('text="متفوق"').count();
    const inventedStatus2 = await page.locator('text="قيد التخرج"').count();
    assert.equal(inventedStatus1, 0, 'Must NOT contain invented status "متفوق"');
    assert.equal(inventedStatus2, 0, 'Must NOT contain invented status "قيد التخرج"');

    await session.context.close();
  } finally {
    await browser.close();
    await app.close();
  }
});
