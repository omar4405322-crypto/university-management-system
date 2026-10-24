import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import prisma from '../src/utils/prismaClient';
import app from '../src/app';
import { generateAccessToken } from '../src/utils/jwt.utils';
import {
  MAX_QUESTION_TEXT_LENGTH,
  MAX_OPTION_TEXT_LENGTH,
  MAX_EXAM_TITLE_LENGTH,
  MAX_EXAM_ROOM_LENGTH,
  MAX_EXAM_TIME_LENGTH,
  MAX_POINTS_TECHNICAL_CEILING,
} from '../src/utils/quizInputGuard.utils';

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
  collegeOther: any;
  dept: any;
  deptOther: any;
  termCurrent: any;
  course: any;
  courseOther: any;
  slot: any;
  docUser: any;
  docDoctor: any;
  docToken: string;
  docOtherUser: any;
  docOtherDoctor: any;
  docOtherToken: string;
  taUser: any;
  taProfile: any;
  taToken: string;
  adminOtherUser: any;
  adminOtherToken: string;
  studentUser: any;
  student: any;
  studentToken: string;
  studentUserNonEnrolled: any;
  studentNonEnrolled: any;
  studentNonEnrolledToken: string;
  enrollment: any;
  cleanup: () => Promise<void>;
}

async function setupTestContext(suffix: string): Promise<FixtureContext> {
  const created = {
    collegeIds: [] as number[],
    departmentIds: [] as number[],
    courseIds: [] as number[],
    slotIds: [] as number[],
    taIds: [] as number[],
    doctorIds: [] as number[],
    studentIds: [] as number[],
    userIds: [] as number[],
    enrollmentIds: [] as number[],
  };

  const cleanup = async () => {
    if (created.courseIds.length > 0) {
      await prisma.courseGradeEntry.deleteMany({ where: { enrollment: { courseId: { in: created.courseIds } } } });
      await prisma.courseGradeComponent.deleteMany({ where: { structure: { courseId: { in: created.courseIds } } } });
      await prisma.courseGradeStructure.deleteMany({ where: { courseId: { in: created.courseIds } } });
      await prisma.examViolation.deleteMany({ where: { submission: { exam: { courseId: { in: created.courseIds } } } } });
      await prisma.examSubmission.deleteMany({ where: { exam: { courseId: { in: created.courseIds } } } });
      await prisma.examQuestion.deleteMany({ where: { exam: { courseId: { in: created.courseIds } } } });
      await prisma.exam.deleteMany({ where: { courseId: { in: created.courseIds } } });
      await prisma.enrollment.deleteMany({ where: { courseId: { in: created.courseIds } } });
    }
    if (created.slotIds.length > 0) {
      await prisma.scheduleSlot.deleteMany({ where: { id: { in: created.slotIds } } });
    }
    if (created.courseIds.length > 0) {
      await prisma.course.deleteMany({ where: { id: { in: created.courseIds } } });
    }
    if (created.taIds.length > 0) {
      await prisma.teachingAssistant.deleteMany({ where: { id: { in: created.taIds } } });
    }
    if (created.doctorIds.length > 0) {
      await prisma.doctor.deleteMany({ where: { id: { in: created.doctorIds } } });
    }
    if (created.studentIds.length > 0) {
      await prisma.student.deleteMany({ where: { id: { in: created.studentIds } } });
    }
    if (created.userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
    }
    if (created.departmentIds.length > 0) {
      await prisma.department.deleteMany({ where: { id: { in: created.departmentIds } } });
    }
    if (created.collegeIds.length > 0) {
      await prisma.college.deleteMany({ where: { id: { in: created.collegeIds } } });
    }
  };

  try {
    const college = await prisma.college.create({ data: { name: `Col_${suffix}` } });
    created.collegeIds.push(college.id);
    const collegeOther = await prisma.college.create({ data: { name: `ColOth_${suffix}` } });
    created.collegeIds.push(collegeOther.id);

    const dept = await prisma.department.create({ data: { name: `Dept_${suffix}`, collegeId: college.id } });
    created.departmentIds.push(dept.id);
    const deptOther = await prisma.department.create({ data: { name: `DeptOth_${suffix}`, collegeId: collegeOther.id } });
    created.departmentIds.push(deptOther.id);

    const termCurrent = await prisma.academicTerm.findFirstOrThrow({ where: { isCurrent: true } });

    const course = await prisma.course.create({
      data: { name: `Course_${suffix}`, courseCode: `C_${suffix}`, departmentId: dept.id, credits: 3 },
    });
    created.courseIds.push(course.id);
    const courseOther = await prisma.course.create({
      data: { name: `CourseOth_${suffix}`, courseCode: `COth_${suffix}`, departmentId: deptOther.id, credits: 3 },
    });
    created.courseIds.push(courseOther.id);

    // Doctor teaching course
    const docUser = await prisma.user.create({
      data: { email: `doc_${suffix}@uni.edu`, password: passwordHash, role: 'DOCTOR', departmentId: dept.id },
    });
    created.userIds.push(docUser.id);
    const docDoctor = await prisma.doctor.create({
      data: { userId: docUser.id, departmentId: dept.id, doctorId: `DOC_${suffix}`, firstName: 'Doc', lastName: 'T6c' },
    });
    created.doctorIds.push(docDoctor.id);
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
    created.slotIds.push(slot.id);

    // Doctor of another course
    const docOtherUser = await prisma.user.create({
      data: { email: `docoth_${suffix}@uni.edu`, password: passwordHash, role: 'DOCTOR', departmentId: deptOther.id },
    });
    created.userIds.push(docOtherUser.id);
    const docOtherDoctor = await prisma.doctor.create({
      data: { userId: docOtherUser.id, departmentId: deptOther.id, doctorId: `DOCOTH_${suffix}`, firstName: 'DocOth', lastName: 'T6c' },
    });
    created.doctorIds.push(docOtherDoctor.id);
    const docOtherToken = generateAccessToken(docOtherUser.id, docOtherUser.tokenVersion);

    // TA profile
    const taUser = await prisma.user.create({
      data: { email: `ta_${suffix}@uni.edu`, password: passwordHash, role: 'TEACHING_ASSISTANT', departmentId: dept.id },
    });
    created.userIds.push(taUser.id);
    const taProfile = await prisma.teachingAssistant.create({
      data: { userId: taUser.id, departmentId: dept.id, employeeId: `EMP_${suffix}`, firstName: 'Ta', lastName: 'T6c' },
    });
    created.taIds.push(taProfile.id);
    const taToken = generateAccessToken(taUser.id, taUser.tokenVersion);

    // College admin of other college
    const adminOtherUser = await prisma.user.create({
      data: { email: `adminoth_${suffix}@uni.edu`, password: passwordHash, role: 'COLLEGE_ADMIN', departmentId: deptOther.id, collegeId: collegeOther.id },
    });
    created.userIds.push(adminOtherUser.id);
    const adminOtherToken = generateAccessToken(adminOtherUser.id, adminOtherUser.tokenVersion);

    // Enrolled student
    const studentUser = await prisma.user.create({
      data: { email: `stu_${suffix}@uni.edu`, password: passwordHash, role: 'STUDENT', departmentId: dept.id },
    });
    created.userIds.push(studentUser.id);
    const student = await prisma.student.create({
      data: { userId: studentUser.id, departmentId: dept.id, studentId: `ST_${suffix}`, firstName: 'Stu', lastName: 'T6c', year: 1 },
    });
    created.studentIds.push(student.id);
    const studentToken = generateAccessToken(studentUser.id, studentUser.tokenVersion);

    // Non-enrolled student
    const studentUserNonEnrolled = await prisma.user.create({
      data: { email: `stunon_${suffix}@uni.edu`, password: passwordHash, role: 'STUDENT', departmentId: dept.id },
    });
    created.userIds.push(studentUserNonEnrolled.id);
    const studentNonEnrolled = await prisma.student.create({
      data: { userId: studentUserNonEnrolled.id, departmentId: dept.id, studentId: `STNON_${suffix}`, firstName: 'StuNon', lastName: 'T6c', year: 1 },
    });
    created.studentIds.push(studentNonEnrolled.id);
    const studentNonEnrolledToken = generateAccessToken(studentUserNonEnrolled.id, studentUserNonEnrolled.tokenVersion);

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
    created.enrollmentIds.push(enrollment.id);

    return {
      college,
      collegeOther,
      dept,
      deptOther,
      termCurrent,
      course,
      courseOther,
      slot,
      docUser,
      docDoctor,
      docToken,
      docOtherUser,
      docOtherDoctor,
      docOtherToken,
      taUser,
      taProfile,
      taToken,
      adminOtherUser,
      adminOtherToken,
      studentUser,
      student,
      studentToken,
      studentUserNonEnrolled,
      studentNonEnrolled,
      studentNonEnrolledToken,
      enrollment,
      cleanup,
    };
  } catch (err) {
    await cleanup();
    throw err;
  }
}

