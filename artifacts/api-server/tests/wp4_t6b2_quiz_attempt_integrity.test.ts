import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import prisma from '../src/utils/prismaClient';
import app from '../src/app';
import { generateAccessToken } from '../src/utils/jwt.utils';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { EXAM_SUBMISSION_GRACE_MS } from '../src/utils/examTiming.utils';
import { buildExamWindow, msUntilOpenWindowPossible } from './wp4_exam_window_helper';

const CAIRO_TZ = 'Africa/Cairo';

let sharedServer: http.Server | null = null;
let sharedBaseUrl: string = '';

async function getTestBaseUrl(): Promise<string> {
  if (sharedServer) return sharedBaseUrl;
  sharedServer = http.createServer(app);
  await new Promise<void>((resolve) => {
    sharedServer!.listen(0, '127.0.0.1', () => {
      const addr = sharedServer!.address() as any;
      sharedBaseUrl = `http://127.0.0.1:${addr.port}/api`;
      resolve();
    });
  });
  sharedServer.unref();
  return sharedBaseUrl;
}

function makeSuffix(testName: string): string {
  const rand = Math.floor(Math.random() * 1000000);
  const time = Date.now().toString().slice(-6);
  return `${testName}_${time}_${rand}`;
}

const passwordHash = '$2b$10$dummyhashedpasswordforisolatedtestsuitesonly0000';

interface FixtureContext {
  college: any;
  dept: any;
  termCurrent: any;
  termPast: any;
  course: any;
  slot: any;
  docUser: any;
  docDoctor: any;
  docToken: string;
  studentUser: any;
  student: any;
  studentToken: string;
  enrollment: any;
  cleanup: () => Promise<void>;
}

async function setupTestContext(suffix: string): Promise<FixtureContext> {
  const college = await prisma.college.create({ data: { name: `Col_${suffix}` } });
  const dept = await prisma.department.create({ data: { name: `Dept_${suffix}`, collegeId: college.id } });

  const termCurrent = await prisma.academicTerm.findFirstOrThrow({ where: { isCurrent: true } });
  const termPast = await prisma.academicTerm.create({
    data: {
      academicYearId: termCurrent.academicYearId,
      name: `Past_${suffix}`,
      termType: 'FALL',
      semesterNumber: 1,
      startDate: new Date('2020-09-01'),
      endDate: new Date('2021-01-31'),
      isCurrent: false,
    },
  });

  const course = await prisma.course.create({
    data: { name: `Course_${suffix}`, courseCode: `C_${suffix}`, departmentId: dept.id, credits: 3 },
  });

  const docUser = await prisma.user.create({
    data: { email: `doc_${suffix}@uni.edu`, password: passwordHash, role: 'DOCTOR', departmentId: dept.id },
  });
  const docDoctor = await prisma.doctor.create({
    data: { userId: docUser.id, departmentId: dept.id, doctorId: `DOC_${suffix}`, firstName: 'Doc', lastName: 'T6b2' },
  });
  const docToken = generateAccessToken(docUser.id, docUser.tokenVersion);

  const slot = await prisma.scheduleSlot.create({
    data: {
      courseId: course.id,
      doctorId: docDoctor.id,
      termId: termCurrent.id,
      dayOfWeek: 'Monday',
      startTime: '08:00',
      endTime: '10:00',
      slotType: 'LECTURE',
    },
  });

  const studentUser = await prisma.user.create({
    data: { email: `stu_${suffix}@uni.edu`, password: passwordHash, role: 'STUDENT', departmentId: dept.id },
  });
  const student = await prisma.student.create({
    data: { userId: studentUser.id, departmentId: dept.id, studentId: `ST_${suffix}`, firstName: 'Stu', lastName: 'T6b2', year: 1 },
  });
  const studentToken = generateAccessToken(studentUser.id, studentUser.tokenVersion);

  const enrollment = await prisma.enrollment.create({
    data: {
      studentId: student.id,
      courseId: course.id,
      semester: 1,
      academicYear: 2026,
      termId: termCurrent.id,
      status: 'ENROLLED',
    },
  });

  const cleanup = async () => {
    await prisma.courseGradeEntry.deleteMany({ where: { enrollment: { courseId: course.id } } });
    await prisma.courseGradeComponent.deleteMany({ where: { structure: { courseId: course.id } } });
    await prisma.courseGradeStructure.deleteMany({ where: { courseId: course.id } });
    await prisma.examViolation.deleteMany({ where: { submission: { exam: { courseId: course.id } } } });
    await prisma.examSubmission.deleteMany({ where: { exam: { courseId: course.id } } });
    await prisma.examQuestion.deleteMany({ where: { exam: { courseId: course.id } } });
    await prisma.exam.deleteMany({ where: { courseId: course.id } });
    await prisma.enrollment.deleteMany({ where: { courseId: course.id } });
    await prisma.scheduleSlot.deleteMany({ where: { id: slot.id } });
    await prisma.course.deleteMany({ where: { id: course.id } });
    await prisma.doctor.deleteMany({ where: { id: docDoctor.id } });
    await prisma.student.deleteMany({ where: { id: student.id } });
    await prisma.user.deleteMany({ where: { id: { in: [docUser.id, studentUser.id] } } });
    await prisma.department.deleteMany({ where: { id: dept.id } });
    await prisma.academicTerm.deleteMany({ where: { id: termPast.id } });
    await prisma.college.deleteMany({ where: { id: college.id } });
  };

  return {
    college,
    dept,
    termCurrent,
    termPast,
    course,
    slot,
    docUser,
    docDoctor,
    docToken,
    studentUser,
    student,
    studentToken,
    enrollment,
    cleanup,
  };
}

