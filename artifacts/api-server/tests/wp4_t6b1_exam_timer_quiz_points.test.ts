import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import prisma from '../src/utils/prismaClient';
import app from '../src/app';
import { generateAccessToken } from '../src/utils/jwt.utils';
import { toHundredths } from '../src/utils/gradeMath.utils';
import { calculateAutoQuiz } from '../src/quiz/quizGradeCalculator';

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
  collegeOther: any;
  dept: any;
  deptOther: any;
  termCurrent: any;
  termPast: any;
  course: any;
  courseOther: any;
  slot: any;
  slotOther: any;
  docUser: any;
  docDoctor: any;
  docToken: string;
  docOtherUser: any;
  docOtherDoctor: any;
  docOtherToken: string;
  taUser: any;
  taToken: string;
  colAdminOtherUser: any;
  colAdminOtherToken: string;
  studentUser: any;
  student: any;
  studentToken: string;
  studentNonEnrolledUser: any;
  studentNonEnrolled: any;
  studentNonEnrolledToken: string;
  enrollment: any;
  cleanup: () => Promise<void>;
}

async function setupTestContext(suffix: string): Promise<FixtureContext> {
  // Colleges & Depts
  const college = await prisma.college.create({ data: { name: `Col_${suffix}` } });
  const collegeOther = await prisma.college.create({ data: { name: `ColOth_${suffix}` } });
  const dept = await prisma.department.create({ data: { name: `Dept_${suffix}`, collegeId: college.id } });
  const deptOther = await prisma.department.create({ data: { name: `DeptOth_${suffix}`, collegeId: collegeOther.id } });

  // Terms
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

  // Courses
  const course = await prisma.course.create({
    data: { name: `Course_${suffix}`, courseCode: `C_${suffix}`, departmentId: dept.id, credits: 3 },
  });
  const courseOther = await prisma.course.create({
    data: { name: `CourseOth_${suffix}`, courseCode: `CO_${suffix}`, departmentId: deptOther.id, credits: 3 },
  });

  // Doctor 1 (Teaches course)
  const docUser = await prisma.user.create({
    data: { email: `doc_${suffix}@uni.edu`, password: passwordHash, role: 'DOCTOR', departmentId: dept.id },
  });
  const docDoctor = await prisma.doctor.create({
    data: { userId: docUser.id, departmentId: dept.id, doctorId: `DOC_${suffix}`, firstName: 'Doc', lastName: 'Main' },
  });
  const docToken = generateAccessToken(docUser.id, docUser.tokenVersion);

  // Doctor Other (Teaches courseOther)
  const docOtherUser = await prisma.user.create({
    data: { email: `doc_oth_${suffix}@uni.edu`, password: passwordHash, role: 'DOCTOR', departmentId: deptOther.id },
  });
  const docOtherDoctor = await prisma.doctor.create({
    data: { userId: docOtherUser.id, departmentId: deptOther.id, doctorId: `DOCO_${suffix}`, firstName: 'Doc', lastName: 'Other' },
  });
  const docOtherToken = generateAccessToken(docOtherUser.id, docOtherUser.tokenVersion);

  // Teaching Assistant
  const taUser = await prisma.user.create({
    data: { email: `ta_${suffix}@uni.edu`, password: passwordHash, role: 'TEACHING_ASSISTANT', departmentId: dept.id },
  });
  await prisma.teachingAssistant.create({
    data: { userId: taUser.id, departmentId: dept.id, employeeId: `TA_${suffix}` },
  });
  const taToken = generateAccessToken(taUser.id, taUser.tokenVersion);

  // College Admin of Other College
  const colAdminOtherUser = await prisma.user.create({
    data: { email: `ca_oth_${suffix}@uni.edu`, password: passwordHash, role: 'COLLEGE_ADMIN', collegeId: collegeOther.id, managedCollegeId: collegeOther.id },
  });
  const colAdminOtherToken = generateAccessToken(colAdminOtherUser.id, colAdminOtherUser.tokenVersion);

  // Schedule Slots
  const slot = await prisma.scheduleSlot.create({
    data: { courseId: course.id, doctorId: docDoctor.id, termId: termCurrent.id, dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:00', slotType: 'LECTURE' },
  });
  const slotOther = await prisma.scheduleSlot.create({
    data: { courseId: courseOther.id, doctorId: docOtherDoctor.id, termId: termCurrent.id, dayOfWeek: 'Tuesday', startTime: '09:00', endTime: '10:00', slotType: 'LECTURE' },
  });

  // Enrolled Student
  const studentUser = await prisma.user.create({
    data: { email: `stu_${suffix}@uni.edu`, password: passwordHash, role: 'STUDENT', departmentId: dept.id },
  });
  const student = await prisma.student.create({
    data: { userId: studentUser.id, departmentId: dept.id, studentId: `S_${suffix}`, firstName: 'Enrolled', lastName: 'Student', year: 1 },
  });
  const studentToken = generateAccessToken(studentUser.id, studentUser.tokenVersion);

  const enrollment = await prisma.enrollment.create({
    data: { studentId: student.id, courseId: course.id, termId: termCurrent.id, academicYear: 1, semester: 1, status: 'ENROLLED' },
  });

  // Non-enrolled Student
  const studentNonEnrolledUser = await prisma.user.create({
    data: { email: `stu_non_${suffix}@uni.edu`, password: passwordHash, role: 'STUDENT', departmentId: dept.id },
  });
  const studentNonEnrolled = await prisma.student.create({
    data: { userId: studentNonEnrolledUser.id, departmentId: dept.id, studentId: `SN_${suffix}`, firstName: 'Non', lastName: 'Enrolled', year: 1 },
  });
  const studentNonEnrolledToken = generateAccessToken(studentNonEnrolledUser.id, studentNonEnrolledUser.tokenVersion);

  const cleanup = async () => {
    await prisma.courseGradeEntry.deleteMany({ where: { enrollment: { courseId: { in: [course.id, courseOther.id] } } } }).catch(() => {});
    await prisma.courseGradeComponent.deleteMany({ where: { structure: { courseId: { in: [course.id, courseOther.id] } } } }).catch(() => {});
    await prisma.courseGradeStructure.deleteMany({ where: { courseId: { in: [course.id, courseOther.id] } } }).catch(() => {});
    await prisma.examViolation.deleteMany({ where: { submission: { exam: { courseId: { in: [course.id, courseOther.id] } } } } }).catch(() => {});
    await prisma.examSubmission.deleteMany({ where: { exam: { courseId: { in: [course.id, courseOther.id] } } } }).catch(() => {});
    await prisma.examQuestion.deleteMany({ where: { exam: { courseId: { in: [course.id, courseOther.id] } } } }).catch(() => {});
    await prisma.exam.deleteMany({ where: { courseId: { in: [course.id, courseOther.id] } } }).catch(() => {});
    await prisma.enrollment.deleteMany({ where: { courseId: { in: [course.id, courseOther.id] } } }).catch(() => {});
    await prisma.scheduleSlot.deleteMany({ where: { id: { in: [slot.id, slotOther.id] } } }).catch(() => {});
    await prisma.course.deleteMany({ where: { id: { in: [course.id, courseOther.id] } } }).catch(() => {});
    await prisma.doctor.deleteMany({ where: { id: { in: [docDoctor.id, docOtherDoctor.id] } } }).catch(() => {});
    await prisma.teachingAssistant.deleteMany({ where: { userId: taUser.id } }).catch(() => {});
    await prisma.student.deleteMany({ where: { id: { in: [student.id, studentNonEnrolled.id] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [docUser.id, docOtherUser.id, taUser.id, colAdminOtherUser.id, studentUser.id, studentNonEnrolledUser.id] } } }).catch(() => {});
    await prisma.department.deleteMany({ where: { id: { in: [dept.id, deptOther.id] } } }).catch(() => {});
    await prisma.academicTerm.deleteMany({ where: { id: termPast.id } }).catch(() => {});
    await prisma.college.deleteMany({ where: { id: { in: [college.id, collegeOther.id] } } }).catch(() => {});
  };

  return {
    college,
    collegeOther,
    dept,
    deptOther,
    termCurrent,
    termPast,
    course,
    courseOther,
    slot,
    slotOther,
    docUser,
    docDoctor,
    docToken,
    docOtherUser,
    docOtherDoctor,
    docOtherToken,
    taUser,
    taToken,
    colAdminOtherUser,
    colAdminOtherToken,
    studentUser,
    student,
    studentToken,
    studentNonEnrolledUser,
    studentNonEnrolled,
    studentNonEnrolledToken,
    enrollment,
    cleanup,
  };
}

// ==========================================
// D1: Server-side quiz attempt deadline & grace
// ==========================================
test('D1: Late submit inside exam window but past startedAt + duration + grace returns 403', async () => {
  const suffix = makeSuffix('d1_late');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();

  const exam = await prisma.exam.create({
    data: {
      courseId: ctx.course.id,
      academicYear: 1,
      semester: 1,
      termId: ctx.termCurrent.id,
      title: `Quiz_D1_${suffix}`,
      type: 'QUIZ',
      date: new Date(),
      startTime: '08:00',
      endTime: '23:59', // Window open until end of day
      durationMinutes: 30, // 30 minute duration
    },
  });

  const question = await prisma.examQuestion.create({
    data: { examId: exam.id, text: 'Q1', type: 'MCQ', optionA: 'A', optionB: 'B', correctAnswer: 'A', points: 5 },
  });

  // Create submission started 35 minutes ago (30 min duration + 3 min grace = 33 min limit)
  const submission = await prisma.examSubmission.create({
    data: {
      examId: exam.id,
      studentId: ctx.student.id,
      enrollmentId: ctx.enrollment.id,
      answers: {},
      status: 'PENDING',
      startedAt: new Date(Date.now() - 35 * 60 * 1000),
    },
  });

  try {
    const res = await fetch(`${baseUrl}/exams/${exam.id}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ctx.studentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: [{ questionId: question.id, answer: 'A' }] }),
    });

    assert.strictEqual(res.status, 403, `Expected 403 Forbidden for late attempt, got ${res.status}`);
    const subAfter = await prisma.examSubmission.findUnique({ where: { id: submission.id } });
    assert.strictEqual(subAfter?.status, 'PENDING', 'Submission must remain PENDING');
    assert.strictEqual(subAfter?.score, null, 'No score written on late submit');
  } finally {
    await prisma.examSubmission.deleteMany({ where: { examId: exam.id } });
    await prisma.examQuestion.deleteMany({ where: { examId: exam.id } });
    await prisma.exam.delete({ where: { id: exam.id } });
    await ctx.cleanup();
  }
});

test('D1: On-time submit inside duration + grace succeeds with 200/201 and status GRADED', async () => {
  const suffix = makeSuffix('d1_ontime');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();

  const exam = await prisma.exam.create({
    data: {
      courseId: ctx.course.id,
      academicYear: 1,
      semester: 1,
      termId: ctx.termCurrent.id,
      title: `Quiz_D1_Ontime_${suffix}`,
      type: 'QUIZ',
      date: new Date(),
      startTime: '08:00',
      endTime: '23:59',
      durationMinutes: 30,
    },
  });

  const question = await prisma.examQuestion.create({
    data: { examId: exam.id, text: 'Q1', type: 'TRUE_FALSE', correctAnswer: 'TRUE', points: 5 },
  });

  // Started 10 minutes ago (well within 30 + 3 min)
  await prisma.examSubmission.create({
    data: {
      examId: exam.id,
      studentId: ctx.student.id,
      enrollmentId: ctx.enrollment.id,
      answers: {},
      status: 'PENDING',
      startedAt: new Date(Date.now() - 10 * 60 * 1000),
    },
  });

  try {
    const res = await fetch(`${baseUrl}/exams/${exam.id}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ctx.studentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: [{ questionId: question.id, answer: 'TRUE' }] }),
    });

    assert.ok(res.status === 200 || res.status === 201, `Expected 200/201, got ${res.status}`);
    const subAfter = await prisma.examSubmission.findUnique({ where: { examId_studentId: { examId: exam.id, studentId: ctx.student.id } } });
    assert.strictEqual(subAfter?.status, 'GRADED');
    assert.strictEqual(subAfter?.score, 5);
  } finally {
    await prisma.examSubmission.deleteMany({ where: { examId: exam.id } });
    await prisma.examQuestion.deleteMany({ where: { examId: exam.id } });
    await prisma.exam.delete({ where: { id: exam.id } });
    await ctx.cleanup();
  }
});

