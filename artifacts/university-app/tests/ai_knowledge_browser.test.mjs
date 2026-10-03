import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';

import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

test('AI Assistant knowledge base citations and admin browser verification', { timeout: 90000 }, async () => {
  const app = await serveBuiltApp();
  const { origin } = app;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  const newPage = (role, language = 'en') => mockSessionPage(browser, { role, language });

  try {
    // 1. Student verifies citations rendering and expandable quotes
    const student = await newPage('STUDENT', 'en');
    const { page } = student;

    await page.route('**/api/ai/**', async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();

      if (method === 'GET' && url.pathname.endsWith('/ai/conversations')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { conversations: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
          }),
        });
        return;
      }

      if (method === 'POST') {
        const body = JSON.parse(route.request().postData() ?? '{}');
        const reply =
          'Based on [Academic Regulations 2026 — Article 12 — p. 18], academic probation is issued when cumulative GPA drops below 2.00.';
        const citations = [
          {
            documentTitle: 'Academic Regulations 2026',
            documentTitleAr: 'اللائحة الأكاديمية 2026',
            version: 1,
            pageNumber: 18,
            sectionTitle: 'Academic Probation Criteria',
            articleNumber: 'Article 12',
            quote: 'Academic warning is issued to the student if the cumulative GPA falls below 2.00 at the end of any semester.',
            documentVersionId: 'ver-101',
            chunkId: 'chunk-501',
          },
        ];

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              conversation: {
                id: 'conv-101',
                title: body.message?.slice(0, 30) || 'Chat',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                archivedAt: null,
              },
              reply,
              citations,
            },
          }),
        });
        return;
      }

      await route.fallback();
    });

    await page.goto(`${origin}/ai-assistant`);
    await page.getByRole('heading', { name: 'University AI Assistant' }).waitFor();

    const textarea = page.locator('textarea');
    await textarea.waitFor({ timeout: 10000 });
    await textarea.fill('What are the probation rules according to university bylaws?');

    const sendBtn = page.getByRole('button', { name: 'Send question' });
    await sendBtn.click();

    // Wait for response and citations container
    await page.waitForSelector('[data-testid="ai-citations-container"]', { timeout: 15000 });

    // Verify citation badge and document title
    const citationTitle = await page.textContent('[data-testid="citation-doc-title"]');
    assert.ok(citationTitle?.includes('Academic Regulations 2026'));

    // Check for article and page badge
    const textContent = await page.textContent('[data-testid="ai-citations-container"]');
    assert.ok(textContent?.includes('Article 12') || textContent?.includes('المادة 12'));
    assert.ok(textContent?.includes('18'));

    // Check horizontal overflow (zero scroll width difference)
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    assert.equal(hasHorizontalOverflow, false, 'No horizontal overflow in citation UI');

    await student.context.close();

    // 2. SuperAdmin navigates to /knowledge-base
    const admin = await newPage('SUPER_ADMIN', 'en');
    const adminPage = admin.page;

    await adminPage.route('**/api/knowledge/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.includes('/knowledge/documents')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'doc-mock-1',
                title: 'Academic Regulations 2026',
                titleAr: 'اللائحة الأكاديمية 2026',
                documentType: 'REGULATION',
                scope: 'GLOBAL',
                status: 'ACTIVE',
                createdAt: new Date().toISOString(),
                activeVersion: {
                  id: 'ver-mock-1',
                  version: 1,
                  originalFilename: 'bylaws.pdf',
                  fileSize: 102400,
                  processingStatus: 'READY',
                  effectiveDate: '2026-09-01T00:00:00.000Z',
                  supersededAt: null,
                  uploadedAt: new Date().toISOString(),
                  chunkCount: 42,
                },
                versions: [],
              },
            ],
            meta: { total: 1 },
          }),
        });
        return;
      }
      await route.fallback();
    });

    await adminPage.goto(`${origin}/knowledge-base`);
    await adminPage.waitForSelector('[data-testid="knowledge-base-admin-page"]', { timeout: 15000 });

    const pageHeading = await adminPage.textContent('h1');
    assert.ok(pageHeading?.includes('Knowledge Base'));

    // Verify document card rendered
    await adminPage.waitForSelector('[data-testid="knowledge-doc-card-doc-mock-1"]', { timeout: 5000 });
    const cardText = await adminPage.textContent('[data-testid="knowledge-doc-card-doc-mock-1"]');
    assert.ok(cardText?.includes('Academic Regulations 2026'));
    assert.ok(cardText?.includes('Ready') || cardText?.includes('READY'));

    await admin.context.close();

    console.log('✔ AI Assistant knowledge base browser test passed cleanly!');
  } finally {
    await browser.close();
    await app.close();
  }
});