// =========================================================================
// STEP 1 = C1 (carry-over): D3 cap resolution via HTTP POST /api/exams
// =========================================================================
test('C1: Doctor creates QUIZ via HTTP POST /api/exams without termId and adds questions exceeding maxPoints returns 422', async () => {
  const suffix = makeSuffix('c1_cap');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.docToken}`, 'Content-Type': 'application/json' };

  let examId: number | null = null;
  try {
    // 1. Setup CourseGradeStructure with AUTO_QUIZ component maxPoints = 10
    const structure = await prisma.courseGradeStructure.create({
      data: {
        courseId: ctx.course.id,
        termId: ctx.termCurrent.id,
        passMark: 50,
        components: {
          create: [
            { name: 'Quizzes', source: 'AUTO_QUIZ', maxPoints: 10, displayOrder: 1 },
          ],
        },
      },
    });

    // 2. Doctor creates a QUIZ exam via HTTP POST /api/exams without specifying termId
    const resCreate = await fetch(`${baseUrl}/exams`, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        courseId: ctx.course.id,
        title: `Quiz C1 ${suffix}`,
        type: 'QUIZ',
        date: '2026-11-01T00:00:00.000Z',
        startTime: '10:00',
        endTime: '12:00',
      }),
    });
    assert.strictEqual(resCreate.status, 201, `Expected 201 on create exam, got ${resCreate.status}`);
    const jsonCreate = await resCreate.json();
    examId = jsonCreate.data.id;

    // 3. Doctor adds question with points = 15 exceeding maxPoints 10 -> MUST return 422 QUIZ_POINTS_CAP_EXCEEDED
    const resAdd = await fetch(`${baseUrl}/exams/${examId}/questions`, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({
        text: 'Question 1',
        type: 'MCQ',
        optionA: 'Opt A',
        optionB: 'Opt B',
        correctAnswer: 'A',
        points: 15,
      }),
    });

    assert.strictEqual(resAdd.status, 422, `Expected 422 for cap exceeded, got ${resAdd.status}`);
    const jsonAdd = await resAdd.json();
    assert.match(jsonAdd.message || jsonAdd.code || JSON.stringify(jsonAdd), /QUIZ_POINTS_CAP_EXCEEDED/);
  } finally {
    if (examId) {
      await prisma.examQuestion.deleteMany({ where: { examId } });
      await prisma.exam.delete({ where: { id: examId } }).catch(() => {});
    }
    await ctx.cleanup();
  }
});

// =========================================================================
// I1: Answer hiding - STUDENT never receives correctAnswer before window + grace
// =========================================================================
test('I1: Student never receives correctAnswer before exam window + grace period closes', async () => {
  const suffix = makeSuffix('i1_hide');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.docToken}`, 'Content-Type': 'application/json' };
  const stuAuth = { Authorization: `Bearer ${ctx.studentToken}`, 'Content-Type': 'application/json' };

  let examId: number | null = null;
  let graceExamId: number | null = null;
  try {
    await new Promise((resolve) => setTimeout(resolve, msUntilOpenWindowPossible(new Date())));
    // Exam date today, open window via helper
    const openWindow = buildExamWindow(new Date(), 'open');

    const exam = await prisma.exam.create({
      data: {
        courseId: ctx.course.id,
        termId: ctx.termCurrent.id,
        academicYear: 2026,
        semester: 1,
        title: `Quiz I1 ${suffix}`,
        type: 'QUIZ',
        date: openWindow.date,
        startTime: openWindow.startTime,
        endTime: openWindow.endTime,
        durationMinutes: 60,
      },
    });
    examId = exam.id;

    const q1 = await prisma.examQuestion.create({
      data: {
        examId: exam.id,
        text: 'What is 2+2?',
        type: 'MCQ',
        optionA: '3',
        optionB: '4',
        correctAnswer: 'B',
        points: 5,
        order: 1,
      },
    });

    // 1. Student calls startExamSession
    const resStart = await fetch(`${baseUrl}/exams/${exam.id}/start`, {
      method: 'POST',
      headers: stuAuth,
    });
    assert.strictEqual(resStart.status, 201);
    const jsonStart = await resStart.json();
    assert.strictEqual(jsonStart.data.correctAnswer, undefined, 'Start session must never return correctAnswer');

    // 2. Student calls getExamQuestions
    const resQ = await fetch(`${baseUrl}/exams/${exam.id}/questions`, {
      headers: stuAuth,
    });
    assert.strictEqual(resQ.status, 200);
    const jsonQ = await resQ.json();
    for (const q of jsonQ.data) {
      assert.strictEqual(q.correctAnswer, undefined, 'GET questions must never include correctAnswer for students');
    }

    // 3. Student submits exam
    const resSubmit = await fetch(`${baseUrl}/exams/${exam.id}/submit`, {
      method: 'POST',
      headers: stuAuth,
      body: JSON.stringify({
        answers: [{ questionId: q1.id, answer: 'B' }],
      }),
    });
    assert.ok(resSubmit.status === 200 || resSubmit.status === 201);
    const jsonSubmit = await resSubmit.json();
    assert.strictEqual(jsonSubmit.data.correctAnswer, undefined, 'Submit response must never return correctAnswer');
    assert.strictEqual(jsonSubmit.data.questions, undefined, 'Submit response must not leak questions');

    // 4. Student calls getMyExamSubmission (exam window is still open in the future)
    const resMySub = await fetch(`${baseUrl}/exams/${exam.id}/my-submission`, {
      headers: stuAuth,
    });
    assert.strictEqual(resMySub.status, 200);
    const jsonMySub = await resMySub.json();
    const questions = jsonMySub.data.questions || [];
    for (const q of questions) {
      assert.strictEqual(q.correctAnswer, undefined, 'my-submission must not leak correctAnswer before exam window closes');
    }

    // 5. Inside 3-minute grace period (endTime was 1 minute ago):
    // Window closed, but grace period is STILL ACTIVE for other students.
    // Review answers must NOT be available yet!
    const graceWindow = buildExamWindow(new Date(), 'grace');
    const graceExam = await prisma.exam.create({
      data: {
        courseId: ctx.course.id,
        termId: ctx.termCurrent.id,
        academicYear: 2026,
        semester: 1,
        title: `Quiz Grace ${suffix}`,
        type: 'QUIZ',
        date: graceWindow.date,
        startTime: graceWindow.startTime,
        endTime: graceWindow.endTime,
        durationMinutes: 60,
      },
    });
    graceExamId = graceExam.id;

    const graceQ = await prisma.examQuestion.create({
      data: {
        examId: graceExam.id,
        text: 'Grace Question',
        type: 'MCQ',
        optionA: 'X',
        optionB: 'Y',
        correctAnswer: 'X',
        points: 5,
        order: 1,
      },
    });

    await prisma.examSubmission.create({
      data: {
        examId: graceExam.id,
        studentId: ctx.student.id,
        enrollmentId: ctx.enrollment.id,
        answers: [{ questionId: graceQ.id, answer: 'X' }],
        score: 5,
        maxScore: 5,
        status: 'GRADED',
      },
    });

    const resGraceSub = await fetch(`${baseUrl}/exams/${graceExam.id}/my-submission`, { headers: stuAuth });
    assert.strictEqual(resGraceSub.status, 200);
    const jsonGraceSub = await resGraceSub.json();
    for (const q of (jsonGraceSub.data.questions || [])) {
      assert.strictEqual(q.correctAnswer, undefined, 'correctAnswer must be hidden inside 3-minute grace window');
    }
  } finally {
    if (examId) {
      await prisma.examViolation.deleteMany({ where: { submission: { examId } } });
      await prisma.examSubmission.deleteMany({ where: { examId } });
      await prisma.examQuestion.deleteMany({ where: { examId } });
      await prisma.exam.delete({ where: { id: examId } }).catch(() => {});
    }
    if (graceExamId) {
      await prisma.examViolation.deleteMany({ where: { submission: { examId: graceExamId } } });
      await prisma.examSubmission.deleteMany({ where: { examId: graceExamId } });
      await prisma.examQuestion.deleteMany({ where: { examId: graceExamId } });
      await prisma.exam.delete({ where: { id: graceExamId } }).catch(() => {});
    }
    await ctx.cleanup();
  }
});

