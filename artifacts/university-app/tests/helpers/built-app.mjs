import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir = fileURLToPath(new URL('../../dist/public/', import.meta.url));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

// Exercise the production bundle with no dependency on a running API or real credentials.
export async function serveBuiltApp() {
  await stat(path.join(publicDir, 'index.html'));
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
      let file = path.resolve(publicDir, `.${decodeURIComponent(pathname)}`);
      const relative = path.relative(publicDir, file);
      if (relative.startsWith('..') || path.isAbsolute(relative)) { response.writeHead(403).end(); return; }
      try {
        if (!(await stat(file)).isFile()) file = path.join(publicDir, 'index.html');
      } catch { file = path.join(publicDir, 'index.html'); }
      const body = await readFile(file);
      response.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream' });
      response.end(body);
    } catch { response.writeHead(500).end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return { origin: `http://127.0.0.1:${address.port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

export async function mockSessionPage(browser, { role = 'SUPER_ADMIN', language = 'en', collapsed = false, user = {} } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.addInitScript(({ language, collapsed }) => {
    if (!localStorage.getItem('language')) localStorage.setItem('language', language);
    if (!localStorage.getItem('sidebar_collapsed')) localStorage.setItem('sidebar_collapsed', String(collapsed));
  }, { language, collapsed });
  // API routes are fulfilled below; every other nonlocal request is blocked.
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/refresh')) {
      await route.fulfill({ status: role ? 200 : 401, contentType: 'application/json', body: JSON.stringify(role ? {
        success: true, data: { accessToken: 'mock-session', user: { id: '1', email: 'test@example.test', role, firstName: 'Test', lastName: 'User', twoFactorEnabled: true, student: role === 'STUDENT' ? { id: 7 } : null, managedCollegeId: role === 'COLLEGE_ADMIN' ? 4 : null, ...user } },
      } : {}) });
      return;
    }
    if (url.pathname.includes('/ai/')) { await route.abort(); return; }
    const data = url.pathname.startsWith('/api/dashboard/') ? { counts: {}, recentActivity: [], collegeDistribution: [], growthData: [], financeOverview: [] } : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  });
  return { context, page };
}
