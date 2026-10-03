import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveBuiltApp, mockSessionPage } from '../artifacts/university-app/tests/helpers/built-app.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, '../scratch/phase10_5_visual/alignment-pass');

async function capture() {
  await mkdir(outDir, { recursive: true });
  const app = await serveBuiltApp();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  const mockConversations = [
    {
      id: 'conv-today-1',
      title: 'مراجعة بيانات الحضور والغياب للقسم',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archivedAt: null,
    },
    {
      id: 'conv-today-2',
      title: 'إحصائيات الطلاب والإنذارات الأكاديمية',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archivedAt: null,
    },
    {
      id: 'conv-yest-1',
      title: 'استعلام عن تقارير الفصل الدراسي الأول',
      createdAt: new Date(Date.now() - 86400000 * 1.2).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 1.2).toISOString(),
      archivedAt: null,
    },
    {
      id: 'conv-week-1',
      title: 'متابعة مهام أعضاء هيئة التدريس',
      createdAt: new Date(Date.now() - 86400000 * 3.5).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 3.5).toISOString(),
      archivedAt: null,
    },
  ];

  try {
    // 1. Desktop with History OPEN (1440x900)
    {
      const { page, context } = await mockSessionPage(browser, {
        role: 'SUPER_ADMIN',
        language: 'ar',
        user: { firstName: 'عمر', lastName: 'الأدمن', email: 'admin@uo6.edu.eg' },
      });
      await page.setViewportSize({ width: 1440, height: 900 });

      await page.route('**/api/ai/conversations**', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                conversations: mockConversations,
                pagination: { page: 1, limit: 20, total: 4, totalPages: 1 },
              },
            }),
          });
          return;
        }
        await route.fallback();
      });

      await page.goto(`${app.origin}/ai-assistant`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(outDir, '01-desktop-history-open.png') });
      await context.close();
    }

    // 2. Desktop with History CLOSED (1440x900)
    {
      const { page, context } = await mockSessionPage(browser, {
        role: 'SUPER_ADMIN',
        language: 'ar',
        user: { firstName: 'عمر', lastName: 'الأدمن', email: 'admin@uo6.edu.eg' },
      });
      await page.setViewportSize({ width: 1440, height: 900 });

      await page.route('**/api/ai/conversations**', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                conversations: mockConversations,
                pagination: { page: 1, limit: 20, total: 4, totalPages: 1 },
              },
            }),
          });
          return;
        }
        await route.fallback();
      });

      await page.goto(`${app.origin}/ai-assistant`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      // Click boundary toggle to close history
      await page.click('[data-testid="ai-history-boundary-toggle"]');
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(outDir, '02-desktop-history-closed.png') });
      await context.close();
    }

    // 3. Collapsed Main Sidebar State (1440x900)
    {
      const { page, context } = await mockSessionPage(browser, {
        role: 'SUPER_ADMIN',
        language: 'ar',
        user: { firstName: 'عمر', lastName: 'الأدمن', email: 'admin@uo6.edu.eg' },
      });
      await page.setViewportSize({ width: 1440, height: 900 });

      await page.route('**/api/ai/conversations**', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                conversations: mockConversations,
                pagination: { page: 1, limit: 20, total: 4, totalPages: 1 },
              },
            }),
          });
          return;
        }
        await route.fallback();
      });

      await page.goto(`${app.origin}/ai-assistant`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      // Collapse university main sidebar
      const sidebarToggle = page.locator('button[aria-label*="Sidebar"], button[aria-label*="الشريط"]').first();
      if (await sidebarToggle.count() > 0) {
        await sidebarToggle.click();
        await page.waitForTimeout(500);
      }
      await page.screenshot({ path: path.join(outDir, '03-desktop-sidebar-collapsed.png') });
      await context.close();
    }

    // 4. Laptop (1280x800)
    {
      const { page, context } = await mockSessionPage(browser, {
        role: 'SUPER_ADMIN',
        language: 'ar',
        user: { firstName: 'عمر', lastName: 'الأدمن', email: 'admin@uo6.edu.eg' },
      });
      await page.setViewportSize({ width: 1280, height: 800 });

      await page.route('**/api/ai/conversations**', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                conversations: mockConversations,
                pagination: { page: 1, limit: 20, total: 4, totalPages: 1 },
              },
            }),
          });
          return;
        }
        await route.fallback();
      });

      await page.goto(`${app.origin}/ai-assistant`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(outDir, '04-laptop.png') });
      await context.close();
    }

    // 5. Mobile 375x812
    {
      const { page, context } = await mockSessionPage(browser, {
        role: 'SUPER_ADMIN',
        language: 'ar',
        user: { firstName: 'عمر', lastName: 'الأدمن', email: 'admin@uo6.edu.eg' },
      });
      await page.setViewportSize({ width: 375, height: 812 });

      await page.route('**/api/ai/conversations**', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                conversations: mockConversations,
                pagination: { page: 1, limit: 20, total: 4, totalPages: 1 },
              },
            }),
          });
          return;
        }
        await route.fallback();
      });

      await page.goto(`${app.origin}/ai-assistant`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(outDir, '05-ar-mobile-375x812.png') });
      await context.close();
    }

    console.log('Screenshots captured successfully to', outDir);
  } finally {
    await browser.close();
    await app.close();
  }
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});