// =========================================================================
// I2: Question-text gating - student without in-progress submission gets no questions
// =========================================================================
test('I2: Student without in-progress submission gets no question text or options', async () => {
  const suffix = makeSuffix('i2_gate');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const stuAuth = { Authorization: `Bearer ${ctx.studentToken}`, 'Content-Type': 'application/json' };

  let examId: number | null = null;
  try {
    const exam = await prisma.exam.create({
      data: {
        courseId: ctx.course.id,
        termId: ctx.termCurrent.id,
        academicYear: 2026,
        semester: 1,
        title: `Quiz I2 ${suffix}`,
        type: 'QUIZ',
        date: new Date(),
        startTime: '00:00',
        endTime: '23:59',
        durationMinutes: 30,
      },
    });
    examId = exam.id;

    const q1 = await prisma.examQuestion.create({
      data: {
        examId: exam.id,
        text: 'Secret Question Text I2',
        type: 'MCQ',
        optionA: 'Secret Option A',
        optionB: 'Secret Option B',
        correctAnswer: 'A',
        points: 5,
        order: 1,
      },
    });

    // 1. BEFORE starting exam session: student calls GET /api/exams/:id/questions
    // Must NOT return question text or options! Expect 403 Forbidden or 409
    const resBeforeStart = await fetch(`${baseUrl}/exams/${exam.id}/questions`, {
      headers: stuAuth,
    });
    assert.strictEqual(resBeforeStart.status, 403, `Expected 403 before starting session, got ${resBeforeStart.status}`);
    const jsonBeforeStart = await resBeforeStart.json();
    assert.strictEqual(jsonBeforeStart.data, undefined, 'No question data returned before start');

    // 2. Student starts exam session
    const resStart = await fetch(`${baseUrl}/exams/${exam.id}/start`, {
      method: 'POST',
      headers: stuAuth,
    });
    assert.strictEqual(resStart.status, 201);

    // 3. WHILE in-progress (PENDING): student calls GET /api/exams/:id/questions -> succeeds
    const resDuring = await fetch(`${baseUrl}/exams/${exam.id}/questions`, {
      headers: stuAuth,
    });
    assert.strictEqual(resDuring.status, 200);
    const jsonDuring = await resDuring.json();
    assert.ok(Array.isArray(jsonDuring.data) && jsonDuring.data.length === 1);
    assert.strictEqual(jsonDuring.data[0].text, 'Secret Question Text I2');

    // 4. Student submits exam
    const resSubmit = await fetch(`${baseUrl}/exams/${exam.id}/submit`, {
      method: 'POST',
      headers: stuAuth,
      body: JSON.stringify({ answers: [{ questionId: q1.id, answer: 'A' }] }),
    });
    assert.ok(resSubmit.status === 200 || resSubmit.status === 201);

    // 5. AFTER submit (submission is GRADED, not in-progress):
    // GET /api/exams/:id/questions must NOT return questions
    const resAfterSubmit = await fetch(`${baseUrl}/exams/${exam.id}/questions`, {
      headers: stuAuth,
    });
    assert.ok([403, 409].includes(resAfterSubmit.status), `Expected 403 or 409 after submit, got ${resAfterSubmit.status}`);

    // GET /api/exams/:id/my-submission before window closes must return questions = []
    const resMySub = await fetch(`${baseUrl}/exams/${exam.id}/my-submission`, {
      headers: stuAuth,
    });
    assert.strictEqual(resMySub.status, 200);
    const jsonMySub = await resMySub.json();
    assert.deepStrictEqual(jsonMySub.data.questions || [], [], 'my-submission must not return question text after completion before window closes');
  } finally {
    if (examId) {
      await prisma.examViolation.deleteMany({ where: { submission: { examId } } });
      await prisma.examSubmission.deleteMany({ where: { examId } });
      await prisma.examQuestion.deleteMany({ where: { examId } });
      await prisma.exam.delete({ where: { id: examId } }).catch(() => {});
    }
    await ctx.cleanup();
  }
});

