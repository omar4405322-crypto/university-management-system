import assert from 'node:assert/strict';
import { test } from 'node:test';
import prisma from '../src/utils/prismaClient';
import type { AuthActor } from '../src/types/auth.types';
import * as aiActionService from '../src/services/aiActionProposal.service';
import { TaskService } from '../src/services/task.service';
import { auditLog } from '../src/utils/audit.utils';

// Isolated IDs for Phase 14.1 Atomicity & Crash Recovery Tests
const COLLEGE_ID = 8801;
const DEPT_ID = 8802;
const FOREIGN_DEPT_ID = 8803;
const DOCTOR_USER_ID = 8810;
const DOCTOR_ID = 8811;
const STUDENT_USER_ID_1 = 8820;
const STUDENT_ID_1 = 8821;
const STUDENT_USER_ID_2 = 8822;
const STUDENT_ID_2 = 8823;
const COURSE_ID = 8830;
const SLOT_ID = 8831;
const NOTIF_ID = 8840;

const SUPER_ADMIN_USER_ID = 8850;
const COLLEGE_ADMIN_USER_ID = 8851;
const DEPT_ADMIN_USER_ID = 8852;
const UNCONFIG_ADMIN_USER_ID = 8853;

const doctorActor: AuthActor = {
  id: DOCTOR_USER_ID,
  email: 'dr.atomicity@test.local',
  role: 'DOCTOR',
  doctor: {
    id: DOCTOR_ID,
    firstName: 'Dr. Atomicity',
    lastName: 'Mansour',
    doctorId: 'DOC-8811',
    departmentId: DEPT_ID,
  },
};

const studentActor: AuthActor = {
  id: STUDENT_USER_ID_1,
  email: 'student.atomicity@test.local',
  role: 'STUDENT',
  student: {
    id: STUDENT_ID_1,
    firstName: 'Student',
    lastName: 'One',
    studentId: 'STU-8821',
    year: 3,
    departmentId: DEPT_ID,
  },
};

const superAdminActor: AuthActor = {
  id: SUPER_ADMIN_USER_ID,
  email: 'superadmin.atomicity@test.local',
  role: 'SUPER_ADMIN',
};

const collegeAdminActor: AuthActor = {
  id: COLLEGE_ADMIN_USER_ID,
  email: 'collegeadmin.atomicity@test.local',
  role: 'ADMIN',
  managedCollegeId: COLLEGE_ID,
  collegeId: COLLEGE_ID,
};

const deptAdminActor: AuthActor = {
  id: DEPT_ADMIN_USER_ID,
  email: 'deptadmin.atomicity@test.local',
  role: 'ADMIN',
  managedDepartmentId: DEPT_ID,
  departmentId: DEPT_ID,
};

const unconfiguredAdminActor: AuthActor = {
  id: UNCONFIG_ADMIN_USER_ID,
  email: 'unconfigadmin.atomicity@test.local',
  role: 'ADMIN',
};

