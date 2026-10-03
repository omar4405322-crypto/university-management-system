import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import type { AuthActor } from '../src/types/auth.types';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'mock-jwt-secret-for-student-auth-tests';
process.env.AI_ASSISTANT_ENABLED = 'true';
process.env.AI_PROVIDER = 'openai';
process.env.OPENAI_API_KEY = 'mock-only-placeholder';

const [
  { default: studentsRouter },
  { executeAiTool },
  { generateAccessToken },
  { default: prisma },
  { default: errorHandler },
  { protect },
] = await Promise.all([
  import('../src/routes/students.routes'),
  import('../src/services/aiTools.service'),
  import('../src/utils/jwt.utils'),
  import('../src/utils/prismaClient'),
  import('../src/middleware/error.middleware'),
  import('../src/middleware/auth.middleware'),
]);

// ─────────────────────────────────────────────────────────────
// Part 1: Tool search_scoped_students Contract & Scope Enforcement
// ─────────────────────────────────────────────────────────────

const collegeAdminActor: AuthActor = {
  id: 10,
  role: 'COLLEGE_ADMIN',
  managedCollegeId: 5,
  isActive: true,
  tokenVersion: 0,
};

const studentActor: AuthActor = {
  id: 20,
  role: 'STUDENT',
  student: { id: 42 },
  isActive: true,
  tokenVersion: 0,
};

const doctorActor: AuthActor = {
  id: 30,
  role: 'DOCTOR',
  doctor: { id: 7 },
  isActive: true,
  tokenVersion: 0,
};

// Mock dependencies for search_scoped_students
const mockDeps = {
  adminSearchStudents: async (actor: AuthActor, filters: any) => {
    // Mimic scoped search: if department filter is out of scope, return UNAUTHORIZED_SCOPE
    if (filters?.departmentId === 999) {
      return {
        status: 'UNAUTHORIZED_SCOPE',
        hasData: false,
        message: 'The requested department is outside your authorized administrative scope.',
        messageAr: 'القسم المطلوب يقع خارج نطاق صلاحياتك الإدارية.',
        totalStudents: 0,
        page: 1,
        limit: 10,
        totalPages: 1,
        students: [],
      };
    }

    return {
      status: 'SUCCESS',
      hasData: true,
      message: 'Found 1 student(s) matching your criteria.',
      messageAr: 'تم العثور على 1 طالب مطابق لمعايير البحث.',
      totalStudents: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
      students: [
        {
          id: 42,
          studentId: 'STU-2024-001',
          fullName: 'Ahmed Ali',
          year: 3,
          departmentName: 'Computer Science',
          collegeName: 'Faculty of Computers and AI',
          status: 'ACTIVE',
        },
      ],
    };
  },
};

// 1. Authorized admin gets scoped result with numeric ID and safe sanitized fields
const searchResult = await executeAiTool(
  'search_scoped_students',
  JSON.stringify({ query: 'Ahmed' }),
  collegeAdminActor,
  mockDeps as any
);

assert.equal(searchResult.status, 'SUCCESS');
assert.equal(searchResult.totalStudents, 1);
assert.equal(searchResult.students.length, 1);

const studentRecord = searchResult.students[0];
assert.equal(typeof studentRecord.id, 'number', 'Primary key id must be numeric');
assert.equal(studentRecord.id, 42);
assert.equal(studentRecord.studentId, 'STU-2024-001');
assert.equal(studentRecord.fullName, 'Ahmed Ali');
assert.equal(studentRecord.year, 3);
assert.equal(studentRecord.departmentName, 'Computer Science');
assert.equal(studentRecord.collegeName, 'Faculty of Computers and AI');
assert.equal(studentRecord.status, 'ACTIVE');

// Verify NO sensitive or unrelated fields are leaked in tool result
const allowedKeys = new Set(['id', 'studentId', 'fullName', 'year', 'departmentName', 'collegeName', 'status']);
for (const key of Object.keys(studentRecord)) {
  assert.ok(allowedKeys.has(key), `Unrelated field ${key} must not be exposed`);
}

// 2. Out-of-scope department query returns UNAUTHORIZED_SCOPE
const outOfScopeResult = await executeAiTool(
  'search_scoped_students',
  JSON.stringify({ departmentId: 999 }),
  collegeAdminActor,
  mockDeps as any
);
assert.equal(outOfScopeResult.status, 'UNAUTHORIZED_SCOPE');
assert.equal(outOfScopeResult.hasData, false);
assert.equal(outOfScopeResult.students.length, 0);

// 3. Unauthorized roles (STUDENT, DOCTOR) cannot execute search_scoped_students
await assert.rejects(
  executeAiTool('search_scoped_students', '{}', studentActor, mockDeps as any),
  /AI tool unavailable/
);
await assert.rejects(
  executeAiTool('search_scoped_students', '{}', doctorActor, mockDeps as any),
  /AI tool unavailable/
);

// ─────────────────────────────────────────────────────────────
// Part 2: Independent GET /api/students/:id Scope & Security Enforcement
// ─────────────────────────────────────────────────────────────