// ==========================================
// D2: AUTO_QUIZ calculator unit & integration cases
// ==========================================
test('D2: AUTO_QUIZ calculator sums GRADED QUIZ submissions, handles exclusions, OD-29 null-termId, exact hundredths', async () => {
  const suffix = makeSuffix('d2_calc');
  const ctx = await setupTestContext(suffix);

  // Student 2 for other-student exclusion
  const s2User = await prisma.user.create({ data: { email: `s2_${suffix}@uni.edu`, password: passwordHash, role: 'STUDENT', departmentId: ctx.dept.id } });
  const s2Student = await prisma.student.create({ data: { userId: s2User.id, departmentId: ctx.dept.id, studentId: `S2_${suffix}`, firstName: 'S2', lastName: 'Excl', year: 1 } });
  const s2Enrollment = await prisma.enrollment.create({ data: { studentId: s2Student.id, courseId: ctx.course.id, termId: ctx.termCurrent.id, academicYear: 1, semester: 1, status: 'ENROLLED' } });

  // Quiz 1 (Course, TermCurrent): 4.25
  const q1 = await prisma.exam.create({ data: { courseId: ctx.course.id, academicYear: 1, semester: 1, termId: ctx.termCurrent.id, type: 'QUIZ', date: new Date(), startTime: '09:00', endTime: '10:00' } });
  await prisma.examSubmission.create({ data: { examId: q1.id, studentId: ctx.student.id, enrollmentId: ctx.enrollment.id, answers: {}, score: 4.25, maxScore: 5, status: 'GRADED' } });

  // Quiz 2 (Course, TermCurrent): 3.10
  const q2 = await prisma.exam.create({ data: { courseId: ctx.course.id, academicYear: 1, semester: 1, termId: ctx.termCurrent.id, type: 'QUIZ', date: new Date(), startTime: '10:00', endTime: '11:00' } });
  await prisma.examSubmission.create({ data: { examId: q2.id, studentId: ctx.student.id, enrollmentId: ctx.enrollment.id, answers: {}, score: 3.10, maxScore: 5, status: 'GRADED' } });

  // Excluded: Midterm exam (MIDTERM, score 20)
  const exMidterm = await prisma.exam.create({ data: { courseId: ctx.course.id, academicYear: 1, semester: 1, termId: ctx.termCurrent.id, type: 'MIDTERM', date: new Date(), startTime: '11:00', endTime: '12:00' } });
  await prisma.examSubmission.create({ data: { examId: exMidterm.id, studentId: ctx.student.id, enrollmentId: ctx.enrollment.id, answers: {}, score: 20.0, maxScore: 20, status: 'GRADED' } });

  // Excluded: PENDING quiz submission
  const exPending = await prisma.exam.create({ data: { courseId: ctx.course.id, academicYear: 1, semester: 1, termId: ctx.termCurrent.id, type: 'QUIZ', date: new Date(), startTime: '12:00', endTime: '13:00' } });
  await prisma.examSubmission.create({ data: { examId: exPending.id, studentId: ctx.student.id, enrollmentId: ctx.enrollment.id, answers: {}, score: 5.0, maxScore: 5, status: 'PENDING' } });

  // Excluded: CANCELLED_CHEATING quiz submission
  const exCheating = await prisma.exam.create({ data: { courseId: ctx.course.id, academicYear: 1, semester: 1, termId: ctx.termCurrent.id, type: 'QUIZ', date: new Date(), startTime: '13:00', endTime: '14:00' } });
  await prisma.examSubmission.create({ data: { examId: exCheating.id, studentId: ctx.student.id, enrollmentId: ctx.enrollment.id, answers: {}, score: 5.0, maxScore: 5, status: 'CANCELLED_CHEATING' } });

  // Excluded: Other course quiz
  const exOtherCourse = await prisma.exam.create({ data: { courseId: ctx.courseOther.id, academicYear: 1, semester: 1, termId: ctx.termCurrent.id, type: 'QUIZ', date: new Date(), startTime: '14:00', endTime: '15:00' } });
  await prisma.examSubmission.create({ data: { examId: exOtherCourse.id, studentId: ctx.student.id, enrollmentId: ctx.enrollment.id, answers: {}, score: 5.0, maxScore: 5, status: 'GRADED' } });

  // Excluded: Past term quiz
  const exPastTerm = await prisma.exam.create({ data: { courseId: ctx.course.id, academicYear: 1, semester: 1, termId: ctx.termPast.id, type: 'QUIZ', date: new Date(), startTime: '15:00', endTime: '16:00' } });
  await prisma.examSubmission.create({ data: { examId: exPastTerm.id, studentId: ctx.student.id, enrollmentId: ctx.enrollment.id, answers: {}, score: 5.0, maxScore: 5, status: 'GRADED' } });

  // Excluded: Other student submission
  const qOtherStu = await prisma.exam.create({ data: { courseId: ctx.course.id, academicYear: 1, semester: 1, termId: ctx.termCurrent.id, type: 'QUIZ', date: new Date(), startTime: '16:00', endTime: '17:00' } });
  await prisma.examSubmission.create({ data: { examId: qOtherStu.id, studentId: s2Student.id, enrollmentId: s2Enrollment.id, answers: {}, score: 5.0, maxScore: 5, status: 'GRADED' } });

  // Expected computed from fixture inputs: 4.25 + 3.10 = 7.35
  const expectedSum = (toHundredths(4.25) + toHundredths(3.10)) / 100;

  try {
    const calcScore = await prisma.$transaction(async (tx) => {
      return await calculateAutoQuiz({
        enrollmentId: ctx.enrollment.id,
        courseId: ctx.course.id,
        termId: ctx.termCurrent.id,
        tx,
      });
    });

    assert.strictEqual(calcScore, expectedSum, `Expected score ${expectedSum}, got ${calcScore}`);

    // OD-29: Quiz with null termId included ONLY when term is current
    const qNullTerm = await prisma.exam.create({ data: { courseId: ctx.course.id, academicYear: 1, semester: 1, termId: null, type: 'QUIZ', date: new Date(), startTime: '17:00', endTime: '18:00' } });
    await prisma.examSubmission.create({ data: { examId: qNullTerm.id, studentId: ctx.student.id, enrollmentId: ctx.enrollment.id, answers: {}, score: 1.50, maxScore: 5, status: 'GRADED' } });

    const calcWithNullCurrent = await prisma.$transaction(async (tx) => {
      return await calculateAutoQuiz({
        enrollmentId: ctx.enrollment.id,
        courseId: ctx.course.id,
        termId: ctx.termCurrent.id,
        tx,
      });
    });
    // Expected: 7.35 + 1.50 = 8.85
    assert.strictEqual(calcWithNullCurrent, 8.85, `Expected 8.85 for current term with null-termId exam, got ${calcWithNullCurrent}`);

    // But for past term, null-termId must NOT count
    const calcPastTerm = await prisma.$transaction(async (tx) => {
      return await calculateAutoQuiz({
        enrollmentId: ctx.enrollment.id,
        courseId: ctx.course.id,
        termId: ctx.termPast.id,
        tx,
      });
    });
    // Past term only has exPastTerm (5.0)
    assert.strictEqual(calcPastTerm, 5.0, `Expected 5.0 for past term, got ${calcPastTerm}`);

    // Exact hundredths arithmetic test: 0.1 + 0.2
    const subQ1 = await prisma.examSubmission.findFirst({ where: { examId: q1.id } });
    const subQ2 = await prisma.examSubmission.findFirst({ where: { examId: q2.id } });
    await prisma.examSubmission.update({ where: { id: subQ1!.id }, data: { score: 0.1 } });
    await prisma.examSubmission.update({ where: { id: subQ2!.id }, data: { score: 0.2 } });
    await prisma.examSubmission.delete({ where: { examId_studentId: { examId: qNullTerm.id, studentId: ctx.student.id } } });

    const calcExactHundredths = await prisma.$transaction(async (tx) => {
      return await calculateAutoQuiz({
        enrollmentId: ctx.enrollment.id,
        courseId: ctx.course.id,
        termId: ctx.termCurrent.id,
        tx,
      });
    });
    assert.strictEqual(calcExactHundredths, 0.3, `Expected exact 0.3 without IEEE float drift, got ${calcExactHundredths}`);

    // Verify calculator does NOT write to Enrollment
    const enrollmentBefore = await prisma.enrollment.findUnique({ where: { id: ctx.enrollment.id } });
    await prisma.$transaction(async (tx) => {
      await calculateAutoQuiz({ enrollmentId: ctx.enrollment.id, courseId: ctx.course.id, termId: ctx.termCurrent.id, tx });
    });
    const enrollmentAfter = await prisma.enrollment.findUnique({ where: { id: ctx.enrollment.id } });
    assert.strictEqual(enrollmentBefore?.finalPointsEarned, enrollmentAfter?.finalPointsEarned);
    assert.strictEqual(enrollmentBefore?.status, enrollmentAfter?.status);
  } finally {
    await prisma.examSubmission.deleteMany({ where: { exam: { courseId: { in: [ctx.course.id, ctx.courseOther.id] } } } });
    await prisma.exam.deleteMany({ where: { courseId: { in: [ctx.course.id, ctx.courseOther.id] } } });
    await prisma.enrollment.deleteMany({ where: { id: s2Enrollment.id } });
    await prisma.student.deleteMany({ where: { id: s2Student.id } });
    await prisma.user.deleteMany({ where: { id: s2User.id } });
    await ctx.cleanup();
  }
});

