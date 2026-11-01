import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { chromium } from 'file:///C:/Users/omar4/AppData/Local/nvm/v20.20.2/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import { serveBuiltApp, mockSessionPage } from './helpers/built-app.mjs';

/*
Real URLs and response envelopes audited from api-server:
1. GET /api/courses/:id
   Mount: artifacts/api-server/src/app.ts:283 -> app.use('/api/courses', protect, coursesRoutes);
   Route: artifacts/api-server/src/routes/courses.routes.ts:71 -> router.get('/:id', idParamValidation, validate, coursesController.getCourseById);
   Controller: artifacts/api-server/src/controllers/courses.controller.ts:291-298 -> res.json({ success: true, data: { ...course, scheduleSlots: normalizedSlots, sections: normalizedSlots } });
2. PATCH /api/courses/:id/toggle-publication
   Route: artifacts/api-server/src/routes/courses.routes.ts:74 -> router.patch('/:id/toggle-publication', coursesController.toggleCoursePublication);
   Controller: artifacts/api-server/src/controllers/courses.controller.ts:1129-1133 -> res.json({ success: true, data: updated, message: ... });
3. POST /api/courses/:id/materials
   Route: artifacts/api-server/src/routes/courses.routes.ts:75-82 -> router.post('/:id/materials', idParamValidation, validate, coursesController.requireCourseMaterialManager, materialUpload.single('file'), coursesController.uploadCourseMaterial);
   Controller: artifacts/api-server/src/controllers/courses.controller.ts:958-962 -> res.status(201).json({ success: true, data: material, message: 'Material uploaded successfully' });
4. PATCH /api/courses/:id/materials/:materialId/toggle
   Route: artifacts/api-server/src/routes/courses.routes.ts:83 -> router.patch('/:id/materials/:materialId/toggle', coursesController.toggleMaterialPublication);
   Controller: artifacts/api-server/src/controllers/courses.controller.ts:1083-1087 -> res.json({ success: true, data: updated, message: ... });
5. DELETE /api/courses/:id/materials/:materialId
   Route: artifacts/api-server/src/routes/courses.routes.ts:84 -> router.delete('/:id/materials/:materialId', coursesController.deleteCourseMaterial);
   Controller: artifacts/api-server/src/controllers/courses.controller.ts:1033-1036 -> res.json({ success: true, message: 'Course material deleted successfully' });
6. GET /api/courses/:id/materials/:materialId/download
   Route: artifacts/api-server/src/routes/courses.routes.ts:85 -> router.get('/:id/materials/:materialId/download', coursesController.downloadCourseMaterial);
   Controller: artifacts/api-server/src/controllers/courses.controller.ts:1141-1252 -> streams binary attachment with Content-Disposition header.
*/

const TA_USER = {
  id: 101,
  email: 'ta.nour@example.test',
  firstName: 'Nour',
  lastName: 'Ali',
  teachingAssistant: { id: 'cm0ta0001', departmentId: 10 },
};

const DOCTOR_USER = {
  id: 200,
  email: 'dr.tariq@example.test',
  firstName: 'Tariq',
  lastName: 'Hassan',
  doctor: { id: 50, departmentId: 10 },
};

const STUDENT_USER = {
  id: 300,
  email: 'student.sara@example.test',
  firstName: 'Sara',
  lastName: 'adel',
  student: { id: 7, departmentId: 10, year: 2 },
};

const BASE_SLOTS = [
  {
    id: 11,
    dayOfWeek: 'SUNDAY',
    startTime: '09:00',
    endTime: '11:00',
    room: 'Hall A',
    slotType: 'LECTURE',
    doctor: {
      id: 50,
      firstName: 'Tariq',
      lastName: 'Hassan',
      doctorId: 'DOC-00050',
      user: { id: 200, email: 'dr.tariq@example.test', profilePicture: null },
    },
    teachingAssistant: null,
  },
  {
    id: 12,
    dayOfWeek: 'TUESDAY',
    startTime: '11:00',
    endTime: '13:00',
    room: 'Lab 2',
    slotType: 'LAB',
    doctor: null,
    teachingAssistant: {
      id: 'cm0ta0001',
      firstName: 'Nour',
      lastName: 'Ali',
      employeeId: 'TA-001',
      user: { id: 101, email: 'ta.nour@example.test', profilePicture: null },
    },
  },
];

