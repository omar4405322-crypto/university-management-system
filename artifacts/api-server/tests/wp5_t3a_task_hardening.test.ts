import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import prisma from '../src/utils/prismaClient';
import { TaskService } from '../src/services/task.service';
import { TaskMutationsService } from '../src/services/task/taskMutations.service';
import { TaskGradingService } from '../src/services/task/taskGrading.service';
import { isTaskPastDue } from '../src/utils/taskDeadline.utils';
import { ConflictError, ValidationError } from '../src/utils/appError';
import type { AuthActor } from '../src/types/auth.types';

// User creation helper: prisma.user.create with crypto.randomUUID() for password
function createRandomPassword(): string {
  return crypto.randomUUID();
}

async function createTestFixture(suffix: string) {
  const college = await prisma.college.create({
    data: { name: `Col_${suffix}` },
  });

  const department = await prisma.department.create({
    data: { name: `Dept_${suffix}`, collegeId: college.id },
  });

  const doctorUser = await prisma.user.create({
    data: {
      email: `doctor_${suffix}@example.test`,
      password: createRandomPassword(),
      role: 'DOCTOR',
      tokenVersion: 0,
      isActive: true,
    },
  });

  const doctor = await prisma.doctor.create({
    data: {
      userId: doctorUser.id,
      firstName: 'TestDoc',
      lastName: suffix,
      departmentId: department.id,
    },
  });

  const course = await prisma.course.create({
    data: {
      name: `Course_${suffix}`,
      courseCode: `C_${suffix.slice(0, 10).toUpperCase()}`,
      credits: 3,
      departmentId: department.id,
    },
  });

  const studentUser = await prisma.user.create({
    data: {
      email: `student_${suffix}@example.test`,
      password: createRandomPassword(),
      role: 'STUDENT',
      tokenVersion: 0,
      isActive: true,
    },
  });

  const student = await prisma.student.create({
    data: {
      userId: studentUser.id,
      firstName: 'TestStu',
      lastName: suffix,
      studentId: `S_${suffix.slice(0, 8)}`,
      year: 2,
      departmentId: department.id,
    },
  });

  const enrollment = await prisma.enrollment.create({
    data: {
      studentId: student.id,
      courseId: course.id,
      academicYear: 2026,
      semester: 1,
      status: 'ENROLLED',
    },
  });

  const slot = await prisma.scheduleSlot.create({
    data: {
      courseId: course.id,
      doctorId: doctor.id,
      dayOfWeek: 'Monday',
      startTime: '09:00',
      endTime: '10:00',
      slotType: 'LECTURE',
    },
  });

  const doctorActor: AuthActor = {
    id: doctorUser.id,
    email: doctorUser.email,
    role: 'DOCTOR',
    tokenVersion: 0,
    doctor: {
      id: doctor.id,
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      doctorId: String(doctor.id),
      departmentId: department.id,
    },
  };

  const studentActor: AuthActor = {
    id: studentUser.id,
    email: studentUser.email,
    role: 'STUDENT',
    tokenVersion: 0,
    student: {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      studentId: student.studentId,
      year: student.year,
      departmentId: department.id,
    },
  };

  return {
    college,
    department,
    doctorUser,
    doctor,
    course,
    studentUser,
    student,
    enrollment,
    slot,
    doctorActor,
    studentActor,
  };
}

