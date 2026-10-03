import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import type { AuthActor } from '../src/types/auth.types';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'ai-action-proposals-secret-key-for-test-32chars';
process.env.AI_ASSISTANT_ENABLED = 'true';
process.env.AI_PROVIDER = 'openai';
process.env.OPENAI_API_KEY = 'mock-key-no-external-network';
process.env.OPENAI_MODEL = 'gpt-4o-mini';

// Guard: automated provider calls are strictly mocked. Any real fetch outside localhost fails.
const nativeFetch = globalThis.fetch;
let externalRequests = 0;
globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
  const input = args[0];
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    externalRequests++;
    throw new Error('Real provider requests strictly forbidden in tests');
  }
  return nativeFetch(...args);
};

const [
  { createAiRouter },
  { generateAiReply },
  { executeAiTool },
  { generateAccessToken },
  { default: prisma },
  { default: errorHandler },
  aiActionService,
  aiConvService,
] = await Promise.all([
  import('../src/routes/ai.routes'),
  import('../src/services/ai.service'),
  import('../src/services/aiTools.service'),
  import('../src/utils/jwt.utils'),
  import('../src/utils/prismaClient'),
  import('../src/middleware/error.middleware'),
  import('../src/services/aiActionProposal.service'),
  import('../src/services/aiConversation.service'),
]);

// Test IDs
const COLLEGE_ID = 7701;
const DEPT_ID = 7702;
const COURSE_ID = 7301;
const DOCTOR_USER_ID = 9401;
const DOCTOR_ID = 7401;
const DOCTOR_UNASSIGNED_USER_ID = 9402;
const DOCTOR_UNASSIGNED_ID = 7402;
const STUDENT_USER_ID = 9403;
const STUDENT_ID = 7403;
const ADMIN_USER_ID = 9404;
const SLOT_ID = 7501;
const NOTIF_ID = 7601;

// Actors
const doctorActor: AuthActor = {
  id: DOCTOR_USER_ID,
  email: 'doctor.test@university.edu',
  role: 'DOCTOR',
  doctor: {
    id: DOCTOR_ID,
    firstName: 'Dr. Tarek',
    lastName: 'Mansour',
    doctorId: 'DOC-9401',
    departmentId: DEPT_ID,
  },
  tokenVersion: 0,
  isActive: true,
  createdAt: new Date(),
};

const unassignedDoctorActor: AuthActor = {
  id: DOCTOR_UNASSIGNED_USER_ID,
  email: 'doctor.unassigned@university.edu',
  role: 'DOCTOR',
  doctor: {
    id: DOCTOR_UNASSIGNED_ID,
    firstName: 'Dr. Sarah',
    lastName: 'Nasser',
    doctorId: 'DOC-9402',
    departmentId: DEPT_ID,
  },
  tokenVersion: 0,
  isActive: true,
  createdAt: new Date(),
};

const studentActor: AuthActor = {
  id: STUDENT_USER_ID,
  email: 'student.test@university.edu',
  role: 'STUDENT',
  student: {
    id: STUDENT_ID,
    firstName: 'Omar',
    lastName: 'Ali',
    studentId: 'STU-9403',
    year: 3,
    departmentId: DEPT_ID,
  },
  tokenVersion: 0,
  isActive: true,
  createdAt: new Date(),
};

const adminActor: AuthActor = {
  id: ADMIN_USER_ID,
  email: 'admin.college@university.edu',
  role: 'COLLEGE_ADMIN',
  collegeId: COLLEGE_ID,
  managedCollegeId: COLLEGE_ID,
  tokenVersion: 0,
  isActive: true,
  createdAt: new Date(),
};

