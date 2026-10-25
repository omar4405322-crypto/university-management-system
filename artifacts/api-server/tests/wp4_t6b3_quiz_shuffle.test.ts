import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import prisma from '../src/utils/prismaClient';
import app from '../src/app';
import { generateAccessToken } from '../src/utils/jwt.utils';
import { calculateExamScore, getMcqOptionMapping } from '../src/controllers/examQuestions.controller';
import { permuteExamQuestions } from '../src/utils/quizShuffle.utils';

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

test.after(async () => {
  if (sharedServer) {
    if (typeof (sharedServer as any).closeAllConnections === 'function') {
      (sharedServer as any).closeAllConnections();
    }
    await new Promise<void>((resolve) => sharedServer!.close(() => resolve()));
  }
});

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
  course: any;
  slot: any;
  docUser: any;
  docDoctor: any;
  docToken: string;
  studentUser: any;
  student: any;
  studentToken: string;
  enrollment: any;
  studentUserB: any;
  studentB: any;
  studentTokenB: string;
  cleanup: () => Promise<void>;
}

async function setupTestContext(suffix: string): Promise<FixtureContext> {
  const college = await prisma.college.create({ data: { name: `Col_${suffix}` } });
  const dept = await prisma.department.create({ data: { name: `Dept_${suffix}`, collegeId: college.id } });

  const termCurrent = await prisma.academicTerm.findFirstOrThrow({ where: { isCurrent: true } });

  const course = await prisma.course.create({
    data: { name: `Course_${suffix}`, courseCode: `C_${suffix}`, departmentId: dept.id, credits: 3 },
  });

  const docUser = await prisma.user.create({
    data: { email: `doc_${suffix}@uni.edu`, password: passwordHash, role: 'DOCTOR', departmentId: dept.id },
  });
  const docDoctor = await prisma.doctor.create({
    data: { userId: docUser.id, departmentId: dept.id, doctorId: `DOC_${suffix}`, firstName: 'Doc', lastName: 'T6b3' },
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
    data: { userId: studentUser.id, departmentId: dept.id, studentId: `ST_${suffix}`, firstName: 'Stu', lastName: 'T6b3', year: 1 },
  });
  const studentToken = generateAccessToken(studentUser.id, studentUser.tokenVersion);

  const studentUserB = await prisma.user.create({
    data: { email: `stub_${suffix}@uni.edu`, password: passwordHash, role: 'STUDENT', departmentId: dept.id },
  });
  const studentB = await prisma.student.create({
    data: { userId: studentUserB.id, departmentId: dept.id, studentId: `STB_${suffix}`, firstName: 'StuB', lastName: 'T6b3', year: 1 },
  });
  const studentTokenB = generateAccessToken(studentUserB.id, studentUserB.tokenVersion);

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
    await prisma.student.deleteMany({ where: { id: { in: [student.id, studentB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [docUser.id, studentUser.id, studentUserB.id] } } });
    await prisma.department.deleteMany({ where: { id: dept.id } });
    await prisma.college.deleteMany({ where: { id: college.id } });
  };

  return {
    college,
    dept,
    termCurrent,
    course,
    slot,
    docUser,
    docDoctor,
    docToken,
    studentUser,
    student,
    studentToken,
    enrollment,
    studentUserB,
    studentB,
    studentTokenB,
    cleanup,
  };
}

async function createQuizExam(ctx: FixtureContext, questionCount: number = 6) {
  const exam = await prisma.exam.create({
    data: {
      courseId: ctx.course.id,
      academicYear: 2026,
      semester: 1,
      termId: ctx.termCurrent.id,
      title: 'Quiz Shuffle Test',
      type: 'QUIZ',
      date: new Date(),
      startTime: '00:00',
      endTime: '23:59',
      durationMinutes: 60,
    },
  });

  const questions: any[] = [];
  for (let i = 1; i <= questionCount; i++) {
    const isTf = i === questionCount; // Last question is TRUE_FALSE
    const q = await prisma.examQuestion.create({
      data: {
        examId: exam.id,
        text: `Question ${i} text`,
        type: isTf ? 'TRUE_FALSE' : 'MCQ',
        optionA: isTf ? null : `OptA_${i}`,
        optionB: isTf ? null : `OptB_${i}`,
        optionC: isTf ? null : `OptC_${i}`,
        optionD: isTf ? null : `OptD_${i}`,
        correctAnswer: isTf ? 'TRUE' : 'B',
        points: 1,
        order: i,
      },
    });
    questions.push(q);
  }

  return { exam, questions };
}

