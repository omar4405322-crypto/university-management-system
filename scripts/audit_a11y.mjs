import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const axePath = 'D:/Projects/UN/University management system/node_modules/.pnpm/axe-core@4.13.0/node_modules/axe-core/axe.min.js';
const axeSource = fs.readFileSync(axePath, 'utf8');

const BASE_URL = 'http://localhost:5173';

const findings = [];
let findingIdCounter = 1;

function addFinding({ wcag, severity, role, route, component, observed, expected, evidence, file }) {
  const id = `A11Y-${String(findingIdCounter++).padStart(3, '0')}`;
  findings.push({
    id,
    wcag,
    severity,
    role,
    route,
    component,
    observed,
    expected,
    evidence,
    file
  });
}

async function runAxe(page, contextStr) {
  await page.evaluate(axeSource);
  const results = await page.evaluate(async () => {
    return await window.axe.run({
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']
      }
    });
  });
  return results;
}

async function auditPage(page, { role, route, name }) {
  console.log(`[AUDIT] Role: ${role} | Route: ${route} (${name})`);
  const currentUrl = page.url();
  const targetUrl = `${BASE_URL}${route}`;
  if (!currentUrl.endsWith(route)) {
    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 15000 });
    } catch (err) {
      try {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
      } catch (e) {
        console.error(`Failed to navigate to ${route}:`, e.message);
        return;
      }
    }
  }
  if (route !== '/login' && route !== '/register') {
    try {
      await page.waitForSelector('main#main-content', { timeout: 10000 });
      await page.waitForSelector('a[href="#main-content"]', { timeout: 10000 });
    } catch (_) {}
  }
  await page.waitForTimeout(600);

  // 1. Language metadata check
  const htmlLang = await page.evaluate(() => document.documentElement.lang);
  const htmlDir = await page.evaluate(() => document.documentElement.dir);
  if (!htmlLang) {
    addFinding({
      wcag: '3.1.1 Language of Page',
      severity: 'HIGH',
      role,
      route,
      component: 'HTML Document',
      observed: 'document.documentElement is missing the lang attribute',
      expected: 'html tag must declare lang="en" or lang="ar"',
      evidence: `html.lang="${htmlLang}"`,
      file: 'artifacts/university-app/index.html'
    });
  }

  // 2. Landmarks check
  const landmarks = await page.evaluate(() => {
    return {
      main: !!document.querySelector('main'),
      mainHasId: !!document.querySelector('main#main-content'),
      skipLink: !!document.querySelector('a[href="#main-content"]'),
      navCount: document.querySelectorAll('nav').length,
      unnamedNavs: Array.from(document.querySelectorAll('nav')).filter(n => !n.getAttribute('aria-label') && !n.getAttribute('aria-labelledby')).length,
      headers: document.querySelectorAll('header').length
    };
  });

  if (!landmarks.skipLink && route !== '/login' && route !== '/register') {
    addFinding({
      wcag: '2.4.1 Bypass Blocks',
      severity: 'MEDIUM',
      role,
      route,
      component: 'AppShell / SkipLink',
      observed: 'No Skip to Main Content link is provided to bypass navigation',
      expected: 'A visible-on-focus skip link targeting #main-content must be present',
      evidence: `skipLink exists: false`,
      file: 'artifacts/university-app/src/components/layout/AppShell.tsx'
    });
  }

  if (landmarks.unnamedNavs > 0) {
    addFinding({
      wcag: '1.3.1 Info and Relationships',
      severity: 'LOW',
      role,
      route,
      component: 'Navigation Landmarks',
      observed: `${landmarks.unnamedNavs} nav element(s) lack aria-label or aria-labelledby`,
      expected: 'Multiple nav elements must have descriptive aria-labels (e.g., "Primary", "Pagination")',
      evidence: `unnamedNavs=${landmarks.unnamedNavs}`,
      file: 'artifacts/university-app/src/components/layout/Sidebar.tsx'
    });
  }

  // 3. Headings check
  const headingInfo = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
      level: parseInt(h.tagName[1], 10),
      text: h.textContent.trim().slice(0, 30)
    }));
    return {
      h1Count: headings.filter(h => h.level === 1).length,
      headings
    };
  });

  if (headingInfo.h1Count === 0 && route !== '/login' && route !== '/register') {
    addFinding({
      wcag: '1.3.1 Info and Relationships / 2.4.6 Headings and Labels',
      severity: 'MEDIUM',
      role,
      route,
      component: `${name} Page Heading`,
      observed: 'Page does not have a top-level <h1> heading',
      expected: 'Each main view should possess a descriptive <h1> landmark heading',
      evidence: `h1Count=0, headings=${JSON.stringify(headingInfo.headings.slice(0, 3))}`,
      file: `artifacts/university-app/src/pages/${name}.tsx`
    });
  }

  // 4. Accessible names on buttons
  const namelessButtons = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.map((b, idx) => {
      const text = b.innerText.trim();
      const ariaLabel = b.getAttribute('aria-label');
      const ariaLabelledby = b.getAttribute('aria-labelledby');
      const title = b.getAttribute('title');
      const hasName = Boolean(text || ariaLabel || ariaLabelledby || title);
      return {
        idx,
        hasName,
        className: b.className.slice(0, 40),
        html: b.outerHTML.slice(0, 100)
      };
    }).filter(b => !b.hasName);
  });

  if (namelessButtons.length > 0) {
    addFinding({
      wcag: '4.1.2 Name, Role, Value',
      severity: 'HIGH',
      role,
      route,
      component: 'Button Controls',
      observed: `${namelessButtons.length} button(s) lack an accessible name`,
      expected: 'All interactive buttons must have an accessible name via text, aria-label, or title',
      evidence: JSON.stringify(namelessButtons.slice(0, 3)),
      file: `artifacts/university-app/src/pages/${name}.tsx`
    });
  }

  // 5. Run axe-core
  const axeResults = await runAxe(page, `${role}-${route}`);
  for (const violation of axeResults.violations) {
    const sevMap = { critical: 'BLOCKER', serious: 'HIGH', moderate: 'MEDIUM', minor: 'LOW' };
    addFinding({
      wcag: violation.tags.find(t => t.startsWith('wcag')) || violation.id,
      severity: sevMap[violation.impact] || 'MEDIUM',
      role,
      route,
      component: violation.id,
      observed: violation.help,
      expected: violation.description,
      evidence: violation.nodes.map(n => n.html.slice(0, 100)).slice(0, 3).join(' | '),
      file: violation.id
    });
  }
}

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('=== STEP 1: PUBLIC ROUTES ===');
  await auditPage(page, { role: 'ANONYMOUS', route: '/login', name: 'Login' });
  await auditPage(page, { role: 'ANONYMOUS', route: '/register', name: 'Register' });

  console.log('=== STEP 2: SUPER_ADMIN ROUTES ===');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.fill('#login-email', 'superadmin@university.com');
  await page.fill('#login-password', 'SuperAdmin123!');
  await page.click('button[type="submit"]');
  await page.waitForSelector('header', { timeout: 15000 });
  await page.waitForSelector('main#main-content', { timeout: 15000 });
  await page.waitForTimeout(500);

  const adminRoutes = [
    { route: '/dashboard', name: 'AdminDashboard' },
    { route: '/students', name: 'StudentsList' },
    { route: '/doctors', name: 'DoctorsList' },
    { route: '/courses', name: 'CoursesList' },
    { route: '/attendance', name: 'AttendanceOverview' },
    { route: '/timetables-management', name: 'TimetablesManagement' },
    { route: '/finance', name: 'FinancePage' },
    { route: '/analytics', name: 'AnalyticsPage' },
    { route: '/settings', name: 'SettingsPage' }
  ];

  for (const r of adminRoutes) {
    await auditPage(page, { role: 'SUPER_ADMIN', ...r });
  }

  // Test Modal Accessibility on Students page (Add Student Modal)
  console.log('[TEST] Checking Add Student Modal accessibility...');
  try {
    await page.goto(`${BASE_URL}/students`, { waitUntil: 'networkidle' });
    const addBtn = page.locator('button:has-text("Add Student"), button:has-text("إضافة طالب")').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(500);
      const dialog = page.locator('[role="dialog"]');
      const dialogExists = await dialog.isVisible();
      const hasAriaModal = await dialog.getAttribute('aria-modal');
      const hasLabelledby = await dialog.getAttribute('aria-labelledby');
      console.log(`Dialog visible: ${dialogExists}, aria-modal: ${hasAriaModal}, aria-labelledby: ${hasLabelledby}`);
      
      // Test Escape key
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const dialogClosed = !(await dialog.isVisible());
      console.log(`Dialog closed via Escape: ${dialogClosed}`);
    }
  } catch (e) {
    console.error('Modal test error:', e.message);
  }

  // Logout and test DOCTOR
  console.log('=== STEP 3: DOCTOR ROUTES ===');
  const doctorContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const doctorPage = await doctorContext.newPage();
  await doctorPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await doctorPage.fill('#login-email', 'doctor1@university.com');
  await doctorPage.fill('#login-password', 'Password123!');
  await doctorPage.click('button[type="submit"]');
  await doctorPage.waitForSelector('main#main-content', { timeout: 20000 });
  await doctorPage.waitForTimeout(500);

  const doctorRoutes = [
    { route: '/dashboard', name: 'DoctorDashboard' },
    { route: '/courses', name: 'DoctorCourses' },
    { route: '/attendance', name: 'DoctorAttendance' },
    { route: '/schedules/doctor', name: 'DoctorSchedule' },
    { route: '/exams', name: 'DoctorExams' },
    { route: '/tasks', name: 'DoctorTasks' },
    { route: '/profile', name: 'DoctorProfile' }
  ];

  for (const r of doctorRoutes) {
    await auditPage(doctorPage, { role: 'DOCTOR', ...r });
  }

  // Logout and test STUDENT
  console.log('=== STEP 4: STUDENT ROUTES ===');
  const studentContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const studentPage = await studentContext.newPage();
  await studentPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await studentPage.fill('#login-email', 'student.test@university.local');
  await studentPage.fill('#login-password', 'StudentTest123!');
  await studentPage.click('button[type="submit"]');
  await studentPage.waitForSelector('main#main-content', { timeout: 20000 });
  await studentPage.waitForTimeout(500);

  const studentRoutes = [
    { route: '/dashboard', name: 'StudentDashboard' },
    { route: '/courses', name: 'StudentCourses' },
    { route: '/schedules/student', name: 'StudentSchedule' },
    { route: '/tasks', name: 'StudentTasks' },
    { route: '/quizzes', name: 'StudentQuizzes' },
    { route: '/record', name: 'StudentRecord' },
    { route: '/attendance', name: 'StudentAttendance' },
    { route: '/profile', name: 'StudentProfile' }
  ];

  for (const r of studentRoutes) {
    await auditPage(studentPage, { role: 'STUDENT', ...r });
  }

  await browser.close();

  // Deduplicate and group findings
  const deduped = [];
  const seen = new Set();
  for (const f of findings) {
    const key = `${f.wcag}::${f.component}::${f.observed}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(f);
    }
  }

  fs.writeFileSync('C:/Users/omar4/.gemini/antigravity/brain/a54af762-b03c-413e-b4b7-a4358f0cdac8/audit_findings.json', JSON.stringify(deduped, null, 2));
  console.log(`\nAudit completed! Total unique findings: ${deduped.length}`);
  console.log(JSON.stringify(deduped, null, 2));
}

main().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