async function createQuizFixture(ctx: FixtureContext) {
  const exam = await prisma.exam.create({
    data: {
      courseId: ctx.course.id,
      termId: ctx.termCurrent.id,
      academicYear: 2026,
      semester: 1,
      type: 'QUIZ',
      title: 'Midterm Quiz',
      date: new Date(),
      startTime: '00:00',
      endTime: '23:59',
      room: 'Lab 101',
      durationMinutes: 60,
    },
  });

  const question = await prisma.examQuestion.create({
    data: {
      examId: exam.id,
      text: 'What is 2+2?',
      type: 'MCQ',
      optionA: '4',
      optionB: '5',
      optionC: '6',
      optionD: '7',
      correctAnswer: 'A',
      points: 2,
      order: 1,
    },
  });

  return { exam, question };
}

// (a) after a student started: question add, update (text, correctAnswer, points) and delete return 409 and DB rows unchanged
test('(a) after a student started: question add, update and delete return 409 and DB rows unchanged', async () => {
  const suffix = makeSuffix('t6c_a');
  const ctx = await setupTestContext(suffix);
  try {
    const baseUrl = await getTestBaseUrl();
    const { exam, question } = await createQuizFixture(ctx);

    // Student starts exam
    const stuHeaders = { Authorization: `Bearer ${ctx.studentToken}`, 'Content-Type': 'application/json' };
    const resStart = await fetch(`${baseUrl}/exams/${exam.id}/start`, { method: 'POST', headers: stuHeaders });
    assert.strictEqual(resStart.status, 201);

    const docHeaders = { Authorization: `Bearer ${ctx.docToken}`, 'Content-Type': 'application/json' };

    // 1. Attempt question add -> expect 409 QUIZ_LOCKED_AFTER_ATTEMPT:
    const resAdd = await fetch(`${baseUrl}/exams/${exam.id}/questions`, {
      method: 'POST',
      headers: docHeaders,
      body: JSON.stringify({
        text: 'New Question After Start',
        type: 'MCQ',
        optionA: 'Opt1',
        optionB: 'Opt2',
        correctAnswer: 'A',
        points: 1,
      }),
    });
    assert.strictEqual(resAdd.status, 409, 'Adding question after start must return 409');
    const bodyAdd = await resAdd.json();
    assert.match(bodyAdd.message, /^QUIZ_LOCKED_AFTER_ATTEMPT:/, 'Error message must start with QUIZ_LOCKED_AFTER_ATTEMPT:');

    // 2. Attempt question update (text, correctAnswer, points) -> expect 409 QUIZ_LOCKED_AFTER_ATTEMPT:
    const resUpdate = await fetch(`${baseUrl}/exams/questions/${question.id}`, {
      method: 'PUT',
      headers: docHeaders,
      body: JSON.stringify({
        text: 'Modified Question Text',
        correctAnswer: 'B',
        points: 5,
      }),
    });
    assert.strictEqual(resUpdate.status, 409, 'Updating question after start must return 409');
    const bodyUpdate = await resUpdate.json();
    assert.match(bodyUpdate.message, /^QUIZ_LOCKED_AFTER_ATTEMPT:/, 'Error message must start with QUIZ_LOCKED_AFTER_ATTEMPT:');

    // 3. Attempt question delete -> expect 409 QUIZ_LOCKED_AFTER_ATTEMPT:
    const resDelete = await fetch(`${baseUrl}/exams/questions/${question.id}`, {
      method: 'DELETE',
      headers: docHeaders,
    });
    assert.strictEqual(resDelete.status, 409, 'Deleting question after start must return 409');
    const bodyDelete = await resDelete.json();
    assert.match(bodyDelete.message, /^QUIZ_LOCKED_AFTER_ATTEMPT:/, 'Error message must start with QUIZ_LOCKED_AFTER_ATTEMPT:');

    // Verify DB rows unchanged
    const questionsCount = await prisma.examQuestion.count({ where: { examId: exam.id } });
    assert.strictEqual(questionsCount, 1, 'Question count must remain exactly 1');

    const freshQuestion = await prisma.examQuestion.findUniqueOrThrow({ where: { id: question.id } });
    assert.strictEqual(freshQuestion.text, 'What is 2+2?', 'Question text must not have changed');
    assert.strictEqual(freshQuestion.correctAnswer, 'A', 'Correct answer must not have changed');
    assert.strictEqual(freshQuestion.points, 2, 'Points must not have changed');
  } finally {
    await ctx.cleanup();
  }
});

