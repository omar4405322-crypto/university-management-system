import { chromium } from 'playwright';

const BASE = process.env.FRONTEND_URL || 'http://localhost:5173';
const EMAIL = process.env.REVIEW_EMAIL || 'admin@university.com';
const PASSWORD = process.env.REVIEW_PASSWORD || 'Admin123!';

const PAGES = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Students', path: '/students' },
  { name: 'Doctors', path: '/doctors' },
  { name: 'Attendance', path: '/attendance' },
  { name: 'Timetable', path: '/timetables-management' },
  { name: 'Profile', path: '/profile' },
  { name: 'Analytics', path: '/analytics' },
];

const results = [];

function isBlankPage(text) {
  const trimmed = (text || '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return true;
  const loadingOnly = /^(loading page\.{0,3}|جاري التحميل\.{0,3})$/i.test(trimmed);
  return loadingOnly;
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.getByRole('textbox').first().fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: /login|تسجيل الدخول/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
}

async function reviewPage(page, { name, path }) {
  const consoleErrors = [];
  const pageErrors = [];

  const onConsole = (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  };
  const onPageError = (err) => pageErrors.push(String(err));

  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    const bodyText = await page.locator('body').innerText();
    const blank = isBlankPage(bodyText);
    const hasErrorBoundary = /something went wrong|حدث خطأ|error boundary/i.test(bodyText);
    const title = await page.title();
    const url = page.url();

    let studentDetails = null;
    if (name === 'Students') {
      const firstLink = page.locator('a[href*="/students/"]').first();
      if (await firstLink.count()) {
        const href = await firstLink.getAttribute('href');
        if (href) {
          studentDetails = await reviewStudentDetails(page, href, onConsole, onPageError);
        }
      }
    }

    results.push({
      name,
      path,
      url,
      title,
      blank,
      hasErrorBoundary,
      consoleErrors: [...new Set(consoleErrors)],
      pageErrors: [...new Set(pageErrors)],
      preview: bodyText.slice(0, 200).replace(/\s+/g, ' ').trim(),
      studentDetails,
    });
  } catch (err) {
    results.push({
      name,
      path,
      error: String(err),
      consoleErrors: [...new Set(consoleErrors)],
      pageErrors: [...new Set(pageErrors)],
    });
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
  }
}

async function reviewStudentDetails(page, href, onConsole, onPageError) {
  const consoleErrors = [];
  const pageErrors = [];

  const wrapConsole = (msg) => {
    onConsole(msg);
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  };
  const wrapPageError = (err) => {
    onPageError(err);
    pageErrors.push(String(err));
  };

  page.on('console', wrapConsole);
  page.on('pageerror', wrapPageError);

  try {
    await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    const bodyText = await page.locator('body').innerText();
    return {
      path: href,
      blank: isBlankPage(bodyText),
      hasErrorBoundary: /something went wrong|حدث خطأ|error boundary/i.test(bodyText),
      consoleErrors: [...new Set(consoleErrors)],
      pageErrors: [...new Set(pageErrors)],
      preview: bodyText.slice(0, 200).replace(/\s+/g, ' ').trim(),
    };
  } catch (err) {
    return { path: href, error: String(err), consoleErrors, pageErrors };
  } finally {
    page.off('console', wrapConsole);
    page.off('pageerror', wrapPageError);
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await login(page);
  for (const entry of PAGES) {
    await reviewPage(page, entry);
  }
} catch (err) {
  console.log(JSON.stringify({ fatal: String(err), results }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}

const failed = results.filter(
  (r) =>
    r.error ||
    r.blank ||
    r.hasErrorBoundary ||
    (r.consoleErrors && r.consoleErrors.length > 0) ||
    (r.pageErrors && r.pageErrors.length > 0) ||
    (r.studentDetails &&
      (r.studentDetails.error ||
        r.studentDetails.blank ||
        r.studentDetails.hasErrorBoundary ||
        r.studentDetails.consoleErrors?.length ||
        r.studentDetails.pageErrors?.length))
);

console.log(JSON.stringify({ summary: { total: results.length, failed: failed.length }, results }, null, 2));
process.exitCode = failed.length ? 1 : 0;