test('(a) seed stored at start and kept on re-start', async () => {
  const suffix = makeSuffix('t6b3_a');
  const ctx = await setupTestContext(suffix);
  try {
    const baseUrl = await getTestBaseUrl();
    const { exam } = await createQuizExam(ctx, 3);
    const stuAuth = { Authorization: `Bearer ${ctx.studentToken}`, 'Content-Type': 'application/json' };

    // Initial start
    const resStart1 = await fetch(`${baseUrl}/exams/${exam.id}/start`, { method: 'POST', headers: stuAuth });
    assert.strictEqual(resStart1.status, 201);

    const sub1 = await (prisma.examSubmission as any).findUnique({
      where: { examId_studentId: { examId: exam.id, studentId: ctx.student.id } },
    });
    assert.ok(sub1, 'Submission must exist');
    assert.strictEqual(typeof sub1.shuffleSeed, 'number', 'shuffleSeed must be a stored integer');
    assert.ok(Number.isInteger(sub1.shuffleSeed) && sub1.shuffleSeed > 0, 'shuffleSeed must be a positive integer');

    // Re-start while PENDING
    const resStart2 = await fetch(`${baseUrl}/exams/${exam.id}/start`, { method: 'POST', headers: stuAuth });
    assert.strictEqual(resStart2.status, 201);

    const sub2 = await (prisma.examSubmission as any).findUnique({
      where: { examId_studentId: { examId: exam.id, studentId: ctx.student.id } },
    });
    assert.strictEqual(sub2.shuffleSeed, sub1.shuffleSeed, 'shuffleSeed must be kept on re-start (never regenerated)');
  } finally {
    await ctx.cleanup();
  }
});

test('(b) same seed gives identical order on two GETs', async () => {
  const suffix = makeSuffix('t6b3_b');
  const ctx = await setupTestContext(suffix);
  try {
    const baseUrl = await getTestBaseUrl();
    const { exam } = await createQuizExam(ctx, 6);
    const stuAuth = { Authorization: `Bearer ${ctx.studentToken}`, 'Content-Type': 'application/json' };

    await fetch(`${baseUrl}/exams/${exam.id}/start`, { method: 'POST', headers: stuAuth });

    const res1 = await fetch(`${baseUrl}/exams/${exam.id}/questions`, { headers: stuAuth });
    assert.strictEqual(res1.status, 200);
    const body1 = await res1.json();

    const res2 = await fetch(`${baseUrl}/exams/${exam.id}/questions`, { headers: stuAuth });
    assert.strictEqual(res2.status, 200);
    const body2 = await res2.json();

    const qIds1 = body1.data.map((q: any) => q.id);
    const qIds2 = body2.data.map((q: any) => q.id);
    assert.deepStrictEqual(qIds1, qIds2, 'Question order must be identical on two GETs for the same attempt');

    for (let i = 0; i < body1.data.length; i++) {
      if (body1.data[i].type === 'MCQ') {
        assert.ok(Array.isArray(body1.data[i].optionOrder), 'MCQ must have optionOrder array');
        assert.deepStrictEqual(body1.data[i].optionOrder, body2.data[i].optionOrder, 'Option order must be identical on two GETs');
      }
    }
  } finally {
    await ctx.cleanup();
  }
});