async function cleanupFixture(ids: {
  submissionIds?: number[];
  taskIds?: number[];
  slotIds?: number[];
  enrollmentIds?: number[];
  studentIds?: number[];
  doctorIds?: number[];
  courseIds?: number[];
  userIds?: number[];
  departmentIds?: number[];
  collegeIds?: number[];
  auditLogIds?: number[];
}) {
  if (ids.submissionIds?.length) {
    await prisma.taskSubmission.deleteMany({ where: { id: { in: ids.submissionIds } } }).catch(() => {});
  }
  if (ids.taskIds?.length) {
    await prisma.taskSubmission.deleteMany({ where: { taskId: { in: ids.taskIds } } }).catch(() => {});
    await prisma.task.deleteMany({ where: { id: { in: ids.taskIds } } }).catch(() => {});
  }
  if (ids.doctorIds?.length) {
    await prisma.taskSubmission.deleteMany({ where: { task: { doctorId: { in: ids.doctorIds } } } }).catch(() => {});
    await prisma.task.deleteMany({ where: { doctorId: { in: ids.doctorIds } } }).catch(() => {});
  }
  if (ids.slotIds?.length) {
    await prisma.scheduleSlot.deleteMany({ where: { id: { in: ids.slotIds } } }).catch(() => {});
  }
  if (ids.enrollmentIds?.length) {
    await prisma.enrollment.deleteMany({ where: { id: { in: ids.enrollmentIds } } }).catch(() => {});
  }
  if (ids.studentIds?.length) {
    await prisma.student.deleteMany({ where: { id: { in: ids.studentIds } } }).catch(() => {});
  }
  if (ids.doctorIds?.length) {
    await prisma.scheduleSlot.deleteMany({ where: { doctorId: { in: ids.doctorIds } } }).catch(() => {});
    await prisma.doctor.deleteMany({ where: { id: { in: ids.doctorIds } } }).catch(() => {});
  }
  if (ids.courseIds?.length) {
    await prisma.course.deleteMany({ where: { id: { in: ids.courseIds } } }).catch(() => {});
  }
  if (ids.auditLogIds?.length) {
    await prisma.auditLog.deleteMany({ where: { id: { in: ids.auditLogIds } } }).catch(() => {});
  }
  if (ids.userIds?.length) {
    await prisma.auditLog.deleteMany({ where: { userId: { in: ids.userIds } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: ids.userIds } } }).catch(() => {});
  }
  if (ids.departmentIds?.length) {
    await prisma.department.deleteMany({ where: { id: { in: ids.departmentIds } } }).catch(() => {});
  }
  if (ids.collegeIds?.length) {
    await prisma.college.deleteMany({ where: { id: { in: ids.collegeIds } } }).catch(() => {});
  }
}

