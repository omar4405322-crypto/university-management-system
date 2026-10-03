import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

function generateMockMessages(count) {
  const messages = [];
  for (let i = 1; i <= count; i++) {
    const isAssistant = i % 2 === 0;
    messages.push({
      id: `msg-${i}`,
      role: isAssistant ? 'ASSISTANT' : 'USER',
      content: isAssistant
        ? `Here is policy clarification #${i}:\n\n| Article | Condition | Required Action |\n| :--- | :--- | :--- |\n| Art. ${i} | Grade < 2.0 | Academic warning issued |\n| Art. ${i+1} | Attendance < 75% | Exam disqualification |\n\nRefer to [Executive Bylaw — Article ${i} — p. ${i}].\n\n* Additional regulation detail ${i}\n* Secondary compliance requirement ${i}`
        : `What are the graduation requirements and academic warning rules for semester ${i}?`,
      citations: isAssistant
        ? [
            {
              id: `cite-${i}`,
              documentTitle: 'Executive Academic Bylaw',
              documentTitleAr: 'اللائحة التنفيذية الأكاديمية',
              version: 1,
              pageNumber: i,
              articleNumber: `المادة ${i}`,
              sectionTitle: 'الإنذار الأكاديمي',
              quote: `نص المادة رقم ${i} بخصوص متطلبات التخرج والإنذار.`,
            },
          ]
        : [],
      createdAt: new Date(Date.now() - (count - i) * 60000).toISOString(),
    });
  }
  return messages;
}

async function runBenchmark() {
  console.log('=== PHASE 11.2 PERFORMANCE BENCHMARK SUITE ===\n');
  const app = await serveBuiltApp();
  const { origin } = app;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  const results = {
    pages: {},
    aiScale: {},
  };

  try {
    // 1. Benchmark Page Navigation & Initial Render Times
    console.log('1. Measuring Page Load & Initial Render Times...');
    const pagesToTest = [
      { name: 'Dashboard', path: '/dashboard' },
      { name: 'Students', path: '/students' },
      { name: 'Doctors', path: '/doctors' },
      { name: 'Tasks', path: '/tasks' },
      { name: 'KnowledgeBase', path: '/knowledge-base' },
      { name: 'AiAssistant', path: '/ai-assistant' },
    ];

    for (const p of pagesToTest) {
      const session = await mockSessionPage(browser, { role: 'SUPER_ADMIN', language: 'en' });
      const { page } = session;

      const startTime = performance.now();
      await page.goto(`${origin}${p.path}`, { waitUntil: 'networkidle' });
      const renderTime = performance.now() - startTime;

      const domNodeCount = await page.evaluate(() => document.querySelectorAll('*').length);
      const metrics = await page.evaluate(() => ({
        jsHeapUsed: window.performance?.memory?.usedJSHeapSize ? Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024)) : null,
      }));

      results.pages[p.name] = {
        renderTimeMs: Math.round(renderTime),
        domNodes: domNodeCount,
        heapMb: metrics.jsHeapUsed,
      };

      console.log(`   - ${p.name.padEnd(16)}: ${Math.round(renderTime)}ms | DOM Nodes: ${domNodeCount} | Heap: ${metrics.heapMb ?? 'N/A'}MB`);
      await session.context.close();
    }

    // 2. Benchmark AI Assistant Conversation Scale (10, 50, 100, 300 messages)
    console.log('\n2. Measuring AI Assistant Conversation Scale (10, 50, 100, 300 messages)...');
    const scaleCounts = [10, 50, 100, 300];

    for (const count of scaleCounts) {
      const session = await mockSessionPage(browser, { role: 'STUDENT', language: 'en' });
      const { page } = session;
      const mockMsgs = generateMockMessages(count);

      await page.route('**/api/ai/conversations/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              conversation: {
                id: 'conv-bench-1',
                title: 'Scale Benchmark Conversation',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                archivedAt: null,
                messages: mockMsgs,
              },
            },
          }),
        });
      });

      await page.route('**/api/ai/conversations', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              conversations: [{ id: 'conv-bench-1', title: 'Scale Benchmark Conversation', lastMessagePreview: 'Latest answer' }],
              pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
            },
          }),
        });
      });

      const startTime = performance.now();
      await page.goto(`${origin}/ai-assistant/conv-bench-1`, { waitUntil: 'networkidle' });
      await page.locator('ol[aria-live="polite"]').waitFor({ timeout: 15000 });
      const loadDuration = performance.now() - startTime;

      // Measure Keystroke Latency (Typing 20 characters in the textarea with long transcript active)
      const textarea = page.getByRole('textbox', { name: 'Ask the assistant' });
      await textarea.waitFor({ timeout: 5000 });

      const typingStart = performance.now();
      await textarea.fill('Benchmark typing prompt test');
      const typingDuration = performance.now() - typingStart;
      const perCharLatency = typingDuration / 28;

      // Measure Scroll Performance / Scroll Time
      const scrollDuration = await page.evaluate(async () => {
        const transcript = document.querySelector('ol[aria-live="polite"]')?.parentElement;
        if (!transcript) return 0;
        const start = performance.now();
        transcript.scrollTop = 0;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        transcript.scrollTop = transcript.scrollHeight;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return performance.now() - start;
      });

      const domNodeCount = await page.evaluate(() => document.querySelectorAll('*').length);
      const metrics = await page.evaluate(() => ({
        jsHeapUsed: window.performance?.memory?.usedJSHeapSize ? Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024)) : null,
      }));

      results.aiScale[`messages_${count}`] = {
        loadMs: Math.round(loadDuration),
        typingTotalMs: Math.round(typingDuration),
        perCharLatencyMs: Number(perCharLatency.toFixed(2)),
        scrollTimeMs: Math.round(scrollDuration),
        domNodes: domNodeCount,
        heapMb: metrics.jsHeapUsed,
      };

      console.log(`   - ${count} messages: Load: ${Math.round(loadDuration)}ms | Typing 28 chars: ${Math.round(typingDuration)}ms (${perCharLatency.toFixed(2)}ms/char) | Scroll: ${Math.round(scrollDuration)}ms | DOM Nodes: ${domNodeCount}`);
      await session.context.close();
    }

    console.log('\n=== BENCHMARK COMPLETE ===\n');
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
    await app.close();
  }
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
