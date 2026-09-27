import assert from "node:assert/strict";
import prisma from "../src/utils/prismaClient";
import { getTranscript } from "../src/controllers/transcript.controller";

async function invokeController(
  controller: any,
  request: Record<string, unknown>,
) {
  return new Promise<any>((resolve, reject) => {
    const response: any = {
      status: () => response,
      json: (body: unknown) => resolve(body),
    };
    controller(request, response, (error?: unknown) => reject(error));
  });
}

async function runTranscriptPerformanceTests() {
  const originals = {
    examFindMany: prisma.exam.findMany,
    quizFindMany: prisma.quiz.findMany,
    taskFindMany: prisma.task.findMany,
    examAggregate: prisma.examSubmission.aggregate,
    enrollmentFindMany: prisma.enrollment.findMany,
    examSubmissionFindMany: prisma.examSubmission.findMany,
    quizSubmissionFindMany: prisma.quizSubmission.findMany,
    taskSubmissionFindMany: prisma.taskSubmission.findMany,
    studentFindUnique: prisma.student.findUnique,
  };

  try {
    const assessmentQueries: Array<{ name: string; args: any }> = [];
    (prisma.exam as any).findMany = async (args: any) => {
      assessmentQueries.push({ name: "exam.findMany", args });
      return [
        {
          id: 1,
          courseId: 4,
          course: { id: 4, name: "Databases", courseCode: "DB301" },
          type: "FINAL",
          date: new Date("2026-06-01"),
          startTime: "09:00",
          endTime: "11:00",
          room: "A1",
          _count: { questions: 20, submissions: 200 },
        },
      ];
    };
    (prisma.quiz as any).findMany = async (args: any) => {
      assessmentQueries.push({ name: "quiz.findMany", args });
      return [];
    };
    (prisma.task as any).findMany = async (args: any) => {
      assessmentQueries.push({ name: "task.findMany", args });
      return [];
    };
    (prisma.examSubmission as any).aggregate = async (args: any) => {
      assessmentQueries.push({ name: "examSubmission.aggregate", args });
      return { _count: { _all: 200 }, _avg: { score: 72.25 } };
    };
    const overview = await invokeController(getTranscript, {
      user: { role: "SUPER_ADMIN" },
      params: {},
    });
    assert.equal(
      assessmentQueries.length,
      4,
      "Overview query count must be fixed",
    );
    for (const query of assessmentQueries.filter((item) =>
      item.name.endsWith("findMany"),
    )) {
      assert.equal(
        query.args.include?.submissions,
        undefined,
        "Nested submissions must not be hydrated",
      );
    }
    assert.equal(overview.data.totalSubmissions, 200);
    assert.equal(overview.data.averageScore, "72.3");
    assert.equal(overview.data.completedExams[0].submissionsCount, 200);

    let enrollmentIdReads = 0;
    const enrollments = [
      {
        id: 1,
        studentId: 9,
        courseId: 4,
        academicYear: 3,
        semester: 1,
        finalGrade: 75,
        status: "COMPLETED",
        course: {
          id: 4,
          name: "Databases",
          courseCode: "DB301",
          credits: 3,
          department: { name: "CS" },
        },
      },
      {
        id: 2,
        studentId: 9,
        courseId: 5,
        academicYear: 3,
        semester: 1,
        finalGrade: 65,
        status: "COMPLETED",
        course: {
          id: 5,
          name: "Networks",
          courseCode: "NW301",
          credits: 3,
          department: { name: "CS" },
        },
      },
    ];
    let enrollmentReads = 0;
    (prisma.enrollment as any).findMany = async () => {
      enrollmentReads += 1;
      return enrollments;
    };
    (prisma.student as any).findUnique = async () => ({ id: 9 });
    (prisma.examSubmission as any).findMany = async () =>
      Array.from({ length: 100 }, (_, index) => ({
        id: index + 1,
        get enrollmentId() {
          enrollmentIdReads += 1;
          return index % 2 === 0 ? 1 : 2;
        },
        score: 70,
        maxScore: 100,
        status: "GRADED",
        exam: {
          id: index + 1,
          type: "MIDTERM",
          date: new Date("2026-05-01"),
          courseId: index % 2 === 0 ? 4 : 5,
        },
      }));
    (prisma.quizSubmission as any).findMany = async () => [];
    (prisma.taskSubmission as any).findMany = async () => [];

    const studentResult = await invokeController(getTranscript, {
      user: { id: 99, role: "STUDENT" },
      params: { studentId: "me" },
    });
    assert.equal(
      enrollmentReads,
      1,
      "Transcript and GPA must share one enrollment read",
    );
    assert.equal(studentResult.data.semesters[0].courses.length, 2);
    assert.equal(studentResult.data.gpa, "1.50");
    assert.equal(
      enrollmentIdReads,
      100,
      "Submission enrollment IDs must be indexed once, not rescanned for every enrollment",
    );
  } finally {
    (prisma.exam as any).findMany = originals.examFindMany;
    (prisma.quiz as any).findMany = originals.quizFindMany;
    (prisma.task as any).findMany = originals.taskFindMany;
    (prisma.examSubmission as any).aggregate = originals.examAggregate;
    (prisma.enrollment as any).findMany = originals.enrollmentFindMany;
    (prisma.examSubmission as any).findMany = originals.examSubmissionFindMany;
    (prisma.quizSubmission as any).findMany = originals.quizSubmissionFindMany;
    (prisma.taskSubmission as any).findMany = originals.taskSubmissionFindMany;
    (prisma.student as any).findUnique = originals.studentFindUnique;
  }
}

await runTranscriptPerformanceTests();
console.log("Transcript performance checks passed");