// ---------------------------------------------------------------------
// ITEM A: Pure function + First-time submit after dueDate must be 409
// ---------------------------------------------------------------------
test('ITEM A (pure function): isTaskPastDue evaluates injected instants without timezone shifting', () => {
  const dueInstant = new Date('2026-05-01T12:00:00.000Z').getTime();
  assert.equal(isTaskPastDue(new Date(dueInstant), dueInstant - 1000), false, 'now = due - 1s must be false');
  assert.equal(isTaskPastDue(new Date(dueInstant), dueInstant), false, 'now = due must be false');
  assert.equal(isTaskPastDue(new Date(dueInstant), dueInstant + 1000), true, 'now = due + 1s must be true');

  // Variations
  assert.equal(isTaskPastDue(new Date(dueInstant).toISOString(), dueInstant + 1000), true);
  assert.equal(isTaskPastDue(null, dueInstant + 1000), false);
  assert.equal(isTaskPastDue(undefined, dueInstant + 1000), false);
});
test('ITEM A: First-time submit after dueDate must throw 409 ConflictError and write nothing', async () => {
  const suffix = `ia_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const fx = await createTestFixture(suffix);

  const pastTask = await prisma.task.create({
    data: {
      title: 'Past Task',
      description: 'Due in 2020',
      courseId: fx.course.id,
      doctorId: fx.doctor.id,
      academicYear: 2026,
      semester: 1,
      dueDate: new Date('2020-01-01T00:00:00.000Z'),
      maxScore: 100,
    },
  });

  const futureTask = await prisma.task.create({
    data: {
      title: 'Future Task',
      description: 'Due in 2099',
      courseId: fx.course.id,
      doctorId: fx.doctor.id,
      academicYear: 2026,
      semester: 1,
      dueDate: new Date('2099-01-01T00:00:00.000Z'),
      maxScore: 100,
    },
  });

  try {
    // Attempt first-time submission on past task
    await assert.rejects(
      async () => {
        await TaskGradingService.submitTask(
          fx.studentActor,
          pastTask.id,
          { notes: 'Submitted late for first time' }
        );
      },
      (err: any) => {
        assert.ok(err instanceof ConflictError, `Expected ConflictError (409), got ${err?.constructor?.name}`);
        assert.equal(err.statusCode, 409);
        return true;
      },
      'First-time submit after dueDate must be 409 ConflictError'
    );

    // Verify nothing written
    const pastCount = await prisma.taskSubmission.count({ where: { taskId: pastTask.id } });
    assert.equal(pastCount, 0, 'Nothing should be written to database for past task');

    // First submit on future task must succeed
    const futureSub = await TaskGradingService.submitTask(
      fx.studentActor,
      futureTask.id,
      { notes: 'Submitted on time for first time' }
    );
    assert.ok(futureSub, 'First submit on future task must succeed');
  } finally {
    await cleanupFixture({
      taskIds: [pastTask.id, futureTask.id],
      slotIds: [fx.slot.id],
      enrollmentIds: [fx.enrollment.id],
      studentIds: [fx.student.id],
      doctorIds: [fx.doctor.id],
      courseIds: [fx.course.id],
      userIds: [fx.doctorUser.id, fx.studentUser.id],
      departmentIds: [fx.department.id],
      collegeIds: [fx.college.id],
    });
  }
});

// ---------------------------------------------------------------------
// ITEM B: Resubmit after grading: non-null score -> 409, score/feedback not cleared
// ---------------------------------------------------------------------
test('ITEM B: Resubmit after grading must throw 409 ConflictError and preserve score/feedback', async () => {
  const suffix = `ib_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const fx = await createTestFixture(suffix);

  const futureTask = await prisma.task.create({
    data: {
      title: 'Graded Resubmit Task',
      description: 'Due in 2099',
      courseId: fx.course.id,
      doctorId: fx.doctor.id,
      academicYear: 2026,
      semester: 1,
      dueDate: new Date('2099-01-01T00:00:00.000Z'),
      maxScore: 100,
    },
  });

  try {
    // 1. Initial submission
    const initialSub = await TaskGradingService.submitTask(
      fx.studentActor,
      futureTask.id,
      { notes: 'First submission before grading' }
    );
    const subId = (initialSub as any).id;

    // 2. Grade submission
    await TaskGradingService.gradeSubmission(
      fx.doctorActor,
      futureTask.id,
      subId,
      95,
      'Excellent initial work',
      (initialSub as any).submittedAt
    );

    // Verify it is graded
    const graded = await prisma.taskSubmission.findUnique({ where: { id: subId } });
    assert.equal(graded?.score, 95);
    assert.equal(graded?.feedback, 'Excellent initial work');

    // 3. Resubmit after grading before 2099 due date -> must be 409
    await assert.rejects(
      async () => {
        await TaskGradingService.submitTask(
          fx.studentActor,
          futureTask.id,
          { notes: 'Attempting to erase my grade' }
        );
      },
      (err: any) => {
        assert.ok(err instanceof ConflictError, `Expected ConflictError (409), got ${err?.constructor?.name}`);
        assert.equal(err.statusCode, 409);
        return true;
      },
      'Resubmit after grading must be 409 ConflictError'
    );

    // Verify score and feedback are NOT cleared
    const postResubmit = await prisma.taskSubmission.findUnique({ where: { id: subId } });
    assert.equal(postResubmit?.score, 95, 'Score must not be cleared');
    assert.equal(postResubmit?.feedback, 'Excellent initial work', 'Feedback must not be cleared');
  } finally {
    await cleanupFixture({
      taskIds: [futureTask.id],
      slotIds: [fx.slot.id],
      enrollmentIds: [fx.enrollment.id],
      studentIds: [fx.student.id],
      doctorIds: [fx.doctor.id],
      courseIds: [fx.course.id],
      userIds: [fx.doctorUser.id, fx.studentUser.id],
      departmentIds: [fx.department.id],
      collegeIds: [fx.college.id],
    });
  }
});