test('D2 Publish E2E: Gradebook publish with AUTO_QUIZ component calculates and completes enrollment', async () => {
  const suffix = makeSuffix('d2_pub_e2e');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.docToken}`, 'Content-Type': 'application/json' };

  // Structure: Manual component (90 max) + AUTO_QUIZ component (10 max)
  const structure = await prisma.courseGradeStructure.create({
    data: {
      courseId: ctx.course.id,
      termId: ctx.termCurrent.id,
      passMark: 50.0,
      components: {
        create: [
          { name: 'Final Exam', maxPoints: 90.0, source: 'MANUAL', displayOrder: 1 },
          { name: 'Online Quizzes', maxPoints: 10.0, source: 'AUTO_QUIZ', displayOrder: 2 },
        ],
      },
    },
    include: { components: true },
  });
  const compFinal = structure.components.find((c) => c.source === 'MANUAL')!;
  const compQuiz = structure.components.find((c) => c.source === 'AUTO_QUIZ')!;

  // Draft grade entry for manual component
  await prisma.courseGradeEntry.create({
    data: { enrollmentId: ctx.enrollment.id, componentId: compFinal.id, score: 80.0, status: 'DRAFT', version: 1 },
  });

  // Student quiz submission
  const quiz = await prisma.exam.create({
    data: { courseId: ctx.course.id, academicYear: 1, semester: 1, termId: ctx.termCurrent.id, type: 'QUIZ', date: new Date(), startTime: '09:00', endTime: '10:00' },
  });
  await prisma.examSubmission.create({
    data: { examId: quiz.id, studentId: ctx.student.id, enrollmentId: ctx.enrollment.id, answers: {}, score: 7.35, maxScore: 10, status: 'GRADED' },
  });

  try {
    const res = await fetch(`${baseUrl}/courses/${ctx.course.id}/gradebook/publish?termId=${ctx.termCurrent.id}`, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);

    const autoEntry = await prisma.courseGradeEntry.findUnique({
      where: { enrollmentId_componentId: { enrollmentId: ctx.enrollment.id, componentId: compQuiz.id } },
    });
    assert.ok(autoEntry, 'AUTO_QUIZ entry must be created');
    assert.strictEqual(autoEntry.score, 7.35);
    assert.strictEqual(autoEntry.status, 'PUBLISHED');

    const enr = await prisma.enrollment.findUnique({ where: { id: ctx.enrollment.id } });
    assert.strictEqual(enr?.status, 'COMPLETED');
    assert.strictEqual(enr?.finalPointsEarned, 80.0 + 7.35);
  } finally {
    await prisma.courseGradeEntry.deleteMany({ where: { enrollmentId: ctx.enrollment.id } });
    await prisma.courseGradeComponent.deleteMany({ where: { structureId: structure.id } });
    await prisma.courseGradeStructure.delete({ where: { id: structure.id } });
    await prisma.examSubmission.deleteMany({ where: { examId: quiz.id } });
    await prisma.exam.delete({ where: { id: quiz.id } });
    await ctx.cleanup();
  }
});

test('D2 Publish: Component maxPoints lowered after quizzes exist returns 409 AUTO_CALCULATOR_INVALID_RESULT with nothing written', async () => {
  const suffix = makeSuffix('d2_pub_exceed');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.docToken}`, 'Content-Type': 'application/json' };

  // Structure: AUTO_QUIZ maxPoints is 5.0
  const structure = await prisma.courseGradeStructure.create({
    data: {
      courseId: ctx.course.id,
      termId: ctx.termCurrent.id,
      passMark: 50.0,
      components: {
        create: [
          { name: 'Final Exam', maxPoints: 95.0, source: 'MANUAL', displayOrder: 1 },
          { name: 'Online Quizzes', maxPoints: 5.0, source: 'AUTO_QUIZ', displayOrder: 2 },
        ],
      },
    },
    include: { components: true },
  });
  const compFinal = structure.components.find((c) => c.source === 'MANUAL')!;
  const compQuiz = structure.components.find((c) => c.source === 'AUTO_QUIZ')!;

  await prisma.courseGradeEntry.create({
    data: { enrollmentId: ctx.enrollment.id, componentId: compFinal.id, score: 80.0, status: 'DRAFT', version: 1 },
  });

  // Student has quizzes totaling 7.35 (> 5.0)
  const quiz = await prisma.exam.create({
    data: { courseId: ctx.course.id, academicYear: 1, semester: 1, termId: ctx.termCurrent.id, type: 'QUIZ', date: new Date(), startTime: '09:00', endTime: '10:00' },
  });
  await prisma.examSubmission.create({
    data: { examId: quiz.id, studentId: ctx.student.id, enrollmentId: ctx.enrollment.id, answers: {}, score: 7.35, maxScore: 10, status: 'GRADED' },
  });

  try {
    const res = await fetch(`${baseUrl}/courses/${ctx.course.id}/gradebook/publish?termId=${ctx.termCurrent.id}`, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({}),
    });

    assert.strictEqual(res.status, 409, `Expected 409 Conflict, got ${res.status}`);
    const json = await res.json();
    assert.match(json.message, /AUTO_CALCULATOR_INVALID_RESULT/);

    // Verify nothing written as PUBLISHED
    const autoEntry = await prisma.courseGradeEntry.findUnique({
      where: { enrollmentId_componentId: { enrollmentId: ctx.enrollment.id, componentId: compQuiz.id } },
    });
    assert.strictEqual(autoEntry, null, 'No entry should be created for failed publish');

    const enr = await prisma.enrollment.findUnique({ where: { id: ctx.enrollment.id } });
    assert.strictEqual(enr?.status, 'ENROLLED', 'Enrollment must remain ENROLLED');
  } finally {
    await prisma.courseGradeEntry.deleteMany({ where: { enrollmentId: ctx.enrollment.id } });
    await prisma.courseGradeComponent.deleteMany({ where: { structureId: structure.id } });
    await prisma.courseGradeStructure.delete({ where: { id: structure.id } });
    await prisma.examSubmission.deleteMany({ where: { examId: quiz.id } });
    await prisma.exam.delete({ where: { id: quiz.id } });
    await ctx.cleanup();
  }
});

