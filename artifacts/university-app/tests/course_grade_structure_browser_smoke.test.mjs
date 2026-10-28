import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

describe('T-7c Browser Verification: Course Grade Structure Editor Smoke, Matrix & Proofs 1-10', () => {
  let appServer;
  let browser;

  let lastPutRequest = null;
  let putRequestCount = 0;
  let getStructureFetchCount = 0;

  const mockTerms = [
    {
      id: 1,
      academicYearId: 1,
      name: 'Fall 2026',
      termType: 'FALL',
      semesterNumber: 1,
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2027-01-31T00:00:00.000Z',
      isCurrent: true,
    },
    {
      id: 2,
      academicYearId: 1,
      name: 'Spring 2027',
      termType: 'SPRING',
      semesterNumber: 2,
      startDate: '2027-02-01T00:00:00.000Z',
      endDate: '2027-06-30T00:00:00.000Z',
      isCurrent: false,
    },
  ];

  const mockCourse = {
    id: 1,
    name: 'Advanced Software Engineering',
    courseCode: 'CS401',
    credits: 3,
    year: 4,
    semester: 1,
    departmentId: 10,
    department: {
      id: 10,
      name: 'Computer Science',
      collegeId: 4,
      college: { id: 4, name: 'Faculty of Computers' },
    },
    scheduleSlots: [],
    materials: [],
    tasks: [],
    enrollments: [],
    _count: { enrollments: 5, quizzes: 1, tasks: 1, exams: 1, materials: 0 },
  };

  const defaultStructureData = {
    courseId: 1,
    termId: 1,
    termName: 'Fall 2026',
    totalPoints: 100,
    passMark: 50,
    components: [
      {
        id: 101,
        name: 'Attendance',
        nameAr: 'الحضور',
        maxPoints: 10,
        source: 'AUTO_ATTENDANCE',
        displayOrder: 1,
      },
      {
        id: 102,
        name: 'Quiz 1',
        nameAr: 'اختبار قصير 1',
        maxPoints: 15,
        source: 'AUTO_QUIZ',
        displayOrder: 2,
      },
      {
        id: 103,
        name: 'Midterm Exam',
        nameAr: 'امتحان منتصف الفصل',
        maxPoints: 25,
        source: 'MANUAL',
        displayOrder: 3,
      },
      {
        id: 104,
        name: 'Final Exam',
        nameAr: 'الامتحان النهائي',
        maxPoints: 50,
        source: 'MANUAL',
        displayOrder: 4,
      },
    ],
    isLocked: false,
  };

  const setupStructureRoutes = async (page, options = {}) => {
    const {
      getStatus = 200,
      getPayload = defaultStructureData,
      putStatus = 200,
      putErrorPayload = null,
      gradebookStatus = 200,
      gradebookPayload = {
        courseId: 1,
        termId: 1,
        termName: 'Fall 2026',
        structure: {
          id: 50,
          totalPoints: 100,
          passMark: 50,
          components: defaultStructureData.components,
        },
        students: [],
      },
    } = options;

    let currentStructureState = structuredClone(getPayload);

    await page.route('**/api/courses/1/grade-structure*', async (route) => {
      const req = route.request();
      const method = req.method();

      if (method === 'PUT') {
        putRequestCount++;
        const parsedBody = JSON.parse(req.postData() || '{}');
        lastPutRequest = {
          url: req.url(),
          method,
          postData: parsedBody,
        };

        if (putStatus !== 200) {
          await route.fulfill({
            status: putStatus,
            contentType: 'application/json',
            body: JSON.stringify(putErrorPayload),
          });
          return;
        }

        const updatedComponents = (parsedBody.components || []).map((c, idx) => ({
          id: c.id ?? 500 + idx,
          name: c.name,
          nameAr: c.nameAr ?? null,
          maxPoints: c.maxPoints,
          source: c.source,
          displayOrder: c.displayOrder ?? idx + 1,
        }));
        const updatedTotal = updatedComponents.reduce((sum, c) => sum + c.maxPoints, 0);

        currentStructureState = {
          courseId: 1,
          termId: 1,
          termName: 'Fall 2026',
          totalPoints: updatedTotal,
          passMark: parsedBody.passMark ?? null,
          components: updatedComponents,
          isLocked: false,
        };

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: currentStructureState,
          }),
        });
        return;
      }

      getStructureFetchCount++;
      if (getStatus !== 200) {
        await route.fulfill({
          status: getStatus,
          contentType: 'application/json',
          body: JSON.stringify(getPayload),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: currentStructureState,
        }),
      });
    });

    await page.route('**/api/courses/1/gradebook*', async (route) => {
      if (gradebookStatus !== 200) {
        await route.fulfill({
          status: gradebookStatus,
          contentType: 'application/json',
          body: JSON.stringify(gradebookPayload),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: gradebookPayload,
        }),
      });
    });

    await page.route('**/api/courses/1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockCourse,
        }),
      });
    });

    await page.route('**/api/academic-terms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockTerms,
        }),
      });
    });
  };

  it('setup server and chromium browser', async () => {
    appServer = await serveBuiltApp();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  });

  // ── PROOF 1: Role matrix ──
  it('Proof 1: Role matrix: Super/College/Department Admin see edit controls and CourseDetails link; Doctor and TA see read-only; Student is blocked', async () => {
    const adminRoles = ['SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'];
    for (const role of adminRoles) {
      const { context, page } = await mockSessionPage(browser, {
        role,
        language: 'en',
        user: { managedCollegeId: 4, managedDepartmentId: 10 },
      });
      await setupStructureRoutes(page);

      // CourseDetails shows Grade Structure entry button for admins
      await page.goto(`${appServer.origin}/courses/1`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="course-grade-structure-entry-button"]', {
        timeout: 8000,
      });
      assert.equal(
        await page.locator('[data-testid="course-grade-structure-entry-button"]').count(),
        1,
        `${role} must see Grade Structure entry button on CourseDetails`
      );

      // Editor page shows edit controls for admins
      await page.goto(`${appServer.origin}/courses/1/grade-structure`, {
        waitUntil: 'networkidle',
      });
      await page.waitForSelector('[data-grade-structure-page="true"]', { timeout: 8000 });
      assert.equal(
        await page.locator('button[data-add-component="true"]').count(),
        1,
        `${role} must see Add Component button`
      );
      assert.equal(
        await page.locator('button[data-save-structure="true"]').count(),
        1,
        `${role} must see Save Structure button`
      );
      assert.ok(
        (await page.locator('input[data-structure-input="true"]').count()) > 0,
        `${role} must see editable inputs`
      );
      assert.equal(
        await page.locator('[data-readonly-banner="true"]').count(),
        0,
        `${role} must NOT see read-only banner`
      );
      await context.close();
    }

    const readOnlyRoles = ['DOCTOR', 'TEACHING_ASSISTANT'];
    for (const role of readOnlyRoles) {
      const { context, page } = await mockSessionPage(browser, {
        role,
        language: 'en',
        user: { doctor: { id: 1 }, teachingAssistant: { id: 1 } },
      });
      await setupStructureRoutes(page);

      // CourseDetails does NOT show Grade Structure editor entry button for Doctor/TA
      await page.goto(`${appServer.origin}/courses/1`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="course-gradebook-entry-button"]', {
        timeout: 8000,
      });
      assert.equal(
        await page.locator('[data-testid="course-grade-structure-entry-button"]').count(),
        0,
        `${role} must NOT see Grade Structure editor entry button on CourseDetails`
      );

      // Direct navigation shows read-only structure with zero inputs
      await page.goto(`${appServer.origin}/courses/1/grade-structure`, {
        waitUntil: 'networkidle',
      });
      await page.waitForSelector('[data-grade-structure-page="true"]', { timeout: 8000 });
      assert.equal(
        await page.locator('[data-readonly-banner="true"]').count(),
        1,
        `${role} must see read-only banner`
      );
      assert.equal(
        await page.locator('input[data-structure-input="true"]').count(),
        0,
        `${role} must see zero editable inputs`
      );
      assert.equal(
        await page.locator('button[data-add-component="true"]').count(),
        0,
        `${role} must NOT see Add Component button`
      );
      assert.equal(
        await page.locator('button[data-save-structure="true"]').count(),
        0,
        `${role} must NOT see Save Structure button`
      );
      await context.close();
    }

    // STUDENT: never sees link on CourseDetails and is blocked from /courses/1/grade-structure
    const { context: stuCtx, page: stuPage } = await mockSessionPage(browser, {
      role: 'STUDENT',
      language: 'en',
    });
    await setupStructureRoutes(stuPage);
    await stuPage.goto(`${appServer.origin}/courses/1`, { waitUntil: 'networkidle' });
    assert.equal(
      await stuPage.locator('[data-testid="course-grade-structure-entry-button"]').count(),
      0,
      'STUDENT must never see Grade Structure entry link'
    );

    await stuPage.goto(`${appServer.origin}/courses/1/grade-structure`, {
      waitUntil: 'networkidle',
    });
    await stuPage.waitForURL('**/unauthorized', { timeout: 8000 });
    assert.equal(
      await stuPage.locator('[data-grade-structure-page="true"]').count(),
      0,
      'STUDENT must be blocked from accessing Grade Structure page'
    );
    await stuCtx.close();
  });

  // ── PROOF 2: Loaded structure renders rows and total ──
  it('Proof 2: Loaded structure renders all component rows, passMark, and totalPoints', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'SUPER_ADMIN',
      language: 'en',
    });
    await setupStructureRoutes(page);
    await page.goto(`${appServer.origin}/courses/1/grade-structure`, { waitUntil: 'networkidle' });
    await page.waitForSelector('tr[data-component-row="true"]', { timeout: 8000 });

    const rowCount = await page.locator('tr[data-component-row="true"]').count();
    assert.equal(rowCount, 4, 'Must render 4 component rows from GET payload');

    const passMarkVal = await page.locator('input[data-passmark-input="true"]').inputValue();
    assert.equal(passMarkVal, '50', 'Pass mark input must equal 50');

    const totalText = await page.locator('[data-live-total="true"]').innerText();
    assert.equal(totalText.trim(), '100', 'Total points must equal 100');

    const firstRowName = await page.locator('input[data-component-name="true"]').first().inputValue();
    const firstRowPoints = await page
      .locator('input[data-component-points="true"]')
      .first()
      .inputValue();
    assert.equal(firstRowName, 'Attendance');
    assert.equal(firstRowPoints, '10');

    await context.close();
  });

  // ── PROOF 3: Add row, edit, remove row, reorder: live total updates ──
  it('Proof 3: Add row, edit, remove row, and reorder update rows and live totalPoints', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'SUPER_ADMIN',
      language: 'en',
    });
    const twoRowStructure = {
      ...defaultStructureData,
      totalPoints: 90,
      passMark: 45,
      components: [
        { id: 101, name: 'Midterm', nameAr: 'ميدتيرم', maxPoints: 40, source: 'MANUAL', displayOrder: 1 },
        { id: 102, name: 'Final', nameAr: 'فاينل', maxPoints: 50, source: 'MANUAL', displayOrder: 2 },
      ],
    };
    await setupStructureRoutes(page, { getPayload: twoRowStructure });
    await page.goto(`${appServer.origin}/courses/1/grade-structure`, { waitUntil: 'networkidle' });
    await page.waitForSelector('tr[data-component-row="true"]', { timeout: 8000 });

    assert.equal((await page.locator('[data-live-total="true"]').innerText()).trim(), '90');

    // 1. Add row -> new row has empty inputs (no invented numbers) and total stays 90
    await page.locator('button[data-add-component="true"]').click();
    assert.equal(await page.locator('tr[data-component-row="true"]').count(), 3);
    assert.equal(await page.locator('input[data-component-name="true"]').nth(2).inputValue(), '');
    assert.equal(await page.locator('input[data-component-points="true"]').nth(2).inputValue(), '');
    assert.equal((await page.locator('[data-live-total="true"]').innerText()).trim(), '90');

    // 2. Edit new row name and maxPoints (20) -> live total becomes 110
    await page.locator('input[data-component-name="true"]').nth(2).fill('Lab Project');
    await page.locator('input[data-component-points="true"]').nth(2).fill('20');
    assert.equal((await page.locator('[data-live-total="true"]').innerText()).trim(), '110');

    // 3. Edit first row maxPoints from 40 to 35.5 -> live total becomes 105.5
    await page.locator('input[data-component-points="true"]').nth(0).fill('35.5');
    assert.equal((await page.locator('[data-live-total="true"]').innerText()).trim(), '105.5');

    // 4. Reorder: move row 1 (Final) up to index 0
    await page.locator('button[data-move-up="true"]').nth(1).click();
    assert.equal(
      await page.locator('input[data-component-name="true"]').nth(0).inputValue(),
      'Final'
    );
    assert.equal(
      await page.locator('input[data-component-name="true"]').nth(1).inputValue(),
      'Midterm'
    );

    // 5. Remove row 2 (Lab Project) -> row count becomes 2 and live total becomes 85.5
    await page.locator('button[data-remove-row="true"]').nth(2).click();
    assert.equal(await page.locator('tr[data-component-row="true"]').count(), 2);
    assert.equal((await page.locator('[data-live-total="true"]').innerText()).trim(), '85.5');

    // 6. Clear passMark to empty string to verify that empty passMark sends null
    await page.locator('input[data-passmark-input="true"]').fill('');

    const saveBtn = page.locator('button[data-save-structure="true"]');
    await page.waitForFunction(() => {
      const btn = document.querySelector('button[data-save-structure="true"]');
      return btn && !btn.hasAttribute('disabled');
    });

    const putResPromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/courses/1/grade-structure') && res.request().method() === 'PUT'
    );
    await saveBtn.click();
    await putResPromise;

    // Item 1 unproven checks on reordered PUT body:
    assert.ok(lastPutRequest, 'Proof 3: PUT request must be captured after saving reordered structure');
    assert.equal(lastPutRequest.method, 'PUT');
    assert.ok(
      lastPutRequest.url.includes('termId=1'),
      `PUT URL must include termId=1: ${lastPutRequest.url}`
    );

    const reorderedBody = lastPutRequest.postData;
    // (d) empty passMark sends null (strictly null, never an empty string)
    assert.strictEqual(reorderedBody.passMark, null, 'Empty passMark must send null');
    assert.equal(typeof reorderedBody.passMark, 'object', 'typeof null is object');
    assert.notEqual(reorderedBody.passMark, '', 'passMark must never be an empty string');

    assert.equal(reorderedBody.components.length, 2);

    // (a) every EXISTING row sends id as a number equal to the loaded component id (service matches by id)
    assert.equal(reorderedBody.components[0].id, 102, 'First component id must equal loaded id 102 (Final)');
    assert.equal(reorderedBody.components[1].id, 101, 'Second component id must equal loaded id 101 (Midterm)');

    // (c) displayOrder follows the on-screen order after a reorder
    assert.equal(reorderedBody.components[0].displayOrder, 1, 'Final displayOrder must be 1');
    assert.equal(reorderedBody.components[1].displayOrder, 2, 'Midterm displayOrder must be 2');
    assert.equal(reorderedBody.components[0].name, 'Final');
    assert.equal(reorderedBody.components[1].name, 'Midterm');
    assert.equal(reorderedBody.components[1].maxPoints, 35.5);

    // Exact keys on both components
    assert.deepEqual(
      Object.keys(reorderedBody.components[0]).sort(),
      ['displayOrder', 'id', 'maxPoints', 'name', 'nameAr', 'source'],
      'Final component must have exact 6 keys'
    );
    assert.deepEqual(
      Object.keys(reorderedBody.components[1]).sort(),
      ['displayOrder', 'id', 'maxPoints', 'name', 'nameAr', 'source'],
      'Midterm component must have exact 6 keys'
    );

    await context.close();
  });

  // ── PROOF 4: Invalid inputs disable Save with localized inline errors ──
  it('Proof 4: Invalid inputs (negative, 3 decimals, empty name, duplicate name, passMark above total) disable Save with localized inline errors', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'SUPER_ADMIN',
      language: 'en',
    });
    const twoRowStructure = {
      ...defaultStructureData,
      totalPoints: 100,
      passMark: 50,
      components: [
        { id: 101, name: 'Midterm', nameAr: null, maxPoints: 40, source: 'MANUAL', displayOrder: 1 },
        { id: 102, name: 'Final', nameAr: null, maxPoints: 60, source: 'MANUAL', displayOrder: 2 },
      ],
    };
    await setupStructureRoutes(page, { getPayload: twoRowStructure });
    await page.goto(`${appServer.origin}/courses/1/grade-structure`, { waitUntil: 'networkidle' });
    await page.waitForSelector('tr[data-component-row="true"]', { timeout: 8000 });

    const saveBtn = page.locator('button[data-save-structure="true"]');
    const firstRowName = page.locator('input[data-component-name="true"]').first();
    const firstRowPoints = page.locator('input[data-component-points="true"]').first();
    const passMarkInput = page.locator('input[data-passmark-input="true"]');

    // 1. Empty name
    await firstRowName.fill('');
    await page.waitForSelector('[data-name-error="true"]', { timeout: 8000 });
    assert.ok(await saveBtn.isDisabled(), 'Save must be disabled when name is empty');
    assert.ok(
      (await page.locator('[data-name-error="true"]').first().innerText()).includes(
        'Component name is required'
      )
    );

    // 2. Duplicate name (case-insensitive)
    await firstRowName.fill('final');
    await page.waitForSelector('[data-name-error="true"]', { timeout: 8000 });
    assert.ok(await saveBtn.isDisabled(), 'Save must be disabled when component name is duplicate');
    assert.ok(
      (await page.locator('[data-name-error="true"]').first().innerText()).includes(
        'Component name must be unique'
      )
    );
    await firstRowName.fill('Midterm');

    // 3. Negative maxPoints
    await firstRowPoints.fill('-5');
    await page.waitForSelector('[data-points-error="true"]', { timeout: 8000 });
    assert.ok(await saveBtn.isDisabled(), 'Save must be disabled when maxPoints is negative');
    assert.ok(
      (await page.locator('[data-points-error="true"]').first().innerText()).includes(
        'Points cannot be negative'
      )
    );

    // 4. 3 decimals on maxPoints
    await firstRowPoints.fill('12.345');
    await page.waitForSelector('[data-points-error="true"]', { timeout: 8000 });
    assert.ok(await saveBtn.isDisabled(), 'Save must be disabled when maxPoints has 3 decimals');
    assert.ok(
      (await page.locator('[data-points-error="true"]').first().innerText()).includes(
        'Points cannot have more than 2 decimal places'
      )
    );
    await firstRowPoints.fill('40');

    // 5. passMark above total (120 > 100)
    await passMarkInput.fill('120');
    await page.waitForSelector('[data-passmark-error="true"]', { timeout: 8000 });
    assert.ok(await saveBtn.isDisabled(), 'Save must be disabled when passMark exceeds total');
    assert.ok(
      (await page.locator('[data-passmark-error="true"]').innerText()).includes(
        'Pass mark cannot exceed total points'
      )
    );

    // 6. passMark 0 (must be strictly positive finite number)
    await passMarkInput.fill('0');
    await page.waitForSelector('[data-passmark-error="true"]', { timeout: 8000 });
    assert.ok(await saveBtn.isDisabled(), 'Save must be disabled when passMark is 0');
    const pmZeroError = await page.locator('[data-passmark-error="true"]').innerText();
    assert.ok(
      pmZeroError.includes('greater than zero'),
      `passMark 0 error banner "${pmZeroError}" must require strictly positive number`
    );

    // 7. passMark negative (-10)
    await passMarkInput.fill('-10');
    await page.waitForSelector('[data-passmark-error="true"]', { timeout: 8000 });
    assert.ok(await saveBtn.isDisabled(), 'Save must be disabled when passMark is negative');
    const pmNegError = await page.locator('[data-passmark-error="true"]').innerText();
    assert.ok(
      pmNegError.includes('cannot be negative'),
      `passMark negative error banner "${pmNegError}" must show negative points error`
    );

    await context.close();
  });

  // ── PROOF 5: Valid save sends exactly one PUT with termId and exact body keys/types, then refetches ──
  it('Proof 5: Valid save sends exactly one PUT (double-click protected) with termId and exact body keys/types, then refetches', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'SUPER_ADMIN',
      language: 'en',
    });
    lastPutRequest = null;
    putRequestCount = 0;
    getStructureFetchCount = 0;

    await setupStructureRoutes(page);
    await page.goto(`${appServer.origin}/courses/1/grade-structure`, { waitUntil: 'networkidle' });
    await page.waitForSelector('tr[data-component-row="true"]', { timeout: 8000 });

    const initialGetCount = getStructureFetchCount;

    // Update passMark to 55 and add a 5th component
    await page.locator('input[data-passmark-input="true"]').fill('55');
    await page.locator('button[data-add-component="true"]').click();
    await page.locator('input[data-component-name="true"]').nth(4).fill('Practical Lab');
    await page.locator('input[data-component-name-ar="true"]').nth(4).fill('معمل عملي');
    await page.locator('input[data-component-points="true"]').nth(4).fill('15.5');

    const saveBtn = page.locator('button[data-save-structure="true"]');
    await page.waitForFunction(() => {
      const btn = document.querySelector('button[data-save-structure="true"]');
      return btn && !btn.hasAttribute('disabled');
    });

    const putResPromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/courses/1/grade-structure') && res.request().method() === 'PUT'
    );
    const refetchGetResPromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/courses/1/grade-structure') && res.request().method() === 'GET'
    );

    await saveBtn.dblclick();
    await putResPromise;
    await refetchGetResPromise;

    assert.equal(putRequestCount, 1, 'Double-click must send exactly one PUT request');
    assert.ok(lastPutRequest, 'PUT request must be captured');
    assert.equal(lastPutRequest.method, 'PUT');
    assert.ok(
      lastPutRequest.url.includes('termId=1'),
      `PUT URL must include termId=1: ${lastPutRequest.url}`
    );

    const body = lastPutRequest.postData;
    assert.deepEqual(Object.keys(body).sort(), ['components', 'passMark']);
    assert.equal(typeof body.passMark, 'number');
    assert.equal(body.passMark, 55);
    assert.ok(Array.isArray(body.components));
    assert.equal(body.components.length, 5);

    // (a) every EXISTING row sends id as a number equal to the loaded component id (service matches by id)
    assert.equal(body.components[0].id, 101, 'Row 0 id must match loaded id 101');
    assert.equal(body.components[1].id, 102, 'Row 1 id must match loaded id 102');
    assert.equal(body.components[2].id, 103, 'Row 2 id must match loaded id 103');
    assert.equal(body.components[3].id, 104, 'Row 3 id must match loaded id 104');

    // (b) a NEW row has no id key
    assert.equal('id' in body.components[4], false, 'New row 4 must have no id property');
    assert.equal(Object.prototype.hasOwnProperty.call(body.components[4], 'id'), false);

    // (c) every component has exactly the keys id (existing only), name, nameAr, maxPoints, source, displayOrder with types string, string|null, number, one of MANUAL|AUTO_QUIZ|AUTO_ATTENDANCE, integer >= 1
    for (let i = 0; i < 4; i++) {
      const comp = body.components[i];
      assert.deepEqual(
        Object.keys(comp).sort(),
        ['displayOrder', 'id', 'maxPoints', 'name', 'nameAr', 'source'],
        `Existing component ${i} must have exactly the 6 required keys`
      );
      assert.equal(typeof comp.id, 'number');
      assert.ok(Number.isInteger(comp.id) && comp.id >= 1);
      assert.equal(typeof comp.name, 'string');
      assert.ok(typeof comp.nameAr === 'string' || comp.nameAr === null);
      assert.equal(typeof comp.maxPoints, 'number');
      assert.ok(Number.isFinite(comp.maxPoints) && comp.maxPoints > 0);
      assert.ok(['MANUAL', 'AUTO_QUIZ', 'AUTO_ATTENDANCE'].includes(comp.source));
      assert.equal(typeof comp.displayOrder, 'number');
      assert.ok(Number.isInteger(comp.displayOrder) && comp.displayOrder >= 1);
      assert.equal(comp.displayOrder, i + 1);
    }

    const newComp = body.components[4];
    assert.deepEqual(
      Object.keys(newComp).sort(),
      ['displayOrder', 'maxPoints', 'name', 'nameAr', 'source'],
      'New component 4 must have exactly the 5 required keys (no id)'
    );
    assert.equal(typeof newComp.name, 'string');
    assert.equal(newComp.name, 'Practical Lab');
    assert.equal(newComp.nameAr, 'معمل عملي');
    assert.equal(typeof newComp.maxPoints, 'number');
    assert.equal(newComp.maxPoints, 15.5);
    assert.equal(newComp.source, 'MANUAL');
    assert.equal(typeof newComp.displayOrder, 'number');
    assert.ok(Number.isInteger(newComp.displayOrder) && newComp.displayOrder >= 1);
    assert.equal(newComp.displayOrder, 5);

    assert.ok(
      getStructureFetchCount > initialGetCount,
      'Editor must refetch GET grade-structure after successful PUT'
    );

    await context.close();
  });

  // ── PROOF 6: isLocked renders read-only banner and no inputs ──
  it('Proof 6: isLocked renders localized read-only banner, zero inputs, and no save button', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'SUPER_ADMIN',
      language: 'en',
    });
    await setupStructureRoutes(page, {
      getPayload: { ...defaultStructureData, isLocked: true },
    });
    await page.goto(`${appServer.origin}/courses/1/grade-structure`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-locked-banner="true"]', { timeout: 8000 });

    const bannerText = await page.locator('[data-locked-banner="true"]').innerText();
    assert.ok(bannerText.includes('Grade structure is locked'));

    assert.equal(
      await page.locator('[data-grade-structure-page="true"] input').count(),
      0,
      'Locked structure page must render zero inputs'
    );
    assert.equal(
      await page.locator('button[data-save-structure="true"]').count(),
      0,
      'Locked structure page must not render Save button'
    );
    assert.equal(
      await page.locator('button[data-add-component="true"]').count(),
      0,
      'Locked structure page must not render Add Component button'
    );
    await context.close();
  });

  // ── PROOF 7: Every real 409/422/403 message in ar and en ──
  it('Proof 7: Every real 409/422/403 backend error from STEP 0 renders localized message in both EN and AR', async () => {
    const errorCases = [
      {
        status: 409,
        message: 'Cannot modify grade structure: published grades exist for this course in this term',
        enSnippet: 'published grades already exist',
        arSnippet: 'لوجود درجات منشورة بالفعل',
      },
      {
        status: 409,
        message: 'Cannot modify grade structure: academic term is in the past',
        enSnippet: 'academic term is in the past',
        arSnippet: 'الفصل الدراسي في الماضي',
      },
      {
        status: 409,
        message: 'Cannot modify grade structure: academic term is locked',
        enSnippet: 'academic term is locked',
        arSnippet: 'الفصل الدراسي مقفل',
      },
      {
        status: 409,
        message: 'Cannot remove component "Midterm Exam": grade entries exist',
        enSnippet: 'Cannot remove a component that already has recorded grade entries',
        arSnippet: 'لا يمكن حذف مكون يحتوي بالفعل على درجات مسجلة',
      },
      {
        status: 409,
        message: 'Cannot change source of component "Midterm Exam": grade entries exist',
        enSnippet: 'Cannot change the source of a component',
        arSnippet: 'لا يمكن تغيير مصدر مكون يحتوي بالفعل على درجات مسجلة',
      },
      {
        status: 409,
        message: 'Cannot reduce maxPoints below existing draft score 22',
        enSnippet: 'Cannot reduce maximum points below an existing student draft score',
        arSnippet: 'لا يمكن تقليل الدرجة القصوى لأقل من درجة مسودة مسجلة',
      },
      {
        status: 409,
        message: 'Duplicate value for name. Please use another value!',
        enSnippet: 'Duplicate component name',
        arSnippet: 'اسم المكون مكرر',
      },
      {
        status: 409,
        message: 'Transaction conflict during grade structure update. Please retry.',
        enSnippet: 'Transaction conflict occurred',
        arSnippet: 'حدث تعارض أثناء تحديث هيكل الدرجات',
      },
      {
        status: 422,
        message: 'At most one component with source AUTO_QUIZ is permitted per course',
        enSnippet: 'Automatic (Quizzes)',
        arSnippet: 'تلقائي (الاختبارات القصيرة)',
      },
      {
        status: 422,
        message: 'At most one component with source AUTO_ATTENDANCE is permitted per course',
        enSnippet: 'Automatic (Attendance)',
        arSnippet: 'تلقائي (الحضور)',
      },
      {
        status: 422,
        message: 'passMark (120) cannot exceed total course points (100)',
        enSnippet: 'Pass mark cannot exceed the total course points',
        arSnippet: 'لا يمكن أن تتجاوز درجة النجاح إجمالي درجات المقرر',
      },
      {
        status: 403,
        message: 'Course is outside your administrative scope',
        enSnippet: 'outside your administrative scope',
        arSnippet: 'خارج نطاق صلاحياتك الإدارية',
      },
      {
        status: 422,
        message: 'Component id 999 does not belong to this course grade structure',
        enSnippet: 'do not belong to this course grade structure',
        arSnippet: 'لا ينتمي إلى هيكل درجات هذا المقرر',
      },
      {
        status: 422,
        message: 'Duplicate component id 101 in grade structure payload',
        enSnippet: 'Duplicate component ID detected',
        arSnippet: 'يوجد معرف مكون مكرر في بيانات هيكل الدرجات',
      },
      {
        status: 403,
        message: 'Teaching assistants are not permitted to modify course grade structures',
        enSnippet: 'do not have permission to modify',
        arSnippet: 'ليس لديك صلاحية لتعديل هيكل درجات المقرر',
      },
      {
        status: 403,
        message: 'Students are not permitted to modify course grade structures',
        enSnippet: 'do not have permission to modify',
        arSnippet: 'ليس لديك صلاحية لتعديل هيكل درجات المقرر',
      },
      {
        status: 403,
        message: 'Doctors are not permitted to modify course grade structures',
        enSnippet: 'do not have permission to modify',
        arSnippet: 'ليس لديك صلاحية لتعديل هيكل درجات المقرر',
      },
      {
        status: 404,
        message: 'Academic term not found',
        enSnippet: 'selected academic term was not found',
        arSnippet: 'الفصل الدراسي المحدد غير موجود',
      },
      {
        status: 422,
        message: 'No active academic term found. Please provide termId explicitly.',
        enSnippet: 'No active academic term found',
        arSnippet: 'لم يتم العثور على فصل دراسي نشط',
      },
      {
        status: 422,
        message: 'Duplicate component name: "Final". Names must be unique within course',
        enSnippet: 'Duplicate component name',
        arSnippet: 'اسم المكون مكرر',
      },
    ];

    for (const tc of errorCases) {
      // EN
      const { context: enCtx, page: enPage } = await mockSessionPage(browser, {
        role: 'SUPER_ADMIN',
        language: 'en',
      });
      await setupStructureRoutes(enPage, {
        putStatus: tc.status,
        putErrorPayload: { success: false, message: tc.message },
      });
      await enPage.goto(`${appServer.origin}/courses/1/grade-structure`, {
        waitUntil: 'networkidle',
      });
      await enPage.waitForSelector('input[data-passmark-input="true"]', { timeout: 8000 });
      await enPage.locator('input[data-passmark-input="true"]').fill('55');
      await enPage.locator('button[data-save-structure="true"]').click();
      await enPage.waitForSelector('[data-save-error-banner="true"]', { timeout: 8000 });
      const enText = await enPage.locator('[data-save-error-banner="true"]').innerText();
      assert.ok(
        enText.includes(tc.enSnippet),
        `EN error banner "${enText}" must include "${tc.enSnippet}"`
      );
      await enCtx.close();

      // AR
      const { context: arCtx, page: arPage } = await mockSessionPage(browser, {
        role: 'SUPER_ADMIN',
        language: 'ar',
      });
      await arPage.addInitScript(() => {
        localStorage.setItem('language', 'ar');
      });
      await setupStructureRoutes(arPage, {
        putStatus: tc.status,
        putErrorPayload: { success: false, message: tc.message },
      });
      await arPage.goto(`${appServer.origin}/courses/1/grade-structure`, {
        waitUntil: 'networkidle',
      });
      await arPage.waitForSelector('input[data-passmark-input="true"]', { timeout: 8000 });
      await arPage.locator('input[data-passmark-input="true"]').fill('55');
      await arPage.locator('button[data-save-structure="true"]').click();
      await arPage.waitForSelector('[data-save-error-banner="true"]', { timeout: 8000 });
      const arText = await arPage.locator('[data-save-error-banner="true"]').innerText();
      assert.ok(
        arText.includes(tc.arSnippet),
        `AR error banner "${arText}" must include "${tc.arSnippet}"`
      );
      await arCtx.close();
    }

    // Unknown backend message renders localized generic message in AR (never raw English)
    const { context: unkCtx, page: unkPage } = await mockSessionPage(browser, {
      role: 'SUPER_ADMIN',
      language: 'ar',
    });
    await unkPage.addInitScript(() => {
      localStorage.setItem('language', 'ar');
    });
    await setupStructureRoutes(unkPage, {
      putStatus: 500,
      putErrorPayload: {
        success: false,
        message: 'RAW_UNHANDLED_WORKER_EXCEPTION_LEAK',
      },
    });
    await unkPage.goto(`${appServer.origin}/courses/1/grade-structure`, {
      waitUntil: 'networkidle',
    });
    await unkPage.waitForSelector('input[data-passmark-input="true"]', { timeout: 8000 });
    await unkPage.locator('input[data-passmark-input="true"]').fill('55');
    await unkPage.locator('button[data-save-structure="true"]').click();
    await unkPage.waitForSelector('[data-save-error-banner="true"]', { timeout: 8000 });
    const unkArText = await unkPage.locator('[data-save-error-banner="true"]').innerText();
    assert.ok(
      unkArText.includes('حدث خطأ أثناء تحديث هيكل الدرجات'),
      `Unknown error in Arabic must render generic Arabic message: "${unkArText}"`
    );
    assert.equal(
      unkArText.includes('RAW_UNHANDLED_WORKER_EXCEPTION_LEAK'),
      false,
      'Unknown error must NEVER render raw English backend string'
    );
    await unkCtx.close();
  });

  // ── PROOF 8: Unsaved-changes guard armed when dirty, disarmed after save ──
  it('Proof 8: Unsaved-changes beforeunload guard is disarmed initially, armed when dirty, and disarmed after save', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'SUPER_ADMIN',
      language: 'en',
    });
    await setupStructureRoutes(page);
    await page.goto(`${appServer.origin}/courses/1/grade-structure`, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[data-passmark-input="true"]', { timeout: 8000 });

    // 1. Initially disarmed
    const initialPrevented = await page.evaluate(() => {
      const evt = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(evt);
      return evt.defaultPrevented;
    });
    assert.equal(initialPrevented, false, 'beforeunload must NOT be armed before edits');

    // 2. Make dirty -> armed
    await page.locator('input[data-passmark-input="true"]').fill('60');
    await page.waitForSelector('[data-grade-structure-page="true"][data-dirty="true"]', {
      timeout: 8000,
    });
    const dirtyPrevented = await page.evaluate(() => {
      const evt = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(evt);
      return evt.defaultPrevented;
    });
    assert.equal(dirtyPrevented, true, 'beforeunload MUST be armed when form is dirty');

    // 3. Save -> disarmed after refetch
    await page.locator('button[data-save-structure="true"]').click();
    await page.waitForSelector('[data-grade-structure-page="true"][data-dirty="false"]', {
      timeout: 8000,
    });
    const afterSavePrevented = await page.evaluate(() => {
      const evt = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(evt);
      return evt.defaultPrevented;
    });
    assert.equal(afterSavePrevented, false, 'beforeunload MUST be disarmed after successful save');

    await context.close();
  });

  // ── PROOF 9: Gradebook "structure not defined" screen shows editor link to admins only, and gradebook link works after save ──
  it('Proof 9: Gradebook 409 "structure not defined" screen offers editor link to admins only, and after saving structure the gradebook opens', async () => {
    // 1. Doctor on 409 gradebook screen does NOT see configure structure button
    const { context: docCtx, page: docPage } = await mockSessionPage(browser, {
      role: 'DOCTOR',
      language: 'en',
      user: { doctor: { id: 1 } },
    });
    await setupStructureRoutes(docPage, {
      gradebookStatus: 409,
      gradebookPayload: {
        success: false,
        message: 'Grade structure has not been defined for this course and term',
      },
    });
    await docPage.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await docPage.waitForSelector('[data-gradebook-error="true"]', { timeout: 8000 });
    assert.equal(
      await docPage.locator('button[data-configure-structure="true"]').count(),
      0,
      'DOCTOR must NOT see Configure Grade Structure link on 409 gradebook screen'
    );
    await docCtx.close();

    // 2. TA on 409 gradebook screen does NOT see configure structure button
    const { context: taCtx, page: taPage } = await mockSessionPage(browser, {
      role: 'TEACHING_ASSISTANT',
      language: 'en',
      user: { teachingAssistant: { id: 1 } },
    });
    await setupStructureRoutes(taPage, {
      gradebookStatus: 409,
      gradebookPayload: {
        success: false,
        message: 'Grade structure has not been defined for this course and term',
      },
    });
    await taPage.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await taPage.waitForSelector('[data-gradebook-error="true"]', { timeout: 8000 });
    assert.equal(
      await taPage.locator('button[data-configure-structure="true"]').count(),
      0,
      'TA must NOT see Configure Grade Structure link on 409 gradebook screen'
    );
    await taCtx.close();

    // 3. Admin on 409 gradebook screen sees configure structure button, clicks it, saves structure, and navigates back to working gradebook
    const { context: admCtx, page: admPage } = await mockSessionPage(browser, {
      role: 'SUPER_ADMIN',
      language: 'en',
    });
    let structureSaved = false;
    await admPage.route('**/api/courses/1/gradebook*', async (route) => {
      await route.fulfill({
        status: structureSaved ? 200 : 409,
        contentType: 'application/json',
        body: JSON.stringify(
          structureSaved
            ? {
                success: true,
                data: {
                  courseId: 1,
                  termId: 1,
                  termName: 'Fall 2026',
                  structure: {
                    id: 50,
                    totalPoints: 100,
                    passMark: 50,
                    components: defaultStructureData.components,
                  },
                  students: [],
                },
              }
            : {
                success: false,
                message: 'Grade structure has not been defined for this course and term',
              }
        ),
      });
    });
    await admPage.route('**/api/courses/1/grade-structure*', async (route) => {
      if (route.request().method() === 'PUT') {
        structureSaved = true;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: defaultStructureData,
        }),
      });
    });
    await admPage.route('**/api/courses/1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockCourse }),
      });
    });
    await admPage.route('**/api/academic-terms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockTerms }),
      });
    });

    await admPage.goto(`${appServer.origin}/courses/1/gradebook`, { waitUntil: 'networkidle' });
    await admPage.waitForSelector('button[data-configure-structure="true"]', { timeout: 8000 });
    await admPage.locator('button[data-configure-structure="true"]').click();

    await admPage.waitForSelector('[data-grade-structure-page="true"]', { timeout: 8000 });
    await admPage.locator('input[data-passmark-input="true"]').fill('55');
    await admPage.locator('button[data-save-structure="true"]').click();
    await admPage.waitForSelector('[data-grade-structure-page="true"][data-dirty="false"]', {
      timeout: 8000,
    });

    await admPage.locator('button[data-open-gradebook="true"]').click();
    await admPage.waitForSelector('[data-table-container="true"]', { timeout: 8000 });
    assert.equal(await admPage.locator('[data-table-container="true"]').count(), 1);
    await admCtx.close();
  });

  // ── PROOF 10: Matrix on the editor: 1440/1024/768/430/390/360 x ar/en x light/dark ──
  const viewports = [1440, 1024, 768, 430, 390, 360];
  const languages = ['en', 'ar'];
  const themes = ['light', 'dark'];

  for (const width of viewports) {
    for (const lang of languages) {
      for (const theme of themes) {
        it(`Proof 10 [${width}px ${lang.toUpperCase()} ${theme.toUpperCase()}]: editor renders with dir/lang, theme class, and scrollWidth <= innerWidth`, async () => {
          const { context, page } = await mockSessionPage(browser, {
            role: 'SUPER_ADMIN',
            language: lang,
          });

          await page.addInitScript(
            ({ themeVal, langVal }) => {
              localStorage.setItem('theme', themeVal);
              localStorage.setItem('language', langVal);
            },
            { themeVal: theme, langVal: lang }
          );

          await page.setViewportSize({ width, height: 900 });

          const jsErrors = [];
          page.on('pageerror', (err) => jsErrors.push(err.message));

          await setupStructureRoutes(page);
          await page.goto(`${appServer.origin}/courses/1/grade-structure`, {
            waitUntil: 'networkidle',
          });
          await page.waitForSelector('[data-grade-structure-page="true"]', { timeout: 8000 });

          const htmlDir = await page.getAttribute('html', 'dir');
          const htmlLang = await page.getAttribute('html', 'lang');
          assert.equal(htmlDir, lang === 'ar' ? 'rtl' : 'ltr');
          assert.equal(htmlLang, lang);

          const hasDarkClass = await page.evaluate(() =>
            document.documentElement.classList.contains('dark')
          );
          assert.equal(hasDarkClass, theme === 'dark');

          const { scrollWidth, innerWidth } = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
          }));
          assert.ok(
            scrollWidth <= innerWidth,
            `scrollWidth (${scrollWidth}) must be <= innerWidth (${innerWidth}) at ${width}px ${lang} ${theme}`
          );
          assert.equal(jsErrors.length, 0);

          await context.close();
        });
      }
    }
  }

  it('teardown server and browser', async () => {
    if (browser) await browser.close();
    if (appServer) await appServer.close();
  });
});

