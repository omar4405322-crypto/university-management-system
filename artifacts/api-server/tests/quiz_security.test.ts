import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Prisma } from '@prisma/client';
import prisma from '../src/utils/prismaClient';
import {
  assertQuizSubmissionWindow,
  createQuiz,
  getQuizById,
  getQuizCourseScope,
  getQuizResults,
  getQuizWhere,
  isQuizSubmissionUniqueConflict,
  submitQuiz,
} from '../src/controllers/quiz.controller';
import { getScopeWhere } from '../src/utils/scope.utils';

type InvocationResult = { body?: any; error?: any; statusCode?: number };

async function invoke(handler: any, request: any): Promise<InvocationResult> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Controller did not finish')), 2_000);
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
    handler(request, response, (error?: unknown) => finish({ error, statusCode }));
  });
}

const student = {
  id: 1,
  role: 'STUDENT',
  student: { id: 17, departmentId: 4, year: 2 },
};
const doctor = { id: 2, role: 'DOCTOR', doctor: { id: 23, departmentId: 4 } };
const teachingAssistant = {
  id: 3,
  role: 'TEACHING_ASSISTANT',
  teachingAssistant: { id: 'ta-29', departmentId: 4 },
};

assert.deepEqual(getQuizCourseScope(student), {
  AND: [
    getScopeWhere(student, 'course'),
    { enrollments: { some: { studentId: 17, status: 'ENROLLED' } } },
  ],
});
assert.deepEqual(getQuizCourseScope(doctor), {
  AND: [
    getScopeWhere(doctor, 'course'),
    { scheduleSlots: { some: { doctorId: 23 } } },
  ],
});
assert.deepEqual(getQuizCourseScope(teachingAssistant), {
  AND: [
    getScopeWhere(teachingAssistant, 'course'),
    { scheduleSlots: { some: { teachingAssistantId: 'ta-29' } } },
  ],
});
assert.deepEqual(getQuizWhere(41, student), {
  AND: [{ id: 41 }, { course: getQuizCourseScope(student) }],
});
assert.deepEqual(getQuizCourseScope({ role: 'STUDENT' }), { id: -1 });
assert.deepEqual(getQuizCourseScope({ role: 'DOCTOR' }), { id: -1 });

const referenceTime = new Date('2026-09-05T10:15:00.000Z');
assert.doesNotThrow(() =>
  assertQuizSubmissionWindow(
    {
      startTime: '2026-09-05T10:00:00.000Z',
      endTime: '2026-09-05T11:00:00.000Z',
      createdAt: '2026-09-05T09:00:00.000Z',
      duration: 30,
    },
    referenceTime
  )
);
assert.throws(
  () =>
    assertQuizSubmissionWindow(
      {
        startTime: '2026-09-05T10:30:00.000Z',
        endTime: '2026-09-05T11:00:00.000Z',
        createdAt: '2026-09-05T09:00:00.000Z',
        duration: 30,
      },
      referenceTime
    ),
  (error: any) => error?.statusCode === 403 && /not started/i.test(error.message)
);
assert.throws(
  () =>
    assertQuizSubmissionWindow(
      {
        startTime: '2026-09-05T09:00:00.000Z',
        endTime: '2026-09-05T12:00:00.000Z',
        createdAt: '2026-09-05T09:00:00.000Z',
        duration: 30,
      },
      referenceTime
    ),
  (error: any) => error?.statusCode === 403 && /closed/i.test(error.message),
  'Duration must close submissions even when the configured end is later'
);
assert.throws(
  () =>
    assertQuizSubmissionWindow(
      {
        startTime: '2026-09-05T10:00:00.000Z',
        endTime: '2026-09-05T10:10:00.000Z',
        createdAt: '2026-09-05T09:00:00.000Z',
        duration: 60,
      },
      referenceTime
    ),
  (error: any) => error?.statusCode === 403 && /closed/i.test(error.message),
  'Configured end time must close submissions even when duration is longer'
);
assert.equal(
  isQuizSubmissionUniqueConflict({
    code: 'P2002',
    meta: { target: ['quizId', 'studentId'] },
  }),
  true
);
assert.equal(
  isQuizSubmissionUniqueConflict({ code: 'P2002', meta: { target: ['email'] } }),
  false
);

const originalQuizFindFirst = prisma.quiz.findFirst;
const originalQuizFindUnique = prisma.quiz.findUnique;
const originalCourseFindFirst = prisma.course.findFirst;
const originalCourseFindUnique = prisma.course.findUnique;
const originalQuizSubmissionFindFirst = prisma.quizSubmission.findFirst;
const originalTransaction = prisma.$transaction;