test('(c) the order is a valid permutation (no question or option lost or duplicated)', async () => {
  const suffix = makeSuffix('t6b3_c');
  const ctx = await setupTestContext(suffix);
  try {
    const baseUrl = await getTestBaseUrl();
    const { exam, questions } = await createQuizExam(ctx, 6);
    const stuAuth = { Authorization: `Bearer ${ctx.studentToken}`, 'Content-Type': 'application/json' };

    await fetch(`${baseUrl}/exams/${exam.id}/start`, { method: 'POST', headers: stuAuth });

    const res = await fetch(`${baseUrl}/exams/${exam.id}/questions`, { headers: stuAuth });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const receivedQuestions = body.data;

    assert.strictEqual(receivedQuestions.length, questions.length, 'Question count must match');
    const expectedIds = new Set(questions.map((q) => q.id));
    const receivedIds = new Set(receivedQuestions.map((q: any) => q.id));
    assert.deepStrictEqual(receivedIds, expectedIds, 'All questions must be present without duplicates or omissions');

    for (const q of receivedQuestions) {
      if (q.type === 'MCQ') {
        assert.ok(Array.isArray(q.optionOrder), 'MCQ must include optionOrder');
        const expectedOptions = ['optionA', 'optionB', 'optionC', 'optionD'];
        assert.strictEqual(q.optionOrder.length, 4, 'optionOrder must contain 4 options');
        assert.deepStrictEqual(new Set(q.optionOrder), new Set(expectedOptions), 'optionOrder must be a permutation of original option keys');
        // Option values unchanged
        const orig = questions.find((origQ) => origQ.id === q.id);
        assert.strictEqual(q.optionA, orig.optionA);
        assert.strictEqual(q.optionB, orig.optionB);
        assert.strictEqual(q.optionC, orig.optionC);
        assert.strictEqual(q.optionD, orig.optionD);
      } else if (q.type === 'TRUE_FALSE') {
        assert.strictEqual(q.optionOrder, undefined, 'TRUE_FALSE must not have optionOrder');
      }
    }
  } finally {
    await ctx.cleanup();
  }
});

test('(d) across 20 fixture seeds with at least 6 questions, at least 2 different orders (computed from the responses, not from the util)', async () => {
  const suffix = makeSuffix('t6b3_d');
  const ctx = await setupTestContext(suffix);
  try {
    const baseUrl = await getTestBaseUrl();
    const { exam } = await createQuizExam(ctx, 6);
    const stuAuth = { Authorization: `Bearer ${ctx.studentToken}`, 'Content-Type': 'application/json' };

    await fetch(`${baseUrl}/exams/${exam.id}/start`, { method: 'POST', headers: stuAuth });

    const orders = new Set<string>();
    for (let seed = 1001; seed <= 1020; seed++) {
      await (prisma.examSubmission as any).update({
        where: { examId_studentId: { examId: exam.id, studentId: ctx.student.id } },
        data: { shuffleSeed: seed },
      });

      const res = await fetch(`${baseUrl}/exams/${exam.id}/questions`, { headers: stuAuth });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      const orderSignature = body.data.map((q: any) => q.id).join('-');
      orders.add(orderSignature);
    }

    assert.ok(orders.size >= 2, `Expected at least 2 different question orders across 20 seeds, got ${orders.size}`);
  } finally {
    await ctx.cleanup();
  }
});

test('(e) answers by original key still score correctly under any seed', async () => {
  const suffix = makeSuffix('t6b3_e');
  const ctx = await setupTestContext(suffix);
  try {
    const baseUrl = await getTestBaseUrl();
    const { exam, questions } = await createQuizExam(ctx, 4);
    const stuAuth = { Authorization: `Bearer ${ctx.studentToken}`, 'Content-Type': 'application/json' };

    // Start exam session
    const resStart = await fetch(`${baseUrl}/exams/${exam.id}/start`, { method: 'POST', headers: stuAuth });
    assert.strictEqual(resStart.status, 201);

    // Answers using the original question keys
    const answersMap: Record<string, string> = {};
    for (const q of questions) {
      answersMap[q.id.toString()] = q.correctAnswer;
    }

    // Submit via POST /submit
    const resSubmit = await fetch(`${baseUrl}/exams/${exam.id}/submit`, {
      method: 'POST',
      headers: stuAuth,
      body: JSON.stringify({ answers: answersMap }),
    });
    assert.strictEqual(resSubmit.status, 200);
    const bodySubmit = await resSubmit.json();
    assert.strictEqual(bodySubmit.data.score, 4, 'Full score 4 must be awarded when submitting with original keys');
    assert.strictEqual(bodySubmit.data.maxScore, 4, 'Max score must be 4');

    // Under any seed (null legacy or arbitrary positive seeds), answers by original key score full points
    for (const seed of [null, 1001, 887766, 2147483647]) {
      const permuted = permuteExamQuestions(questions, seed, exam.id);
      const { score, maxScore } = calculateExamScore(permuted, answersMap);
      assert.strictEqual(score, 4, `Full score must be awarded under seed ${seed}`);
      assert.strictEqual(maxScore, 4, `Max score must be 4 under seed ${seed}`);
    }
  } finally {
    await ctx.cleanup();
  }
});