const mockUsers: Record<number, any> = {
  10: { id: 10, role: 'COLLEGE_ADMIN', managedCollegeId: 5, isActive: true, tokenVersion: 0 },
  11: { id: 11, role: 'COLLEGE_ADMIN', managedCollegeId: 99, isActive: true, tokenVersion: 0 }, // Out-of-scope admin
  1: { id: 1, role: 'SUPER_ADMIN', isActive: true, tokenVersion: 0 },
  20: { id: 20, role: 'STUDENT', student: { id: 42 }, isActive: true, tokenVersion: 0 },
};

const originalUserFindUnique = prisma.user.findUnique;
const originalStudentFindUnique = prisma.student.findUnique;

(prisma.user.findUnique as any) = async ({ where }: { where: { id: number } }) => {
  return mockUsers[where.id] || null;
};

const mockStudentsDb: Record<number, any> = {
  42: {
    id: 42,
    studentId: 'STU-2024-001',
    firstName: 'Ahmed',
    lastName: 'Ali',
    year: 3,
    isActive: true,
    departmentId: 101,
    department: {
      id: 101,
      name: 'Computer Science',
      collegeId: 5, // College 5
      college: { id: 5, name: 'Faculty of Computers and AI' },
    },
    user: { email: 'ahmed@example.test', role: 'STUDENT', profilePicture: null, isActive: true },
    group: null,
    enrollments: [],
    payments: [],
  },
};

(prisma.student.findUnique as any) = async ({ where }: { where: { id: number } }) => {
  return mockStudentsDb[where.id] || null;
};

const app = express();
app.use(express.json());
app.use('/api/students', protect, studentsRouter);
app.use(errorHandler);

const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert.ok(address && typeof address === 'object');
const baseUrl = `http://127.0.0.1:${address.port}/api/students`;

try {
  // Test A: Authorized COLLEGE_ADMIN (managedCollegeId: 5) accessing student 42 (collegeId: 5) -> 200 OK
  {
    const res = await fetch(`${baseUrl}/42`, {
      headers: { authorization: `Bearer ${generateAccessToken(10, 0)}` },
    });
    assert.equal(res.status, 200, 'Authorized admin must receive 200 OK');
    const json = (await res.json()) as any;
    assert.equal(json.success, true);
    assert.equal(json.data.id, 42);
    assert.equal(json.data.studentId, 'STU-2024-001');
  }

  // Test B: SUPER_ADMIN accessing student 42 -> 200 OK
  {
    const res = await fetch(`${baseUrl}/42`, {
      headers: { authorization: `Bearer ${generateAccessToken(1, 0)}` },
    });
    assert.equal(res.status, 200, 'Super admin must receive 200 OK');
    const json = (await res.json()) as any;
    assert.equal(json.data.id, 42);
  }

  // Test C: Unauthorized Scoped Admin (managedCollegeId: 99 != 5) -> 403 Forbidden (IDOR protection)
  {
    const res = await fetch(`${baseUrl}/42`, {
      headers: { authorization: `Bearer ${generateAccessToken(11, 0)}` },
    });
    assert.equal(res.status, 403, 'Out-of-scope admin must be denied with 403 Forbidden');
    const json = (await res.json()) as any;
    assert.match(json.message, /Access denied: student belongs to a different scope/i);
  }

  // Test D: Malformed non-numeric ID parameter (e.g. STU-2024-001 or abc) -> rejected (422/400)
  {
    const res = await fetch(`${baseUrl}/STU-2024-001`, {
      headers: { authorization: `Bearer ${generateAccessToken(10, 0)}` },
    });
    assert.ok(res.status === 400 || res.status === 422, `Malformed non-integer ID parameter must be rejected with 400/422, got ${res.status}`);
  }
  {
    const res = await fetch(`${baseUrl}/abc`, {
      headers: { authorization: `Bearer ${generateAccessToken(10, 0)}` },
    });
    assert.ok(res.status === 400 || res.status === 422, `Non-integer string ID must be rejected with 400/422, got ${res.status}`);
  }

  // Test E: Non-existent numeric ID -> 404 Not Found
  {
    const res = await fetch(`${baseUrl}/99999`, {
      headers: { authorization: `Bearer ${generateAccessToken(1, 0)}` },
    });
    assert.equal(res.status, 404, 'Non-existent student ID must return 404 Not Found');
  }

  // Test F: Unauthorized role (STUDENT) trying to access student management details -> 403 Forbidden
  {
    const res = await fetch(`${baseUrl}/42`, {
      headers: { authorization: `Bearer ${generateAccessToken(20, 0)}` },
    });
    assert.equal(res.status, 403, 'Unauthorized role (STUDENT) must be blocked from admin route');
  }
} finally {
  (prisma.user.findUnique as any) = originalUserFindUnique;
  (prisma.student.findUnique as any) = originalStudentFindUnique;
  server.close();
}

console.log('✓ student_details_authorization.test.ts: all scope, security & data contract tests passed.');
