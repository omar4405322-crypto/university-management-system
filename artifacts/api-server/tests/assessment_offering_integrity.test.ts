import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import prisma from "../src/utils/prismaClient";
import { TaskService } from "../src/services/task.service";
import { EnrollmentService } from "../src/services/enrollment.service";

const original = {
  studentFindUnique: prisma.student.findUnique,
  taskFindUnique: prisma.task.findUnique,
  enrollmentFindUnique: prisma.enrollment.findUnique,
  examSubmissionFindMany: prisma.examSubmission.findMany,
  quizSubmissionFindMany: prisma.quizSubmission.findMany,
  taskSubmissionFindMany: prisma.taskSubmission.findMany,
};

async function staleOfferingCannotAuthorizeTaskSubmission() {
  let enrollmentQuery: any;
  (prisma.student.findUnique as any) = async () => ({ id: 7 });
  (prisma.task.findUnique as any) = async () => ({
    id: 50,
    courseId: 41,
    academicYear: 2026,
    semester: 2,
    isDeleted: false,
    course: { id: 41, departmentId: 3, department: { collegeId: 2 } },
  });
  (prisma.enrollment.findUnique as any) = async (args: any) => {
    enrollmentQuery = args;
    return { id: 102, status: "BLOCKED" };
  };

  await assert.rejects(
    TaskService.submitTask(
      { id: 70, role: "STUDENT", student: { id: 7 } },
      50,
      { notes: "must not be accepted through a stale prior-term enrollment" },
    ),
    /blocked/i,
  );

  assert.deepEqual(
    enrollmentQuery.where.studentId_courseId_semester_academicYear,
    { studentId: 7, courseId: 41, academicYear: 2026, semester: 2 },
  );
}

async function transcriptSeparatesRetakeEvidenceByEnrollment() {
  const enrollments = [
    {
      id: 101,
      studentId: 7,
      courseId: 41,
      academicYear: 2025,
      semester: 2,
      course: {},
    },
    {
      id: 102,
      studentId: 7,
      courseId: 41,
      academicYear: 2026,
      semester: 2,
      course: {},
    },
  ] as any;

  (prisma.examSubmission.findMany as any) = async () => [
    {
      id: 1,
      enrollmentId: 101,
      score: 60,
      maxScore: 100,
      status: "GRADED",
      exam: {
        id: 11,
        type: "FINAL",
        courseId: 41,
        date: new Date("2025-05-01"),
      },
    },
  ];
  (prisma.quizSubmission.findMany as any) = async () => [
    {
      id: 2,
      enrollmentId: 102,
      score: 90,
      submittedAt: new Date("2026-05-01"),
      quiz: { id: 12, title: "Current quiz", courseId: 41 },
    },
  ];
  (prisma.taskSubmission.findMany as any) = async () => [
    {
      id: 3,
      enrollmentId: 102,
      score: 80,
      submittedAt: new Date("2026-05-02"),
      task: { id: 13, title: "Current task", courseId: 41, maxScore: 100 },
    },
  ];

  const transcript = await EnrollmentService.getStudentTranscript(
    7,
    enrollments,
  );
  assert.deepEqual(
    transcript[0].exams.map((item: any) => item.id),
    [1],
  );
  assert.deepEqual(transcript[0].quizzes, []);
  assert.deepEqual(transcript[0].tasks, []);
  assert.deepEqual(transcript[1].exams, []);
  assert.deepEqual(
    transcript[1].quizzes.map((item: any) => item.id),
    [2],
  );
  assert.deepEqual(
    transcript[1].tasks.map((item: any) => item.id),
    [3],
  );
}

function creationPathsWriteOfferingAndEnrollmentKeys() {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const sourceDir = resolve(testDir, "../src");
  const examSource = readFileSync(
    resolve(sourceDir, "controllers/exams.controller.ts"),
    "utf8",
  );
  const quizSource = readFileSync(
    resolve(sourceDir, "controllers/quiz.controller.ts"),
    "utf8",
  );
  const taskSourceFiles = [
    resolve(sourceDir, "services/task.service.ts"),
    resolve(sourceDir, "services/task/taskMutations.service.ts"),
    resolve(sourceDir, "services/task/taskGrading.service.ts"),
  ].filter(existsSync);
  const taskSource = taskSourceFiles.map(f => readFileSync(f, "utf8")).join("\n");

  assert.match(
    examSource,
    /tx\.exam\.create\([\s\S]*academicYear:[\s\S]*semester:/u,
  );
  assert.match(
    examSource,
    /prisma\.examSubmission\.create\([\s\S]*enrollmentId: enrollment\.id/u,
  );
  assert.match(
    quizSource,
    /prisma\.quiz\.create\([\s\S]*academicYear:[\s\S]*semester:/u,
  );
  assert.match(
    quizSource,
    /tx\.quizSubmission\.create\([\s\S]*enrollmentId: enrollment\.id/u,
  );
  assert.match(
    taskSource,
    /prisma\.task\.create\([\s\S]*academicYear:[\s\S]*semester:/u,
  );
  assert.match(
    taskSource,
    /tx\.taskSubmission\.create\([\s\S]*enrollmentId: enrollment\.id/u,
  );
}

try {
  await staleOfferingCannotAuthorizeTaskSubmission();
  await transcriptSeparatesRetakeEvidenceByEnrollment();
  creationPathsWriteOfferingAndEnrollmentKeys();
  console.log(
    "Assessment offering and enrollment-attempt integrity checks passed",
  );
} finally {
  prisma.student.findUnique = original.studentFindUnique;
  prisma.task.findUnique = original.taskFindUnique;
  prisma.enrollment.findUnique = original.enrollmentFindUnique;
  prisma.examSubmission.findMany = original.examSubmissionFindMany;
  prisma.quizSubmission.findMany = original.quizSubmissionFindMany;
  prisma.taskSubmission.findMany = original.taskSubmissionFindMany;
  await prisma.$disconnect();
}