// Seed test database
async function seedTestData() {
  // College & Department
  await prisma.college.upsert({
    where: { id: COLLEGE_ID },
    update: { name: 'College of Computing & AI', nameAr: 'كلية الحاسبات والذكاء الاصطناعي' },
    create: { id: COLLEGE_ID, name: 'College of Computing & AI', nameAr: 'كلية الحاسبات والذكاء الاصطناعي' },
  });

  await prisma.department.upsert({
    where: { id: DEPT_ID },
    update: { name: 'Computer Science', nameAr: 'علوم الحاسب', collegeId: COLLEGE_ID },
    create: { id: DEPT_ID, name: 'Computer Science', nameAr: 'علوم الحاسب', collegeId: COLLEGE_ID },
  });

  // Doctor User & Doctor record
  await prisma.user.upsert({
    where: { id: DOCTOR_USER_ID },
    update: { email: doctorActor.email, role: 'DOCTOR', isActive: true },
    create: { id: DOCTOR_USER_ID, email: doctorActor.email, password: 'hash', role: 'DOCTOR', isActive: true },
  });
  await prisma.doctor.upsert({
    where: { id: DOCTOR_ID },
    update: { userId: DOCTOR_USER_ID, firstName: 'Dr. Tarek', lastName: 'Mansour', departmentId: DEPT_ID },
    create: { id: DOCTOR_ID, userId: DOCTOR_USER_ID, firstName: 'Dr. Tarek', lastName: 'Mansour', doctorId: 'DOC-9401', departmentId: DEPT_ID },
  });

  // Unassigned Doctor
  await prisma.user.upsert({
    where: { id: DOCTOR_UNASSIGNED_USER_ID },
    update: { email: unassignedDoctorActor.email, role: 'DOCTOR', isActive: true },
    create: { id: DOCTOR_UNASSIGNED_USER_ID, email: unassignedDoctorActor.email, password: 'hash', role: 'DOCTOR', isActive: true },
  });
  await prisma.doctor.upsert({
    where: { id: DOCTOR_UNASSIGNED_ID },
    update: { userId: DOCTOR_UNASSIGNED_USER_ID, firstName: 'Dr. Sarah', lastName: 'Nasser', departmentId: DEPT_ID },
    create: { id: DOCTOR_UNASSIGNED_ID, userId: DOCTOR_UNASSIGNED_USER_ID, firstName: 'Dr. Sarah', lastName: 'Nasser', doctorId: 'DOC-9402', departmentId: DEPT_ID },
  });

  // Student User & Student record
  await prisma.user.upsert({
    where: { id: STUDENT_USER_ID },
    update: { email: studentActor.email, role: 'STUDENT', isActive: true, departmentId: DEPT_ID, collegeId: COLLEGE_ID },
    create: { id: STUDENT_USER_ID, email: studentActor.email, password: 'hash', role: 'STUDENT', isActive: true, departmentId: DEPT_ID, collegeId: COLLEGE_ID },
  });
  await prisma.student.upsert({
    where: { id: STUDENT_ID },
    update: { userId: STUDENT_USER_ID, firstName: 'Omar', lastName: 'Ali', departmentId: DEPT_ID },
    create: { id: STUDENT_ID, userId: STUDENT_USER_ID, firstName: 'Omar', lastName: 'Ali', studentId: 'STU-9403', year: 3, departmentId: DEPT_ID },
  });

  // Admin User
  await prisma.user.upsert({
    where: { id: ADMIN_USER_ID },
    update: { email: adminActor.email, role: 'COLLEGE_ADMIN', collegeId: COLLEGE_ID, managedCollegeId: COLLEGE_ID, isActive: true },
    create: { id: ADMIN_USER_ID, email: adminActor.email, password: 'hash', role: 'COLLEGE_ADMIN', collegeId: COLLEGE_ID, managedCollegeId: COLLEGE_ID, isActive: true },
  });

  // Course
  await prisma.course.upsert({
    where: { id: COURSE_ID },
    update: { courseCode: 'CS7301', name: 'Operating Systems Security', departmentId: DEPT_ID },
    create: { id: COURSE_ID, courseCode: 'CS7301', name: 'Operating Systems Security', departmentId: DEPT_ID, year: 3, credits: 3 },
  });

  // ScheduleSlot assigning doctor 7401 to course 7301
  await prisma.scheduleSlot.upsert({
    where: { id: SLOT_ID },
    update: { courseId: COURSE_ID, doctorId: DOCTOR_ID, isArchived: false },
    create: {
      id: SLOT_ID,
      courseId: COURSE_ID,
      doctorId: DOCTOR_ID,
      dayOfWeek: 'MONDAY',
      startTime: '09:00',
      endTime: '10:30',
      slotType: 'LECTURE',
    },
  });

  // Enrollment for student in course
  const existingEnrollment = await prisma.enrollment.findFirst({
    where: { studentId: STUDENT_ID, courseId: COURSE_ID },
  });
  if (existingEnrollment) {
    await prisma.enrollment.update({
      where: { id: existingEnrollment.id },
      data: { status: 'ENROLLED' },
    });
  } else {
    await prisma.enrollment.create({
      data: { studentId: STUDENT_ID, courseId: COURSE_ID, status: 'ENROLLED', semester: 1, academicYear: 2026 },
    });
  }

  // Notification for student
  await prisma.notification.upsert({
    where: { id: NOTIF_ID },
    update: { userId: STUDENT_USER_ID, title: 'Exam schedule posted', message: 'Check your exams', isRead: false },
    create: { id: NOTIF_ID, userId: STUDENT_USER_ID, title: 'Exam schedule posted', message: 'Check your exams', isRead: false },
  });

  // Conversation for doctor
  await prisma.aIConversation.upsert({
    where: { id: 'test-conv-1' },
    update: { userId: DOCTOR_USER_ID, title: 'Test Conversation' },
    create: { id: 'test-conv-1', userId: DOCTOR_USER_ID, title: 'Test Conversation' },
  });
}