test('(f) no response of any student endpoint contains the seed or correctAnswer', async () => {
  const suffix = makeSuffix('t6b3_f');
  const ctx = await setupTestContext(suffix);
  try {
    const baseUrl = await getTestBaseUrl();
    const { exam } = await createQuizExam(ctx, 4);
    const stuAuth = { Authorization: `Bearer ${ctx.studentToken}`, 'Content-Type': 'application/json' };

    const resStart = await fetch(`${baseUrl}/exams/${exam.id}/start`, { method: 'POST', headers: stuAuth });
    assert.strictEqual(resStart.status, 201);
    const bodyStart = await resStart.json();

    assert.strictEqual(bodyStart.data.shuffleSeed, undefined, 'Start response must never leak shuffleSeed');
    assert.strictEqual(bodyStart.data.correctAnswer, undefined, 'Start response must never leak correctAnswer');

    const resQ = await fetch(`${baseUrl}/exams/${exam.id}/questions`, { headers: stuAuth });
    assert.strictEqual(resQ.status, 200);
    const bodyQ = await resQ.json();

    for (const q of bodyQ.data) {
      assert.strictEqual(q.shuffleSeed, undefined, 'Question object must never contain shuffleSeed');
      assert.strictEqual(q.correctAnswer, undefined, 'Question object must never contain correctAnswer');
    }
  } finally {
    await ctx.cleanup();
  }
});

test('(g) null-seed legacy attempt returns original order', async () => {
  const suffix = makeSuffix('t6b3_g');
  const ctx = await setupTestContext(suffix);
  try {
    const baseUrl = await getTestBaseUrl();
    const { exam, questions } = await createQuizExam(ctx, 4);
    const stuAuth = { Authorization: `Bearer ${ctx.studentToken}`, 'Content-Type': 'application/json' };

    await fetch(`${baseUrl}/exams/${exam.id}/start`, { method: 'POST', headers: stuAuth });

    // Explicitly set shuffleSeed to null (simulating legacy attempt)
    await (prisma.examSubmission as any).update({
      where: { examId_studentId: { examId: exam.id, studentId: ctx.student.id } },
      data: { shuffleSeed: null },
    });

    const res = await fetch(`${baseUrl}/exams/${exam.id}/questions`, { headers: stuAuth });
    assert.strictEqual(res.status, 200);
    const body = await res.json();

    const returnedIds = body.data.map((q: any) => q.id);
    const expectedIds = questions.map((q) => q.id);
    assert.deepStrictEqual(returnedIds, expectedIds, 'Null-seed legacy attempt must preserve original question order');

    for (const q of body.data) {
      if (q.type === 'MCQ') {
        assert.deepStrictEqual(
          q.optionOrder,
          ['optionA', 'optionB', 'optionC', 'optionD'],
          'Null-seed legacy attempt must preserve original option order',
        );
      }
    }
  } finally {
    await ctx.cleanup();
  }
});

