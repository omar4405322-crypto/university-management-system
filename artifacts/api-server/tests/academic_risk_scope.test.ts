import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { calculateStudentRisk } from '../src/utils/cron';

test('BL-001: Verify cron.ts contains scoped active enrollment query', () => {
  const cronSource = readFileSync(
    new URL('../src/utils/cron.ts', import.meta.url),
    'utf8'
  );

  const startJobIndex = cronSource.indexOf('startRiskDetectionJob');
  const jobSource = cronSource.slice(startJobIndex, startJobIndex + 2500);

  // 1. Check: Prisma query must scope enrollments to ENROLLED
  assert.match(
    jobSource,
    /enrollments:\s*\{\s*where:\s*\{\s*status:\s*['"]ENROLLED['"]\s*\}/,
    'Prisma enrollments query must filter where: { status: "ENROLLED" }'
  );

  // 2. Check: Attendance selection must include offering identity fields
  assert.match(
    jobSource,
    /attendance:\s*\{\s*select:\s*\{[\s\S]*?courseId:\s*true[\s\S]*?semester:\s*true[\s\S]*?academicYear:\s*true/m,
    'Attendance selection must include courseId, semester, and academicYear'
  );

  // 3. Check: Course tasks must select offering fields
  assert.match(
    jobSource,
    /tasks:\s*\{[\s\S]*?semester:\s*true[\s\S]*?academicYear:\s*true/m,
    'Course tasks must select semester and academicYear'
  );
});

test('BL-001: Evaluates current ENROLLED attempt only', () => {
  const student = {
    enrollments: [
      {
        id: 1,
        courseId: 101,
        semester: 1,
        academicYear: 2026,
        status: 'ENROLLED',
        course: {
          tasks: [
            { id: 11, semester: 1, academicYear: 2026 },
            { id: 12, semester: 1, academicYear: 2026 },
          ],
        },
        quizSubmissions: [{ score: 85 }, { score: 95 }],
        taskSubmissions: [{ taskId: 11 }, { taskId: 12 }],
      },
    ],
    attendance: [
      { status: 'PRESENT', courseId: 101, semester: 1, academicYear: 2026 },
      { status: 'PRESENT', courseId: 101, semester: 1, academicYear: 2026 },
      { status: 'LATE', courseId: 101, semester: 1, academicYear: 2026 },
    ],
  };

  const risk = calculateStudentRisk(student);
  assert.equal(risk.attendanceRate, 100);
  assert.equal(risk.averageQuizScore, 90);
  assert.equal(risk.assignmentCompletionRate, 100);
  assert.equal(risk.predictedRisk, 'LOW');
});

test('BL-001: Excludes previous FAILED attempt and historical metrics', () => {
  // Scenario: Student previously FAILED course 101 in 2025 with terrible attendance and zero quiz scores.
  // In 2026, student is ENROLLED in course 102 with perfect scores.
  const student = {
    enrollments: [
      {
        id: 1,
        courseId: 101,
        semester: 1,
        academicYear: 2025,
        status: 'FAILED',
        course: {
          tasks: [{ id: 1, semester: 1, academicYear: 2025 }],
        },
        quizSubmissions: [{ score: 10 }, { score: 20 }],
        taskSubmissions: [],
      },
      {
        id: 2,
        courseId: 102,
        semester: 1,
        academicYear: 2026,
        status: 'ENROLLED',
        course: {
          tasks: [{ id: 2, semester: 1, academicYear: 2026 }],
        },
        quizSubmissions: [{ score: 90 }],
        taskSubmissions: [{ taskId: 2 }],
      },
    ],
    attendance: [
      // Historical failed attendance (4 absences)
      { status: 'ABSENT', courseId: 101, semester: 1, academicYear: 2025 },
      { status: 'ABSENT', courseId: 101, semester: 1, academicYear: 2025 },
      { status: 'ABSENT', courseId: 101, semester: 1, academicYear: 2025 },
      { status: 'ABSENT', courseId: 101, semester: 1, academicYear: 2025 },
      // Current active attendance (2 presents)
      { status: 'PRESENT', courseId: 102, semester: 1, academicYear: 2026 },
      { status: 'PRESENT', courseId: 102, semester: 1, academicYear: 2026 },
    ],
  };

  const risk = calculateStudentRisk(student);
  // FAILED attempt must be 100% ignored
  assert.equal(risk.attendanceRate, 100, 'Historical absences must not degrade current attendance');
  assert.equal(risk.averageQuizScore, 90, 'Historical low quiz scores must not degrade current quiz average');
  assert.equal(risk.assignmentCompletionRate, 100, 'Historical unsubmitted task must not degrade assignment rate');
  assert.equal(risk.predictedRisk, 'LOW');
});

test('BL-001: Excludes previous COMPLETED attempt from altering current risk', () => {
  const student = {
    enrollments: [
      {
        id: 1,
        courseId: 101,
        semester: 1,
        academicYear: 2025,
        status: 'COMPLETED',
        course: { tasks: [{ id: 10, semester: 1, academicYear: 2025 }] },
        quizSubmissions: [{ score: 60 }],
        taskSubmissions: [{ taskId: 10 }],
      },
      {
        id: 2,
        courseId: 102,
        semester: 1,
        academicYear: 2026,
        status: 'ENROLLED',
        course: { tasks: [{ id: 20, semester: 1, academicYear: 2026 }] },
        quizSubmissions: [{ score: 95 }],
        taskSubmissions: [{ taskId: 20 }],
      },
    ],
    attendance: [
      { status: 'ABSENT', courseId: 101, semester: 1, academicYear: 2025 },
      { status: 'PRESENT', courseId: 102, semester: 1, academicYear: 2026 },
    ],
  };

  const risk = calculateStudentRisk(student);
  assert.equal(risk.attendanceRate, 100);
  assert.equal(risk.averageQuizScore, 95);
  assert.equal(risk.assignmentCompletionRate, 100);
  assert.equal(risk.predictedRisk, 'LOW');
});

test('BL-001: Excludes WITHDRAWN / DROPPED attempt', () => {
  const student = {
    enrollments: [
      {
        id: 1,
        courseId: 101,
        semester: 1,
        academicYear: 2026,
        status: 'WITHDRAWN',
        course: { tasks: [{ id: 1, semester: 1, academicYear: 2026 }] },
        quizSubmissions: [{ score: 0 }],
        taskSubmissions: [],
      },
      {
        id: 2,
        courseId: 102,
        semester: 1,
        academicYear: 2026,
        status: 'ENROLLED',
        course: { tasks: [{ id: 2, semester: 1, academicYear: 2026 }] },
        quizSubmissions: [{ score: 85 }],
        taskSubmissions: [{ taskId: 2 }],
      },
    ],
    attendance: [
      { status: 'ABSENT', courseId: 101, semester: 1, academicYear: 2026 },
      { status: 'PRESENT', courseId: 102, semester: 1, academicYear: 2026 },
    ],
  };

  const risk = calculateStudentRisk(student);
  assert.equal(risk.attendanceRate, 100);
  assert.equal(risk.averageQuizScore, 85);
  assert.equal(risk.predictedRisk, 'LOW');
});

test('BL-001: Course retake evaluates only new active attempt', () => {
  // Scenario: Student retakes Course 101 in 2026 after failing it in 2025.
  const student = {
    enrollments: [
      {
        id: 1,
        courseId: 101,
        semester: 1,
        academicYear: 2025,
        status: 'FAILED',
        course: {
          tasks: [
            { id: 101, semester: 1, academicYear: 2025 },
            { id: 102, semester: 1, academicYear: 2025 },
          ],
        },
        quizSubmissions: [{ score: 25 }],
        taskSubmissions: [],
      },
      {
        id: 2,
        courseId: 101,
        semester: 1,
        academicYear: 2026,
        status: 'ENROLLED',
        course: {
          tasks: [
            { id: 101, semester: 1, academicYear: 2025 }, // Historical task in course pool
            { id: 103, semester: 1, academicYear: 2026 }, // Current task
          ],
        },
        quizSubmissions: [{ score: 92 }],
        taskSubmissions: [{ taskId: 103 }],
      },
    ],
    attendance: [
      // 2025 offering attendance
      { status: 'ABSENT', courseId: 101, semester: 1, academicYear: 2025 },
      { status: 'ABSENT', courseId: 101, semester: 1, academicYear: 2025 },
      // 2026 offering attendance
      { status: 'PRESENT', courseId: 101, semester: 1, academicYear: 2026 },
      { status: 'PRESENT', courseId: 101, semester: 1, academicYear: 2026 },
    ],
  };

  const risk = calculateStudentRisk(student);
  assert.equal(risk.attendanceRate, 100, '2026 attendance must be 100%');
  assert.equal(risk.averageQuizScore, 92, '2026 quiz score must be 92');
  assert.equal(risk.assignmentCompletionRate, 100, 'Historical 2025 task must not count against 2026 offering');
  assert.equal(risk.predictedRisk, 'LOW');
});

test('BL-001: Historical attendance, task submission, and quiz submission cannot pollute current attempt', () => {
  const student = {
    enrollments: [
      {
        id: 99,
        courseId: 300,
        semester: 1,
        academicYear: 2026,
        status: 'ENROLLED',
        course: {
          tasks: [{ id: 501, semester: 1, academicYear: 2026 }],
        },
        quizSubmissions: [{ score: 80 }],
        taskSubmissions: [{ taskId: 501 }],
      },
    ],
    attendance: [
      // Current offering attendance: 1 PRESENT
      { status: 'PRESENT', courseId: 300, semester: 1, academicYear: 2026 },
      // Stray / historical attendance records without matching active offering
      { status: 'ABSENT', courseId: 300, semester: 2, academicYear: 2024 },
      { status: 'ABSENT', courseId: 200, semester: 1, academicYear: 2025 },
      { status: 'ABSENT', courseId: 300, semester: null, academicYear: null },
    ],
  };

  const risk = calculateStudentRisk(student);
  assert.equal(risk.attendanceRate, 100, 'Only matching offering attendance should be counted');
  assert.equal(risk.predictedRisk, 'LOW');
});

test('BL-001: Stale unclosed ENROLLED record is disambiguated to authoritative current offering', () => {
  // In the event an old enrollment was never transitioned out of ENROLLED:
  const student = {
    enrollments: [
      {
        id: 10,
        courseId: 101,
        semester: 1,
        academicYear: 2024,
        status: 'ENROLLED', // Stale unclosed attempt
        course: { tasks: [{ id: 1, semester: 1, academicYear: 2024 }] },
        quizSubmissions: [{ score: 30 }],
        taskSubmissions: [],
      },
      {
        id: 20,
        courseId: 101,
        semester: 1,
        academicYear: 2026,
        status: 'ENROLLED', // Authoritative current attempt
        course: { tasks: [{ id: 2, semester: 1, academicYear: 2026 }] },
        quizSubmissions: [{ score: 90 }],
        taskSubmissions: [{ taskId: 2 }],
      },
    ],
    attendance: [
      { status: 'ABSENT', courseId: 101, semester: 1, academicYear: 2024 },
      { status: 'PRESENT', courseId: 101, semester: 1, academicYear: 2026 },
    ],
  };

  const risk = calculateStudentRisk(student);
  assert.equal(risk.attendanceRate, 100, 'Stale 2024 attempt attendance must be excluded');
  assert.equal(risk.averageQuizScore, 90, 'Stale 2024 attempt quiz must be excluded');
  assert.equal(risk.predictedRisk, 'LOW');
});

test('BL-001: Student with zero active enrollments defaults safely to LOW risk', () => {
  const student = {
    enrollments: [
      {
        id: 1,
        courseId: 101,
        semester: 1,
        academicYear: 2024,
        status: 'COMPLETED',
        course: { tasks: [] },
        quizSubmissions: [],
        taskSubmissions: [],
      },
    ],
    attendance: [],
  };

  const risk = calculateStudentRisk(student);
  assert.equal(risk.attendanceRate, 100);
  assert.equal(risk.averageQuizScore, 100);
  assert.equal(risk.assignmentCompletionRate, 100);
  assert.equal(risk.predictedRisk, 'LOW');
});