// ==========================================
// D3: Cumulative quiz-points cap
// ==========================================
test('D3: Cumulative quiz-points cap on question add/update, two exams, delete budget freeing, parallel adds', async () => {
  const suffix = makeSuffix('d3_cap');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.docToken}`, 'Content-Type': 'application/json' };

  // Structure with AUTO_QUIZ maxPoints = 15.0
  const structure = await prisma.courseGradeStructure.create({
    data: {
      courseId: ctx.course.id,
      termId: ctx.termCurrent.id,
      components: {
        create: [
          { name: 'Quizzes', maxPoints: 15.0, source: 'AUTO_QUIZ', displayOrder: 1 },
        ],
      },
    },
  });

  const quiz1 = await prisma.exam.create({
    data: { courseId: ctx.course.id, academicYear: 1, semester: 1, termId: ctx.termCurrent.id, type: 'QUIZ', date: new Date(), startTime: '09:00', endTime: '10:00' },
  });
  const quiz2 = await prisma.exam.create({
    data: { courseId: ctx.course.id, academicYear: 1, semester: 1, termId: ctx.termCurrent.id, type: 'QUIZ', date: new Date(), startTime: '10:00', endTime: '11:00' },
  });

  try {
    // 1. Add question with 10 points -> succeeds (10 <= 15)
    const res1 = await fetch(`${baseUrl}/exams/${quiz1.id}/questions`, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({ text: 'Q1', type: 'MCQ', correctAnswer: 'A', points: 10 }),
    });
    assert.strictEqual(res1.status, 201, `Expected 201, got ${res1.status}`);
    const q1Data = (await res1.json()).data;

    // 2. Add question with 5 points -> exact fit, succeeds (15 <= 15)
    const res2 = await fetch(`${baseUrl}/exams/${quiz1.id}/questions`, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({ text: 'Q2', type: 'MCQ', correctAnswer: 'B', points: 5 }),
    });
    assert.strictEqual(res2.status, 201, `Expected 201 for exact fit, got ${res2.status}`);
    const q2Data = (await res2.json()).data;

    // 3. Add question with 1 point -> one over (16 > 15) -> 422 QUIZ_POINTS_CAP_EXCEEDED
    const resOver = await fetch(`${baseUrl}/exams/${quiz1.id}/questions`, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({ text: 'Q3', type: 'MCQ', correctAnswer: 'C', points: 1 }),
    });
    assert.strictEqual(resOver.status, 422, `Expected 422 for cap exceeded, got ${resOver.status}`);
    const jsonOver = await resOver.json();
    assert.match(jsonOver.message || jsonOver.code || JSON.stringify(jsonOver), /QUIZ_POINTS_CAP_EXCEEDED/);

    // 4. Across two exams: Adding question to quiz2 in same course-term also rejected
    const resQuiz2 = await fetch(`${baseUrl}/exams/${quiz2.id}/questions`, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({ text: 'Q2_1', type: 'MCQ', correctAnswer: 'A', points: 1 }),
    });
    assert.strictEqual(resQuiz2.status, 422, `Expected 422 across two exams in same course-term, got ${resQuiz2.status}`);

    // 5. Other course-term not counted: exam in courseOther has no cap from this structure
    const quizOther = await prisma.exam.create({
      data: { courseId: ctx.courseOther.id, academicYear: 1, semester: 1, termId: ctx.termCurrent.id, type: 'QUIZ', date: new Date(), startTime: '11:00', endTime: '12:00' },
    });
    const resOther = await fetch(`${baseUrl}/exams/${quizOther.id}/questions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ctx.docOtherToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Q_Oth', type: 'MCQ', correctAnswer: 'A', points: 100 }),
    });
    assert.strictEqual(resOther.status, 201, `Expected 201 for course without AUTO_QUIZ component, got ${resOther.status}`);
    await prisma.examQuestion.deleteMany({ where: { examId: quizOther.id } });
    await prisma.exam.delete({ where: { id: quizOther.id } });

    // 6. Update raising the total: updating Q2 from 5 points to 6 points -> 422
    const resUpdate = await fetch(`${baseUrl}/exams/questions/${q2Data.id}`, {
      method: 'PUT',
      headers: docAuth,
      body: JSON.stringify({ points: 6 }),
    });
    assert.strictEqual(resUpdate.status, 422, `Expected 422 when updating question exceeds cap, got ${resUpdate.status}`);

    // 7. Delete frees budget: delete Q2 (5 points) -> leaves 10 points -> now 5 points available
    const resDel = await fetch(`${baseUrl}/exams/questions/${q2Data.id}`, {
      method: 'DELETE',
      headers: docAuth,
    });
    assert.strictEqual(resDel.status, 200, `Expected 200 on delete, got ${resDel.status}`);

    // Now adding 5 points succeeds
    const resAddAfterDel = await fetch(`${baseUrl}/exams/${quiz1.id}/questions`, {
      method: 'POST',
      headers: docAuth,
      body: JSON.stringify({ text: 'Q_New', type: 'MCQ', correctAnswer: 'A', points: 5 }),
    });
    assert.strictEqual(resAddAfterDel.status, 201, `Expected 201 after deleting freed budget, got ${resAddAfterDel.status}`);
    const qNewData = (await resAddAfterDel.json()).data;
    await prisma.examQuestion.delete({ where: { id: qNewData.id } });

    // 8. Parallel adds: With 5 points remaining budget, launch two parallel requests each asking for 5 points
    const [par1, par2] = await Promise.all([
      fetch(`${baseUrl}/exams/${quiz1.id}/questions`, {
        method: 'POST',
        headers: docAuth,
        body: JSON.stringify({ text: 'Par1', type: 'MCQ', correctAnswer: 'A', points: 5 }),
      }),
      fetch(`${baseUrl}/exams/${quiz1.id}/questions`, {
        method: 'POST',
        headers: docAuth,
        body: JSON.stringify({ text: 'Par2', type: 'MCQ', correctAnswer: 'A', points: 5 }),
      }),
    ]);

    const statuses = [par1.status, par2.status].sort();
    assert.deepStrictEqual(statuses, [201, 422], `Expected exactly one 201 and one 422 in race, got ${statuses.join(', ')}`);
  } finally {
    await prisma.examQuestion.deleteMany({ where: { examId: { in: [quiz1.id, quiz2.id] } } });
    await prisma.exam.deleteMany({ where: { id: { in: [quiz1.id, quiz2.id] } } });
    await prisma.courseGradeComponent.deleteMany({ where: { structureId: structure.id } });
    await prisma.courseGradeStructure.delete({ where: { id: structure.id } });
    await ctx.cleanup();
  }
});