// (b) the same after submit
test('(b) after a student submitted: question add, update and delete return 409 and DB rows unchanged', async () => {
  const suffix = makeSuffix('t6c_b');
  const ctx = await setupTestContext(suffix);
  try {
    const baseUrl = await getTestBaseUrl();
    const { exam, question } = await createQuizFixture(ctx);

    // Student starts and submits exam
    const stuHeaders = { Authorization: `Bearer ${ctx.studentToken}`, 'Content-Type': 'application/json' };
    const resStart = await fetch(`${baseUrl}/exams/${exam.id}/start`, { method: 'POST', headers: stuHeaders });
    assert.strictEqual(resStart.status, 201);

    const resSubmit = await fetch(`${baseUrl}/exams/${exam.id}/submit`, {
      method: 'POST',
      headers: stuHeaders,
      body: JSON.stringify({ answers: { [question.id.toString()]: 'A' } }),
    });
    assert.strictEqual(resSubmit.status, 200);

    const docHeaders = { Authorization: `Bearer ${ctx.docToken}`, 'Content-Type': 'application/json' };

    // 1. Add question -> 409
    const resAdd = await fetch(`${baseUrl}/exams/${exam.id}/questions`, {
      method: 'POST',
      headers: docHeaders,
      body: JSON.stringify({
        text: 'New Question After Submit',
        type: 'MCQ',
        optionA: 'Opt1',
        optionB: 'Opt2',
        correctAnswer: 'A',
      }),
    });
    assert.strictEqual(resAdd.status, 409);
    const bodyAdd = await resAdd.json();
    assert.match(bodyAdd.message, /^QUIZ_LOCKED_AFTER_ATTEMPT:/);

    // 2. Update question -> 409
    const resUpdate = await fetch(`${baseUrl}/exams/questions/${question.id}`, {
      method: 'PUT',
      headers: docHeaders,
      body: JSON.stringify({ points: 10 }),
    });
    assert.strictEqual(resUpdate.status, 409);
    const bodyUpdate = await resUpdate.json();
    assert.match(bodyUpdate.message, /^QUIZ_LOCKED_AFTER_ATTEMPT:/);

    // 3. Delete question -> 409
    const resDelete = await fetch(`${baseUrl}/exams/questions/${question.id}`, {
      method: 'DELETE',
      headers: docHeaders,
    });
    assert.strictEqual(resDelete.status, 409);
    const bodyDelete = await resDelete.json();
    assert.match(bodyDelete.message, /^QUIZ_LOCKED_AFTER_ATTEMPT:/);

    // Verify DB rows intact
    const freshQuestion = await prisma.examQuestion.findUniqueOrThrow({ where: { id: question.id } });
    assert.strictEqual(freshQuestion.points, 2);
  } finally {
    await ctx.cleanup();
  }
});