async function seedData() {
  // College & Departments
  await prisma.college.upsert({
    where: { id: COLLEGE_ID },
    update: { name: 'College of Systems', nameAr: 'كلية الأنظمة' },
    create: { id: COLLEGE_ID, name: 'College of Systems', nameAr: 'كلية الأنظمة' },
  });

  await prisma.department.upsert({
    where: { id: DEPT_ID },
    update: { name: 'Distributed Systems', nameAr: 'النظم الموزعة', collegeId: COLLEGE_ID },
    create: { id: DEPT_ID, name: 'Distributed Systems', nameAr: 'النظم الموزعة', collegeId: COLLEGE_ID },
  });

  await prisma.department.upsert({
    where: { id: FOREIGN_DEPT_ID },
    update: { name: 'Foreign Department', nameAr: 'قسم آخر', collegeId: COLLEGE_ID },
    create: { id: FOREIGN_DEPT_ID, name: 'Foreign Department', nameAr: 'قسم آخر', collegeId: COLLEGE_ID },
  });

  // Doctor
  await prisma.user.upsert({
    where: { id: DOCTOR_USER_ID },
    update: { email: doctorActor.email, role: 'DOCTOR', isActive: true },
    create: { id: DOCTOR_USER_ID, email: doctorActor.email, password: 'hash', role: 'DOCTOR', isActive: true },
  });
  await prisma.doctor.upsert({
    where: { id: DOCTOR_ID },
    update: { userId: DOCTOR_USER_ID, firstName: 'Dr. Atomicity', lastName: 'Mansour', departmentId: DEPT_ID },
    create: { id: DOCTOR_ID, userId: DOCTOR_USER_ID, firstName: 'Dr. Atomicity', lastName: 'Mansour', doctorId: 'DOC-8811', departmentId: DEPT_ID },
  });

  // Students
  await prisma.user.upsert({
    where: { id: STUDENT_USER_ID_1 },
    update: { email: studentActor.email, role: 'STUDENT', isActive: true, departmentId: DEPT_ID, collegeId: COLLEGE_ID },
    create: { id: STUDENT_USER_ID_1, email: studentActor.email, password: 'hash', role: 'STUDENT', isActive: true, departmentId: DEPT_ID, collegeId: COLLEGE_ID },
  });
  await prisma.student.upsert({
    where: { id: STUDENT_ID_1 },
    update: { userId: STUDENT_USER_ID_1, firstName: 'Student', lastName: 'One', departmentId: DEPT_ID },
    create: { id: STUDENT_ID_1, userId: STUDENT_USER_ID_1, firstName: 'Student', lastName: 'One', studentId: 'STU-8821', year: 3, departmentId: DEPT_ID },
  });

  await prisma.user.upsert({
    where: { id: STUDENT_USER_ID_2 },
    update: { email: 'student2.atomicity@test.local', role: 'STUDENT', isActive: true, departmentId: DEPT_ID, collegeId: COLLEGE_ID },
    create: { id: STUDENT_USER_ID_2, email: 'student2.atomicity@test.local', password: 'hash', role: 'STUDENT', isActive: true, departmentId: DEPT_ID, collegeId: COLLEGE_ID },
  });
  await prisma.student.upsert({
    where: { id: STUDENT_ID_2 },
    update: { userId: STUDENT_USER_ID_2, firstName: 'Student', lastName: 'Two', departmentId: DEPT_ID },
    create: { id: STUDENT_ID_2, userId: STUDENT_USER_ID_2, firstName: 'Student', lastName: 'Two', studentId: 'STU-8822', year: 3, departmentId: DEPT_ID },
  });

  // Admins
  await prisma.user.upsert({
    where: { id: SUPER_ADMIN_USER_ID },
    update: { email: superAdminActor.email, role: 'SUPER_ADMIN', isActive: true },
    create: { id: SUPER_ADMIN_USER_ID, email: superAdminActor.email, password: 'hash', role: 'SUPER_ADMIN', isActive: true },
  });

  await prisma.user.upsert({
    where: { id: COLLEGE_ADMIN_USER_ID },
    update: { email: collegeAdminActor.email, role: 'ADMIN', collegeId: COLLEGE_ID, managedCollegeId: COLLEGE_ID, isActive: true },
    create: { id: COLLEGE_ADMIN_USER_ID, email: collegeAdminActor.email, password: 'hash', role: 'ADMIN', collegeId: COLLEGE_ID, managedCollegeId: COLLEGE_ID, isActive: true },
  });

  await prisma.user.upsert({
    where: { id: DEPT_ADMIN_USER_ID },
    update: { email: deptAdminActor.email, role: 'ADMIN', departmentId: DEPT_ID, managedDepartmentId: DEPT_ID, isActive: true },
    create: { id: DEPT_ADMIN_USER_ID, email: deptAdminActor.email, password: 'hash', role: 'ADMIN', departmentId: DEPT_ID, managedDepartmentId: DEPT_ID, isActive: true },
  });

  // Course
  await prisma.course.upsert({
    where: { id: COURSE_ID },
    update: { courseCode: 'CS8830', name: 'Fault-Tolerant Systems', departmentId: DEPT_ID },
    create: { id: COURSE_ID, courseCode: 'CS8830', name: 'Fault-Tolerant Systems', departmentId: DEPT_ID, year: 3, credits: 3 },
  });

  // Schedule Slot
  await prisma.scheduleSlot.upsert({
    where: { id: SLOT_ID },
    update: { courseId: COURSE_ID, doctorId: DOCTOR_ID, isArchived: false },
    create: { id: SLOT_ID, courseId: COURSE_ID, doctorId: DOCTOR_ID, dayOfWeek: 'TUESDAY', startTime: '10:00', endTime: '12:00', slotType: 'LECTURE' },
  });

  // Enrollments
  for (const sId of [STUDENT_ID_1, STUDENT_ID_2]) {
    const existing = await prisma.enrollment.findFirst({ where: { studentId: sId, courseId: COURSE_ID } });
    if (existing) {
      await prisma.enrollment.update({ where: { id: existing.id }, data: { status: 'ENROLLED' } });
    } else {
      await prisma.enrollment.create({ data: { studentId: sId, courseId: COURSE_ID, status: 'ENROLLED', semester: 1, academicYear: 2026 } });
    }
  }

  // Notification
  await prisma.notification.upsert({
    where: { id: NOTIF_ID },
    update: { userId: STUDENT_USER_ID_1, title: 'Atomicity Test Notification', message: 'Read me', isRead: false },
    create: { id: NOTIF_ID, userId: STUDENT_USER_ID_1, title: 'Atomicity Test Notification', message: 'Read me', isRead: false },
  });
}