// =========================================================================
// I3: Server-side scoring - submit-body forged fields are ignored
// =========================================================================
test('I3: Submit-body forged fields (score, maxScore, studentId, isCorrect) are ignored and score is computed strictly server-side', async () => {
  const suffix = makeSuffix('i3_forge');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const stuAuth = { Authorization: `Bearer ${ctx.studentToken}`, 'Content-Type': 'application/json' };

  let examId: number | null = null;
  try {
    const exam = await prisma.exam.create({
      data: {
        courseId: ctx.course.id,
        termId: ctx.termCurrent.id,
        academicYear: 2026,
        semester: 1,
        title: `Quiz I3 ${suffix}`,
        type: 'QUIZ',
        date: new Date(),
        startTime: '00:00',
        endTime: '23:59',
        durationMinutes: 30,
      },
    });
    examId = exam.id;

    const q1 = await prisma.examQuestion.create({
      data: {
        examId: exam.id,
        text: 'What is 5*5?',
        type: 'MCQ',
        optionA: '25',
        optionB: '50',
        correctAnswer: 'A',
        points: 5,
        order: 1,
      },
    });

    // Start exam
    await fetch(`${baseUrl}/exams/${exam.id}/start`, { method: 'POST', headers: stuAuth });

    // Submit with wrong answer 'WRONG_VALUE', but forged body fields claiming score: 100, maxScore: 100, studentId: 99999
    const resSubmit = await fetch(`${baseUrl}/exams/${exam.id}/submit`, {
      method: 'POST',
      headers: stuAuth,
      body: JSON.stringify({
        answers: [{ questionId: q1.id, answer: 'WRONG_VALUE' }], // WRONG answer
        score: 100,
        maxScore: 100,
        isCorrect: true,
        status: 'GRADED',
        studentId: 999999,
      }),
    });
    assert.ok(resSubmit.status === 200 || resSubmit.status === 201);

    const sub = await prisma.examSubmission.findUnique({
      where: { examId_studentId: { examId: exam.id, studentId: ctx.student.id } },
    });

    assert.ok(sub);
    assert.strictEqual(sub.score, 0, `Expected computed score 0 for wrong answer, got forged ${sub.score}`);
    assert.strictEqual(sub.maxScore, 5, `Expected maxScore 5, got forged ${sub.maxScore}`);
    assert.strictEqual(sub.studentId, ctx.student.id, 'studentId must remain authentic student id');
  } finally {
    if (examId) {
      await prisma.examViolation.deleteMany({ where: { submission: { examId } } });
      await prisma.examSubmission.deleteMany({ where: { examId } });
      await prisma.examQuestion.deleteMany({ where: { examId } });
      await prisma.exam.delete({ where: { id: examId } }).catch(() => {});
    }
    await ctx.cleanup();
  }
});