// (c) positive control: no attempt = add/update/delete work
test('(c) positive control: no attempt = add/update/delete work', async () => {
  const suffix = makeSuffix('t6c_c');
  const ctx = await setupTestContext(suffix);
  try {
    const baseUrl = await getTestBaseUrl();
    const { exam, question } = await createQuizFixture(ctx);
    const docHeaders = { Authorization: `Bearer ${ctx.docToken}`, 'Content-Type': 'application/json' };

    // 1. Add question works
    const resAdd = await fetch(`${baseUrl}/exams/${exam.id}/questions`, {
      method: 'POST',
      headers: docHeaders,
      body: JSON.stringify({
        text: 'What is 3+3?',
        type: 'MCQ',
        optionA: '6',
        optionB: '7',
        correctAnswer: 'A',
        points: 3,
      }),
    });
    assert.strictEqual(resAdd.status, 201);
    const bodyAdd = await resAdd.json();
    const newQuestionId = bodyAdd.data.id;

    // 2. Update question works
    const resUpdate = await fetch(`${baseUrl}/exams/questions/${newQuestionId}`, {
      method: 'PUT',
      headers: docHeaders,
      body: JSON.stringify({ text: 'What is 3+3 exactly?', points: 4 }),
    });
    assert.strictEqual(resUpdate.status, 200);
    const bodyUpdate = await resUpdate.json();
    assert.strictEqual(bodyUpdate.data.points, 4);

    // 3. Delete question works
    const resDelete = await fetch(`${baseUrl}/exams/questions/${newQuestionId}`, {
      method: 'DELETE',
      headers: docHeaders,
    });
    assert.strictEqual(resDelete.status, 200);

    const checkQ = await prisma.examQuestion.findUnique({ where: { id: newQuestionId } });
    assert.strictEqual(checkQ, null, 'Deleted question must no longer exist in DB');
  } finally {
    await ctx.cleanup();
  }
});