function buildCoursePayload(materials = []) {
  return {
    id: 1,
    courseCode: 'CS201',
    name: 'Data Structures',
    description: 'Core data structures and algorithmic analysis',
    credits: 3,
    maxStudents: 60,
    year: 2,
    semester: 1,
    isPublished: true,
    departmentId: 10,
    department: {
      id: 10,
      name: 'Computer Science',
      nameAr: 'علوم الحاسب',
      collegeId: 1,
      college: { id: 1, name: 'Faculty of Computers', nameAr: 'كلية الحاسبات' },
    },
    scheduleSlots: BASE_SLOTS,
    sections: BASE_SLOTS,
    tasks: [],
    materials,
    enrollments: [],
    _count: {
      enrollments: 24,
      quizzes: 0,
      tasks: 0,
      exams: 0,
      materials: materials.length,
    },
  };
}

async function assertHtmlPrefs(page, { lang, theme }) {
  const htmlDir = await page.getAttribute('html', 'dir');
  const htmlLang = await page.getAttribute('html', 'lang');
  const hasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  assert.equal(htmlDir, lang === 'ar' ? 'rtl' : 'ltr', `HTML dir must match ${lang}`);
  assert.equal(htmlLang, lang, `HTML lang must be ${lang}`);
  assert.equal(hasDark, theme === 'dark', `HTML dark class must be ${theme === 'dark'}`);
}

async function setupCourseMocks(page, initialMaterials) {
  let currentCourse = buildCoursePayload(initialMaterials);
  const capturedUploads = [];
  const capturedToggles = [];
  const capturedDeletes = [];
  const capturedCoursePubToggles = [];
  const capturedDownloads = [];

  await page.route('**/api/courses/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();

    const getMatch = url.pathname.match(/^\/api\/courses\/(\d+)$/);
    if (method === 'GET' && getMatch) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: currentCourse }),
      });
      return;
    }

    const pubToggleMatch = url.pathname.match(/^\/api\/courses\/(\d+)\/toggle-publication$/);
    if (method === 'PATCH' && pubToggleMatch) {
      const courseId = Number(pubToggleMatch[1]);
      capturedCoursePubToggles.push({ courseId, method, pathname: url.pathname });
      currentCourse = { ...currentCourse, isPublished: !currentCourse.isPublished };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: currentCourse,
          message: currentCourse.isPublished
            ? 'Course published for students'
            : 'Course set to draft mode',
        }),
      });
      return;
    }

    const uploadMatch = url.pathname.match(/^\/api\/courses\/(\d+)\/materials$/);
    if (method === 'POST' && uploadMatch) {
      const courseId = Number(uploadMatch[1]);
      const contentType = req.headers()['content-type'] || '';
      const rawBuffer = req.postDataBuffer() || Buffer.alloc(0);
      const formData = await new Response(rawBuffer, {
        headers: { 'content-type': contentType },
      }).formData();
      const keys = Array.from(formData.keys());
      const fields = {};
      for (const key of keys) {
        const val = formData.get(key);
        fields[key] = typeof val === 'string' ? val : { name: val.name, size: val.size, type: val.type };
      }

      const created = {
        id: 901,
        title: String(fields.title || ''),
        description: fields.description ? String(fields.description) : null,
        type: fields.type === 'TUTORIAL' ? 'TUTORIAL' : 'LECTURE',
        fileUrl: typeof fields.fileUrl === 'string' ? fields.fileUrl : '/uploads/materials/mock.pdf',
        fileName: typeof fields.fileUrl === 'string' ? null : 'mock.pdf',
        fileSize: typeof fields.fileUrl === 'string' ? null : 1024,
        fileType: typeof fields.fileUrl === 'string' ? 'link' : 'application/pdf',
        isPublished: true,
        courseId,
        uploadedById: TA_USER.id,
        createdAt: '2026-10-20T12:00:00.000Z',
        uploadedBy: {
          id: TA_USER.id,
          email: TA_USER.email,
          role: 'TEACHING_ASSISTANT',
          teachingAssistant: { firstName: TA_USER.firstName, lastName: TA_USER.lastName },
        },
      };
      capturedUploads.push({ courseId, method, pathname: url.pathname, keys, fields });
      currentCourse = buildCoursePayload([created, ...currentCourse.materials]);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: created,
          message: 'Material uploaded successfully',
        }),
      });
      return;
    }

    const matToggleMatch = url.pathname.match(/^\/api\/courses\/(\d+)\/materials\/(\d+)\/toggle$/);
    if (method === 'PATCH' && matToggleMatch) {
      const courseId = Number(matToggleMatch[1]);
      const materialId = Number(matToggleMatch[2]);
      capturedToggles.push({ courseId, materialId, method, pathname: url.pathname });
      let updatedItem = null;
      const nextMaterials = currentCourse.materials.map((m) => {
        if (m.id === materialId) {
          updatedItem = { ...m, isPublished: !m.isPublished };
          return updatedItem;
        }
        return m;
      });
      currentCourse = buildCoursePayload(nextMaterials);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: updatedItem,
          message: updatedItem?.isPublished
            ? 'Material published for students'
            : 'Material set to draft mode',
        }),
      });
      return;
    }

    const matDeleteMatch = url.pathname.match(/^\/api\/courses\/(\d+)\/materials\/(\d+)$/);
    if (method === 'DELETE' && matDeleteMatch) {
      const courseId = Number(matDeleteMatch[1]);
      const materialId = Number(matDeleteMatch[2]);
      capturedDeletes.push({ courseId, materialId, method, pathname: url.pathname });
      currentCourse = buildCoursePayload(
        currentCourse.materials.filter((m) => m.id !== materialId)
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Course material deleted successfully',
        }),
      });
      return;
    }

    const downloadMatch = url.pathname.match(/^\/api\/courses\/(\d+)\/materials\/(\d+)\/download$/);
    if (method === 'GET' && downloadMatch) {
      const courseId = Number(downloadMatch[1]);
      const materialId = Number(downloadMatch[2]);
      capturedDownloads.push({ courseId, materialId, method, pathname: url.pathname });
      await route.fulfill({
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="material.pdf"',
          'x-content-type-options': 'nosniff',
        },
        body: Buffer.from('%PDF-1.4 mock binary'),
      });
      return;
    }

    await route.fallback();
  });

  return {
    capturedUploads,
    capturedToggles,
    capturedDeletes,
    capturedCoursePubToggles,
    capturedDownloads,
  };
}