// ==========================================
// D4: Manual-grade bounds validation
// ==========================================
test('D4: Manual-grade score bounds (>= 0, <= maxScore, finite, at most 2 decimals)', async () => {
  const suffix = makeSuffix('d4_bounds');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();
  const docAuth = { Authorization: `Bearer ${ctx.docToken}`, 'Content-Type': 'application/json' };

  const exam = await prisma.exam.create({
    data: { courseId: ctx.course.id, academicYear: 1, semester: 1, termId: ctx.termCurrent.id, type: 'QUIZ', date: new Date(), startTime: '09:00', endTime: '10:00' },
  });

  const submission = await prisma.examSubmission.create({
    data: {
      examId: exam.id,
      studentId: ctx.student.id,
      enrollmentId: ctx.enrollment.id,
      answers: {},
      score: 5,
      maxScore: 10,
      status: 'GRADED',
    },
  });

  try {
    // 1. Negative score -> 422
    const resNeg = await fetch(`${baseUrl}/exams/submissions/${submission.id}/grade`, {
      method: 'PUT',
      headers: docAuth,
      body: JSON.stringify({ score: -1 }),
    });
    assert.strictEqual(resNeg.status, 422, `Expected 422 for negative score, got ${resNeg.status}`);

    // 2. Score > maxScore -> 422
    const resMax = await fetch(`${baseUrl}/exams/submissions/${submission.id}/grade`, {
      method: 'PUT',
      headers: docAuth,
      body: JSON.stringify({ score: 10.01 }),
    });
    assert.strictEqual(resMax.status, 422, `Expected 422 for score > maxScore, got ${resMax.status}`);

    // 3. More than 2 decimals (8.125) -> 422
    const resDec = await fetch(`${baseUrl}/exams/submissions/${submission.id}/grade`, {
      method: 'PUT',
      headers: docAuth,
      body: JSON.stringify({ score: 8.125 }),
    });
    assert.strictEqual(resDec.status, 422, `Expected 422 for score with > 2 decimals, got ${resDec.status}`);

    // 4. Valid score with 2 decimals (8.50) -> 200
    const resValid = await fetch(`${baseUrl}/exams/submissions/${submission.id}/grade`, {
      method: 'PUT',
      headers: docAuth,
      body: JSON.stringify({ score: 8.5 }),
    });
    assert.strictEqual(resValid.status, 200, `Expected 200 for valid score, got ${resValid.status}`);
    const subAfter = await prisma.examSubmission.findUnique({ where: { id: submission.id } });
    assert.strictEqual(subAfter?.score, 8.5);
  } finally {
    await prisma.examSubmission.deleteMany({ where: { examId: exam.id } });
    await prisma.exam.delete({ where: { id: exam.id } });
    await ctx.cleanup();
  }
});