// (d) exam delete with a submission: 409 and rows intact (passes today = FALSE POSITIVE)
test('(d) exam delete with a submission: 409 and rows intact', async () => {
  const suffix = makeSuffix('t6c_d');
  const ctx = await setupTestContext(suffix);
  try {
    const baseUrl = await getTestBaseUrl();
    const { exam } = await createQuizFixture(ctx);

    // Student starts exam
    const stuHeaders = { Authorization: `Bearer ${ctx.studentToken}`, 'Content-Type': 'application/json' };
    const resStart = await fetch(`${baseUrl}/exams/${exam.id}/start`, { method: 'POST', headers: stuHeaders });
    assert.strictEqual(resStart.status, 201);

    const docHeaders = { Authorization: `Bearer ${ctx.docToken}`, 'Content-Type': 'application/json' };
    const resDelete = await fetch(`${baseUrl}/exams/${exam.id}`, {
      method: 'DELETE',
      headers: docHeaders,
    });
    assert.strictEqual(resDelete.status, 409, 'Exam deletion with submission must return 409');
    const bodyDelete = await resDelete.json();
    assert.match(bodyDelete.message, /^QUIZ_LOCKED_AFTER_ATTEMPT:/, 'Message must start with QUIZ_LOCKED_AFTER_ATTEMPT:');

    // Rows intact
    const examCheck = await prisma.exam.findUnique({ where: { id: exam.id } });
    assert.ok(examCheck, 'Exam must still exist in DB');
  } finally {
    await ctx.cleanup();
  }
});

// (e) points -5, NaN, 1.5, "abc", Infinity, over ceiling: 422, negative points cannot free cap budget
test('(e) points -5, NaN, 1.5, "abc", Infinity, over ceiling: 422', async () => {
  const suffix = makeSuffix('t6c_e');
  const ctx = await setupTestContext(suffix);
  try {
    const baseUrl = await getTestBaseUrl();
    const { exam, question } = await createQuizFixture(ctx);
    const docHeaders = { Authorization: `Bearer ${ctx.docToken}`, 'Content-Type': 'application/json' };

    const invalidPointsList = [
      -5,
      NaN,
      1.5,
      'abc',
      Infinity,
      MAX_POINTS_TECHNICAL_CEILING + 1,
    ];

    for (const invalidPoint of invalidPointsList) {
      // Test on question add
      const resAdd = await fetch(`${baseUrl}/exams/${exam.id}/questions`, {
        method: 'POST',
        headers: docHeaders,
        body: JSON.stringify({
          text: `Invalid points test`,
          type: 'MCQ',
          optionA: 'A',
          optionB: 'B',
          correctAnswer: 'A',
          points: invalidPoint,
        }),
      });
      assert.strictEqual(
        resAdd.status,
        422,
        `Adding question with points ${invalidPoint} must return 422, got ${resAdd.status}`,
      );

      // Test on question update
      const resUpdate = await fetch(`${baseUrl}/exams/questions/${question.id}`, {
        method: 'PUT',
        headers: docHeaders,
        body: JSON.stringify({ points: invalidPoint }),
      });
      assert.strictEqual(
        resUpdate.status,
        422,
        `Updating question with points ${invalidPoint} must return 422, got ${resUpdate.status}`,
      );
    }

    // Verify negative points cannot be stored to free budget
    const freshQ = await prisma.examQuestion.findUniqueOrThrow({ where: { id: question.id } });
    assert.strictEqual(freshQ.points, 2, 'Points must remain 2');
  } finally {
    await ctx.cleanup();
  }
});

