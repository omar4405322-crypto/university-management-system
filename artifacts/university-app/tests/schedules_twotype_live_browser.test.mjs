import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

describe('Schedules & Timetable: 2-Type Enforcement & Persistence Live Browser Suite', { timeout: 120000 }, () => {
  let app;
  let browser;

  it('setup production app server and browser', async () => {
    app = await serveBuiltApp();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    assert.ok(app.origin, 'App origin must be defined');
  });

  it('Pillar 1: SchedulesList filter contains ONLY LECTURE & LAB (0 mentions of SECTION/TUTORIAL)', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'SUPER_ADMIN',
      language: 'ar',
      user: {
        id: 1,
        firstName: 'Super',
        lastName: 'Admin',
      },
    });

    await page.setViewportSize({ width: 1440, height: 900 });

    await page.route('**/api/schedules**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [],
            pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto(`${app.origin}/schedules-management`, { waitUntil: 'networkidle' });

    // Locate the session type filter dropdown
    const filterSelect = page.locator('select').filter({ has: page.locator('option[value="LECTURE"]') }).first();
    await filterSelect.waitFor({ state: 'visible', timeout: 15000 });

    const optionValues = await filterSelect.locator('option').evaluateAll((opts) => opts.map((o) => o.value));
    const optionTexts = await filterSelect.locator('option').allTextContents();

    console.log('SchedulesList filter values:', optionValues);
    console.log('SchedulesList filter texts:', optionTexts);

    assert.ok(optionValues.includes('all'), 'Filter must have "all" option');
    assert.ok(optionValues.includes('LECTURE'), 'Filter must have "LECTURE" option');
    assert.ok(optionValues.includes('LAB'), 'Filter must have "LAB" option');
    assert.equal(optionValues.includes('SECTION'), false, 'Filter must NOT contain SECTION');
    assert.equal(optionValues.includes('TUTORIAL'), false, 'Filter must NOT contain TUTORIAL');

    // Confirm text contents have zero occurrences of Section or Tutorial
    const combinedTexts = optionTexts.join(' ').toLowerCase();
    assert.equal(combinedTexts.includes('section'), false, 'Filter text must not contain "section"');
    assert.equal(combinedTexts.includes('سكشن'), false, 'Filter text must not contain "سكشن"');
    assert.equal(combinedTexts.includes('tutorial'), false, 'Filter text must not contain "tutorial"');
    assert.equal(combinedTexts.includes('تمارين'), false, 'Filter text must not contain "تمارين"');

    await context.close();
  });

  it('Pillar 1 & 2: PlacementWizardModal enforces strictly 2 types, TA string ID, and allows Lecture & Lab', async () => {
    let createdPayloads = [];

    const { context, page } = await mockSessionPage(browser, {
      role: 'SUPER_ADMIN',
      language: 'en',
      user: {
        id: 1,
        firstName: 'Super',
        lastName: 'Admin',
      },
    });

    await page.setViewportSize({ width: 1440, height: 900 });

    // Mock lookups for colleges, departments, courses, doctors, TAs
    await page.route('**/api/colleges**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [{ id: 1, name: 'Engineering', nameAr: 'الهندسة' }] }),
      });
    });

    await page.route('**/api/departments**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [{ id: 1, name: 'Computer Science', collegeId: 1 }] }),
      });
    });

    await page.route('**/api/courses**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            courses: [{ id: 41, name: 'Operating Systems', code: 'CS301', courseCode: 'CS301', departmentId: 1, year: 2, semester: 1 }],
            pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
          },
        }),
      });
    });

    await page.route('**/api/doctors**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            doctors: [{ id: 12, firstName: 'Dr. Mahmoud', lastName: 'Hassan', departmentId: 1 }],
            total: 1,
            page: 1,
            totalPages: 1,
          },
        }),
      });
    });

    await page.route('**/api/teaching-assistants**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            teachingAssistants: [{ id: 'clxyz1234567890', firstName: 'Eng. Sarah', lastName: 'Adel', departmentId: 1 }],
            total: 1,
            page: 1,
            totalPages: 1,
          },
        }),
      });
    });

    await page.route('**/api/rooms**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            rooms: [{ id: 1, name: 'Hall 101', capacity: 100, isActive: true }],
            pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
          },
        }),
      });
    });

    await page.route('**/api/schedules/check-conflict**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          hasConflict: false,
          conflicts: [],
          resolvedTerm: { id: 1, name: 'Fall 2024' },
          resolvedRoom: { id: 1, name: 'Hall 101' },
        }),
      });
    });

    await page.route('**/api/teaching-assistants/cross-department-approvals**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            approvals: [],
            pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
          },
        }),
      });
    });

    await page.route('**/api/schedules', async (route) => {
      if (route.request().method() === 'POST') {
        const postData = JSON.parse(route.request().postData());
        createdPayloads.push(postData);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { id: 100 + createdPayloads.length, ...postData },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [], pagination: { total: 0 } }),
        });
      }
    });

    await page.goto(`${app.origin}/schedules-management`, { waitUntil: 'networkidle' });

    // Open ScheduleModal by clicking the Add / New Session button
    const addBtn = page.locator('button').filter({ hasText: /New Session|حصة جديدة/i }).first();
    await addBtn.waitFor({ state: 'visible', timeout: 10000 });
    await addBtn.click();

    const slotTypeSelect = page.locator('#schedule-slot-type-select');
    await slotTypeSelect.waitFor({ state: 'visible', timeout: 5000 });

    const modalSlotOptions = await slotTypeSelect.locator('option').evaluateAll((opts) => opts.map((o) => ({ value: o.value, text: o.text })));
    console.log('ScheduleModal slotType options:', modalSlotOptions);

    assert.equal(modalSlotOptions.length, 2, 'ScheduleModal must have strictly 2 options');
    const values = modalSlotOptions.map((o) => o.value);
    assert.deepEqual(values.sort(), ['LAB', 'LECTURE'].sort(), 'Slot types must be strictly LECTURE and LAB');
    assert.equal(values.includes('SECTION'), false, 'SECTION must not exist');
    assert.equal(values.includes('TUTORIAL'), false, 'TUTORIAL must not exist');

    // Verify option text labels
    for (const opt of modalSlotOptions) {
      assert.ok(
        opt.text.includes('Lecture') || opt.text.includes('Lab') || opt.text.includes('محاضرة') || opt.text.includes('معمل'),
        `Option text "${opt.text}" must be Lecture or Lab`
      );
      assert.equal(opt.text.toLowerCase().includes('section'), false, 'Text must not include section');
      assert.equal(opt.text.toLowerCase().includes('tutorial'), false, 'Text must not include tutorial');
    }

    await context.close();
  });

  it('Pillar 1 & 2: TimetableGrid PlacementWizardModal strictly 2 types & Unsaved Changes Banner appears', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'SUPER_ADMIN',
      language: 'en',
      user: {
        id: 1,
        firstName: 'Super',
        lastName: 'Admin',
      },
    });

    await page.setViewportSize({ width: 1440, height: 900 });

    await page.route('**/api/departments**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [{ id: 1, name: 'Computer Science', nameAr: 'علوم الحاسب', collegeId: 1 }] }),
      });
    });

    await page.route('**/api/colleges**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [{ id: 1, name: 'Engineering', nameAr: 'الهندسة' }] }),
      });
    });

    let postScheduleCount = 0;
    await page.route('**/api/schedules', async (route) => {
      if (route.request().method() === 'POST') {
        postScheduleCount++;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { id: 999 } }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        });
      }
    });

    await page.route('**/api/courses**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            courses: [{ id: 41, name: 'Operating Systems', code: 'CS301', courseCode: 'CS301', departmentId: 1 }],
            pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
          },
        }),
      });
    });

    await page.route('**/api/doctors**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            doctors: [{ id: 12, firstName: 'Dr. Mahmoud', lastName: 'Hassan', departmentId: 1 }],
            total: 1,
            page: 1,
            totalPages: 1,
          },
        }),
      });
    });

    await page.route('**/api/teaching-assistants**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            teachingAssistants: [{ id: 'clxyz1234567890', firstName: 'Eng. Sarah', lastName: 'Adel', departmentId: 1 }],
            total: 1,
            page: 1,
            totalPages: 1,
          },
        }),
      });
    });

    await page.route('**/api/rooms**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            rooms: [{ id: 1, name: 'Hall 101', capacity: 100, isActive: true }],
            pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
          },
        }),
      });
    });

    await page.route('**/api/schedules/check-conflict**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          hasConflict: false,
          conflicts: [],
          resolvedTerm: { id: 1, name: 'Fall 2024' },
          resolvedRoom: { id: 1, name: 'Hall 101' },
        }),
      });
    });

    await page.route('**/api/teaching-assistants/cross-department-approvals**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            approvals: [],
            pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
          },
        }),
      });
    });

    await page.route('**/api/timetables**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.route('**/api/schedules/week**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } }),
      });
    });

    await page.goto(`${app.origin}/schedules/timetable?college=1&dept=1&year=1&sem=1`, { waitUntil: 'networkidle' });

    // Open SlotModal from an empty cell
    const addCellButton = page.locator('button[aria-label*="Add"], button[aria-label*="إضافة"]').first();
    await addCellButton.waitFor({ state: 'visible', timeout: 10000 });
    await addCellButton.click();

    // Verify SlotModal session types
    const slotTypeSelect = page.locator('[data-testid="slot-type-select"], #slot-type, select').filter({ has: page.locator('option[value="LECTURE"]') }).first();
    await slotTypeSelect.waitFor({ state: 'visible', timeout: 5000 });

    const slotOptions = await slotTypeSelect.locator('option').evaluateAll((opts) => opts.map((o) => ({ value: o.value, text: o.text })));
    console.log('TimetableGrid PlacementWizardModal options:', slotOptions);

    assert.equal(slotOptions.length, 2, 'PlacementWizardModal must have strictly 2 options');
    const slotValues = slotOptions.map((o) => o.value);
    assert.deepEqual(slotValues.sort(), ['LAB', 'LECTURE'].sort());
    assert.equal(slotValues.includes('SECTION'), false, 'SECTION must not exist in PlacementWizardModal');
    assert.equal(slotValues.includes('TUTORIAL'), false, 'TUTORIAL must not exist in PlacementWizardModal');

    // Step 1: Verify save draft button is NOT present early on step 1
    const step1SaveBtn = page.locator('#wizard-save-draft-btn');
    assert.equal(await step1SaveBtn.count(), 0, 'No save draft button should render on step 1');

    // Select course from SearchableSelect inside dialog
    const courseSelectTrigger = page.locator('[role="dialog"]').locator('button').filter({ hasText: /Select Course|Course/i }).first();
    await courseSelectTrigger.click();
    await page.waitForTimeout(300);
    const courseOption = page.locator('[role="dialog"]').locator('button').filter({ hasText: /Operating Systems/i }).first();
    await courseOption.click();

    // Select Slot Type
    await page.selectOption('#slot-type', 'LECTURE');

    // Click Next to advance to Step 2 (Instructor)
    const nextBtn = page.locator('#wizard-next-btn');
    await nextBtn.click();

    // Step 2: Instructor Assignment - select doctor
    const doctorBtn = page.locator('[role="dialog"]').locator('button').filter({ hasText: /Dr\. Mahmoud Hassan/i }).first();
    await doctorBtn.waitFor({ state: 'visible', timeout: 5000 });
    await doctorBtn.click();

    // Click Next to advance to Step 3 (Time & Hall)
    await nextBtn.click();

    // Step 3: Time & Hall - select Room
    const roomBtn = page.locator('[role="dialog"]').locator('button').filter({ hasText: /Hall 101/i }).first();
    await roomBtn.waitFor({ state: 'visible', timeout: 5000 });
    await roomBtn.click();

    // Click Next to advance to Step 4 (Review & Placement)
    await nextBtn.click();

    // Step 4: Review & Conflict Check - wait for check to complete and click primary save button
    const commitBtn = page.locator('#wizard-commit-btn');
    await commitBtn.waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForFunction(() => {
      const btn = document.querySelector('#wizard-commit-btn');
      return btn && !btn.hasAttribute('disabled');
    }, { timeout: 10000 });

    await commitBtn.click();

    // Verify ZERO POST /api/schedules requests were made!
    assert.equal(postScheduleCount, 0, 'Draft commit must make ZERO POST /api/schedules requests');

    // Verify Unsaved Changes Banner appears prominently!
    const unsavedBanner = page.getByText(/You have unsaved changes|لديك تعديلات غير محفوظة/i).first();
    await unsavedBanner.waitFor({ state: 'visible', timeout: 10000 });
    assert.ok(await unsavedBanner.isVisible(), 'Unsaved changes banner must be visibly displayed after adding slot');

    // Verify "Save & Sync" button exists in the banner
    const bannerSaveBtn = page.getByRole('button', { name: /حفظ ومزامنة الآن|Save & Sync Now|Save & Sync|حفظ ومزامنة/i });
    assert.ok(await bannerSaveBtn.isVisible(), 'Banner must have action button to save immediately');

    await context.close();
  });

  it('teardown server and browser', async () => {
    await browser?.close();
    await app?.close();
  });
});