// Clean test proposals & created tasks
async function cleanupTestData() {
  await prisma.aIActionProposal.deleteMany({
    where: { userId: { in: [DOCTOR_USER_ID, DOCTOR_UNASSIGNED_USER_ID, STUDENT_USER_ID, ADMIN_USER_ID] } },
  });
  await prisma.task.deleteMany({
    where: { courseId: COURSE_ID },
  });
}

await seedTestData();

// HTTP Test Server
const app = express();
app.use(express.json());
app.use('/api/ai', createAiRouter());
app.use(errorHandler);

const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert.ok(address && typeof address === 'object');
const baseUrl = `http://127.0.0.1:${address.port}/api/ai`;

// Helper for authenticated HTTP requests
async function authFetch(path: string, token: string, options: RequestInit = {}) {
  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, body: data as any };
}

// Tokens
const doctorToken = generateAccessToken(DOCTOR_USER_ID, 0);
const unassignedDoctorToken = generateAccessToken(DOCTOR_UNASSIGNED_USER_ID, 0);
const studentToken = generateAccessToken(STUDENT_USER_ID, 0);
const adminToken = generateAccessToken(ADMIN_USER_ID, 0);

// ============================================================================
// TEST SUITE
// ============================================================================

test('PHASE 14 — SAFE AI ACTIONS, PREVIEW, EXPLICIT CONFIRMATION & EXACTLY-ONCE EXECUTION', async (t) => {
  t.beforeEach(async () => {
    await cleanupTestData();
    // Ensure schedule slot is assigned to doctor
    await prisma.scheduleSlot.update({
      where: { id: SLOT_ID },
      data: { doctorId: DOCTOR_ID },
    });
  });

  t.after(async () => {
    await cleanupTestData();
    server.close();
  });

  // ==========================================================================
  // 1. INVARIANT: MODEL CANNOT DIRECTLY EXECUTE & STRICT SCHEMAS
  // ==========================================================================

  await t.test('1.1 Doctor can propose CREATE_TASK; writes 0 rows to Task table', async () => {
    const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const proposal = await aiActionService.proposeAction(
      doctorActor,
      'CREATE_TASK',
      {
        courseId: COURSE_ID,
        title: 'Midterm Research Report',
        description: 'Submit PDF report by Friday',
        dueDate,
        maxScore: 100,
      },
      { conversationId: 'test-conv-1', sourceUserMessageId: 'msg-turn-1' },
    );

    assert.equal(proposal.status, 'PROPOSED');
    assert.equal(proposal.requiresConfirmation, true);
    assert.ok(proposal.proposalId);
    assert.ok(proposal.humanReadableSummary.includes('Midterm Research Report'));
    assert.equal(proposal.preview.recipientsCount, 1);

    // CRITICAL: Zero tasks exist in database
    const taskCount = await prisma.task.count({ where: { courseId: COURSE_ID } });
    assert.equal(taskCount, 0, 'No task must be created during proposal stage');
  });

  await t.test('1.2 Non-doctor (Student) cannot propose CREATE_TASK (403 Forbidden)', async () => {
    const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    await assert.rejects(
      async () => {
        await aiActionService.proposeAction(
          studentActor,
          'CREATE_TASK',
          { courseId: COURSE_ID, title: 'Unauthorized Task', dueDate },
        );
      },
      (err: any) => err.statusCode === 403,
    );
  });

  await t.test('1.3 Doctor not assigned to course cannot propose CREATE_TASK (403 Forbidden)', async () => {
    const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    await assert.rejects(
      async () => {
        await aiActionService.proposeAction(
          unassignedDoctorActor,
          'CREATE_TASK',
          { courseId: COURSE_ID, title: 'Unassigned Course Task', dueDate },
        );
      },
      (err: any) => err.statusCode === 403,
    );
  });

  await t.test('1.4 Reject CREATE_TASK with past deadline (422 ValidationError)', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await assert.rejects(
      async () => {
        await aiActionService.proposeAction(
          doctorActor,
          'CREATE_TASK',
          { courseId: COURSE_ID, title: 'Past Deadline Task', dueDate: pastDate },
        );
      },
      (err: any) => err.statusCode === 422 && err.message.includes('future'),
    );
  });

  await t.test('1.5 Reject arbitrary properties / bypass execution flags (Strict Zod)', async () => {
    const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await assert.rejects(
      async () => {
        await aiActionService.proposeAction(
          doctorActor,
          'CREATE_TASK',
          {
            courseId: COURSE_ID,
            title: 'Hacked Task',
            dueDate,
            confirmed: true,
            bypassSecurity: true,
          } as any,
        );
      },
      (err: any) => err.statusCode === 422,
    );
  });

  await t.test('1.6 Proposal Idempotency: Duplicate provider call returns existing proposal', async () => {
    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const payload = {
      courseId: COURSE_ID,
      title: 'Idempotency Test Assignment',
      dueDate,
    };
    const options = { conversationId: 'conv-idemp-1', sourceUserMessageId: 'turn-msg-1' };
    await prisma.aIConversation.upsert({
      where: { id: 'conv-idemp-1' },
      update: { userId: DOCTOR_USER_ID, title: 'Idempotency Conv' },
      create: { id: 'conv-idemp-1', userId: DOCTOR_USER_ID, title: 'Idempotency Conv' },
    });

    const first = await aiActionService.proposeAction(doctorActor, 'CREATE_TASK', payload, options);
    const second = await aiActionService.proposeAction(doctorActor, 'CREATE_TASK', payload, options);

    assert.equal(first.proposalId, second.proposalId);
    assert.equal(second.idempotentReplay, true);

    const totalProposals = await prisma.aIActionProposal.count({
      where: { userId: DOCTOR_USER_ID, conversationId: 'conv-idemp-1' },
    });
    assert.equal(totalProposals, 1, 'Provider retry must not create duplicate proposal rows');
  });

  // ==========================================================================
  // 2. STUDENT ACTIONS & NOTIFICATION READ
  // ==========================================================================

  await t.test('2.1 Student can propose MARK_NOTIFICATION_READ for own notification', async () => {
    const proposal = await aiActionService.proposeAction(
      studentActor,
      'MARK_NOTIFICATION_READ',
      { notificationId: NOTIF_ID },
    );
    assert.equal(proposal.status, 'PROPOSED');
    assert.equal(proposal.requiresConfirmation, true);

    // Notification is still unread until confirmed
    const notif = await prisma.notification.findUnique({ where: { id: NOTIF_ID } });
    assert.equal(notif?.isRead, false, 'Notification must remain unread before confirmation');
  });

  await t.test('2.2 Student cannot propose MARK_NOTIFICATION_READ for foreign notification (404)', async () => {
    await assert.rejects(
      async () => {
        await aiActionService.proposeAction(
          doctorActor,
          'MARK_NOTIFICATION_READ',
          { notificationId: NOTIF_ID },
        );
      },
      (err: any) => err.statusCode === 404,
    );
  });

  // ==========================================================================
  // 3. ADMIN ACTIONS & ANNOUNCEMENT BOUNDARIES
  // ==========================================================================

  await t.test('3.1 Scoped admin can propose CREATE_ANNOUNCEMENT for managed college', async () => {
    const proposal = await aiActionService.proposeAction(
      adminActor,
      'CREATE_ANNOUNCEMENT',
      {
        targetScope: 'COLLEGE',
        collegeId: COLLEGE_ID,
        title: 'Midterm Break Schedule',
        message: 'The midterm break starts next Sunday.',
        type: 'info',
      },
    );
    assert.equal(proposal.status, 'PROPOSED');
    assert.ok(proposal.preview.estimatedRecipientsCount !== undefined);
  });

  await t.test('3.2 Scoped admin cannot broadcast outside managed scope (403 Forbidden)', async () => {
    await assert.rejects(
      async () => {
        await aiActionService.proposeAction(
          adminActor,
          'CREATE_ANNOUNCEMENT',
          {
            targetScope: 'GLOBAL',
            title: 'Unauthorized Global Broadcast',
            message: 'Should fail',
          },
        );
      },
      (err: any) => err.statusCode === 403,
    );
  });

  // ==========================================================================
  // 4. EXPLICIT HUMAN CONFIRMATION & EXACTLY-ONCE CONCURRENCY
  // ==========================================================================

  await t.test('4.1 Explicit confirmation executes TaskService and creates business row', async () => {
    const dueDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
    const proposal = await aiActionService.proposeAction(
      doctorActor,
      'CREATE_TASK',
      {
        courseId: COURSE_ID,
        title: 'Confirmed Project 1',
        description: 'Complete project by deadline',
        dueDate,
      },
    );

    // Call confirmation endpoint
    const res = await authFetch(`/actions/${proposal.proposalId}/confirm`, doctorToken, {
      method: 'POST',
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'SUCCEEDED');
    assert.ok(res.body.data.executionResult.taskId);

    // Verify exactly one Task was created in DB
    const task = await prisma.task.findFirst({
      where: { courseId: COURSE_ID, title: 'Confirmed Project 1' },
    });
    assert.ok(task, 'Task must be created in DB upon confirmation');
    assert.equal(task.doctorId, DOCTOR_ID);

    // Verify proposal updated to SUCCEEDED
    const pDb = await prisma.aIActionProposal.findUnique({ where: { id: proposal.proposalId } });
    assert.equal(pDb?.status, 'SUCCEEDED');
    assert.ok(pDb?.executedAt);

    // Verify audit record emitted
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'AI_ACTION_EXECUTED', entityId: proposal.proposalId },
    });
    assert.ok(audit, 'AI_ACTION_EXECUTED audit record must be recorded');
  });

  await t.test('4.2 Concurrency: Two simultaneous confirm requests create exactly ONE business row', async () => {
    const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const proposal = await aiActionService.proposeAction(
      doctorActor,
      'CREATE_TASK',
      {
        courseId: COURSE_ID,
        title: 'Concurrent Double-Click Task',
        dueDate,
      },
    );

    // Send two confirm requests simultaneously (simulating double-click or network retry)
    const [res1, res2] = await Promise.all([
      authFetch(`/actions/${proposal.proposalId}/confirm`, doctorToken, { method: 'POST' }),
      authFetch(`/actions/${proposal.proposalId}/confirm`, doctorToken, { method: 'POST' }),
    ]);

    assert.equal(res1.status, 200);
    assert.equal(res2.status, 200);
    assert.equal(res1.body.data.status, 'SUCCEEDED');
    assert.equal(res2.body.data.status, 'SUCCEEDED');

    // Exactly one was the original, other was alreadyExecuted
    const hasAlreadyExecutedFlag = res1.body.data.alreadyExecuted || res2.body.data.alreadyExecuted;
    assert.equal(hasAlreadyExecutedFlag, true, 'One of the concurrent calls must report alreadyExecuted');

    // Database task count for this title must be EXACTLY 1
    const tasksCount = await prisma.task.count({
      where: { courseId: COURSE_ID, title: 'Concurrent Double-Click Task' },
    });
    assert.equal(tasksCount, 1, 'Exactly one task row must exist after simultaneous confirmations');
  });

  // ==========================================================================
  // 5. STALE STATE REVALIDATION & EXPIRATION
  // ==========================================================================

  await t.test('5.1 Stale detection: Unassigning doctor before confirmation marks proposal STALE', async () => {
    const dueDate = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString();
    const proposal = await aiActionService.proposeAction(
      doctorActor,
      'CREATE_TASK',
      {
        courseId: COURSE_ID,
        title: 'Stale Assignment Test',
        dueDate,
      },
    );

    // Simulate administrative change: doctor is unassigned from course
    await prisma.scheduleSlot.update({
      where: { id: SLOT_ID },
      data: { doctorId: DOCTOR_UNASSIGNED_ID },
    });

    // Attempt confirmation
    const res = await authFetch(`/actions/${proposal.proposalId}/confirm`, doctorToken, {
      method: 'POST',
    });

    assert.equal(res.status, 422);
    assert.ok(res.body.message.includes('stale') || res.body.message.includes('assigned'));

    // Proposal in DB must be STALE with failureCode DOCTOR_UNASSIGNED
    const pDb = await prisma.aIActionProposal.findUnique({ where: { id: proposal.proposalId } });
    assert.equal(pDb?.status, 'STALE');
    assert.equal(pDb?.failureCode, 'DOCTOR_UNASSIGNED');

    // Zero tasks created
    const taskCount = await prisma.task.count({
      where: { courseId: COURSE_ID, title: 'Stale Assignment Test' },
    });
    assert.equal(taskCount, 0, 'No task should be created when proposal becomes stale');
  });

  await t.test('5.2 Proposal Expiration: Confirming expired proposal fails closed', async () => {
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const proposal = await aiActionService.proposeAction(
      doctorActor,
      'CREATE_TASK',
      {
        courseId: COURSE_ID,
        title: 'Expiring Task',
        dueDate,
      },
    );

    // Manually backdate expiresAt in DB
    await prisma.aIActionProposal.update({
      where: { id: proposal.proposalId },
      data: { expiresAt: new Date(Date.now() - 60 * 1000) },
    });

    const res = await authFetch(`/actions/${proposal.proposalId}/confirm`, doctorToken, {
      method: 'POST',
    });

    assert.equal(res.status, 422);
    assert.ok(res.body.message.includes('expired'));

    const pDb = await prisma.aIActionProposal.findUnique({ where: { id: proposal.proposalId } });
    assert.equal(pDb?.status, 'EXPIRED');
  });

  await t.test('5.3 Cancellation: Explicit cancellation prevents subsequent execution', async () => {
    const dueDate = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();
    const proposal = await aiActionService.proposeAction(
      doctorActor,
      'CREATE_TASK',
      {
        courseId: COURSE_ID,
        title: 'Canceled Task',
        dueDate,
      },
    );

    // Cancel proposal
    const cancelRes = await authFetch(`/actions/${proposal.proposalId}/cancel`, doctorToken, {
      method: 'POST',
    });
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.body.data.status, 'CANCELED');

    // Attempt confirm
    const confirmRes = await authFetch(`/actions/${proposal.proposalId}/confirm`, doctorToken, {
      method: 'POST',
    });
    assert.equal(confirmRes.status, 422);
    assert.ok(confirmRes.body.message.includes('canceled'));

    const tasksCount = await prisma.task.count({
      where: { courseId: COURSE_ID, title: 'Canceled Task' },
    });
    assert.equal(tasksCount, 0);
  });

  // ==========================================================================
  // 6. IDOR SECURITY BOUNDARIES
  // ==========================================================================

  await t.test('6.1 IDOR: User B cannot GET, CONFIRM, or CANCEL User A proposal (404 Closed)', async () => {
    const dueDate = new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString();
    const proposal = await aiActionService.proposeAction(
      doctorActor,
      'CREATE_TASK',
      {
        courseId: COURSE_ID,
        title: 'IDOR Protected Task',
        dueDate,
      },
    );

    // Student attempts to view doctor proposal
    const getRes = await authFetch(`/actions/${proposal.proposalId}`, studentToken);
    assert.equal(getRes.status, 404, 'Must fail closed with 404');

    // Student attempts to confirm doctor proposal
    const confirmRes = await authFetch(`/actions/${proposal.proposalId}/confirm`, studentToken, {
      method: 'POST',
    });
    assert.equal(confirmRes.status, 404, 'Cross-user confirm must fail closed with 404');

    // Student attempts to cancel doctor proposal
    const cancelRes = await authFetch(`/actions/${proposal.proposalId}/cancel`, studentToken, {
      method: 'POST',
    });
    assert.equal(cancelRes.status, 404, 'Cross-user cancel must fail closed with 404');
  });

  // ==========================================================================
  // 7. ZERO REAL PROVIDER CALLS VERIFICATION
  // ==========================================================================

  await t.test('7.1 Zero outbound external requests during test suite', () => {
    assert.equal(externalRequests, 0, 'No outbound external AI provider requests permitted in tests');
  });
});