// (f) HTML tag-like, URI schemes, control chars: 422; valid comparisons: PASS
test('(f) HTML tag-like, URI schemes, control chars: 422; valid comparisons: PASS', async () => {
  const suffix = makeSuffix('t6c_f');
  const ctx = await setupTestContext(suffix);
  try {
    const baseUrl = await getTestBaseUrl();
    const { exam, question } = await createQuizFixture(ctx);
    const docHeaders = { Authorization: `Bearer ${ctx.docToken}`, 'Content-Type': 'application/json' };

    const rejectedPayloads = [
      '<script>',
      '</b>',
      '<!--',
      '<?xml',
      'a<b',
      '<img src=x onerror=1>',
      'javascript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      'Test\x00ControlChar',
      'Test\x07BellChar',
      'Test\x1FUnitSeparator',
    ];

    for (const payload of rejectedPayloads) {
      // 1. On question add: test text and each option
      for (const field of ['text', 'optionA', 'optionB', 'optionC', 'optionD']) {
        const payloadBody: any = {
          text: 'Valid Question Text',
          type: 'MCQ',
          optionA: 'Opt A',
          optionB: 'Opt B',
          correctAnswer: 'A',
          points: 1,
        };
        payloadBody[field] = payload;
        const resAdd = await fetch(`${baseUrl}/exams/${exam.id}/questions`, {
          method: 'POST',
          headers: docHeaders,
          body: JSON.stringify(payloadBody),
        });
        assert.strictEqual(
          resAdd.status,
          422,
          `Adding question with rejected payload in ${field} must return 422, got ${resAdd.status}`,
        );
      }

      // 2. On question update: test text
      const resUpdate = await fetch(`${baseUrl}/exams/questions/${question.id}`, {
        method: 'PUT',
        headers: docHeaders,
        body: JSON.stringify({ text: payload }),
      });
      assert.strictEqual(
        resUpdate.status,
        422,
        `Updating question with rejected payload must return 422, got ${resUpdate.status}`,
      );

      // 3. On Exam create: test title, room
      const resExamCreate = await fetch(`${baseUrl}/exams`, {
        method: 'POST',
        headers: docHeaders,
        body: JSON.stringify({
          courseId: ctx.course.id,
          type: 'QUIZ',
          title: payload,
          date: new Date().toISOString(),
          startTime: '09:00',
          endTime: '10:00',
          room: 'Room 1',
        }),
      });
      assert.strictEqual(
        resExamCreate.status,
        422,
        `Creating exam with rejected payload in title must return 422, got ${resExamCreate.status}`,
      );

      // 4. On Exam update: test room
      const resExamUpdate = await fetch(`${baseUrl}/exams/${exam.id}`, {
        method: 'PUT',
        headers: docHeaders,
        body: JSON.stringify({ room: payload }),
      });
      assert.strictEqual(
        resExamUpdate.status,
        422,
        `Updating exam with rejected payload in room must return 422, got ${resExamUpdate.status}`,
      );
    }

    // Must PASS: "if x < y then z", "a <= b", "x < 5 and y > 3", "5 > 3 && 2 < 4"
    const passPayloads = [
      'if x < y then z',
      'a <= b',
      'x < 5 and y > 3',
      '5 > 3 && 2 < 4',
    ];

    for (const validPayload of passPayloads) {
      // 1. Question add with valid comparison text and option
      const resAdd = await fetch(`${baseUrl}/exams/${exam.id}/questions`, {
        method: 'POST',
        headers: docHeaders,
        body: JSON.stringify({
          text: validPayload,
          type: 'MCQ',
          optionA: validPayload,
          optionB: 'Valid Option',
          correctAnswer: 'A',
          points: 1,
        }),
      });
      assert.strictEqual(
        resAdd.status,
        201,
        `Adding question with valid comparison "${validPayload}" must return 201, got ${resAdd.status}`,
      );
      const bodyAdd = await resAdd.json();
      assert.strictEqual(bodyAdd.data.text, validPayload, 'Question text must match input');
      assert.strictEqual(bodyAdd.data.optionA, validPayload, 'OptionA text must match input');

      // 2. Question update with valid comparison text
      const resUpdate = await fetch(`${baseUrl}/exams/questions/${question.id}`, {
        method: 'PUT',
        headers: docHeaders,
        body: JSON.stringify({ text: validPayload }),
      });
      assert.strictEqual(
        resUpdate.status,
        200,
        `Updating question with valid comparison "${validPayload}" must return 200, got ${resUpdate.status}`,
      );
      const bodyUpdate = await resUpdate.json();
      assert.strictEqual(bodyUpdate.data.text, validPayload, 'Updated question text must match input');

      // 3. Exam create with valid comparison room
      const resExamCreate = await fetch(`${baseUrl}/exams`, {
        method: 'POST',
        headers: docHeaders,
        body: JSON.stringify({
          courseId: ctx.course.id,
          type: 'QUIZ',
          title: `Quiz for ${validPayload}`,
          date: new Date().toISOString(),
          startTime: '09:00',
          endTime: '10:00',
          room: validPayload,
        }),
      });
      assert.strictEqual(
        resExamCreate.status,
        201,
        `Creating exam with valid comparison room "${validPayload}" must return 201, got ${resExamCreate.status}`,
      );
      const bodyExamCreate = await resExamCreate.json();
      assert.strictEqual(bodyExamCreate.data.room, validPayload, 'Exam room must match input');

      // 4. Exam update with valid comparison room
      const resExamUpdate = await fetch(`${baseUrl}/exams/${exam.id}`, {
        method: 'PUT',
        headers: docHeaders,
        body: JSON.stringify({ room: validPayload }),
      });
      assert.strictEqual(
        resExamUpdate.status,
        200,
        `Updating exam with valid comparison room "${validPayload}" must return 200, got ${resExamUpdate.status}`,
      );
      const bodyExamUpdate = await resExamUpdate.json();
      assert.strictEqual(bodyExamUpdate.data.room, validPayload, 'Updated exam room must match input');
    }
  } finally {
    await ctx.cleanup();
  }
});