// ---------------------------------------------------------------------
// ITEM C: Blank submission = 422; fileUrl must be https only (reject http:)
// ---------------------------------------------------------------------
test('ITEM C: Blank submission rejected with 422; http fileUrl rejected with 422', async () => {
  const suffix = `ic_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const fx = await createTestFixture(suffix);

  const futureTask = await prisma.task.create({
    data: {
      title: 'Validation Task',
      description: 'Due in 2099',
      courseId: fx.course.id,
      doctorId: fx.doctor.id,
      academicYear: 2026,
      semester: 1,
      dueDate: new Date('2099-01-01T00:00:00.000Z'),
      maxScore: 100,
    },
  });

  try {
    // 1. Blank submission (no fileUrl, empty notes) -> 422
    await assert.rejects(
      async () => {
        await TaskGradingService.submitTask(
          fx.studentActor,
          futureTask.id,
          { notes: '   ', fileUrl: '' }
        );
      },
      (err: any) => {
        assert.ok(err instanceof ValidationError, `Expected ValidationError (422), got ${err?.constructor?.name}`);
        assert.equal(err.statusCode, 422);
        return true;
      },
      'Blank submission must be 422 ValidationError'
    );

    // 2. Reject http: fileUrl -> 422
    await assert.rejects(
      async () => {
        await TaskGradingService.submitTask(
          fx.studentActor,
          futureTask.id,
          { fileUrl: 'http://drive.google.com/file/d/test12345' }
        );
      },
      (err: any) => {
        assert.ok(err instanceof ValidationError, `Expected ValidationError (422), got ${err?.constructor?.name}`);
        assert.equal(err.statusCode, 422);
        return true;
      },
      'http fileUrl must be rejected with 422 ValidationError'
    );

    // 3. Valid https: submission -> OK
    const validSub = await TaskGradingService.submitTask(
      fx.studentActor,
      futureTask.id,
      { fileUrl: 'https://drive.google.com/file/d/test12345' }
    );
    assert.ok(validSub, 'Valid https submission must succeed');
  } finally {
    await cleanupFixture({
      taskIds: [futureTask.id],
      slotIds: [fx.slot.id],
      enrollmentIds: [fx.enrollment.id],
      studentIds: [fx.student.id],
      doctorIds: [fx.doctor.id],
      courseIds: [fx.course.id],
      userIds: [fx.doctorUser.id, fx.studentUser.id],
      departmentIds: [fx.department.id],
      collegeIds: [fx.college.id],
    });
  }
});

// ---------------------------------------------------------------------
// ITEM D: Input guards on Task.title, description, notes, feedback
// ---------------------------------------------------------------------
test('ITEM D: Input guards reject markup, dangerous URIs, control chars, ceiling overflows with 422', async () => {
  const suffix = `id_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const fx = await createTestFixture(suffix);

  let createdTaskId: number | undefined;

  try {
    // 1. Task.title with markup start <script> -> 422
    await assert.rejects(
      async () => {
        await TaskMutationsService.createTask(fx.doctorActor, {
          title: '<script>alert("xss")</script>',
          description: 'Valid description',
          courseId: fx.course.id,
          dueDate: new Date('2099-01-01T00:00:00.000Z'),
          maxScore: 100,
        });
      },
      (err: any) => {
        assert.ok(err instanceof ValidationError, `Expected ValidationError (422), got ${err?.constructor?.name}`);
        assert.equal(err.statusCode, 422);
        return true;
      },
      'Task.title with markup must be rejected with 422'
    );

    // 2. Task.title exceeding 255 chars -> 422
    await assert.rejects(
      async () => {
        await TaskMutationsService.createTask(fx.doctorActor, {
          title: 'A'.repeat(256),
          description: 'Valid description',
          courseId: fx.course.id,
          dueDate: new Date('2099-01-01T00:00:00.000Z'),
          maxScore: 100,
        });
      },
      (err: any) => {
        assert.ok(err instanceof ValidationError, `Expected ValidationError (422), got ${err?.constructor?.name}`);
        assert.equal(err.statusCode, 422);
        return true;
      },
      'Task.title exceeding ceiling must be rejected with 422'
    );

    // 3. Task.description with data:text/html -> 422
    await assert.rejects(
      async () => {
        await TaskMutationsService.createTask(fx.doctorActor, {
          title: 'Valid Title',
          description: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
          courseId: fx.course.id,
          dueDate: new Date('2099-01-01T00:00:00.000Z'),
          maxScore: 100,
        });
      },
      (err: any) => {
        assert.ok(err instanceof ValidationError, `Expected ValidationError (422), got ${err?.constructor?.name}`);
        assert.equal(err.statusCode, 422);
        return true;
      },
      'Task.description with dangerous URI must be rejected with 422'
    );

    // 4. Create valid task
    const task = await TaskMutationsService.createTask(fx.doctorActor, {
      title: 'Valid Task Title',
      description: 'Valid Task Description',
      courseId: fx.course.id,
      dueDate: new Date('2099-01-01T00:00:00.000Z'),
      maxScore: 100,
    });
    createdTaskId = task.id;

    // 5. Update task: update maxScore without title/description -> succeeds (validate only fields sent)
    const updated = await TaskMutationsService.updateTask(fx.doctorActor, task.id, {
      maxScore: 80,
    });
    assert.equal(updated.maxScore, 80);

    // 6. Update task with control chars in title -> 422
    await assert.rejects(
      async () => {
        await TaskMutationsService.updateTask(fx.doctorActor, task.id, {
          title: 'Bad\x00Title',
        });
      },
      (err: any) => {
        assert.ok(err instanceof ValidationError, `Expected ValidationError (422), got ${err?.constructor?.name}`);
        assert.equal(err.statusCode, 422);
        return true;
      },
      'Update task with control char must be rejected with 422'
    );

    // 7. TaskSubmission.notes with markup -> 422
    await assert.rejects(
      async () => {
        await TaskGradingService.submitTask(fx.studentActor, task.id, {
          notes: '<img src=x onerror=alert(1)>',
        });
      },
      (err: any) => {
        assert.ok(err instanceof ValidationError, `Expected ValidationError (422), got ${err?.constructor?.name}`);
        assert.equal(err.statusCode, 422);
        return true;
      },
      'Submission notes with markup must be rejected with 422'
    );

    // Submit valid
    const validSub = await TaskGradingService.submitTask(fx.studentActor, task.id, {
      notes: 'Clean student notes',
    });

    // 8. TaskSubmission feedback with javascript: -> 422
    await assert.rejects(
      async () => {
        await TaskGradingService.gradeSubmission(
          fx.doctorActor,
          task.id,
          (validSub as any).id,
          75,
          'javascript:alert(document.cookie)',
          (validSub as any).submittedAt
        );
      },
      (err: any) => {
        assert.ok(err instanceof ValidationError, `Expected ValidationError (422), got ${err?.constructor?.name}`);
        assert.equal(err.statusCode, 422);
        return true;
      },
      'Grade feedback with javascript URI must be rejected with 422'
    );
  } finally {
    await cleanupFixture({
      taskIds: createdTaskId ? [createdTaskId] : [],
      slotIds: [fx.slot.id],
      enrollmentIds: [fx.enrollment.id],
      studentIds: [fx.student.id],
      doctorIds: [fx.doctor.id],
      courseIds: [fx.course.id],
      userIds: [fx.doctorUser.id, fx.studentUser.id],
      departmentIds: [fx.department.id],
      collegeIds: [fx.college.id],
    });
  }
});