test('(h) scope: another student or a non-enrolled student cannot read someone elses order; parallel starts leave at most one PENDING row', async () => {
  const suffix = makeSuffix('t6b3_h');
  const ctx = await setupTestContext(suffix);
  try {
    const baseUrl = await getTestBaseUrl();
    const { exam } = await createQuizExam(ctx, 4);
    const stuAuthA = { Authorization: `Bearer ${ctx.studentToken}`, 'Content-Type': 'application/json' };
    const stuAuthB = { Authorization: `Bearer ${ctx.studentTokenB}`, 'Content-Type': 'application/json' };

    // 1. Student B is NOT enrolled in course -> 403
    const resB = await fetch(`${baseUrl}/exams/${exam.id}/questions`, { headers: stuAuthB });
    assert.strictEqual(resB.status, 403, 'Non-enrolled student must receive 403');

    // 2. Student A is enrolled but has not started session -> 403
    const resA = await fetch(`${baseUrl}/exams/${exam.id}/questions`, { headers: stuAuthA });
    assert.strictEqual(resA.status, 403, 'Student who has not started session must receive 403');

    // 3. Parallel starts for Student A
    const [start1, start2] = await Promise.all([
      fetch(`${baseUrl}/exams/${exam.id}/start`, { method: 'POST', headers: stuAuthA }),
      fetch(`${baseUrl}/exams/${exam.id}/start`, { method: 'POST', headers: stuAuthA }),
    ]);

    assert.ok(start1.status === 201, 'First parallel start should succeed');
    assert.ok(start2.status === 201, 'Second parallel start should succeed (recovering existing)');

    const submissions = await prisma.examSubmission.findMany({
      where: { examId: exam.id, studentId: ctx.student.id },
    });
    assert.strictEqual(submissions.length, 1, 'Parallel starts must leave at most one row in database');
    assert.strictEqual(submissions[0].status, 'PENDING');
  } finally {
    await ctx.cleanup();
  }
});

test('(i) JSON.stringify of every student response body (start, submit, cancel, my-submission) must not contain shuffleSeed', async () => {
  const suffix = makeSuffix('t6b3_i');
  const ctx = await setupTestContext(suffix);
  try {
    const baseUrl = await getTestBaseUrl();
    const { exam, questions } = await createQuizExam(ctx, 4);
    const stuAuthA = { Authorization: `Bearer ${ctx.studentToken}`, 'Content-Type': 'application/json' };

    // Enroll studentB as well for cancel test
    await prisma.enrollment.create({
      data: {
        studentId: ctx.studentB.id,
        courseId: ctx.course.id,
        semester: 1,
        academicYear: 2026,
        termId: ctx.termCurrent.id,
        status: 'ENROLLED',
      },
    });
    const stuAuthB = { Authorization: `Bearer ${ctx.studentTokenB}`, 'Content-Type': 'application/json' };

    // 1. startExamSession (Student A)
    const resStart = await fetch(`${baseUrl}/exams/${exam.id}/start`, { method: 'POST', headers: stuAuthA });
    assert.strictEqual(resStart.status, 201);
    const bodyStart = await resStart.json();
    assert.strictEqual(
      JSON.stringify(bodyStart).includes('"shuffleSeed"'),
      false,
      'startExamSession response must not contain "shuffleSeed"',
    );

    // 2. getMyExamSubmission (Student A)
    const resMySub = await fetch(`${baseUrl}/exams/${exam.id}/my-submission`, { headers: stuAuthA });
    assert.strictEqual(resMySub.status, 200);
    const bodyMySub = await resMySub.json();
    assert.strictEqual(
      JSON.stringify(bodyMySub).includes('"shuffleSeed"'),
      false,
      'getMyExamSubmission response must not contain "shuffleSeed"',
    );

    // 3. submitExam (Student A)
    const answersMap: Record<string, string> = {};
    for (const q of questions) {
      answersMap[q.id.toString()] = q.correctAnswer;
    }
    const resSubmit = await fetch(`${baseUrl}/exams/${exam.id}/submit`, {
      method: 'POST',
      headers: stuAuthA,
      body: JSON.stringify({ answers: answersMap }),
    });
    assert.strictEqual(resSubmit.status, 200);
    const bodySubmit = await resSubmit.json();
    assert.strictEqual(
      JSON.stringify(bodySubmit).includes('"shuffleSeed"'),
      false,
      'submitExam response must not contain "shuffleSeed"',
    );

    // 4. cancelExam (Student B)
    const resStartB = await fetch(`${baseUrl}/exams/${exam.id}/start`, { method: 'POST', headers: stuAuthB });
    assert.strictEqual(resStartB.status, 201);
    const resCancel = await fetch(`${baseUrl}/exams/${exam.id}/cancel`, {
      method: 'POST',
      headers: stuAuthB,
      body: JSON.stringify({ reason: 'testing cancel shuffleSeed exclusion' }),
    });
    assert.strictEqual(resCancel.status, 200);
    const bodyCancel = await resCancel.json();
    assert.strictEqual(
      JSON.stringify(bodyCancel).includes('"shuffleSeed"'),
      false,
      'cancelExam response must not contain "shuffleSeed"',
    );
  } finally {
    await ctx.cleanup();
  }
});