// (g) length ceilings
test('(g) length ceilings on question text, options, and Exam text fields', async () => {
  const suffix = makeSuffix('t6c_g');
  const ctx = await setupTestContext(suffix);
  try {
    const baseUrl = await getTestBaseUrl();
    const { exam, question } = await createQuizFixture(ctx);
    const docHeaders = { Authorization: `Bearer ${ctx.docToken}`, 'Content-Type': 'application/json' };

    // 1. Question text exceeding MAX_QUESTION_TEXT_LENGTH -> 422
    const oversizedQuestionText = 'A'.repeat(MAX_QUESTION_TEXT_LENGTH + 1);
    const resOverQ = await fetch(`${baseUrl}/exams/${exam.id}/questions`, {
      method: 'POST',
      headers: docHeaders,
      body: JSON.stringify({
        text: oversizedQuestionText,
        type: 'MCQ',
        optionA: 'A',
        optionB: 'B',
        correctAnswer: 'A',
        points: 1,
      }),
    });
    assert.strictEqual(resOverQ.status, 422, 'Oversized question text must return 422');

    // 2. Option text exceeding MAX_OPTION_TEXT_LENGTH -> 422
    const oversizedOptionText = 'B'.repeat(MAX_OPTION_TEXT_LENGTH + 1);
    const resOverOpt = await fetch(`${baseUrl}/exams/${exam.id}/questions`, {
      method: 'POST',
      headers: docHeaders,
      body: JSON.stringify({
        text: 'Valid Question Text',
        type: 'MCQ',
        optionA: oversizedOptionText,
        optionB: 'B',
        correctAnswer: 'A',
        points: 1,
      }),
    });
    assert.strictEqual(resOverOpt.status, 422, 'Oversized option text must return 422');

    // 3. Exam title exceeding MAX_EXAM_TITLE_LENGTH -> 422
    const oversizedTitle = 'T'.repeat(MAX_EXAM_TITLE_LENGTH + 1);
    const resOverTitle = await fetch(`${baseUrl}/exams`, {
      method: 'POST',
      headers: docHeaders,
      body: JSON.stringify({
        courseId: ctx.course.id,
        type: 'QUIZ',
        title: oversizedTitle,
        date: new Date().toISOString(),
        startTime: '09:00',
        endTime: '10:00',
        room: 'Room 1',
      }),
    });
    assert.strictEqual(resOverTitle.status, 422, 'Oversized exam title must return 422');

    // 4. Exam room exceeding MAX_EXAM_ROOM_LENGTH -> 422
    const oversizedRoom = 'R'.repeat(MAX_EXAM_ROOM_LENGTH + 1);
    const resOverRoom = await fetch(`${baseUrl}/exams/${exam.id}`, {
      method: 'PUT',
      headers: docHeaders,
      body: JSON.stringify({ room: oversizedRoom }),
    });
    assert.strictEqual(resOverRoom.status, 422, 'Oversized exam room must return 422');

    // 5. Exam time exceeding MAX_EXAM_TIME_LENGTH -> 422
    const oversizedTime = '1'.repeat(MAX_EXAM_TIME_LENGTH + 1);
    const resOverTime = await fetch(`${baseUrl}/exams/${exam.id}`, {
      method: 'PUT',
      headers: docHeaders,
      body: JSON.stringify({ startTime: oversizedTime }),
    });
    assert.strictEqual(resOverTime.status, 422, 'Oversized exam startTime must return 422');
  } finally {
    await ctx.cleanup();
  }
});