try {
  let capturedQuizQuery: any;
  let submissionLookupCount = 0;
  (prisma.quiz as any).findFirst = async (args: any) => {
    capturedQuizQuery = args;
    return {
      id: 41,
      title: 'Scoped quiz',
      questions: [{ id: 1, text: 'Question', optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D', points: 1 }],
    };
  };
  (prisma.quizSubmission as any).findFirst = async () => {
    submissionLookupCount += 1;
    return null;
  };

  const studentRead = await invoke(getQuizById, {
    params: { id: '41' },
    user: student,
  });
  assert.equal(studentRead.error, undefined);
  assert.deepEqual(capturedQuizQuery.where, getQuizWhere(41, student));
  assert.equal(capturedQuizQuery.include.questions.select.correct, undefined);
  assert.equal(capturedQuizQuery.include.questions.select.optionA, true);
  assert.equal(studentRead.body.data.hasSubmitted, false);
  assert.equal(submissionLookupCount, 1);

  (prisma.quiz as any).findFirst = async () => null;
  (prisma.quiz as any).findUnique = async () => ({ id: 41 });
  const deniedRead = await invoke(getQuizById, {
    params: { id: '41' },
    user: { ...student, student: { ...student.student, id: 999 } },
  });
  assert.equal(deniedRead.error?.statusCode, 403);
  assert.equal(submissionLookupCount, 1, 'Denied reads must stop before submission lookup');

  let quizCreateCalled = false;
  let capturedCourseWhere: any;
  (prisma.course as any).findFirst = async (args: any) => {
    capturedCourseWhere = args.where;
    return null;
  };
  (prisma.course as any).findUnique = async () => ({ id: 7 });
  (prisma.quiz as any).create = async () => {
    quizCreateCalled = true;
  };
  const deniedCreate = await invoke(createQuiz, {
    body: {
      title: 'Unauthorized',
      courseId: '7',
      duration: '30',
      questions: [],
    },
    user: doctor,
  });
  assert.equal(deniedCreate.error?.statusCode, 403);
  assert.deepEqual(capturedCourseWhere, {
    AND: [{ id: 7 }, getQuizCourseScope(doctor)],
  });
  assert.equal(quizCreateCalled, false);

  let transactionOptions: any;
  let transactionQuizWhere: any;
  let createdSubmission: any;
  const tx = {
    quiz: {
      findFirst: async (args: any) => {
        transactionQuizWhere = args.where;
        return {
          id: 41,
          startTime: new Date(Date.now() - 60_000),
          endTime: new Date(Date.now() + 600_000),
          createdAt: new Date(Date.now() - 60_000),
          duration: 30,
          questions: [
            { id: 101, correct: 'A', points: 2 },
            { id: 102, correct: 'B', points: 2 },
          ],
        };
      },
    },
    quizSubmission: {
      findFirst: async () => null,
      create: async (args: any) => {
        createdSubmission = args.data;
        return { id: 88, ...args.data };
      },
    },
  };
  (prisma.quiz as any).findFirst = async () => ({ id: 41 });
  (prisma as any).$transaction = async (callback: any, options: any) => {
    transactionOptions = options;
    return callback(tx);
  };

  const submitted = await invoke(submitQuiz, {
    params: { id: '41' },
    body: {
      answers: [
        { questionId: 101, answer: 'A' },
        { questionId: 102, answer: 'D' },
      ],
    },
    user: student,
  });
  assert.equal(submitted.error, undefined);
  assert.equal(submitted.statusCode, 201);
  assert.deepEqual(transactionQuizWhere, getQuizWhere(41, student));
  assert.equal(transactionOptions.isolationLevel, Prisma.TransactionIsolationLevel.Serializable);
  assert.deepEqual(createdSubmission.answers, { '101': 'A', '102': 'D' });
  assert.equal(createdSubmission.quizId, 41);
  assert.equal(createdSubmission.studentId, 17);
  assert.equal(createdSubmission.score, 50);

  tx.quizSubmission.create = async () => {
    throw { code: 'P2002', meta: { target: ['quizId', 'studentId'] } };
  };
  const duplicate = await invoke(submitQuiz, {
    params: { id: '41' },
    body: { answers: { '101': 'A' } },
    user: student,
  });
  assert.equal(duplicate.error?.statusCode, 409);
  assert.match(duplicate.error?.message, /already submitted/i);

  let transactionCalled = false;
  (prisma.quiz as any).findFirst = async () => null;
  (prisma.quiz as any).findUnique = async () => ({ id: 41 });
  (prisma as any).$transaction = async () => {
    transactionCalled = true;
  };
  const deniedSubmission = await invoke(submitQuiz, {
    params: { id: '41' },
    body: { answers: { '101': 'A' } },
    user: student,
  });
  assert.equal(deniedSubmission.error?.statusCode, 403);
  assert.equal(transactionCalled, false, 'Non-enrolled students must stop before the transaction');

  (prisma.quiz as any).findFirst = async (args: any) => {
    capturedQuizQuery = args;
    return { id: 41, submissions: [] };
  };
  const results = await invoke(getQuizResults, {
    params: { id: '41' },
    user: doctor,
  });
  assert.equal(results.error, undefined);
  assert.deepEqual(capturedQuizQuery.where, getQuizWhere(41, doctor));
} finally {
  (prisma.quiz as any).findFirst = originalQuizFindFirst;
  (prisma.quiz as any).findUnique = originalQuizFindUnique;
  (prisma.course as any).findFirst = originalCourseFindFirst;
  (prisma.course as any).findUnique = originalCourseFindUnique;
  (prisma.quizSubmission as any).findFirst = originalQuizSubmissionFindFirst;
  (prisma as any).$transaction = originalTransaction;
}

const schema = await readFile(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const migration = await readFile(
  new URL(
    '../prisma/migrations/20260905010000_enforce_unique_quiz_submission/migration.sql',
    import.meta.url
  ),
  'utf8'
);
assert.match(schema, /model QuizSubmission[\s\S]*@@unique\(\[quizId, studentId\]\)/);
assert.match(migration, /CREATE UNIQUE INDEX "QuizSubmission_quizId_studentId_key"/);

console.log('Quiz scope, timing, and single-submission security checks passed');
