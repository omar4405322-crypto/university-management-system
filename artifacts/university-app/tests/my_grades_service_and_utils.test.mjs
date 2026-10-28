import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test, describe } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

describe('TASK T-7b1: Student My Grades Service, Helpers, Error Mapping, Capabilities & UI Rules', () => {
  // 1. PIN BACKEND CONTRACT & ERROR STRINGS FROM STEP 0
  test('STEP 0 Parity: pins route, controller, and studentGrades.service.ts response envelope and error strings', () => {
    const routePath = path.join(rootDir, 'artifacts/api-server/src/routes/enrollment.routes.ts');
    const controllerPath = path.join(
      rootDir,
      'artifacts/api-server/src/controllers/enrollment.controller.ts'
    );
    const servicePath = path.join(
      rootDir,
      'artifacts/api-server/src/services/studentGrades.service.ts'
    );

    const routeSrc = readFileSync(routePath, 'utf8');
    const controllerSrc = readFileSync(controllerPath, 'utf8');
    const serviceSrc = readFileSync(servicePath, 'utf8');

    assert.ok(
      routeSrc.includes('router.get("/my-grades", protect, authorize("STUDENT"), getMyGrades);'),
      'enrollment.routes.ts must register GET /my-grades with protect and authorize("STUDENT")'
    );
    assert.ok(
      controllerSrc.includes('studentGradesService.getStudentMyGrades(req.user)'),
      'enrollment.controller.ts getMyGrades must delegate to studentGradesService.getStudentMyGrades(req.user)'
    );
    assert.ok(
      serviceSrc.includes("throw new AuthenticationError('Authentication required');"),
      'studentGrades.service.ts must throw AuthenticationError(Authentication required)'
    );
    assert.ok(
      serviceSrc.includes("throw new ForbiddenError('Only students can access their personal grades');"),
      'studentGrades.service.ts must throw ForbiddenError(Only students can access their personal grades)'
    );
    assert.ok(
      serviceSrc.includes("throw new NotFoundError('Student profile not found');"),
      'studentGrades.service.ts must throw NotFoundError(Student profile not found)'
    );
    assert.ok(
      serviceSrc.includes('score: hasEntry ? (entry.isAbsent ? 0 : entry.score) : null'),
      'studentGrades.service.ts must set score to 0 when entry.isAbsent is true'
    );
    assert.ok(
      serviceSrc.includes('finalPointsEarned: isComplete ? enr.finalPointsEarned : null'),
      'studentGrades.service.ts must null out finalPointsEarned when incomplete'
    );
  });

  // 2. PURE HELPERS IN gradebook.utils.ts
  test('Helpers: formatGradeNumber, mapMyGradesError, resolveComponentDisplay, resolveCourseTotalsDisplay, groupMyGradesByTerm', async () => {
    const webUtilsPath = path.join(rootDir, 'artifacts/university-app/src/utils/gradebook.utils.ts');
    const webSrc = readFileSync(webUtilsPath, 'utf8');
    const transpiled = ts.transpileModule(webSrc, {
      compilerOptions: { module: ts.ModuleKind.ESNext },
    }).outputText;
    const dataUri = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
    const {
      MAX_DECIMAL_PLACES,
      formatGradeNumber,
      mapMyGradesError,
      resolveComponentDisplay,
      resolveCourseTotalsDisplay,
      groupMyGradesByTerm,
    } = await import(dataUri);

    assert.equal(MAX_DECIMAL_PLACES, 2);
    assert.equal(typeof formatGradeNumber, 'function');
    assert.equal(typeof mapMyGradesError, 'function');
    assert.equal(typeof resolveComponentDisplay, 'function');
    assert.equal(typeof resolveCourseTotalsDisplay, 'function');
    assert.equal(typeof groupMyGradesByTerm, 'function');

    // formatGradeNumber: 2-decimal rule without invented values
    assert.equal(formatGradeNumber(85), '85');
    assert.equal(formatGradeNumber(22.5), '22.5');
    assert.equal(formatGradeNumber(14.75), '14.75');
    assert.equal(formatGradeNumber(33.336), '33.34');
    assert.equal(formatGradeNumber(0), '0');
    assert.equal(formatGradeNumber(null), '');
    assert.equal(formatGradeNumber(undefined), '');

    // mapMyGradesError: 401, 403, 404, 500
    assert.equal(mapMyGradesError('Authentication required', 401), 'myGrades.errors.unauthorized');
    assert.equal(
      mapMyGradesError('Access denied. No security token provided.', 401),
      'myGrades.errors.unauthorized'
    );
    assert.equal(
      mapMyGradesError('Only students can access their personal grades', 403),
      'myGrades.errors.forbidden'
    );
    assert.equal(
      mapMyGradesError('Forbidden: Your role (DOCTOR) does not have permission for this action.', 403),
      'myGrades.errors.forbidden'
    );
    assert.equal(
      mapMyGradesError('Student profile not found', 404),
      'myGrades.errors.studentNotFound'
    );
    assert.equal(mapMyGradesError('Internal server failure', 500), 'myGrades.errors.generic');

    // resolveComponentDisplay: published score, absent (score: 0 + isAbsent: true -> ABS, never 0/), and pending
    const scoredDisplay = resolveComponentDisplay({
      componentId: 101,
      name: 'Midterm Exam',
      nameAr: 'امتحان منتصف الفصل',
      maxPoints: 25,
      source: 'MANUAL',
      score: 22.5,
      isAbsent: false,
      isPublished: true,
    });
    assert.equal(scoredDisplay.state, 'PUBLISHED_SCORE');
    assert.equal(scoredDisplay.scoreText, '22.5 / 25');
    assert.equal(scoredDisplay.maxPointsText, '25');

    const absentDisplay = resolveComponentDisplay({
      componentId: 102,
      name: 'Quiz 1',
      nameAr: 'اختبار قصير 1',
      maxPoints: 15,
      source: 'AUTO_QUIZ',
      score: 0, // Backend sends 0 when entry.isAbsent is true
      isAbsent: true,
      isPublished: true,
    });
    assert.equal(absentDisplay.state, 'ABSENT');
    assert.equal(absentDisplay.scoreText, null, 'Absent component must never produce a numeric score string');
    assert.equal(absentDisplay.labelKey, 'myGrades.absent');

    const pendingDisplay = resolveComponentDisplay({
      componentId: 103,
      name: 'Final Exam',
      nameAr: 'الامتحان النهائي',
      maxPoints: 50,
      source: 'MANUAL',
      score: null,
      isAbsent: false,
      isPublished: false,
    });
    assert.equal(pendingDisplay.state, 'PENDING');
    assert.equal(pendingDisplay.scoreText, null);
    assert.equal(pendingDisplay.labelKey, 'myGrades.pendingPublication');

    // resolveCourseTotalsDisplay: complete vs incomplete
    const completeTotals = resolveCourseTotalsDisplay({
      enrollmentId: 1,
      courseId: 10,
      termId: 1,
      course: { id: 10, code: 'CS401', name: 'Software Engineering', credits: 3 },
      term: { id: 1, name: 'Fall 2026' },
      passMark: 50,
      components: [],
      finalPointsEarned: 85.5,
      finalPointsMax: 100,
      finalGrade: 85.5,
      status: 'COMPLETED',
    });
    assert.equal(completeTotals.isComplete, true);
    assert.equal(completeTotals.totalPointsText, '85.5 / 100');
    assert.equal(completeTotals.percentageText, '85.5%');
    assert.equal(completeTotals.status, 'COMPLETED');
    assert.equal(completeTotals.statusKey, 'myGrades.status.COMPLETED');
    assert.equal(completeTotals.pendingKey, null);

    const incompleteTotals = resolveCourseTotalsDisplay({
      enrollmentId: 2,
      courseId: 11,
      termId: 1,
      course: { id: 11, code: 'CS402', name: 'Operating Systems', credits: 3 },
      term: { id: 1, name: 'Fall 2026' },
      passMark: 50,
      components: [],
      finalPointsEarned: null,
      finalPointsMax: null,
      finalGrade: null,
      status: null,
    });
    assert.equal(incompleteTotals.isComplete, false);
    assert.equal(incompleteTotals.totalPointsText, null);
    assert.equal(incompleteTotals.percentageText, null);
    assert.equal(incompleteTotals.status, null);
    assert.equal(incompleteTotals.statusKey, null);
    assert.equal(incompleteTotals.pendingKey, 'myGrades.totalsPending');

    // groupMyGradesByTerm
    const grouped = groupMyGradesByTerm([
      {
        enrollmentId: 1,
        courseId: 10,
        termId: 2,
        course: { id: 10, code: 'CS401', name: 'Software Engineering', credits: 3 },
        term: { id: 2, name: 'Spring 2027' },
        passMark: 50,
        components: [],
        finalPointsEarned: null,
        finalPointsMax: null,
        finalGrade: null,
        status: null,
      },
      {
        enrollmentId: 2,
        courseId: 11,
        termId: 2,
        course: { id: 11, code: 'CS402', name: 'Operating Systems', credits: 3 },
        term: { id: 2, name: 'Spring 2027' },
        passMark: 50,
        components: [],
        finalPointsEarned: null,
        finalPointsMax: null,
        finalGrade: null,
        status: null,
      },
      {
        enrollmentId: 3,
        courseId: 12,
        termId: 1,
        course: { id: 12, code: 'CS301', name: 'Algorithms', credits: 3 },
        term: { id: 1, name: 'Fall 2026' },
        passMark: 50,
        components: [],
        finalPointsEarned: 90,
        finalPointsMax: 100,
        finalGrade: 90,
        status: 'COMPLETED',
      },
    ]);
    assert.equal(grouped.length, 2);
    assert.equal(grouped[0].termName, 'Spring 2027');
    assert.equal(grouped[0].courses.length, 2);
    assert.equal(grouped[1].termName, 'Fall 2026');
    assert.equal(grouped[1].courses.length, 1);
  });

  // 3. CAPABILITY MATRIX & STUDENT-ONLY ROUTE GUARD
  test('Capabilities: myGrades.view is granted strictly to STUDENT only; all non-student roles are denied', async () => {
    const capPath = path.join(rootDir, 'artifacts/university-app/src/config/capabilities.ts');
    const capSrc = readFileSync(capPath, 'utf8');
    const transpiled = ts.transpileModule(capSrc, {
      compilerOptions: { module: ts.ModuleKind.ESNext },
    }).outputText;
    const dataUri = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
    const { hasCapability, canAccessRoute, getRolesForCapability } = await import(dataUri);

    assert.equal(hasCapability('STUDENT', 'myGrades.view'), true, 'STUDENT must have myGrades.view');
    assert.equal(canAccessRoute('STUDENT', '/my-grades'), true, 'STUDENT must access /my-grades');
    assert.deepEqual(getRolesForCapability('myGrades.view'), ['STUDENT']);

    const blockedRoles = [
      'SUPER_ADMIN',
      'ADMIN',
      'COLLEGE_ADMIN',
      'DEPARTMENT_ADMIN',
      'DOCTOR',
      'TEACHING_ASSISTANT',
    ];
    for (const role of blockedRoles) {
      assert.equal(
        hasCapability(role, 'myGrades.view'),
        false,
        `${role} must NOT have myGrades.view`
      );
      assert.equal(
        canAccessRoute(role, '/my-grades'),
        false,
        `${role} must NOT be allowed to access /my-grades`
      );
    }
  });

  // 4. SERVICE WIRING, ROUTE, SIDEBAR, i18n SYMMETRY & PAGE CONSTRAINTS
  test('Wiring & UI Rules: getMyGrades in enrollment.service.ts, /my-grades in App.tsx & Sidebar.tsx, symmetric i18n, no isRTL/KPI/letterGrade/CSV', () => {
    const enrollmentServicePath = path.join(
      rootDir,
      'artifacts/university-app/src/services/enrollment.service.ts'
    );
    const enrollmentServiceSrc = readFileSync(enrollmentServicePath, 'utf8');
    assert.ok(
      enrollmentServiceSrc.includes("'/enrollments/my-grades'"),
      'enrollment.service.ts must call /enrollments/my-grades'
    );
    assert.ok(
      enrollmentServiceSrc.includes('getMyGrades'),
      'enrollment.service.ts must expose getMyGrades'
    );
    assert.strictEqual(
      enrollmentServiceSrc.includes('_retry'),
      false,
      'enrollment.service.ts must not pass private _retry interceptor flag'
    );
    assert.strictEqual(
      enrollmentServiceSrc.includes('as any'),
      false,
      'enrollment.service.ts must not use unsafe as any typecast for config'
    );

    const appPath = path.join(rootDir, 'artifacts/university-app/src/App.tsx');
    const appSrc = readFileSync(appPath, 'utf8');
    assert.ok(appSrc.includes('path="my-grades"'), 'App.tsx must register path="my-grades"');
    assert.ok(
      appSrc.includes('capability="myGrades.view"'),
      'App.tsx must guard /my-grades with capability="myGrades.view"'
    );

    const sidebarPath = path.join(
      rootDir,
      'artifacts/university-app/src/components/layout/Sidebar.tsx'
    );
    const sidebarSrc = readFileSync(sidebarPath, 'utf8');
    assert.ok(sidebarSrc.includes("path: '/my-grades'"), 'Sidebar.tsx must include /my-grades');
    assert.ok(
      sidebarSrc.includes("capability: 'myGrades.view'"),
      'Sidebar.tsx must gate /my-grades with myGrades.view'
    );

    const pagePath = path.join(
      rootDir,
      'artifacts/university-app/src/pages/grades/MyGradesPage.tsx'
    );
    assert.ok(existsSync(pagePath), 'MyGradesPage.tsx must exist');
    const pageSrc = readFileSync(pagePath, 'utf8');
    assert.ok(
      pageSrc.includes('data-course-no-components'),
      'MyGradesPage.tsx must render data-course-no-components when components is empty'
    );
    assert.ok(
      pageSrc.includes('noComponentsYet'),
      'MyGradesPage.tsx must render noComponentsYet localized empty structure message'
    );
    assert.equal(
      pageSrc.includes('isRTL'),
      false,
      'MyGradesPage.tsx must not contain any isRTL ternaries or references'
    );
    assert.equal(
      pageSrc.includes('exportToCsv') || pageSrc.includes('text/csv'),
      false,
      'MyGradesPage.tsx must not contain CSV export logic'
    );

    const enPath = path.join(rootDir, 'artifacts/university-app/src/i18n/en.json');
    const arPath = path.join(rootDir, 'artifacts/university-app/src/i18n/ar.json');
    const en = JSON.parse(readFileSync(enPath, 'utf8'));
    const ar = JSON.parse(readFileSync(arPath, 'utf8'));

    assert.ok(en.myGrades, 'en.json must define myGrades namespace');
    assert.ok(ar.myGrades, 'ar.json must define myGrades namespace');
    assert.ok(en.nav?.myGrades, 'en.json must define nav.myGrades');
    assert.ok(ar.nav?.myGrades, 'ar.json must define nav.myGrades');

    const getKeys = (obj, prefix = '') => {
      let keys = [];
      for (const [k, v] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          keys = keys.concat(getKeys(v, fullKey));
        } else {
          keys.push(fullKey);
        }
      }
      return keys;
    };

    const enKeys = getKeys(en.myGrades, 'myGrades');
    const arKeys = getKeys(ar.myGrades, 'myGrades');

    assert.deepEqual(
      enKeys.filter((k) => !arKeys.includes(k)),
      [],
      'All en myGrades keys must exist in ar.json'
    );
    assert.deepEqual(
      arKeys.filter((k) => !enKeys.includes(k)),
      [],
      'All ar myGrades keys must exist in en.json'
    );
  });
});