test('(j) fixture student with non-identity MCQ mapping answers with original keys and expects full score through POST submit', async () => {
  const suffix = makeSuffix('t6b3_j');
  const ctx = await setupTestContext(suffix);
  try {
    const baseUrl = await getTestBaseUrl();
    const { exam, questions } = await createQuizExam(ctx, 4);

    const availableLetters = ['A', 'B', 'C', 'D'];
    let nonIdentityFound = false;

    // Check initial fixture questions for non-identity mapping
    for (const q of questions) {
      if (q.type === 'MCQ') {
        const mapping = getMcqOptionMapping(ctx.student.id, q.id, availableLetters);
        if (mapping.some((val, idx) => val !== availableLetters[idx])) {
          nonIdentityFound = true;
          break;
        }
      }
    }

    // Fix by construction: keep adding fixture questions until non-identity mapping is found (bounded at 50)
    while (!nonIdentityFound && questions.length < 50) {
      const nextIdx = questions.length + 1;
      const q = await prisma.examQuestion.create({
        data: {
          examId: exam.id,
          text: `Question ${nextIdx} text`,
          type: 'MCQ',
          optionA: `OptA_${nextIdx}`,
          optionB: `OptB_${nextIdx}`,
          optionC: `OptC_${nextIdx}`,
          optionD: `OptD_${nextIdx}`,
          correctAnswer: 'B',
          points: 1,
          order: nextIdx,
        },
      });
      questions.push(q);
      const mapping = getMcqOptionMapping(ctx.student.id, q.id, availableLetters);
      if (mapping.some((val, idx) => val !== availableLetters[idx])) {
        nonIdentityFound = true;
        break;
      }
    }

    assert.ok(
      nonIdentityFound,
      `Failed to find non-identity option mapping for student ${ctx.student.id} across ${questions.length} questions (bounded at 50)`
    );

    const stuAuth = { Authorization: `Bearer ${ctx.studentToken}`, 'Content-Type': 'application/json' };
    const resStart = await fetch(`${baseUrl}/exams/${exam.id}/start`, { method: 'POST', headers: stuAuth });
    assert.strictEqual(resStart.status, 201);

    // Answer ALL questions by ORIGINAL key
    const answersMap: Record<string, string> = {};
    for (const q of questions) {
      answersMap[q.id.toString()] = q.correctAnswer;
    }

    const resSubmit = await fetch(`${baseUrl}/exams/${exam.id}/submit`, {
      method: 'POST',
      headers: stuAuth,
      body: JSON.stringify({ answers: answersMap }),
    });
    assert.strictEqual(resSubmit.status, 200);
    const bodySubmit = await resSubmit.json();

    const expectedScore = questions.reduce((sum, q) => sum + (q.points || 0), 0);
    assert.strictEqual(
      bodySubmit.data.score,
      expectedScore,
      `Expected full score ${expectedScore}, got ${bodySubmit.data.score}`,
    );
    assert.strictEqual(
      bodySubmit.data.maxScore,
      expectedScore,
      `Expected maxScore ${expectedScore}, got ${bodySubmit.data.maxScore}`,
    );
  } finally {
    await ctx.cleanup();
  }
});


