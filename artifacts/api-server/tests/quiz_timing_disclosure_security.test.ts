import assert from "node:assert/strict";
import prisma from "../src/utils/prismaClient";
import { AuthorizationError, NotFoundError } from "../src/utils/appError";
import {
  getQuizById,
  getQuizTimingWindow,
} from "../src/controllers/quiz.controller";

type InvocationResult = { body?: any; error?: any; statusCode?: number };

async function invoke(handler: any, request: any): Promise<InvocationResult> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Controller did not finish")),
      2_000,
    );
    let statusCode = 200;
    const finish = (result: InvocationResult) => {
      clearTimeout(timeout);
      resolve(result);
    };
    const response = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: any) {
        finish({ body, statusCode });
        return this;
      },
    };
    handler(request, response, (error?: unknown) =>
      finish({ error, statusCode }),
    );
  });
}

async function runQuizTimingDisclosureSecurityTests() {
  const originalQuizFindFirst = prisma.quiz.findFirst;
  const originalQuizFindUnique = prisma.quiz.findUnique;
  const originalQuestionFindMany = prisma.question.findMany;
  const originalSubmissionFindFirst = prisma.quizSubmission.findFirst;
  const originalEnrollmentFindUnique = prisma.enrollment.findUnique;

  const enrolledStudent = {
    id: 10,
    role: "STUDENT",
    student: { id: 100, departmentId: 1, year: 2 },
  };

  const courseDoctor = {
    id: 20,
    role: "DOCTOR",
    doctor: { id: 200, departmentId: 1 },
  };

  const superAdmin = {
    id: 999,
    role: "SUPER_ADMIN",
  };

  const teachingAssistant = {
    id: 30,
    role: "TEACHING_ASSISTANT",
    teachingAssistant: { id: 300, departmentId: 1 },
  };

  const tStart = new Date("2026-09-08T10:00:00.000Z");
  const tEnd = new Date("2026-09-08T10:30:00.000Z");
  const duration = 30; // 30 minutes

  const mockQuizRecord = {
    id: 50,
    title: "Operating Systems Quiz 1",
    description: "Process Synchronization",
    courseId: 5,
    academicYear: 2026,
    semester: 1,
    doctorId: 200,
    duration,
    startTime: tStart,
    endTime: tEnd,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    course: { id: 5, name: "Operating Systems", courseCode: "CS301" },
    doctor: { id: 200, firstName: "Ada", lastName: "Lovelace" },
  };

  const mockQuestionsInDb = [
    {
      id: 1,
      quizId: 50,
      text: "What is a mutex?",
      optionA: "Mutual exclusion lock",
      optionB: "Multi-threaded execution",
      optionC: "Memory unit",
      optionD: "None",
      correct: "A",
      points: 2,
    },
    {
      id: 2,
      quizId: 50,
      text: "What is a deadlock?",
      optionA: "Fast thread",
      optionB: "Circular wait condition",
      optionC: "CPU burst",
      optionD: "None",
      correct: "B",
      points: 2,
    },
  ];

  let questionQueryCount = 0;
  let capturedQuestionSelect: any = null;

  try {
    (prisma.enrollment as any).findUnique = async () => ({
      id: 700,
      status: "ENROLLED",
    });
    (prisma.question as any).findMany = async (args: any) => {
      questionQueryCount += 1;
      capturedQuestionSelect = args?.select;
      if (args?.select) {
        return mockQuestionsInDb.map((q) => {
          const res: any = {};
          for (const key of Object.keys(args.select)) {
            if (args.select[key]) res[key] = (q as any)[key];
          }
          return res;
        });
      }
      return mockQuestionsInDb;
    };

    (prisma.quizSubmission as any).findFirst = async () => null; // not submitted by default

    // =========================================================================
    // 1. Enrolled student BEFORE start: metadata available, questions/options absent
    // =========================================================================
    (prisma.quiz as any).findFirst = async () => ({ ...mockQuizRecord });
    questionQueryCount = 0;

    const beforeStartRes = await invoke(getQuizById, {
      params: { id: "50" },
      user: enrolledStudent,
      now: new Date("2026-09-08T09:59:59.000Z"), // 1 second before start
    });

    assert.equal(beforeStartRes.error, undefined);
    assert.equal(beforeStartRes.body.data.id, 50);
    assert.equal(beforeStartRes.body.data.title, "Operating Systems Quiz 1");
    assert.deepEqual(
      beforeStartRes.body.data.questions,
      [],
      "Questions must be empty array before start",
    );
    assert.equal(
      questionQueryCount,
      0,
      "Database question query must NOT be invoked before start",
    );

    // =========================================================================
    // 2. Exact start boundary: now === startsAt -> questions available (without correct)
    // =========================================================================
    questionQueryCount = 0;
    capturedQuestionSelect = null;

    const exactStartRes = await invoke(getQuizById, {
      params: { id: "50" },
      user: enrolledStudent,
      now: new Date("2026-09-08T10:00:00.000Z"), // Exact start
    });

    assert.equal(exactStartRes.error, undefined);
    assert.equal(exactStartRes.body.data.questions.length, 2);
    assert.equal(
      questionQueryCount,
      1,
      "Question query must be invoked when window is open",
    );
    assert.equal(
      capturedQuestionSelect.correct,
      undefined,
      "Prisma select must NOT include correct answer key",
    );
    assert.equal(
      exactStartRes.body.data.questions[0].correct,
      undefined,
      "Response must never include answer key",
    );
    assert.equal(
      exactStartRes.body.data.questions[0].optionA,
      "Mutual exclusion lock",
    );

    // =========================================================================
    // 3. Enrolled student during active permitted window
    // =========================================================================
    questionQueryCount = 0;
    const midWindowRes = await invoke(getQuizById, {
      params: { id: "50" },
      user: enrolledStudent,
      now: new Date("2026-09-08T10:15:00.000Z"), // Mid-window
    });

    assert.equal(midWindowRes.error, undefined);
    assert.equal(midWindowRes.body.data.questions.length, 2);
    assert.equal(midWindowRes.body.data.questions[0].correct, undefined);
    assert.equal(midWindowRes.body.data.questions[1].correct, undefined);

    // =========================================================================
    // 4. Exact end boundary: now === closesAt -> questions available
    // =========================================================================
    questionQueryCount = 0;
    const exactEndRes = await invoke(getQuizById, {
      params: { id: "50" },
      user: enrolledStudent,
      now: new Date("2026-09-08T10:30:00.000Z"), // Exact close
    });

    assert.equal(exactEndRes.error, undefined);
    assert.equal(exactEndRes.body.data.questions.length, 2);

    // =========================================================================
    // 5. Closed window: now === closesAt + 1ms -> questions absent
    // =========================================================================
    questionQueryCount = 0;
    const afterCloseRes = await invoke(getQuizById, {
      params: { id: "50" },
      user: enrolledStudent,
      now: new Date("2026-09-08T10:30:00.001Z"), // 1ms after close
    });

    assert.equal(afterCloseRes.error, undefined);
    assert.deepEqual(
      afterCloseRes.body.data.questions,
      [],
      "Questions must be empty array after window closes",
    );
    assert.equal(
      questionQueryCount,
      0,
      "Database question query must NOT be invoked when window is closed",
    );

    // =========================================================================
    // 6. Already-submitted student during active window: questions absent
    // =========================================================================
    (prisma.quizSubmission as any).findFirst = async () => ({
      id: 99,
      studentId: 100,
      quizId: 50,
    });
    questionQueryCount = 0;

    const submittedRes = await invoke(getQuizById, {
      params: { id: "50" },
      user: enrolledStudent,
      now: new Date("2026-09-08T10:15:00.000Z"), // Active window, but already submitted
    });

    assert.equal(submittedRes.error, undefined);
    assert.equal(submittedRes.body.data.hasSubmitted, true);
    assert.deepEqual(
      submittedRes.body.data.questions,
      [],
      "Already submitted student must receive questions: []",
    );
    assert.equal(
      questionQueryCount,
      0,
      "Database question query must NOT be invoked for submitted student",
    );
    (prisma.quizSubmission as any).findFirst = async () => null; // reset

    // =========================================================================
    // 7. Unenrolled student denied (403 AuthorizationError)
    // =========================================================================
    (prisma.quiz as any).findFirst = async () => null; // Scoped quiz lookup fails
    (prisma.quiz as any).findUnique = async () => ({ id: 50 }); // Quiz exists in DB

    const unenrolledRes = await invoke(getQuizById, {
      params: { id: "50" },
      user: { id: 99, role: "STUDENT", student: { id: 999 } },
    });

    assert.ok(
      unenrolledRes.error instanceof AuthorizationError,
      "Unenrolled student must receive AuthorizationError",
    );

    // =========================================================================
    // 8. Authorized instructor preview preserved (full questions including correct)
    // =========================================================================
    (prisma.quiz as any).findFirst = async () => ({ ...mockQuizRecord });
    questionQueryCount = 0;

    const doctorPreviewRes = await invoke(getQuizById, {
      params: { id: "50" },
      user: courseDoctor,
      now: new Date("2026-09-08T08:00:00.000Z"), // Doctor previewing hours before start
    });

    assert.equal(doctorPreviewRes.error, undefined);
    assert.equal(doctorPreviewRes.body.data.questions.length, 2);
    assert.equal(
      doctorPreviewRes.body.data.questions[0].correct,
      "A",
      "Doctor must see answer keys in preview",
    );
    assert.equal(doctorPreviewRes.body.data.questions[1].correct, "B");

    // =========================================================================
    // 9. SUPER_ADMIN preview preserved
    // =========================================================================
    const adminPreviewRes = await invoke(getQuizById, {
      params: { id: "50" },
      user: superAdmin,
      now: new Date("2026-09-08T08:00:00.000Z"),
    });

    assert.equal(adminPreviewRes.error, undefined);
    assert.equal(adminPreviewRes.body.data.questions.length, 2);
    assert.equal(adminPreviewRes.body.data.questions[0].correct, "A");

    // =========================================================================
    // 10. TEACHING_ASSISTANT receives no question preview
    // =========================================================================
    questionQueryCount = 0;
    const taRes = await invoke(getQuizById, {
      params: { id: "50" },
      user: teachingAssistant,
      now: new Date("2026-09-08T08:00:00.000Z"),
    });

    assert.equal(taRes.error, undefined);
    assert.deepEqual(
      taRes.body.data.questions,
      [],
      "Teaching Assistant must not receive question preview",
    );
    assert.equal(questionQueryCount, 0);

    // =========================================================================
    // 11. Missing / invalid timing data fails safely (questions: [])
    // =========================================================================
    (prisma.quiz as any).findFirst = async () => ({
      ...mockQuizRecord,
      startTime: null,
      createdAt: "invalid-date",
      duration: -5,
    });
    questionQueryCount = 0;

    const invalidTimingRes = await invoke(getQuizById, {
      params: { id: "50" },
      user: enrolledStudent,
      now: new Date("2026-09-08T10:15:00.000Z"),
    });

    assert.equal(invalidTimingRes.error, undefined);
    assert.deepEqual(
      invalidTimingRes.body.data.questions,
      [],
      "Invalid timing must fail safely with questions: []",
    );
    assert.equal(questionQueryCount, 0);

    // =========================================================================
    // 12. Helper getQuizTimingWindow unit tests
    // =========================================================================
    const windowResult = getQuizTimingWindow({
      startTime: "2026-09-08T10:00:00.000Z",
      endTime: "2026-09-08T10:45:00.000Z",
      createdAt: "2026-09-01T00:00:00.000Z",
      duration: 30, // 30 mins duration is shorter than 45 mins end time
    });
    // Closes at min(10:45, 10:00 + 30m) = 10:30
    assert.equal(
      windowResult.closesAt.toISOString(),
      "2026-09-08T10:30:00.000Z",
    );

    console.log(
      "All 12 Quiz Timing Disclosure Security (SEC-03) tests passed successfully.",
    );
  } finally {
    (prisma.quiz as any).findFirst = originalQuizFindFirst;
    (prisma.quiz as any).findUnique = originalQuizFindUnique;
    (prisma.question as any).findMany = originalQuestionFindMany;
    (prisma.quizSubmission as any).findFirst = originalSubmissionFindFirst;
    (prisma.enrollment as any).findUnique = originalEnrollmentFindUnique;
  }
}

runQuizTimingDisclosureSecurityTests().catch((err) => {
  console.error("Quiz timing disclosure security tests failed:", err);
  process.exit(1);
});