// ==========================================
// D5: IDOR matrix (5 actors x 10 endpoints)
// ==========================================
test('D5: IDOR matrix verification (docOther, ta, student, nonEnrolled, colAdminOther against 10 operations)', async () => {
  const suffix = makeSuffix('d5_idor');
  const ctx = await setupTestContext(suffix);
  const baseUrl = await getTestBaseUrl();

  const exam = await prisma.exam.create({
    data: { courseId: ctx.course.id, academicYear: 1, semester: 1, termId: ctx.termCurrent.id, type: 'QUIZ', date: new Date(), startTime: '09:00', endTime: '10:00' },
  });

  const question = await prisma.examQuestion.create({
    data: { examId: exam.id, text: 'Q_IDOR', type: 'MCQ', correctAnswer: 'A', points: 1 },
  });

  const submission = await prisma.examSubmission.create({
    data: { examId: exam.id, studentId: ctx.student.id, enrollmentId: ctx.enrollment.id, answers: {}, score: 1, maxScore: 1, status: 'PENDING' },
  });

  const actors = [
    { name: 'docOther', token: ctx.docOtherToken },
    { name: 'ta', token: ctx.taToken },
    { name: 'studentEnrolled', token: ctx.studentToken },
    { name: 'studentNonEnrolled', token: ctx.studentNonEnrolledToken },
    { name: 'colAdminOther', token: ctx.colAdminOtherToken },
  ];

  try {
    for (const actor of actors) {
      const headers = { Authorization: `Bearer ${actor.token}`, 'Content-Type': 'application/json' };

      // 1. Exam update (PUT /exams/:id) - only doc of course or admin of college can update
      const resExamUpdate = await fetch(`${baseUrl}/exams/${exam.id}`, { method: 'PUT', headers, body: JSON.stringify({ room: 'NewRoom' }) });
      assert.ok([401, 403, 404].includes(resExamUpdate.status), `Actor ${actor.name} should not update exam, got ${resExamUpdate.status}`);

      // 2. Exam delete (DELETE /exams/:id)
      const resExamDelete = await fetch(`${baseUrl}/exams/${exam.id}`, { method: 'DELETE', headers });
      assert.ok([401, 403, 404, 409].includes(resExamDelete.status), `Actor ${actor.name} should not delete exam, got ${resExamDelete.status}`);

      // 3. Question add (POST /exams/:id/questions)
      const resQAdd = await fetch(`${baseUrl}/exams/${exam.id}/questions`, { method: 'POST', headers, body: JSON.stringify({ text: 'Attack', type: 'MCQ', correctAnswer: 'A', points: 1 }) });
      assert.ok([401, 403, 404].includes(resQAdd.status), `Actor ${actor.name} should not add question, got ${resQAdd.status}`);

      // 4. Question update (PUT /exams/questions/:questionId)
      const resQUpdate = await fetch(`${baseUrl}/exams/questions/${question.id}`, { method: 'PUT', headers, body: JSON.stringify({ text: 'AttackText' }) });
      assert.ok([401, 403, 404].includes(resQUpdate.status), `Actor ${actor.name} should not update question, got ${resQUpdate.status}`);

      // 5. Question delete (DELETE /exams/questions/:questionId)
      const resQDelete = await fetch(`${baseUrl}/exams/questions/${question.id}`, { method: 'DELETE', headers });
      assert.ok([401, 403, 404].includes(resQDelete.status), `Actor ${actor.name} should not delete question, got ${resQDelete.status}`);

      // 6. Grade submission (PUT /exams/submissions/:submissionId/grade)
      const resGrade = await fetch(`${baseUrl}/exams/submissions/${submission.id}/grade`, { method: 'PUT', headers, body: JSON.stringify({ score: 1 }) });
      assert.ok([401, 403, 404].includes(resGrade.status), `Actor ${actor.name} should not grade submission, got ${resGrade.status}`);

      // 7. Submissions list (GET /exams/:id/submissions)
      const resSubmissions = await fetch(`${baseUrl}/exams/${exam.id}/submissions`, { method: 'GET', headers });
      assert.ok([401, 403, 404].includes(resSubmissions.status), `Actor ${actor.name} should not list submissions, got ${resSubmissions.status}`);

      // 8. Start exam (POST /exams/:id/start) - allowed ONLY for enrolled student
      if (actor.name !== 'studentEnrolled') {
        const resStart = await fetch(`${baseUrl}/exams/${exam.id}/start`, { method: 'POST', headers });
        assert.ok([401, 403, 404].includes(resStart.status), `Actor ${actor.name} should not start exam, got ${resStart.status}`);
      }

      // 9. Submit exam (POST /exams/:id/submit) - allowed ONLY for enrolled student
      if (actor.name !== 'studentEnrolled') {
        const resSubmit = await fetch(`${baseUrl}/exams/${exam.id}/submit`, { method: 'POST', headers, body: JSON.stringify({ answers: [] }) });
        assert.ok([401, 403, 404].includes(resSubmit.status), `Actor ${actor.name} should not submit exam, got ${resSubmit.status}`);
      }

      // 10. Questions list (GET /exams/:id/questions) - allowed only for enrolled student, doc of course, or admin of college
      if (['docOther', 'ta', 'studentNonEnrolled', 'colAdminOther'].includes(actor.name)) {
        const resQuestions = await fetch(`${baseUrl}/exams/${exam.id}/questions`, { method: 'GET', headers });
        assert.ok([401, 403, 404].includes(resQuestions.status), `Actor ${actor.name} should not get questions, got ${resQuestions.status}`);
      }
    }
  } finally {
    await prisma.examSubmission.deleteMany({ where: { examId: exam.id } });
    await prisma.examQuestion.deleteMany({ where: { examId: exam.id } });
    await prisma.exam.delete({ where: { id: exam.id } });
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
