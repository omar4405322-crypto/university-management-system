import assert from "node:assert/strict";
import prisma from "../src/utils/prismaClient";
import {
  calculateExamScore,
  cancelExam,
  getExamSubmissions,
  gradeSubmission as gradeExamSubmission,
  submitExam,
} from "../src/controllers/exams.controller";
import { TaskService } from "../src/services/task.service";

type HandlerResult = { body?: any; error?: any };

function invoke(handler: any, req: any): Promise<HandlerResult> {
  return new Promise((resolve) => {
    handler(req, { json: (body: any) => resolve({ body }) }, (error: any) =>
      resolve({ error }),
    );
  });
}

const originals = {
  studentFindUnique: prisma.student.findUnique,
  examFindUnique: prisma.exam.findUnique,
  examFindFirst: prisma.exam.findFirst,
  enrollmentFindUnique: prisma.enrollment.findUnique,
  submissionFindUnique: prisma.examSubmission.findUnique,
  submissionFindMany: prisma.examSubmission.findMany,
  submissionUpdateMany: prisma.examSubmission.updateMany,
  questionFindMany: prisma.examQuestion.findMany,
  auditCreate: prisma.auditLog.create,
  transaction: prisma.$transaction,
};

async function run() {
  console.log("--- Starting Assessment Submission Integrity Suite ---");

  const falseQuestion = [
    { id: 1, type: "TRUE_FALSE", correctAnswer: "FALSE", points: 2 },
  ];
  assert.equal(calculateExamScore(falseQuestion, { 1: "" }).score, 0);
  assert.equal(calculateExamScore(falseQuestion, { 1: "malformed" }).score, 0);
  assert.equal(
    calculateExamScore(falseQuestion, { 1: ["FALSE"] } as any).score,
    0,
  );
  assert.equal(calculateExamScore(falseQuestion, { 1: false } as any).score, 2);
  assert.equal(calculateExamScore(falseQuestion, { 1: 0 } as any).score, 2);
  console.log(
    "✓ Finding 8: malformed/empty true-false answers receive no credit; explicit false values remain valid",
  );

  let response: HandlerResult;
  (prisma.exam as any).findFirst = async () => ({ id: 10 });
  (prisma.examQuestion as any).findMany = async () => falseQuestion;
  (prisma.examSubmission as any).findMany = async () => [
    {
      id: 20,
      examId: 10,
      studentId: 30,
      answers: { 1: "" },
      score: null,
      maxScore: null,
      status: "PENDING",
      submittedAt: null,
    },
  ];
  response = await invoke(getExamSubmissions, {
    params: { id: "10" },
    user: { id: 1, role: "SUPER_ADMIN" },
  });
  assert.equal(response.body.data[0].status, "PENDING");
  assert.equal(response.body.data[0].score, null);
  assert.equal(response.body.data[0].maxScore, null);
  assert.equal(response.body.data[0].provisionalScore, 0);
  assert.equal(response.body.data[0].provisionalMaxScore, 2);
  console.log(
    "✓ Finding 9: PENDING list rows preserve stored status/score and label computed values as provisional",
  );

  let initialReadCount = 0;
  let releaseInitialReads!: () => void;
  const bothInitialReads = new Promise<void>((resolve) => {
    releaseInitialReads = resolve;
  });
  let persistedStatus = "PENDING";
  const guardedUpdates: any[] = [];

  (prisma.student as any).findUnique = async () => ({ id: 30 });
  (prisma.exam as any).findUnique = async () => ({
    id: 10,
    courseId: 40,
    academicYear: 2026,
    semester: 1,
  });
  (prisma.enrollment as any).findUnique = async () => ({
    id: 50,
    status: "ENROLLED",
  });
  (prisma.examQuestion as any).findMany = async () => [];
  (prisma.examSubmission as any).findUnique = async () => {
    initialReadCount += 1;
    if (initialReadCount === 2) releaseInitialReads();
    await bothInitialReads;
    return {
      id: 20,
      examId: 10,
      studentId: 30,
      status: "PENDING",
      answers: {},
    };
  };
  (prisma.auditLog as any).create = async () => ({});
  (prisma as any).$transaction = async (callback: any) =>
    callback({
      examSubmission: {
        updateMany: async (args: any) => {
          guardedUpdates.push(args);
          if (persistedStatus !== "PENDING") return { count: 0 };
          persistedStatus = args.data.status;
          return { count: 1 };
        },
        findUnique: async () => ({
          id: 20,
          examId: 10,
          studentId: 30,
          status: persistedStatus,
          answers: {},
        }),
      },
      examViolation: {
        create: async () => ({}),
        createMany: async () => ({ count: 0 }),
      },
    });

  const requestBase = {
    params: { id: "10" },
    user: { id: 1, role: "STUDENT" },
    ip: "127.0.0.1",
    get: () => undefined,
  };
  const race = await Promise.all([
    invoke(submitExam, {
      ...requestBase,
      body: { answers: {}, antiCheatLogs: [] },
    }),
    invoke(cancelExam, {
      ...requestBase,
      body: { reason: "test", antiCheatLogs: [] },
    }),
  ]);
  assert.equal(race.filter((result) => result.body).length, 1);
  assert.equal(
    race.filter((result) => result.error?.statusCode === 409).length,
    1,
  );
  assert.equal(guardedUpdates.length, 2);
  assert.ok(guardedUpdates.every((args) => args.where.status === "PENDING"));
  console.log(
    "✓ Finding 6: concurrent submit/cancel produces one terminal transition and one 409 conflict",
  );

  let manualGradeWhere: any;
  (prisma.examSubmission as any).findUnique = async () => ({
    id: 21,
    examId: 10,
    status: "CANCELLED_CHEATING",
    maxScore: 10,
  });
  (prisma.exam as any).findFirst = async () => ({ id: 10 });
  (prisma.examSubmission as any).updateMany = async (args: any) => {
    manualGradeWhere = args.where;
    return { count: 0 };
  };
  response = await invoke(gradeExamSubmission, {
    params: { submissionId: "21" },
    body: { score: 5 },
    user: { id: 1, role: "SUPER_ADMIN" },
  });
  assert.equal(response.error?.statusCode, 409);
  assert.deepEqual(manualGradeWhere.status.in, ["PENDING", "GRADED"]);
  console.log(
    "✓ Finding 6: manual grading rejects CANCELLED_CHEATING unless a separate reversal occurs",
  );

  const viewedRevision = new Date("2026-09-01T10:00:00.000Z");
  const currentRevision = new Date("2026-09-01T10:05:00.000Z");
  let taskGradeWhere: any;
  (prisma as any).$transaction = async (callback: any) =>
    callback({
      taskSubmission: {
        findUnique: async () => ({
          id: 70,
          taskId: 60,
          studentId: 80,
          submittedAt: currentRevision,
          score: null,
          feedback: "new revision feedback",
          task: {
            id: 60,
            doctorId: 90,
            isDeleted: false,
            maxScore: 100,
            course: { departmentId: 2, department: { collegeId: 1 } },
          },
        }),
        updateMany: async (args: any) => {
          taskGradeWhere = args.where;
          return { count: 0 };
        },
      },
    });
  await assert.rejects(
    TaskService.gradeSubmission(
      { id: 1, role: "SUPER_ADMIN" },
      60,
      70,
      75,
      "reviewed",
      viewedRevision,
    ),
    (error: any) => error?.statusCode === 409,
  );
  assert.equal(taskGradeWhere.taskId, 60);
  assert.equal(taskGradeWhere.submittedAt.getTime(), viewedRevision.getTime());
  assert.equal(taskGradeWhere.feedback, "new revision feedback");
  console.log(
    "✓ Finding 7: grading a superseded task revision fails with a 409 conflict",
  );
}

try {
  await run();
} finally {
  (prisma.student as any).findUnique = originals.studentFindUnique;
  (prisma.exam as any).findUnique = originals.examFindUnique;
  (prisma.exam as any).findFirst = originals.examFindFirst;
  (prisma.enrollment as any).findUnique = originals.enrollmentFindUnique;
  (prisma.examSubmission as any).findUnique = originals.submissionFindUnique;
  (prisma.examSubmission as any).findMany = originals.submissionFindMany;
  (prisma.examSubmission as any).updateMany = originals.submissionUpdateMany;
  (prisma.examQuestion as any).findMany = originals.questionFindMany;
  (prisma.auditLog as any).create = originals.auditCreate;
  (prisma as any).$transaction = originals.transaction;
}

console.log("--- Assessment Submission Integrity Suite Passed ---");