// ---------------------------------------------------------------------
// ITEM E: Audit logs populated for CREATE_TASK, UPDATE_TASK, DELETE_TASK
// ---------------------------------------------------------------------
test('ITEM E: CREATE_TASK, UPDATE_TASK, DELETE_TASK create AuditLog rows with actorEmail and details', async () => {
  const suffix = `ie_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const fx = await createTestFixture(suffix);

  const mockReqSource = {
    user: { id: fx.doctorUser.id, email: fx.doctorUser.email, role: fx.doctorUser.role },
    ip: '127.0.0.1',
  };

  let taskId: number | undefined;

  try {
    // 1. CREATE_TASK
    const task = await TaskMutationsService.createTask(
      fx.doctorActor,
      {
        title: 'Audit Test Task',
        description: 'Audit Test Desc',
        courseId: fx.course.id,
        dueDate: new Date('2099-01-01T00:00:00.000Z'),
        maxScore: 100,
      },
      undefined,
      mockReqSource
    );
    taskId = task.id;

    const createAudit = await prisma.auditLog.findFirst({
      where: { action: 'CREATE_TASK', entityId: String(task.id) },
    });
    assert.ok(createAudit, 'CREATE_TASK audit log must exist');
    assert.equal(createAudit.actorEmail, fx.doctorUser.email, 'actorEmail must match doctor email');
    assert.ok(createAudit.details, 'details must be non-null');

    // 2. UPDATE_TASK
    await TaskMutationsService.updateTask(
      fx.doctorActor,
      task.id,
      { title: 'Updated Audit Title' },
      mockReqSource
    );

    const updateAudit = await prisma.auditLog.findFirst({
      where: { action: 'UPDATE_TASK', entityId: String(task.id) },
    });
    assert.ok(updateAudit, 'UPDATE_TASK audit log must exist');
    assert.equal(updateAudit.actorEmail, fx.doctorUser.email, 'actorEmail must match doctor email');
    assert.ok(updateAudit.details, 'details must be non-null');

    // 3. DELETE_TASK (soft)
    await TaskMutationsService.deleteTask(
      fx.doctorActor,
      task.id,
      false,
      mockReqSource
    );

    const softDeleteAudit = await prisma.auditLog.findFirst({
      where: { action: 'DELETE_TASK', entityId: String(task.id) },
    });
    assert.ok(softDeleteAudit, 'DELETE_TASK soft audit log must exist');
    assert.equal(softDeleteAudit.actorEmail, fx.doctorUser.email, 'actorEmail must match doctor email');
    assert.ok(softDeleteAudit.details, 'details must be non-null');
    assert.equal((softDeleteAudit.details as any)?.force, false, 'details.force must be false');

    // 4. DELETE_TASK (force)
    const task2 = await TaskMutationsService.createTask(
      fx.doctorActor,
      {
        title: 'Task to hard delete',
        description: 'Desc',
        courseId: fx.course.id,
        dueDate: new Date('2099-01-01T00:00:00.000Z'),
        maxScore: 100,
      },
      undefined,
      mockReqSource
    );

    await TaskMutationsService.deleteTask(
      fx.doctorActor,
      task2.id,
      true,
      mockReqSource
    );

    const hardDeleteAudit = await prisma.auditLog.findFirst({
      where: { action: 'DELETE_TASK', entityId: String(task2.id) },
    });
    assert.ok(hardDeleteAudit, 'DELETE_TASK hard audit log must exist');
    assert.equal(hardDeleteAudit.actorEmail, fx.doctorUser.email, 'actorEmail must match doctor email');
    assert.ok(hardDeleteAudit.details, 'details must be non-null');
    assert.equal((hardDeleteAudit.details as any)?.force, true, 'details.force must be true');
  } finally {
    await cleanupFixture({
      taskIds: taskId ? [taskId] : [],
      slotIds: [fx.slot.id],
      enrollmentIds: [fx.enrollment.id],
      studentIds: [fx.student.id],
      doctorIds: [fx.doctor.id],
      courseIds: [fx.course.id],
      userIds: [fx.doctorUser.id, fx.studentUser.id],
      departmentIds: [fx.department.id],
      collegeIds: [fx.college.id],
    });
  }
});

// ---------------------------------------------------------------------
// ITEM F: M-253 proof: grade with exact submittedAt ISO string vs stale
// ---------------------------------------------------------------------
test('ITEM F: M-253 backend proof: exact submittedAt ISO string -> 200, stale value -> 409', async () => {
  const suffix = `if_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const fx = await createTestFixture(suffix);

  const futureTask = await prisma.task.create({
    data: {
      title: 'M253 Task',
      description: 'M253 Desc',
      courseId: fx.course.id,
      doctorId: fx.doctor.id,
      academicYear: 2026,
      semester: 1,
      dueDate: new Date('2099-01-01T00:00:00.000Z'),
      maxScore: 100,
    },
  });

  try {
    const submission = await TaskGradingService.submitTask(
      fx.studentActor,
      futureTask.id,
      { notes: 'Original submission for M253' }
    );
    const subId = (submission as any).id;

    // Fetch via getTaskSubmissions (simulating GET submissions API)
    const listResult = await TaskService.getTaskSubmissions(fx.doctorActor, futureTask.id);
    const listedSub = listResult.rows.map((r: any) => r.submission).find((s: any) => s?.id === subId);
    assert.ok(listedSub, 'Submission must be found in GET submissions');

    // Convert to ISO string as returned over HTTP JSON API
    const exactSubmittedAtISO = new Date(listedSub.submittedAt).toISOString();

    // 1. Stale submittedAt ISO (e.g. 1 second earlier) -> must throw 409 ConflictError
    const staleSubmittedAtISO = new Date(new Date(exactSubmittedAtISO).getTime() - 1000).toISOString();
    await assert.rejects(
      async () => {
        await TaskGradingService.gradeSubmission(
          fx.doctorActor,
          futureTask.id,
          subId,
          88,
          'Grading with stale revision',
          staleSubmittedAtISO
        );
      },
      (err: any) => {
        assert.ok(err instanceof ConflictError, `Expected ConflictError (409), got ${err?.constructor?.name}`);
        assert.equal(err.statusCode, 409);
        return true;
      },
      'Grade with stale submittedAt revision must throw 409 ConflictError'
    );

    // 2. Exact submittedAt ISO string -> must succeed (200)
    const graded = await TaskGradingService.gradeSubmission(
      fx.doctorActor,
      futureTask.id,
      subId,
      88,
      'Grading with exact revision',
      exactSubmittedAtISO
    );
    assert.equal(graded.score, 88);
    assert.equal(graded.feedback, 'Grading with exact revision');
  } finally {
    await cleanupFixture({
      taskIds: [futureTask.id],
      slotIds: [fx.slot.id],
      enrollmentIds: [fx.enrollment.id],
      studentIds: [fx.student.id],
      doctorIds: [fx.doctor.id],
      courseIds: [fx.course.id],
      userIds: [fx.doctorUser.id, fx.studentUser.id],
      departmentIds: [fx.department.id],
      collegeIds: [fx.college.id],
    });
  }
});
