import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pw = require('C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core');
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:5000';

const results = {
  timestamp: new Date().toISOString(),
  findings: [],
  testedRoutes: [],
  roleResults: {},
};

function addFinding(finding) {
  console.log(`\n[FINDING ${finding.id}] [${finding.severity}] ${finding.route} - ${finding.summary}`);
  results.findings.push(finding);
}

async function runAudit() {
  const browser = await pw.chromium.launch({ channel: 'chrome', headless: true });
  
  // -------------------------------------------------------------
  // 1. AUDIT LOGIN & AUTH UX
  // -------------------------------------------------------------
  console.log('\n--- AUDITING LOGIN & AUTH UX ---');
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleLogs.push(msg.text());
    });

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    results.testedRoutes.push({ route: '/login', role: 'ANONYMOUS', status: 'OK' });

    // Test Form Validation on empty submit
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(500);
      const emailValidation = await page.$eval('input[name="email"], input[type="email"]', el => el.validationMessage || el.getAttribute('aria-invalid') || '');
      console.log('Login empty submit validation message:', emailValidation);
    }

    // Test Invalid Credentials Feedback
    await page.fill('input[name="email"], input[type="email"]', 'nonexistent@university.com');
    await page.fill('input[name="password"], input[type="password"]', 'WrongPassword123!');
    await submitBtn.click();
    await page.waitForTimeout(1000);
    const errorAlert = await page.$('.text-error, .text-destructive, [role="alert"], .text-red-500, .bg-red-50, .border-destructive');
    const errorText = errorAlert ? await errorAlert.innerText() : 'NONE';
    console.log('Login invalid credentials error feedback:', errorText);

    if (!errorAlert && !errorText) {
      addFinding({
        id: 'UX-LOGIN-01',
        severity: 'HIGH',
        role: 'ANONYMOUS',
        route: '/login',
        summary: 'Missing visible feedback on invalid login credentials',
        observed: 'No alert or toast rendered on failed login',
        expected: 'Clear error alert explaining invalid credentials',
      });
    }

    await context.close();
  }

  // -------------------------------------------------------------
  // 2. AUDIT SUPER_ADMIN JOURNEYS
  // -------------------------------------------------------------
  console.log('\n--- AUDITING SUPER_ADMIN JOURNEYS ---');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') pageErrors.push(msg.text());
    });

    // Login as Super Admin
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[name="email"], input[type="email"]', 'superadmin@university.com');
    await page.fill('input[name="password"], input[type="password"]', 'SuperAdmin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 });
    console.log('Super Admin logged in. Redirected to:', page.url());

    // Verify Dashboard
    await page.waitForTimeout(1000);
    results.testedRoutes.push({ route: page.url(), role: 'SUPER_ADMIN', status: 'OK' });

    // Test Global Search Modal (Ctrl+K / Cmd+K / search button)
    console.log('Testing Global Search...');
    const searchTrigger = await page.$('button[aria-label*="search" i], button:has-text("Search"), input[placeholder*="Search" i]');
    if (searchTrigger) {
      await searchTrigger.click();
      await page.waitForTimeout(500);
      const searchInput = await page.$('[role="dialog"] input, [data-dialog] input, input[placeholder*="search" i]');
      if (searchInput) {
        // Test search query
        await searchInput.fill('Ahmed');
        await page.waitForTimeout(600);
        const searchResults = await page.$$('[role="option"], [role="listbox"] li, .search-result-item');
        console.log(`Global search for "Ahmed" returned ${searchResults.length} items`);
        
        // Test search with no results
        await searchInput.fill('xyznonexistentquery999');
        await page.waitForTimeout(600);
        const emptyResult = await page.$eval('[role="dialog"], [data-dialog]', el => el.innerText);
        console.log('Global search zero-results text snippet:', emptyResult.slice(0, 150));
        
        // Test Escape key closes dialog
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        const dialogOpen = await page.$('[role="dialog"]');
        if (dialogOpen) {
          console.log('Warning: Dialog remained open after Escape');
        }
      }
    }

    // List of Super Admin routes to audit
    const adminRoutes = [
      { name: 'Dashboard', path: '/' },
      { name: 'Students', path: '/students' },
      { name: 'Doctors', path: '/doctors' },
      { name: 'Teaching Assistants', path: '/teaching-assistants' },
      { name: 'Colleges', path: '/colleges' },
      { name: 'Departments', path: '/departments' },
      { name: 'Courses', path: '/courses' },
      { name: 'Registration Requests', path: '/registration-requests' },
      { name: 'Admins', path: '/admins' },
      { name: 'Groups', path: '/groups' },
      { name: 'Attendance', path: '/attendance' },
      { name: 'Schedules', path: '/schedules' },
      { name: 'Exams', path: '/exams' },
      { name: 'Quizzes', path: '/quizzes' },
      { name: 'Tasks', path: '/tasks' },
      { name: 'Records', path: '/records' },
      { name: 'Finance', path: '/finance' },
      { name: 'Analytics', path: '/analytics' },
      { name: 'Notifications', path: '/notifications' },
      { name: 'Profile', path: '/profile' },
      { name: 'Settings', path: '/settings' },
    ];

    for (const r of adminRoutes) {
      console.log(`\nAuditing Super Admin route: ${r.name} (${r.path})...`);
      try {
        await page.goto(`${BASE_URL}${r.path}`, { waitUntil: 'networkidle', timeout: 8000 });
        await page.waitForTimeout(800);
        results.testedRoutes.push({ route: r.path, role: 'SUPER_ADMIN', status: 'OK' });

        // Check for tables, empty states, search bars, filter buttons
        const table = await page.$('table');
        const rows = table ? await page.$$('table tbody tr') : [];
        const searchInput = await page.$('input[placeholder*="search" i], input[type="search"]');
        const filterControls = await page.$$('button:has-text("Filter"), select, [role="combobox"]');
        const emptyState = await page.$('.empty-state, :has-text("No ")');
        const primaryAction = await page.$('button:has-text("Add"), button:has-text("Create"), button:has-text("New")');

        console.log(`  Route ${r.path}: Table=${!!table} (${rows.length} rows), Search=${!!searchInput}, Filters=${filterControls.length}, PrimaryAction=${!!primaryAction}`);

        // Test Filter & Search if table exists
        if (searchInput && table && rows.length > 0) {
          await searchInput.fill('ZZZNonExistentName123');
          await page.waitForTimeout(500);
          const zeroRows = await page.$$('table tbody tr');
          const zeroText = await page.$eval('table tbody, .empty-state, main', el => el.innerText);
          console.log(`  Search filter test: ${zeroRows.length} rows showing. Text snippet: ${zeroText.slice(0, 100).replace(/\n/g, ' ')}`);
          await searchInput.fill('');
          await page.waitForTimeout(300);
        }

        // Test opening Create/Add Modal if primary action exists
        if (primaryAction && r.path !== '/analytics' && r.path !== '/') {
          const actionText = await primaryAction.innerText();
          console.log(`  Testing primary action: "${actionText}" on ${r.path}`);
          await primaryAction.click();
          await page.waitForTimeout(600);
          const modal = await page.$('[role="dialog"], [data-dialog], .modal');
          if (modal) {
            console.log(`  Modal opened successfully for ${actionText}`);
            // Check form inputs in modal
            const inputs = await modal.$$('input, select, textarea');
            console.log(`  Modal contains ${inputs.length} form controls`);
            // Check cancel button or close button
            const cancelBtn = await modal.$('button:has-text("Cancel"), button[aria-label*="close" i], button:has-text("Close")');
            if (cancelBtn) {
              await cancelBtn.click();
              await page.waitForTimeout(400);
            } else {
              await page.keyboard.press('Escape');
              await page.waitForTimeout(400);
            }
          }
        }
      } catch (err) {
        console.error(`  Error auditing route ${r.path}:`, err.message);
        addFinding({
          id: `UX-ADMIN-${r.name.toUpperCase().replace(/\s+/g, '_')}`,
          severity: 'HIGH',
          role: 'SUPER_ADMIN',
          route: r.path,
          summary: `Failed to load or error on ${r.name}`,
          observed: err.message,
          expected: 'Page loads cleanly without error',
        });
      }
    }

    await context.close();
  }

  // -------------------------------------------------------------
  // 3. AUDIT DOCTOR JOURNEYS
  // -------------------------------------------------------------
  console.log('\n--- AUDITING DOCTOR JOURNEYS (yussef@university.com) ---');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[name="email"], input[type="email"]', 'yussef@university.com');
    await page.fill('input[name="password"], input[type="password"]', 'Yussef@123');
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 });
    console.log('Doctor logged in. Current URL:', page.url());

    // Verify runtime role display
    const roleBadge = await page.$eval('body', el => el.innerText);
    const hasAdminControls = roleBadge.includes('Manage Colleges') || roleBadge.includes('System Admins');
    console.log('Doctor UI role check - contains admin controls:', hasAdminControls);

    const doctorRoutes = [
      { name: 'Dashboard', path: '/' },
      { name: 'Courses', path: '/courses' },
      { name: 'Attendance', path: '/attendance' },
      { name: 'Exams', path: '/exams' },
      { name: 'Quizzes', path: '/quizzes' },
      { name: 'Tasks', path: '/tasks' },
      { name: 'Schedule', path: '/schedules' },
      { name: 'Notifications', path: '/notifications' },
      { name: 'Profile', path: '/profile' },
      { name: 'Settings', path: '/settings' },
    ];

    for (const r of doctorRoutes) {
      console.log(`\nAuditing Doctor route: ${r.name} (${r.path})...`);
      try {
        await page.goto(`${BASE_URL}${r.path}`, { waitUntil: 'networkidle', timeout: 8000 });
        await page.waitForTimeout(800);
        results.testedRoutes.push({ route: r.path, role: 'DOCTOR', status: 'OK' });
        
        const table = await page.$('table');
        const rows = table ? await page.$$('table tbody tr') : [];
        console.log(`  Doctor ${r.name}: Table=${!!table} (${rows.length} rows)`);
      } catch (err) {
        console.error(`  Doctor route error ${r.path}:`, err.message);
        addFinding({
          id: `UX-DOCTOR-${r.name.toUpperCase()}`,
          severity: 'HIGH',
          role: 'DOCTOR',
          route: r.path,
          summary: `Doctor route error on ${r.name}`,
          observed: err.message,
          expected: 'Page loads cleanly for doctor',
        });
      }
    }

    await context.close();
  }

  // -------------------------------------------------------------
  // 4. AUDIT MOBILE RESPONSIVENESS & TOUCH TARGETS (430px, 390px, 360px)
  // -------------------------------------------------------------
  console.log('\n--- AUDITING MOBILE VIEWPORTS (430px, 390px, 360px) ---');
  for (const width of [430, 390, 360]) {
    console.log(`Testing mobile viewport width: ${width}px...`);
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage();

    // Login
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[name="email"], input[type="email"]', 'superadmin@university.com');
    await page.fill('input[name="password"], input[type="password"]', 'SuperAdmin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 });

    // Check Mobile Navigation Hamburger / Drawer
    const menuBtn = await page.$('button[aria-label*="menu" i], button:has(svg.lucide-menu), button:has-text("Menu")');
    console.log(`  [${width}px] Mobile hamburger menu button found: ${!!menuBtn}`);

    if (menuBtn) {
      await menuBtn.click();
      await page.waitForTimeout(500);
      const navDrawer = await page.$('nav, [role="navigation"], .sidebar, [data-mobile-menu]');
      console.log(`  [${width}px] Mobile drawer opened: ${!!navDrawer}`);
    }

    // Check key data pages on mobile: /students, /courses, /schedules
    for (const p of ['/students', '/courses', '/schedules', '/attendance']) {
      await page.goto(`${BASE_URL}${p}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      
      // Check horizontal overflow
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      console.log(`  [${width}px] Route ${p} - Page horizontal overflow: ${hasHorizontalScroll}`);
    }

    await context.close();
  }

  // -------------------------------------------------------------
  // 5. AUDIT ARABIC (RTL) LOCALE
  // -------------------------------------------------------------
  console.log('\n--- AUDITING ARABIC (RTL) LOCALE ---');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[name="email"], input[type="email"]', 'superadmin@university.com');
    await page.fill('input[name="password"], input[type="password"]', 'SuperAdmin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 });

    // Switch Language to Arabic
    const langBtn = await page.$('button:has-text("العربية"), button:has-text("AR"), button[aria-label*="language" i]');
    if (langBtn) {
      await langBtn.click();
      await page.waitForTimeout(600);
    } else {
      // Try dropdown
      const langDropdown = await page.$('[aria-label*="Language" i], button:has-text("EN"), button:has-text("English")');
      if (langDropdown) {
        await langDropdown.click();
        await page.waitForTimeout(300);
        const arOption = await page.$('text=العربية, [role="menuitem"]:has-text("العربية")');
        if (arOption) await arOption.click();
        await page.waitForTimeout(600);
      }
    }

    const docDir = await page.evaluate(() => document.documentElement.dir || document.body.dir);
    console.log('Document direction after Arabic switch:', docDir);

    for (const p of ['/', '/students', '/courses', '/schedules', '/tasks', '/records']) {
      await page.goto(`${BASE_URL}${p}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const title = await page.title();
      console.log(`  Arabic Route ${p}: Page title = ${title}`);
    }

    await context.close();
  }

  await browser.close();

  fs.writeFileSync('scripts/ux_audit_results.json', JSON.stringify(results, null, 2));
  console.log('\nAudit complete! Results saved to scripts/ux_audit_results.json');
}

runAudit().catch(e => {
  console.error('Audit fatal error:', e);
  process.exit(1);
});