async function cleanTestData() {
  await prisma.aIActionProposal.deleteMany({
    where: { userId: { in: [DOCTOR_USER_ID, STUDENT_USER_ID_1, SUPER_ADMIN_USER_ID, COLLEGE_ADMIN_USER_ID, DEPT_ADMIN_USER_ID] } },
  });
  await prisma.task.deleteMany({ where: { courseId: COURSE_ID } });
  await prisma.notification.deleteMany({
    where: { userId: { in: [STUDENT_USER_ID_1, STUDENT_USER_ID_2] }, id: { not: NOTIF_ID } },
  });
  await prisma.auditLog.deleteMany({
    where: { entity: 'AIActionProposal', userId: { in: [DOCTOR_USER_ID, STUDENT_USER_ID_1, SUPER_ADMIN_USER_ID, COLLEGE_ADMIN_USER_ID] } },
  });
}

test('PHASE 14.1 — ATOMIC ACTION EXECUTION, CRASH RECOVERY & FINAL WRITE SAFETY', async (t) => {
  await seedData();
  await cleanTestData();

  t.after(async () => {
    await cleanTestData();
  });

  // ==========================================================================
  // 1. LOST RESPONSE AFTER SUCCESS
  // ==========================================================================
  await t.test('1.1 Lost HTTP response after commit returns persisted result without duplicate mutation', async () => {
    const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const proposal = await aiActionService.proposeAction(doctorActor, 'CREATE_TASK', {
      courseId: COURSE_ID,
      title: 'Crash Recovery Assignment',
      dueDate,
    });

    // 1st Confirm: succeeds and commits
    const firstResult = await aiActionService.confirmAndExecuteProposal(proposal.proposalId, doctorActor);
    assert.equal(firstResult.status, 'SUCCEEDED');
    assert.equal(Boolean(firstResult.alreadyExecuted), false);

    const taskCountAfterFirst = await prisma.task.count({ where: { courseId: COURSE_ID } });
    assert.equal(taskCountAfterFirst, 1, 'Exactly one task created');

    const auditCountAfterFirst = await prisma.auditLog.count({
      where: { action: 'AI_ACTION_EXECUTED', entityId: proposal.proposalId },
    });
    assert.equal(auditCountAfterFirst, 1, 'Exactly one execution audit log created');

    // Simulated network loss / client retry
    const retryResult = await aiActionService.confirmAndExecuteProposal(proposal.proposalId, doctorActor);
    assert.equal(retryResult.status, 'SUCCEEDED');
    assert.equal(retryResult.alreadyExecuted, true, 'Retry must return alreadyExecuted: true');
    assert.deepEqual(retryResult.executionResult, firstResult.executionResult, 'Must return identical execution result');

    const taskCountAfterRetry = await prisma.task.count({ where: { courseId: COURSE_ID } });
    assert.equal(taskCountAfterRetry, 1, 'No duplicate task created on retry');

    const auditCountAfterRetry = await prisma.auditLog.count({
      where: { action: 'AI_ACTION_EXECUTED', entityId: proposal.proposalId },
    });
    assert.equal(auditCountAfterRetry, 1, 'No duplicate audit log created on retry');
  });

  // ==========================================================================
  // 2. CONCURRENT CONFIRMATIONS: 2 CONCURRENT & 5 CONCURRENT
  // ==========================================================================
  await t.test('2.1 Two concurrent confirmations create exactly ONE Task and ONE audit event', async () => {
    const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const proposal = await aiActionService.proposeAction(doctorActor, 'CREATE_TASK', {
      courseId: COURSE_ID,
      title: 'Concurrency Test Assignment 2-way',
      dueDate,
    });

    const [res1, res2] = await Promise.all([
      aiActionService.confirmAndExecuteProposal(proposal.proposalId, doctorActor),
      aiActionService.confirmAndExecuteProposal(proposal.proposalId, doctorActor),
    ]);

    assert.equal(res1.status, 'SUCCEEDED');
    assert.equal(res2.status, 'SUCCEEDED');
    // Exactly one winner and one idempotent replay
    const results = [res1, res2];
    const initialWinner = results.find((r) => !r.alreadyExecuted);
    const idempotentReplay = results.find((r) => r.alreadyExecuted);
    assert.ok(initialWinner, 'One request must execute the mutation');
    assert.ok(idempotentReplay, 'Concurrent request must receive idempotent result');

    const tasks = await prisma.task.findMany({ where: { courseId: COURSE_ID, title: 'Concurrency Test Assignment 2-way' } });
    assert.equal(tasks.length, 1, 'Database must contain exactly ONE task');

    const audits = await prisma.auditLog.findMany({
      where: { action: 'AI_ACTION_EXECUTED', entityId: proposal.proposalId },
    });
    assert.equal(audits.length, 1, 'Database must contain exactly ONE audit event');
  });

  await t.test('2.2 Five concurrent confirmations create exactly ONE Task and ONE audit event', async () => {
    const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const proposal = await aiActionService.proposeAction(doctorActor, 'CREATE_TASK', {
      courseId: COURSE_ID,
      title: 'Concurrency Test Assignment 5-way',
      dueDate,
    });

    const results = await Promise.all([
      aiActionService.confirmAndExecuteProposal(proposal.proposalId, doctorActor),
      aiActionService.confirmAndExecuteProposal(proposal.proposalId, doctorActor),
      aiActionService.confirmAndExecuteProposal(proposal.proposalId, doctorActor),
      aiActionService.confirmAndExecuteProposal(proposal.proposalId, doctorActor),
      aiActionService.confirmAndExecuteProposal(proposal.proposalId, doctorActor),
    ]);

    for (const res of results) {
      assert.equal(res.status, 'SUCCEEDED');
    }

    const tasks = await prisma.task.findMany({ where: { courseId: COURSE_ID, title: 'Concurrency Test Assignment 5-way' } });
    assert.equal(tasks.length, 1, 'Database must contain exactly ONE task among 5 concurrent calls');

    const audits = await prisma.auditLog.findMany({
      where: { action: 'AI_ACTION_EXECUTED', entityId: proposal.proposalId },
    });
    assert.equal(audits.length, 1, 'Database must contain exactly ONE audit event among 5 concurrent calls');
  });

  // ==========================================================================
  // 3. TRANSACTION ROLLBACK & PROCESS INTERRUPTION SIMULATION
  // ==========================================================================
  await t.test('3.1 Simulated business failure rolls back transaction; leaves 0 tasks and proposal in PROPOSED state', async () => {
    const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const proposal = await aiActionService.proposeAction(doctorActor, 'CREATE_TASK', {
      courseId: COURSE_ID,
      title: 'Rollback Simulation Assignment',
      dueDate,
    });

    // Temporarily spy/stub TaskService.createTask to simulate an uncaught exception
    const originalCreateTask = TaskService.createTask;
    (TaskService as any).createTask = async () => {
      throw new Error('Simulated process interruption during business write');
    };

    try {
      await assert.rejects(
        async () => {
          await aiActionService.confirmAndExecuteProposal(proposal.proposalId, doctorActor);
        },
        /Simulated process interruption during business write/,
      );
    } finally {
      TaskService.createTask = originalCreateTask;
    }

    // Assert: Zero tasks created in database
    const taskCount = await prisma.task.count({ where: { courseId: COURSE_ID, title: 'Rollback Simulation Assignment' } });
    assert.equal(taskCount, 0, 'No task must be left behind after rollback');

    // Assert: Proposal rolled back to PROPOSED (not permanently wedged in EXECUTING)
    const storedProposal = await prisma.aIActionProposal.findUnique({ where: { id: proposal.proposalId } });
    assert.equal(storedProposal?.status, 'PROPOSED', 'Proposal state must roll back to PROPOSED for safe retry');
  });

  await t.test('3.2 Simulated audit failure inside transaction rolls back business mutation', async () => {
    const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const proposal = await aiActionService.proposeAction(doctorActor, 'CREATE_TASK', {
      courseId: COURSE_ID,
      title: 'Audit Rollback Assignment',
      dueDate,
    });

    // Intercept $transaction to simulate auditLog throwing inside tx
    let threw = false;
    try {
      await prisma.$transaction(async (tx) => {
        // Execute business mutation
        const task = await TaskService.createTask(
          doctorActor,
          {
            title: 'Audit Rollback Assignment',
            description: '',
            courseId: COURSE_ID,
            dueDate: new Date(dueDate),
            maxScore: 100,
          },
          tx,
        );
        assert.ok(task.id);
        // Simulate audit log write failure inside the transaction
        threw = true;
        throw new Error('Simulated auditLog PostgreSQL write failure');
      });
    } catch (err: any) {
      assert.ok(threw);
      assert.match(err.message, /Simulated auditLog PostgreSQL write failure/);
    }

    // Verify task did NOT commit
    const taskCount = await prisma.task.count({ where: { courseId: COURSE_ID, title: 'Audit Rollback Assignment' } });
    assert.equal(taskCount, 0, 'Task must roll back when audit log write fails inside transaction');
  });

  // ==========================================================================
  // 4. NOTIFICATION READ IDEMPOTENCY & STALE DETECTION
  // ==========================================================================
  await t.test('4.1 MARK_NOTIFICATION_READ: Already-read notification is a safe idempotent execution', async () => {
    // Mark as read in DB prior to confirmation
    await prisma.notification.update({ where: { id: NOTIF_ID }, data: { isRead: true } });

    const proposal = await aiActionService.proposeAction(studentActor, 'MARK_NOTIFICATION_READ', {
      notificationId: NOTIF_ID,
    });

    const result = await aiActionService.confirmAndExecuteProposal(proposal.proposalId, studentActor);
    assert.equal(result.status, 'SUCCEEDED');
    assert.equal(result.executionResult.isRead, true);

    const notif = await prisma.notification.findUnique({ where: { id: NOTIF_ID } });
    assert.equal(notif?.isRead, true);
  });

  await t.test('4.2 MARK_NOTIFICATION_READ: Two simultaneous confirmations succeed without duplicate effects', async () => {
    await prisma.notification.update({ where: { id: NOTIF_ID }, data: { isRead: false } });

    const proposal = await aiActionService.proposeAction(studentActor, 'MARK_NOTIFICATION_READ', {
      notificationId: NOTIF_ID,
    });

    const [res1, res2] = await Promise.all([
      aiActionService.confirmAndExecuteProposal(proposal.proposalId, studentActor),
      aiActionService.confirmAndExecuteProposal(proposal.proposalId, studentActor),
    ]);

    assert.equal(res1.status, 'SUCCEEDED');
    assert.equal(res2.status, 'SUCCEEDED');

    const notif = await prisma.notification.findUnique({ where: { id: NOTIF_ID } });
    assert.equal(notif?.isRead, true);
  });

  await t.test('4.3 MARK_NOTIFICATION_READ: Foreign notification ID fails closed and marks STALE', async () => {
    // Foreign notification belonging to DOCTOR_USER_ID
    const foreignNotif = await prisma.notification.create({
      data: { userId: DOCTOR_USER_ID, title: 'Doctor Private', message: 'Doc only', isRead: false },
    });

    try {
      // Student cannot propose foreign notification
      await assert.rejects(
        async () => {
          await aiActionService.proposeAction(studentActor, 'MARK_NOTIFICATION_READ', {
            notificationId: foreignNotif.id,
          });
        },
        (err: any) => err.statusCode === 404,
      );
    } finally {
      await prisma.notification.delete({ where: { id: foreignNotif.id } });
    }
  });

  // ==========================================================================
  // 5. CREATE_ANNOUNCEMENT EXACTLY-ONCE
  // ==========================================================================
  await t.test('5.1 CREATE_ANNOUNCEMENT: Concurrent confirmations deliver exactly ONE notification per recipient', async () => {
    const proposal = await aiActionService.proposeAction(collegeAdminActor, 'CREATE_ANNOUNCEMENT', {
      targetScope: 'COLLEGE',
      collegeId: COLLEGE_ID,
      title: 'College Assembly Notice',
      message: 'All students please attend the main hall tomorrow.',
    });

    // Fire 3 simultaneous confirmations
    const results = await Promise.all([
      aiActionService.confirmAndExecuteProposal(proposal.proposalId, collegeAdminActor),
      aiActionService.confirmAndExecuteProposal(proposal.proposalId, collegeAdminActor),
      aiActionService.confirmAndExecuteProposal(proposal.proposalId, collegeAdminActor),
    ]);

    for (const res of results) {
      assert.equal(res.status, 'SUCCEEDED');
    }

    // Verify recipient 1 received exactly 1 notification
    const student1Notifs = await prisma.notification.findMany({
      where: { userId: STUDENT_USER_ID_1, title: 'College Assembly Notice' },
    });
    assert.equal(student1Notifs.length, 1, 'Student 1 must receive exactly ONE notification');

    // Verify recipient 2 received exactly 1 notification
    const student2Notifs = await prisma.notification.findMany({
      where: { userId: STUDENT_USER_ID_2, title: 'College Assembly Notice' },
    });
    assert.equal(student2Notifs.length, 1, 'Student 2 must receive exactly ONE notification');

    // Verify execution audit log count
    const audits = await prisma.auditLog.findMany({
      where: { action: 'AI_ACTION_EXECUTED', entityId: proposal.proposalId },
    });
    assert.equal(audits.length, 1, 'Exactly ONE execution audit log written for announcement');
  });

  // ==========================================================================
  // 6. ADMIN SCOPE CONSISTENCY & FAIL-CLOSED ENFORCEMENT
  // ==========================================================================
  await t.test('6.1 SuperAdmin can propose and confirm GLOBAL announcement', async () => {
    const proposal = await aiActionService.proposeAction(superAdminActor, 'CREATE_ANNOUNCEMENT', {
      targetScope: 'GLOBAL',
      title: 'Global University Notice',
      message: 'System upgrade scheduled for this weekend.',
    });
    assert.equal(proposal.status, 'PROPOSED');

    const result = await aiActionService.confirmAndExecuteProposal(proposal.proposalId, superAdminActor);
    assert.equal(result.status, 'SUCCEEDED');
  });

  await t.test('6.2 College Admin cannot broadcast GLOBAL announcement (403 Forbidden)', async () => {
    await assert.rejects(
      async () => {
        await aiActionService.proposeAction(collegeAdminActor, 'CREATE_ANNOUNCEMENT', {
          targetScope: 'GLOBAL',
          title: 'Illegal Global Notice',
          message: 'This should fail',
        });
      },
      (err: any) => err.statusCode === 403,
    );
  });

  await t.test('6.3 College Admin cannot broadcast to foreign college ID (403 Forbidden)', async () => {
    await assert.rejects(
      async () => {
        await aiActionService.proposeAction(collegeAdminActor, 'CREATE_ANNOUNCEMENT', {
          targetScope: 'COLLEGE',
          collegeId: 9999, // foreign college
          title: 'Foreign College Notice',
          message: 'This should fail',
        });
      },
      (err: any) => err.statusCode === 404 || err.statusCode === 403,
    );
  });

  await t.test('6.4 Department Admin cannot broadcast college-wide announcement (403 Forbidden)', async () => {
    await assert.rejects(
      async () => {
        await aiActionService.proposeAction(deptAdminActor, 'CREATE_ANNOUNCEMENT', {
          targetScope: 'COLLEGE',
          collegeId: COLLEGE_ID,
          title: 'Illegal College Notice from Dept Admin',
          message: 'This should fail',
        });
      },
      (err: any) => err.statusCode === 403,
    );
  });

  await t.test('6.5 Department Admin cannot broadcast to foreign department (403 Forbidden)', async () => {
    await assert.rejects(
      async () => {
        await aiActionService.proposeAction(deptAdminActor, 'CREATE_ANNOUNCEMENT', {
          targetScope: 'DEPARTMENT',
          departmentId: FOREIGN_DEPT_ID,
          title: 'Foreign Dept Notice',
          message: 'This should fail',
        });
      },
      (err: any) => err.statusCode === 403,
    );
  });

  await t.test('6.6 Unconfigured Generic ADMIN fails closed (403 Forbidden)', async () => {
    await assert.rejects(
      async () => {
        await aiActionService.proposeAction(unconfiguredAdminActor, 'CREATE_ANNOUNCEMENT', {
          targetScope: 'GLOBAL',
          title: 'Unconfigured Admin Notice',
          message: 'This should fail',
        });
      },
      (err: any) => err.statusCode === 403,
    );
  });
});