// =========================================================================
// I4: Replay & races - parallel submits (exactly one 200, one 409, never 500)
// =========================================================================
test('I4: Parallel submits return exactly one 200 and one 409; submit after GRADED returns 409; late submit returns 403', async () => {
  const suffix = makeSuffix('i4_race');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const stuAuth = { Authorization: `Bearer ${ctx.studentToken}`, 'Content-Type': 'application/json' };

  let examId: number | null = null;
  try {
    const exam = await prisma.exam.create({
      data: {
        courseId: ctx.course.id,
        termId: ctx.termCurrent.id,
        academicYear: 2026,
        semester: 1,
        title: `Quiz I4 ${suffix}`,
        type: 'QUIZ',
        date: new Date(),
        startTime: '00:00',
        endTime: '23:59',
        durationMinutes: 30,
      },
    });
    examId = exam.id;

    const q1 = await prisma.examQuestion.create({
      data: {
        examId: exam.id,
        text: 'What is 10/2?',
        type: 'MCQ',
        optionA: '5',
        optionB: '2',
        correctAnswer: 'A',
        points: 5,
        order: 1,
      },
    });

    // Start exam
    await fetch(`${baseUrl}/exams/${exam.id}/start`, { method: 'POST', headers: stuAuth });

    // Parallel submits race
    const submitBody = JSON.stringify({ answers: [{ questionId: q1.id, answer: 'A' }] });
    const [res1, res2] = await Promise.all([
      fetch(`${baseUrl}/exams/${exam.id}/submit`, { method: 'POST', headers: stuAuth, body: submitBody }),
      fetch(`${baseUrl}/exams/${exam.id}/submit`, { method: 'POST', headers: stuAuth, body: submitBody }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    assert.deepStrictEqual(statuses, [200, 409], `Expected exactly one 200 and one 409, got [${statuses.join(', ')}]`);

    // Resubmission after GRADED -> 409 Conflict
    const resReplay = await fetch(`${baseUrl}/exams/${exam.id}/submit`, {
      method: 'POST',
      headers: stuAuth,
      body: submitBody,
    });
    assert.strictEqual(resReplay.status, 409, `Expected 409 on replay submit, got ${resReplay.status}`);

    // Late submit check: create another exam where attempt is already late
    const lateExam = await prisma.exam.create({
      data: {
        courseId: ctx.course.id,
        termId: ctx.termCurrent.id,
        academicYear: 2026,
        semester: 1,
        title: `Quiz Late ${suffix}`,
        type: 'QUIZ',
        date: new Date(),
        startTime: '00:00',
        endTime: '23:59',
        durationMinutes: 10,
      },
    });
    const lateSub = await prisma.examSubmission.create({
      data: {
        examId: lateExam.id,
        studentId: ctx.student.id,
        enrollmentId: ctx.enrollment.id,
        answers: [],
        status: 'PENDING',
        startedAt: new Date(Date.now() - 20 * 60 * 1000), // 20m ago for 10m exam + 3m grace
      },
    });

    const resLate = await fetch(`${baseUrl}/exams/${lateExam.id}/submit`, {
      method: 'POST',
      headers: stuAuth,
      body: JSON.stringify({ answers: [] }),
    });
    assert.strictEqual(resLate.status, 403, `Expected 403 on late submit, got ${resLate.status}`);

    await prisma.examSubmission.delete({ where: { id: lateSub.id } });
    await prisma.exam.delete({ where: { id: lateExam.id } });
  } finally {
    if (examId) {
      await prisma.examViolation.deleteMany({ where: { submission: { examId } } });
      await prisma.examSubmission.deleteMany({ where: { examId } });
      await prisma.examQuestion.deleteMany({ where: { examId } });
      await prisma.exam.delete({ where: { id: examId } }).catch(() => {});
    }
    await ctx.cleanup();
  }
});

test.after(async () => {
  if (sharedServer) {
    sharedServer.closeAllConnections?.();
    await new Promise<void>((resolve) => sharedServer!.close(() => resolve()));
    sharedServer = null;
  }
  await prisma.$disconnect();
});
