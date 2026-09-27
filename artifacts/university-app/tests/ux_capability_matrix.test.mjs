import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Dynamically transpile and import the live capabilities TypeScript source
const capabilitiesSource = readFileSync(
  new URL('../src/config/capabilities.ts', import.meta.url),
  'utf8'
);

const transpiledJs = ts.transpileModule(capabilitiesSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;

const dataUri = `data:text/javascript;base64,${Buffer.from(transpiledJs).toString('base64')}`;
const {
  ALL_ROLES,
  ROLE_CAPABILITY_MATRIX,
  hasCapability,
  getRolesForCapability,
  canAccessRoute,
  ROUTE_CAPABILITY_MAP,
} = await import(dataUri);

test('UX-001: All known roles are accounted for in the capability matrix', () => {
  const expectedRoles = [
    'SUPER_ADMIN',
    'ADMIN',
    'COLLEGE_ADMIN',
    'DEPARTMENT_ADMIN',
    'DOCTOR',
    'TEACHING_ASSISTANT',
    'STUDENT',
  ];

  for (const role of expectedRoles) {
    assert.ok(ALL_ROLES.includes(role), `ALL_ROLES must include ${role}`);
    assert.ok(
      Array.isArray(ROLE_CAPABILITY_MATRIX[role]),
      `ROLE_CAPABILITY_MATRIX must configure capabilities for ${role}`
    );
  }
});

test('UX-001: Teaching Assistant permitted flows match backend authorization', () => {
  // Teaching Assistants participate in courses, schedules, attendance, tasks, and quizzes
  assert.equal(hasCapability('TEACHING_ASSISTANT', 'courses.view'), true);
  assert.equal(hasCapability('TEACHING_ASSISTANT', 'schedules.ta'), true);
  assert.equal(hasCapability('TEACHING_ASSISTANT', 'schedules.timetable'), true);
  assert.equal(hasCapability('TEACHING_ASSISTANT', 'attendance.view'), true);
  assert.equal(hasCapability('TEACHING_ASSISTANT', 'tasks.view'), true);
  assert.equal(hasCapability('TEACHING_ASSISTANT', 'quizzes.view'), true);
  assert.equal(hasCapability('TEACHING_ASSISTANT', 'warnings.view'), true);

  // Teaching Assistants must NOT possess admin or financial privileges
  assert.equal(hasCapability('TEACHING_ASSISTANT', 'finance.view'), false);
  assert.equal(hasCapability('TEACHING_ASSISTANT', 'analytics.view'), false);
  assert.equal(hasCapability('TEACHING_ASSISTANT', 'admins.view'), false);
  assert.equal(hasCapability('TEACHING_ASSISTANT', 'colleges.manage'), false);
});

test('UX-001: Tenant Admins (COLLEGE_ADMIN, DEPARTMENT_ADMIN) have aligned navigation and route capabilities', () => {
  // Both can view departments, manage groups, and process registration requests
  for (const tenantRole of ['COLLEGE_ADMIN', 'DEPARTMENT_ADMIN']) {
    assert.equal(hasCapability(tenantRole, 'departments.view'), true);
    assert.equal(hasCapability(tenantRole, 'groups.view'), true);
    assert.equal(hasCapability(tenantRole, 'registration_requests.view'), true);
    assert.equal(hasCapability(tenantRole, 'schedules.manage'), true);
    assert.equal(hasCapability(tenantRole, 'courses.view'), true);
    assert.equal(hasCapability(tenantRole, 'attendance.view'), true);
    assert.equal(hasCapability(tenantRole, 'tasks.view'), true);
    assert.equal(hasCapability(tenantRole, 'quizzes.view'), true);

    // Cannot access top-level system finances
    assert.equal(hasCapability(tenantRole, 'finance.view'), false);
  }

  // College admin can view colleges; Department admin is scoped to their department
  assert.equal(hasCapability('COLLEGE_ADMIN', 'colleges.view'), true);
  assert.equal(hasCapability('DEPARTMENT_ADMIN', 'colleges.view'), false);
});

test('UX-001: Direct URL access rules strictly align with capability matrix', () => {
  // Test route permissions for STUDENT
  assert.equal(canAccessRoute('STUDENT', '/dashboard'), true);
  assert.equal(canAccessRoute('STUDENT', '/courses'), true);
  assert.equal(canAccessRoute('STUDENT', '/schedules/student'), true);
  assert.equal(canAccessRoute('STUDENT', '/attendance'), true);
  assert.equal(canAccessRoute('STUDENT', '/warnings'), true);
  assert.equal(canAccessRoute('STUDENT', '/tasks'), true);
  assert.equal(canAccessRoute('STUDENT', '/quizzes'), true);

  // Student blocked from administrative routes
  assert.equal(canAccessRoute('STUDENT', '/finance'), false);
  assert.equal(canAccessRoute('STUDENT', '/analytics'), false);
  assert.equal(canAccessRoute('STUDENT', '/admins'), false);
  assert.equal(canAccessRoute('STUDENT', '/colleges'), false);
  assert.equal(canAccessRoute('STUDENT', '/registration-requests'), false);
  assert.equal(canAccessRoute('STUDENT', '/timetables-management'), false);

  // Test route permissions for TEACHING_ASSISTANT
  assert.equal(canAccessRoute('TEACHING_ASSISTANT', '/attendance'), true);
  assert.equal(canAccessRoute('TEACHING_ASSISTANT', '/tasks'), true);
  assert.equal(canAccessRoute('TEACHING_ASSISTANT', '/quizzes'), true);
  assert.equal(canAccessRoute('TEACHING_ASSISTANT', '/schedules/ta'), true);
  assert.equal(canAccessRoute('TEACHING_ASSISTANT', '/finance'), false);
  assert.equal(canAccessRoute('TEACHING_ASSISTANT', '/admins'), false);
});

test('UX-001: Matrix test across all roles and critical capability vectors', () => {
  const capabilityVector = [
    { capability: 'colleges.view', expectedRoles: ['SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN'] },
    { capability: 'finance.view', expectedRoles: ['SUPER_ADMIN', 'ADMIN'] },
    { capability: 'admins.view', expectedRoles: ['SUPER_ADMIN', 'ADMIN'] },
    {
      capability: 'attendance.view',
      expectedRoles: [
        'SUPER_ADMIN',
        'ADMIN',
        'COLLEGE_ADMIN',
        'DEPARTMENT_ADMIN',
        'DOCTOR',
        'TEACHING_ASSISTANT',
        'STUDENT',
      ],
    },
    {
      capability: 'tasks.view',
      expectedRoles: [
        'SUPER_ADMIN',
        'ADMIN',
        'COLLEGE_ADMIN',
        'DEPARTMENT_ADMIN',
        'DOCTOR',
        'TEACHING_ASSISTANT',
        'STUDENT',
      ],
    },
    {
      capability: 'quizzes.view',
      expectedRoles: [
        'SUPER_ADMIN',
        'ADMIN',
        'COLLEGE_ADMIN',
        'DEPARTMENT_ADMIN',
        'DOCTOR',
        'TEACHING_ASSISTANT',
        'STUDENT',
      ],
    },
    { capability: 'statistics.view', expectedRoles: ['SUPER_ADMIN', 'STUDENT'] },
  ];

  for (const { capability, expectedRoles } of capabilityVector) {
    const authorizedRoles = getRolesForCapability(capability);
    for (const role of ALL_ROLES) {
      const isExpected = expectedRoles.includes(role);
      const isAuthorized = authorizedRoles.includes(role);
      assert.equal(
        isAuthorized,
        isExpected,
        `Role ${role} authorization for ${capability} expected: ${isExpected}, got: ${isAuthorized}`
      );
    }
  }
});

test('UX-001: Sidebar navigation source binds items to capabilities and includes Quizzes', () => {
  const sidebarSource = readFileSync(
    new URL('../src/components/layout/Sidebar.tsx', import.meta.url),
    'utf8'
  );

  // Check that capabilities are imported
  assert.match(
    sidebarSource,
    /import\s*\{\s*hasCapability,\s*Capability\s*\}\s*from\s*['"]\.\.\/\.\.\/config\/capabilities['"]/,
    'Sidebar must import hasCapability from config/capabilities'
  );

  // Check that quizzes route exists in sidebar navigation
  assert.match(
    sidebarSource,
    /path:\s*['"]\/quizzes['"]/,
    'Sidebar navigation must include /quizzes item'
  );

  // Check that filtering uses hasCapability
  assert.match(
    sidebarSource,
    /hasCapability\(user\?\.role,\s*item\.capability\)/,
    'Sidebar must filter navigation items using hasCapability(user?.role, item.capability)'
  );
});