// (h) scope: doctor of another course, TA, student, non-enrolled student, College Admin of another college get no new access (403/404, never 200 and never 500)
test('(h) scope: unauthorized roles receive 403/404, never 200 and never 500', async () => {
  const suffix = makeSuffix('t6c_h');
  const ctx = await setupTestContext(suffix);
  try {
    const baseUrl = await getTestBaseUrl();
    const { exam, question } = await createQuizFixture(ctx);

    const unauthorizedTokens = [
      { role: 'DOCTOR_OTHER_COURSE', token: ctx.docOtherToken },
      { role: 'TEACHING_ASSISTANT', token: ctx.taToken },
      { role: 'STUDENT_ENROLLED', token: ctx.studentToken },
      { role: 'STUDENT_NON_ENROLLED', token: ctx.studentNonEnrolledToken },
      { role: 'COLLEGE_ADMIN_OTHER', token: ctx.adminOtherToken },
    ];

    for (const { role, token } of unauthorizedTokens) {
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

      // 1. Attempt question add
      const resAdd = await fetch(`${baseUrl}/exams/${exam.id}/questions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: 'Unauthorized Question',
          type: 'MCQ',
          optionA: '1',
          optionB: '2',
          correctAnswer: 'A',
          points: 1,
        }),
      });
      assert.ok(
        resAdd.status === 403 || resAdd.status === 404,
        `Role ${role} on add question must receive 403 or 404, got ${resAdd.status}`,
      );

      // 2. Attempt question update
      const resUpdate = await fetch(`${baseUrl}/exams/questions/${question.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ text: 'Unauthorized Update' }),
      });
      assert.ok(
        resUpdate.status === 403 || resUpdate.status === 404,
        `Role ${role} on update question must receive 403 or 404, got ${resUpdate.status}`,
      );

      // 3. Attempt question delete
      const resDelete = await fetch(`${baseUrl}/exams/questions/${question.id}`, {
        method: 'DELETE',
        headers,
      });
      assert.ok(
        resDelete.status === 403 || resDelete.status === 404,
        `Role ${role} on delete question must receive 403 or 404, got ${resDelete.status}`,
      );

      // 4. Attempt exam delete
      const resExamDelete = await fetch(`${baseUrl}/exams/${exam.id}`, {
        method: 'DELETE',
        headers,
      });
      assert.ok(
        resExamDelete.status === 403 || resExamDelete.status === 404,
        `Role ${role} on delete exam must receive 403 or 404, got ${resExamDelete.status}`,
      );
    }
  } finally {
    await ctx.cleanup();
  }
});