describe('WP5-T4b Browser Suite: TA Material Parity, Link Materials (M-275) & 24-Config Matrix', () => {
  let appServer;
  let browser;

  before(async () => {
    appServer = await serveBuiltApp();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  });

  after(async () => {
    try {
      if (browser) await browser.close();
    } finally {
      if (appServer) await appServer.close();
    }
  });

  it('(a) TA has no LECTURE option and no publication toggle, and the upload POST body type is TUTORIAL', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'TEACHING_ASSISTANT',
      language: 'en',
      user: TA_USER,
    });
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('language', 'en');
    });

    const { capturedUploads } = await setupCourseMocks(page, []);
    await page.goto(`${appServer.origin}/courses/1`, { waitUntil: 'networkidle' });
    await page.locator('h1:has-text("Data Structures")').waitFor({ state: 'visible', timeout: 8000 });
    await assertHtmlPrefs(page, { lang: 'en', theme: 'light' });

    // Course-publication toggle button must NOT render for TEACHING_ASSISTANT
    const pubToggleBtn = page.locator(
      'button:has-text("المقرر منشور للطلاب"), button:has-text("مسودة ومخفي")'
    );
    assert.equal(await pubToggleBtn.count(), 0, 'TA must not see course-publication toggle button');

    // Lectures tab must NOT offer upload lecture action to TA
    await page.locator('button:has-text("Lectures")').first().click();
    await page.locator('h3:has-text("Lectures")').first().waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(
      await page.locator('button:has-text("Upload New Lecture")').count(),
      0,
      'TA must not see Upload New Lecture button on Lectures tab'
    );

    // Tutorials tab offers upload tutorial modal, without LECTURE category option
    await page.locator('button:has-text("Tutorials & Labs")').first().click();
    const openUploadBtn = page.locator('button:has-text("Upload New Tutorial")').first();
    await openUploadBtn.waitFor({ state: 'visible', timeout: 5000 });
    await openUploadBtn.click();

    const modalForm = page.locator('form').first();
    await modalForm.waitFor({ state: 'visible', timeout: 5000 });

    assert.equal(
      await modalForm.locator('button:has-text("Lecture")').count(),
      0,
      'Upload form must not offer LECTURE option to TA'
    );
    assert.equal(
      await modalForm.locator('button:has-text("Tutorial")').count(),
      1,
      'Upload form must show TUTORIAL option for TA'
    );

    // Submit a link material as TA and verify multipart POST keys, id type, and type === TUTORIAL
    await modalForm.locator('input[type="text"]').first().fill('TA Week 1 Worksheet');
    await modalForm.locator('button:has-text("External Link")').click();
    await modalForm.locator('input[type="url"]').fill('https://docs.example.edu/ta-week-1');
    await modalForm.locator('button[type="submit"]').click();

    await page.locator('h4:has-text("TA Week 1 Worksheet")').waitFor({ state: 'visible', timeout: 8000 });

    assert.equal(capturedUploads.length, 1, 'Expected exactly 1 material upload POST');
    const uploadReq = capturedUploads[0];
    assert.equal(typeof uploadReq.courseId, 'number', 'courseId must be a number');
    assert.equal(Number.isInteger(uploadReq.courseId), true, 'courseId must be an integer');
    assert.equal(uploadReq.courseId, 1);
    assert.equal(uploadReq.method, 'POST');
    assert.equal(uploadReq.pathname, '/api/courses/1/materials');
    assert.deepEqual(uploadReq.keys.sort(), ['fileUrl', 'title', 'type']);
    assert.equal(uploadReq.fields.title, 'TA Week 1 Worksheet');
    assert.equal(uploadReq.fields.type, 'TUTORIAL', 'TA upload POST body type must be TUTORIAL');
    assert.equal(uploadReq.fields.fileUrl, 'https://docs.example.edu/ta-week-1');

    await context.close();
  });

  it('(b) TA delete/toggle controls render only on own TUTORIAL rows', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'TEACHING_ASSISTANT',
      language: 'en',
      user: TA_USER,
    });
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('language', 'en');
    });

    const materials = [
      {
        id: 301,
        title: 'Doctor Lecture 1',
        description: 'Uploaded by professor',
        type: 'LECTURE',
        fileUrl: '/uploads/materials/lec301.pdf',
        fileName: 'lec301.pdf',
        fileSize: 102400,
        fileType: 'application/pdf',
        isPublished: true,
        createdAt: '2026-10-10T10:00:00.000Z',
        uploadedById: 200,
        uploadedBy: {
          id: 200,
          email: 'dr.tariq@example.test',
          role: 'DOCTOR',
          doctor: { firstName: 'Tariq', lastName: 'Hassan' },
        },
      },
      {
        id: 302,
        title: 'Other Staff Tutorial 1',
        description: 'Uploaded by another TA',
        type: 'TUTORIAL',
        fileUrl: '/uploads/materials/tut302.pdf',
        fileName: 'tut302.pdf',
        fileSize: 51200,
        fileType: 'application/pdf',
        isPublished: true,
        createdAt: '2026-10-11T10:00:00.000Z',
        uploadedById: 202,
        uploadedBy: {
          id: 202,
          email: 'other.ta@example.test',
          role: 'TEACHING_ASSISTANT',
          teachingAssistant: { firstName: 'Omar', lastName: 'Sami' },
        },
      },
      {
        id: 303,
        title: 'My Own Tutorial 2',
        description: 'Uploaded by current TA',
        type: 'TUTORIAL',
        fileUrl: '/uploads/materials/tut303.pdf',
        fileName: 'tut303.pdf',
        fileSize: 61440,
        fileType: 'application/pdf',
        isPublished: true,
        createdAt: '2026-10-12T10:00:00.000Z',
        uploadedById: 101,
        uploadedBy: {
          id: 101,
          email: TA_USER.email,
          role: 'TEACHING_ASSISTANT',
          teachingAssistant: { firstName: 'Nour', lastName: 'Ali' },
        },
      },
    ];

    const { capturedToggles, capturedDeletes } = await setupCourseMocks(page, materials);
    await page.goto(`${appServer.origin}/courses/1`, { waitUntil: 'networkidle' });
    await page.locator('h1:has-text("Data Structures")').waitFor({ state: 'visible', timeout: 8000 });
    await assertHtmlPrefs(page, { lang: 'en', theme: 'light' });

    // 1. Lectures tab: Doctor Lecture 1 must have NO toggle or delete controls for TA
    await page.locator('button:has-text("Lectures")').first().click();
    const lectureCard = page.locator('div:has(> div > div > div > div > h4:text-is("Doctor Lecture 1"))').first();
    await lectureCard.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(
      await lectureCard.locator('button[title="Delete"]').count(),
      0,
      'TA must not see delete button on LECTURE row'
    );
    assert.equal(
      await lectureCard.locator('button[title*="نشر"], button[title*="مسودة"]').count(),
      0,
      'TA must not see toggle button on LECTURE row'
    );

    // 2. Tutorials tab: Other Staff Tutorial 1 has NO controls; My Own Tutorial 2 HAS controls
    await page.locator('button:has-text("Tutorials & Labs")').first().click();

    const otherTutCard = page
      .locator('div:has(> div > div > div > div > h4:text-is("Other Staff Tutorial 1"))')
      .first();
    await otherTutCard.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(
      await otherTutCard.locator('button[title="Delete"]').count(),
      0,
      'TA must not see delete button on another user TUTORIAL row'
    );
    assert.equal(
      await otherTutCard.locator('button[title*="نشر"], button[title*="مسودة"]').count(),
      0,
      'TA must not see toggle button on another user TUTORIAL row'
    );

    const ownTutCard = page
      .locator('div:has(> div > div > div > div > h4:text-is("My Own Tutorial 2"))')
      .first();
    await ownTutCard.waitFor({ state: 'visible', timeout: 5000 });
    const ownToggleBtn = ownTutCard.locator('button[title*="نشر"], button[title*="مسودة"]');
    const ownDeleteBtn = ownTutCard.locator('button[title="Delete"]');
    assert.equal(await ownToggleBtn.count(), 1, 'TA must see toggle button on own TUTORIAL row');
    assert.equal(await ownDeleteBtn.count(), 1, 'TA must see delete button on own TUTORIAL row');

    // Verify toggle request URL and ID types
    await ownToggleBtn.click();
    await page.waitForFunction(
      () => document.body.innerText.includes('مخفي - مسودة'),
      { timeout: 5000 }
    );
    assert.equal(capturedToggles.length, 1);
    assert.equal(typeof capturedToggles[0].courseId, 'number');
    assert.equal(typeof capturedToggles[0].materialId, 'number');
    assert.equal(capturedToggles[0].courseId, 1);
    assert.equal(capturedToggles[0].materialId, 303);
    assert.equal(capturedToggles[0].pathname, '/api/courses/1/materials/303/toggle');

    // Verify delete request URL and ID types
    await ownDeleteBtn.click();
    const confirmBtn = page.locator('div[role="dialog"] button:has-text("Delete")').first();
    await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
    await confirmBtn.click();
    await ownTutCard.waitFor({ state: 'hidden', timeout: 5000 });
    assert.equal(capturedDeletes.length, 1);
    assert.equal(typeof capturedDeletes[0].courseId, 'number');
    assert.equal(typeof capturedDeletes[0].materialId, 'number');
    assert.equal(capturedDeletes[0].courseId, 1);
    assert.equal(capturedDeletes[0].materialId, 303);
    assert.equal(capturedDeletes[0].pathname, '/api/courses/1/materials/303');

    await context.close();
  });

  it('(c) doctor still has the LECTURE option and the publication toggle', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'DOCTOR',
      language: 'en',
      user: DOCTOR_USER,
    });
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('language', 'en');
    });

    const { capturedCoursePubToggles } = await setupCourseMocks(page, []);
    await page.goto(`${appServer.origin}/courses/1`, { waitUntil: 'networkidle' });
    await page.locator('h1:has-text("Data Structures")').waitFor({ state: 'visible', timeout: 8000 });
    await assertHtmlPrefs(page, { lang: 'en', theme: 'light' });

    const pubToggleBtn = page.locator(
      'button:has-text("المقرر منشور للطلاب"), button:has-text("مسودة ومخفي")'
    );
    assert.equal(await pubToggleBtn.count(), 1, 'Doctor must still see course-publication toggle');
    await pubToggleBtn.click();
    await page.waitForFunction(
      () => document.body.innerText.includes('مسودة ومخفي'),
      { timeout: 5000 }
    );
    assert.equal(capturedCoursePubToggles.length, 1);
    assert.equal(typeof capturedCoursePubToggles[0].courseId, 'number');
    assert.equal(capturedCoursePubToggles[0].courseId, 1);
    assert.equal(capturedCoursePubToggles[0].pathname, '/api/courses/1/toggle-publication');

    await page.locator('button:has-text("Lectures")').first().click();
    const uploadLectureBtn = page.locator('button:has-text("Upload New Lecture")').first();
    await uploadLectureBtn.waitFor({ state: 'visible', timeout: 5000 });
    await uploadLectureBtn.click();

    const modalForm = page.locator('form').first();
    await modalForm.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(
      await modalForm.locator('button:has-text("Lecture")').count(),
      1,
      'Doctor must still see LECTURE option in upload modal'
    );
    assert.equal(
      await modalForm.locator('button:has-text("Tutorial")').count(),
      1,
      'Doctor must still see TUTORIAL option in upload modal'
    );

    await context.close();
  });

  it('(d) student has no management controls', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'STUDENT',
      language: 'en',
      user: STUDENT_USER,
    });
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'dark');
      localStorage.setItem('language', 'en');
    });

    const materials = [
      {
        id: 310,
        title: 'Published Lecture PDF',
        type: 'LECTURE',
        fileUrl: '/uploads/materials/lec310.pdf',
        fileName: 'lec310.pdf',
        fileSize: 102400,
        fileType: 'application/pdf',
        isPublished: true,
        createdAt: '2026-10-12T10:00:00.000Z',
        uploadedById: 200,
        uploadedBy: {
          id: 200,
          email: 'dr.tariq@example.test',
          role: 'DOCTOR',
          doctor: { firstName: 'Tariq', lastName: 'Hassan' },
        },
      },
      {
        id: 311,
        title: 'Published Tutorial PDF',
        type: 'TUTORIAL',
        fileUrl: '/uploads/materials/tut311.pdf',
        fileName: 'tut311.pdf',
        fileSize: 51200,
        fileType: 'application/pdf',
        isPublished: true,
        createdAt: '2026-10-13T10:00:00.000Z',
        uploadedById: 101,
        uploadedBy: {
          id: 101,
          email: TA_USER.email,
          role: 'TEACHING_ASSISTANT',
          teachingAssistant: { firstName: 'Nour', lastName: 'Ali' },
        },
      },
    ];

    await setupCourseMocks(page, materials);
    await page.goto(`${appServer.origin}/courses/1`, { waitUntil: 'networkidle' });
    await page.locator('h1:has-text("Data Structures")').waitFor({ state: 'visible', timeout: 8000 });
    await assertHtmlPrefs(page, { lang: 'en', theme: 'dark' });

    assert.equal(
      await page.locator('button:has-text("المقرر منشور للطلاب"), button:has-text("مسودة ومخفي")').count(),
      0,
      'Student must not see course-publication toggle'
    );

    await page.locator('button:has-text("Lectures")').first().click();
    await page.locator('h4:text-is("Published Lecture PDF")').waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(await page.locator('button:has-text("Upload New Lecture")').count(), 0);
    assert.equal(await page.locator('button[title="Delete"]').count(), 0);
    assert.equal(await page.locator('button[title*="نشر"], button[title*="مسودة"]').count(), 0);

    await page.locator('button:has-text("Tutorials & Labs")').first().click();
    await page.locator('h4:text-is("Published Tutorial PDF")').waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(await page.locator('button:has-text("Upload New Tutorial")').count(), 0);
    assert.equal(await page.locator('button[title="Delete"]').count(), 0);
    assert.equal(await page.locator('button[title*="نشر"], button[title*="مسودة"]').count(), 0);

    await context.close();
  });

  it('(e) link material: anchor with https href, rel and target, localized link label, no size text, no download request', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'STUDENT',
      language: 'en',
      user: STUDENT_USER,
    });
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('language', 'en');
    });

    await context.route('https://docs.example.edu/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><title>External Resource</title>',
      });
    });

    const materials = [
      {
        id: 401,
        title: 'HTTPS Reference Guide',
        description: 'External official guide',
        type: 'TUTORIAL',
        fileUrl: 'https://docs.example.edu/reference-guide',
        fileName: null,
        fileSize: null,
        fileType: 'link',
        isPublished: true,
        createdAt: '2026-10-15T10:00:00.000Z',
        uploadedById: 101,
        uploadedBy: {
          id: 101,
          email: TA_USER.email,
          role: 'TEACHING_ASSISTANT',
          teachingAssistant: { firstName: 'Nour', lastName: 'Ali' },
        },
      },
    ];

    const { capturedDownloads } = await setupCourseMocks(page, materials);
    await page.goto(`${appServer.origin}/courses/1`, { waitUntil: 'networkidle' });
    await page.locator('h1:has-text("Data Structures")').waitFor({ state: 'visible', timeout: 8000 });
    await assertHtmlPrefs(page, { lang: 'en', theme: 'light' });

    await page.locator('button:has-text("Tutorials & Labs")').first().click();
    const linkCard = page
      .locator('div:has(> div > div > div > div > h4:text-is("HTTPS Reference Guide"))')
      .first();
    await linkCard.waitFor({ state: 'visible', timeout: 5000 });

    const anchor = linkCard.locator('a');
    assert.equal(await anchor.count(), 1, 'Link material must render an <a> open-link element');
    assert.equal(await anchor.getAttribute('href'), 'https://docs.example.edu/reference-guide');
    assert.equal(await anchor.getAttribute('target'), '_blank');
    assert.equal(await anchor.getAttribute('rel'), 'noopener noreferrer');

    const cardText = (await linkCard.textContent()) || '';
    assert.doesNotMatch(cardText, /\b(Bytes|KB|MB|GB)\b/, 'Link material must show no size text');
    assert.match(cardText, /\bLink\b/, 'Link material must display localized link label');
    assert.equal(
      await linkCard.locator('button:has-text("Download")').count(),
      0,
      'Link material must not render download button'
    );

    const popupPromise = context.waitForEvent('page');
    await anchor.click();
    const popup = await popupPromise;
    await popup.close();

    assert.equal(capturedDownloads.length, 0, 'Link material must make zero calls to download endpoint');

    await context.close();
  });

  it('(f) non-https stored URL renders no anchor and uploaded-file material remains unchanged', async () => {
    const { context, page } = await mockSessionPage(browser, {
      role: 'STUDENT',
      language: 'en',
      user: STUDENT_USER,
    });
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('language', 'en');
    });

    const materials = [
      {
        id: 402,
        title: 'Insecure HTTP Link',
        type: 'TUTORIAL',
        fileUrl: 'http://insecure.example.edu/sheet',
        fileName: null,
        fileSize: null,
        fileType: 'link',
        isPublished: true,
        createdAt: '2026-10-15T10:00:00.000Z',
        uploadedById: 101,
        uploadedBy: {
          id: 101,
          email: TA_USER.email,
          role: 'TEACHING_ASSISTANT',
          teachingAssistant: { firstName: 'Nour', lastName: 'Ali' },
        },
      },
      {
        id: 403,
        title: 'Non-HTTPS Scheme Link',
        type: 'TUTORIAL',
        fileUrl: 'ftp://files.example.edu/archive.zip',
        fileName: null,
        fileSize: null,
        fileType: 'link',
        isPublished: true,
        createdAt: '2026-10-15T10:00:00.000Z',
        uploadedById: 101,
        uploadedBy: {
          id: 101,
          email: TA_USER.email,
          role: 'TEACHING_ASSISTANT',
          teachingAssistant: { firstName: 'Nour', lastName: 'Ali' },
        },
      },
      {
        id: 404,
        title: 'Uploaded Lab PDF',
        type: 'TUTORIAL',
        fileUrl: '/uploads/materials/lab404.pdf',
        fileName: 'lab404.pdf',
        fileSize: 204800,
        fileType: 'application/pdf',
        isPublished: true,
        createdAt: '2026-10-15T10:00:00.000Z',
        uploadedById: 101,
        uploadedBy: {
          id: 101,
          email: TA_USER.email,
          role: 'TEACHING_ASSISTANT',
          teachingAssistant: { firstName: 'Nour', lastName: 'Ali' },
        },
      },
    ];

    const { capturedDownloads } = await setupCourseMocks(page, materials);
    await page.goto(`${appServer.origin}/courses/1`, { waitUntil: 'networkidle' });
    await page.locator('h1:has-text("Data Structures")').waitFor({ state: 'visible', timeout: 8000 });
    await assertHtmlPrefs(page, { lang: 'en', theme: 'light' });

    await page.locator('button:has-text("Tutorials & Labs")').first().click();

    const httpCard = page
      .locator('div:has(> div > div > div > div > h4:text-is("Insecure HTTP Link"))')
      .first();
    await httpCard.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(await httpCard.locator('a').count(), 0, 'http:// URL must render no anchor');
    assert.equal(
      await httpCard.locator('button:has-text("Download")').count(),
      0,
      'http:// link material must not render download fallback button'
    );

    const ftpCard = page
      .locator('div:has(> div > div > div > div > h4:text-is("Non-HTTPS Scheme Link"))')
      .first();
    await ftpCard.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(await ftpCard.locator('a').count(), 0, 'ftp:// URL must render no anchor');
    assert.equal(
      await ftpCard.locator('button:has-text("Download")').count(),
      0,
      'ftp:// link material must not render download fallback button'
    );

    // Uploaded-file material unchanged: size text shown, download button calls download endpoint
    const pdfCard = page
      .locator('div:has(> div > div > div > div > h4:text-is("Uploaded Lab PDF"))')
      .first();
    await pdfCard.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(await pdfCard.locator('a').count(), 0, 'Uploaded file must not render external anchor');
    assert.match((await pdfCard.textContent()) || '', /200 KB/, 'Uploaded file must still show formatted size');
    const downloadBtn = pdfCard.locator('button:has-text("Download")');
    assert.equal(await downloadBtn.count(), 1, 'Uploaded file must still render download button');
    const downloadRespPromise = page.waitForResponse((res) =>
      res.url().endsWith('/api/courses/1/materials/404/download')
    );
    await downloadBtn.click();
    await downloadRespPromise;
    assert.equal(capturedDownloads.length, 1);
    assert.equal(capturedDownloads[0].courseId, 1);
    assert.equal(capturedDownloads[0].materialId, 404);
    assert.equal(capturedDownloads[0].pathname, '/api/courses/1/materials/404/download');

    await context.close();
  });

  // ── (g) 24-CONFIG MATRIX (1440/1024/768/430/390/360 x ar/en x light/dark) ──
  const viewports = [1440, 1024, 768, 430, 390, 360];
  const languages = ['ar', 'en'];
  const themes = ['light', 'dark'];

  for (const width of viewports) {
    for (const lang of languages) {
      for (const theme of themes) {
        it(`(g) Matrix [${width}px ${lang.toUpperCase()} ${theme.toUpperCase()}]: TA view with link + uploaded material fits viewport`, async () => {
          const { context, page } = await mockSessionPage(browser, {
            role: 'TEACHING_ASSISTANT',
            language: lang,
            user: TA_USER,
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

          const matrixMaterials = [
            {
              id: 501,
              title: 'TA Lab Reference Guide',
              description: 'HTTPS tutorial reference',
              type: 'TUTORIAL',
              fileUrl: 'https://docs.example.edu/ta-lab-link',
              fileName: null,
              fileSize: null,
              fileType: 'link',
              isPublished: true,
              createdAt: '2026-10-16T10:00:00.000Z',
              uploadedById: 101,
              uploadedBy: {
                id: 101,
                email: TA_USER.email,
                role: 'TEACHING_ASSISTANT',
                teachingAssistant: { firstName: 'Nour', lastName: 'Ali' },
              },
            },
            {
              id: 502,
              title: 'TA Lab Uploaded Sheet',
              description: 'PDF worksheet',
              type: 'TUTORIAL',
              fileUrl: '/uploads/materials/lab502.pdf',
              fileName: 'lab502.pdf',
              fileSize: 102400,
              fileType: 'application/pdf',
              isPublished: true,
              createdAt: '2026-10-17T10:00:00.000Z',
              uploadedById: 101,
              uploadedBy: {
                id: 101,
                email: TA_USER.email,
                role: 'TEACHING_ASSISTANT',
                teachingAssistant: { firstName: 'Nour', lastName: 'Ali' },
              },
            },
          ];

          await setupCourseMocks(page, matrixMaterials);
          await page.goto(`${appServer.origin}/courses/1`, { waitUntil: 'networkidle' });
          await page.locator('h1:has-text("Data Structures")').waitFor({ state: 'visible', timeout: 8000 });
          await assertHtmlPrefs(page, { lang, theme });

          const tutorialsTabText = lang === 'ar' ? 'السكاشن والتمارين' : 'Tutorials & Labs';
          await page.locator(`button:has-text("${tutorialsTabText}")`).first().click();

          const linkCard = page
            .locator('div:has(> div > div > div > div > h4:text-is("TA Lab Reference Guide"))')
            .first();
          const uploadedCard = page
            .locator('div:has(> div > div > div > div > h4:text-is("TA Lab Uploaded Sheet"))')
            .first();
          await linkCard.waitFor({ state: 'visible', timeout: 5000 });
          await uploadedCard.waitFor({ state: 'visible', timeout: 5000 });

          const baseMetrics = await page.evaluate(() => {
            const scrollWidth = document.documentElement.scrollWidth;
            const innerWidth = window.innerWidth;
            const titles = ['TA Lab Reference Guide', 'TA Lab Uploaded Sheet'];
            const cardRects = titles.map((t) => {
              const h4 = Array.from(document.querySelectorAll('h4')).find(
                (el) => el.textContent?.trim() === t
              );
              const card = h4?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement;
              if (!card) return null;
              const r = card.getBoundingClientRect();
              return {
                title: t,
                left: Math.round(r.left),
                right: Math.round(r.right),
                width: Math.round(r.width),
              };
            });
            return { scrollWidth, innerWidth, cardRects };
          });

          assert.ok(
            baseMetrics.scrollWidth <= baseMetrics.innerWidth,
            `scrollWidth (${baseMetrics.scrollWidth}) must be <= innerWidth (${baseMetrics.innerWidth}) at ${width}px ${lang} ${theme}`
          );
          assert.equal(baseMetrics.cardRects.length, 2);
          for (const rect of baseMetrics.cardRects) {
            assert.ok(rect && rect.width > 0, `Card rect must exist at ${width}px ${lang} ${theme}`);
            assert.ok(
              rect.left >= 0 && rect.right <= baseMetrics.innerWidth,
              `Card "${rect.title}" bounds [${rect.left}, ${rect.right}] must be within [0, ${baseMetrics.innerWidth}] at ${width}px ${lang} ${theme}`
            );
          }

          const expectedLinkWord = lang === 'ar' ? 'رابط' : 'Link';
          assert.match(
            (await linkCard.textContent()) || '',
            new RegExp(expectedLinkWord),
            `Link material card must show localized "${expectedLinkWord}" label in ${lang}`
          );

          const linkAnchor = linkCard.locator('a[href="https://docs.example.edu/ta-lab-link"]');
          assert.equal(await linkAnchor.count(), 1, 'Link material anchor must render on TA matrix view');

          const anchorRect = await linkAnchor.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
          });
          assert.ok(anchorRect.width > 0, 'Anchor rect must have positive width');
          assert.ok(
            anchorRect.left >= 0 && anchorRect.right <= baseMetrics.innerWidth,
            `Anchor bounds [${anchorRect.left}, ${anchorRect.right}] must be within [0, ${baseMetrics.innerWidth}] at ${width}px ${lang} ${theme}`
          );
          assert.equal(jsErrors.length, 0, `Unexpected JS errors: ${jsErrors.join('; ')}`);

          await context.close();
        });
      }
    }
  }
});
