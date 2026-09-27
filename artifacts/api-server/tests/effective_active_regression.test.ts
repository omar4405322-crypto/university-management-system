import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import { EnrollmentService } from '../src/services/enrollment.service';
import {
  deactivateUserAndRevokeSessions,
  setUserAndRoleActiveState,
} from '../src/services/studentStatus.service';
import {
  getSuggestedTeachingAssistants,
  getTAStats,
} from '../src/controllers/teachingAssistants.controller';
import { getSuggestedDoctors } from '../src/controllers/doctors.controller';
import { getCourseById } from '../src/controllers/courses.controller';
import {
  getDoctorStats as getDoctorDashboardStats,
  getPublicLandingStats,
  getStudentStats,
} from '../src/controllers/dashboard.controller';
import { globalSearch } from '../src/controllers/search.controller';
import { StudentGroupsService } from '../src/services/studentGroups.service';
import { AttendanceSessionService } from '../src/services/attendance-session.service';
import { getTranscriptOverviewWhere } from '../src/utils/transcriptScope.utils';
import { startRiskDetectionJob } from '../src/utils/cron';
import cron from 'node-cron';

async function autoEnrollmentRequiresBothStudentFlags() {
  const originals = {
    courseFindUnique: prisma.course.findUnique,
    studentFindMany: prisma.student.findMany,
  };
  let capturedStudentWhere: unknown;

  try {
    (prisma.course.findUnique as any) = async () => ({
      id: 10,
      departmentId: 3,
      year: 2,
      semester: 1,
    });
    (prisma.student.findMany as any) = async (args: any) => {
      capturedStudentWhere = args.where;
      return [];
    };

    assert.deepEqual(await EnrollmentService.autoEnrollCourse(10), {
      enrolledCount: 0,
    });
    assert.deepEqual(capturedStudentWhere, {
      AND: [
        { departmentId: 3, year: 2 },
        { isActive: true, user: { is: { isActive: true } } },
      ],
    });
  } finally {
    prisma.course.findUnique = originals.courseFindUnique;
    prisma.student.findMany = originals.studentFindMany;
  }
}

async function genericActivationKeepsRoleFlagsConsistent() {
  const originalTransaction = prisma.$transaction;
  const calls: Array<{ model: string; args: any }> = [];
  try {
    (prisma as any).$transaction = async (callback: any) => callback({
      user: {
        update: async (args: any) => {
          calls.push({ model: 'user', args });
          return { id: args.where.id, ...args.data };
        },
      },
      student: {
        updateMany: async (args: any) => {
          calls.push({ model: 'student', args });
          return { count: 1 };
        },
      },
      teachingAssistant: {
        updateMany: async (args: any) => {
          calls.push({ model: 'teachingAssistant', args });
          return { count: 1 };
        },
      },
      refreshToken: {
        deleteMany: async (args: any) => {
          calls.push({ model: 'refreshToken', args });
          return { count: 1 };
        },
      },
    });

    const deactivatedAt = new Date('2026-09-08T12:00:00.000Z');
    await deactivateUserAndRevokeSessions(42, deactivatedAt);
    assert.deepEqual(calls.map(({ model }) => model), [
      'user',
      'student',
      'teachingAssistant',
      'refreshToken',
    ]);
    assert.deepEqual(calls[1].args, {
      where: { userId: 42 },
      data: { isActive: false },
    });
    assert.deepEqual(calls[2].args, {
      where: { userId: 42 },
      data: { status: 'INACTIVE' },
    });

    calls.length = 0;
    await setUserAndRoleActiveState(42, true);
    assert.deepEqual(calls.map(({ model }) => model), [
      'user',
      'student',
      'teachingAssistant',
    ]);
    assert.equal(calls[0].args.data.isActive, true);
    assert.equal(calls[0].args.data.deactivatedAt, null);
    assert.deepEqual(calls[1].args.data, { isActive: true });
    assert.deepEqual(calls[2].args.data, { status: 'ACTIVE' });
  } finally {
    prisma.$transaction = originalTransaction;
  }
}

const responseRecorder = () => {
  const state: { body?: any } = {};
  return {
    state,
    response: {
      status() { return this; },
      json(body: any) { state.body = body; return this; },
    } as any,
  };
};

const invokeHandler = async (handler: any, request: any) =>
  new Promise<any>((resolve, reject) => {
    const response: any = {
      status() { return response; },
      json(body: any) { resolve(body); return response; },
    };
    handler(request, response, (error?: unknown) => {
      if (error) reject(error);
      else resolve(undefined);
    });
  });

async function staffSuggestionsAndActiveStatsUseEffectiveStatus() {
  const originals = {
    courseFindUnique: prisma.course.findUnique,
    taFindMany: prisma.teachingAssistant.findMany,
    taCount: prisma.teachingAssistant.count,
    doctorFindMany: prisma.doctor.findMany,
  };
  const taQueries: any[] = [];
  let doctorWhere: any;
  try {
    (prisma.course.findUnique as any) = async () => ({
      id: 10,
      departmentId: 3,
      department: { collegeId: 2 },
    });
    (prisma.teachingAssistant.findMany as any) = async (args: any) => {
      taQueries.push(args.where);
      return [];
    };
    (prisma.teachingAssistant.count as any) = async (args: any) => {
      taQueries.push(args.where);
      return 0;
    };
    (prisma.doctor.findMany as any) = async (args: any) => {
      doctorWhere = args.where;
      return [];
    };

    const taResponse = responseRecorder();
    await getSuggestedTeachingAssistants(
      { query: { courseId: '10' }, user: { role: 'SUPER_ADMIN' } } as any,
      taResponse.response,
      (error: unknown) => { throw error; }
    );
    assert.deepEqual(taQueries[0], {
      AND: [
        {},
        { status: 'ACTIVE', user: { is: { isActive: true } } },
      ],
    });

    const statsResponse = responseRecorder();
    await getTAStats(
      { user: { role: 'SUPER_ADMIN' } } as any,
      statsResponse.response,
      (error: unknown) => { throw error; }
    );
    assert.deepEqual(taQueries[2], {
      AND: [
        {},
        { status: 'ACTIVE', user: { is: { isActive: true } } },
      ],
    });

    const doctorResponse = responseRecorder();
    await getSuggestedDoctors(
      { query: { courseId: '10' }, user: { role: 'SUPER_ADMIN' } } as any,
      doctorResponse.response,
      (error: unknown) => { throw error; }
    );
    assert.deepEqual(doctorWhere, {
      AND: [
        { AND: [{}, { user: { is: { role: 'DOCTOR' } } }] },
        { user: { is: { isActive: true } } },
      ],
    });
  } finally {
    prisma.course.findUnique = originals.courseFindUnique;
    prisma.teachingAssistant.findMany = originals.taFindMany;
    prisma.teachingAssistant.count = originals.taCount;
    prisma.doctor.findMany = originals.doctorFindMany;
  }
}

async function operationalSearchAndGroupCountsExcludeInactivePeople() {
  const originals = {
    studentFindMany: prisma.student.findMany,
    doctorFindMany: prisma.doctor.findMany,
    courseFindMany: prisma.course.findMany,
    collegeFindMany: prisma.college.findMany,
    departmentFindMany: prisma.department.findMany,
    groupFindMany: prisma.studentGroup.findMany,
  };
  let studentWhere: any;
  let doctorWhere: any;
  let groupInclude: any;
  try {
    (prisma.student.findMany as any) = async (args: any) => {
      studentWhere = args.where;
      return [];
    };
    (prisma.doctor.findMany as any) = async (args: any) => {
      doctorWhere = args.where;
      return [];
    };
    (prisma.course.findMany as any) = async () => [];
    (prisma.college.findMany as any) = async () => [];
    (prisma.department.findMany as any) = async () => [];

    const searchResponse = responseRecorder();
    await globalSearch(
      { query: { q: 'Ada' }, user: { role: 'SUPER_ADMIN' } } as any,
      searchResponse.response
    );
    assert.deepEqual(studentWhere.AND[1], {
      isActive: true,
      user: { is: { isActive: true } },
    });
    assert.deepEqual(doctorWhere.AND[1], {
      user: { is: { isActive: true } },
    });

    (prisma.studentGroup.findMany as any) = async (args: any) => {
      groupInclude = args.include;
      return [];
    };
    assert.deepEqual(
      await StudentGroupsService.getDepartmentGroupTree(3),
      []
    );
    assert.deepEqual(groupInclude._count.select.students.where, {
      AND: [
        {},
        { isActive: true, user: { is: { isActive: true } } },
      ],
    });
  } finally {
    prisma.student.findMany = originals.studentFindMany;
    prisma.doctor.findMany = originals.doctorFindMany;
    prisma.course.findMany = originals.courseFindMany;
    prisma.college.findMany = originals.collegeFindMany;
    prisma.department.findMany = originals.departmentFindMany;
    prisma.studentGroup.findMany = originals.groupFindMany;
  }
}

async function rostersAndPopulationCountsUseEffectiveActivity() {
  const originals = {
    sessionFindUnique: prisma.attendanceSession.findUnique,
    studentFindMany: prisma.student.findMany,
    attendanceFindMany: prisma.attendance.findMany,
    courseFindFirst: prisma.course.findFirst,
    studentCount: prisma.student.count,
    doctorCount: prisma.doctor.count,
    taCount: prisma.teachingAssistant.count,
    collegeCount: prisma.college.count,
    departmentCount: prisma.department.count,
    courseCount: prisma.course.count,
    collegeFindMany: prisma.college.findMany,
  };
  let rosterStudentWhere: any;
  let courseInclude: any;
  const populationWheres: any[] = [];

  try {
    (prisma.attendanceSession.findUnique as any) = async () => ({
      id: 91,
      scheduleSlot: { courseId: 10, groupId: 7 },
    });
    (prisma.student.findMany as any) = async (args: any) => {
      rosterStudentWhere = args.where;
      return [];
    };
    (prisma.attendance.findMany as any) = async () => [];

    assert.deepEqual(
      await AttendanceSessionService.getSessionRoster(
        { role: 'SUPER_ADMIN' },
        91
      ),
      []
    );
    assert.deepEqual(rosterStudentWhere, {
      AND: [
        {
          groupId: 7,
          enrollments: { some: { courseId: 10, status: 'ENROLLED' } },
        },
        { isActive: true, user: { is: { isActive: true } } },
      ],
    });

    (prisma.course.findFirst as any) = async (args: any) => {
      courseInclude = args.include;
      return { id: 10, isPublished: true };
    };
    await invokeHandler(
      getCourseById,
      { params: { id: '10' }, user: { role: 'SUPER_ADMIN' } }
    );
    assert.deepEqual(courseInclude.tasks.where, { isDeleted: false });
    assert.deepEqual(courseInclude.enrollments.where, {
      status: 'ENROLLED',
      student: {
        is: {
          AND: [
            {},
            { isActive: true, user: { is: { isActive: true } } },
          ],
        },
      },
    });

    (prisma.student.count as any) = async (args: any) => {
      populationWheres.push(args.where);
      return 0;
    };
    (prisma.doctor.count as any) = async (args: any) => {
      populationWheres.push(args.where);
      return 0;
    };
    (prisma.teachingAssistant.count as any) = async (args: any) => {
      populationWheres.push(args.where);
      return 0;
    };
    (prisma.college.count as any) = async () => 0;
    (prisma.department.count as any) = async () => 0;
    (prisma.course.count as any) = async () => 0;
    (prisma.college.findMany as any) = async () => [];

    await invokeHandler(getPublicLandingStats, {});
    assert.deepEqual(populationWheres, [
      {
        AND: [
          {},
          { isActive: true, user: { is: { isActive: true } } },
        ],
      },
      { AND: [{}, { user: { is: { isActive: true } } }] },
      {
        AND: [
          {},
          { status: 'ACTIVE', user: { is: { isActive: true } } },
        ],
      },
    ]);
  } finally {
    prisma.attendanceSession.findUnique = originals.sessionFindUnique;
    prisma.student.findMany = originals.studentFindMany;
    prisma.attendance.findMany = originals.attendanceFindMany;
    prisma.course.findFirst = originals.courseFindFirst;
    prisma.student.count = originals.studentCount;
    prisma.doctor.count = originals.doctorCount;
    prisma.teachingAssistant.count = originals.taCount;
    prisma.college.count = originals.collegeCount;
    prisma.department.count = originals.departmentCount;
    prisma.course.count = originals.courseCount;
    prisma.college.findMany = originals.collegeFindMany;
  }
}

async function dashboardTaskSurfacesExcludeDeletedTasksButKeepPayments() {
  const originals = {
    studentFindUnique: prisma.student.findUnique,
    doctorFindUnique: prisma.doctor.findUnique,
    paymentGroupBy: prisma.payment.groupBy,
    examFindMany: prisma.exam.findMany,
    scheduleFindMany: prisma.scheduleSlot.findMany,
    courseFindMany: prisma.course.findMany,
    quizFindMany: prisma.quiz.findMany,
    quizCount: prisma.quiz.count,
    taskFindMany: prisma.task.findMany,
    taskSubmissionFindMany: prisma.taskSubmission.findMany,
    taskSubmissionCount: prisma.taskSubmission.count,
    studentCount: prisma.student.count,
  };
  let paymentWhere: any;
  let pendingTaskWhere: any;
  let recentSubmissionWhere: any;
  let pendingSubmissionWhere: any;

  try {
    (prisma.student.findUnique as any) = async () => ({
      id: 4,
      firstName: 'Ada',
      lastName: 'Lovelace',
      studentId: 'S-4',
      enrolledAt: new Date('2024-09-01T00:00:00.000Z'),
      year: 2,
      groupId: 7,
      departmentId: 3,
      department: { name: 'CS', college: { name: 'Engineering' } },
      successMetrics: null,
    });
    (prisma.payment.groupBy as any) = async (args: any) => {
      paymentWhere = args.where;
      return [];
    };
    (prisma.exam.findMany as any) = async () => [];
    (prisma.scheduleSlot.findMany as any) = async () => [];
    (prisma.course.findMany as any) = async () => [];
    (prisma.quiz.findMany as any) = async () => [];
    (prisma.task.findMany as any) = async (args: any) => {
      pendingTaskWhere = args.where;
      return [];
    };

    await invokeHandler(getStudentStats, {
      user: { id: 44, role: 'STUDENT' },
    });
    assert.deepEqual(paymentWhere, { studentId: 4 });
    assert.equal(JSON.stringify(paymentWhere).includes('isActive'), false);
    assert.equal(pendingTaskWhere.isDeleted, false);

    (prisma.doctor.findUnique as any) = async () => ({
      id: 8,
      firstName: 'Grace',
      lastName: 'Hopper',
      doctorId: 'DOC-8',
      specialty: 'Compilers',
      departmentId: 3,
      department: { name: 'CS', college: { name: 'Engineering' } },
    });
    (prisma.scheduleSlot.findMany as any) = async () => [];
    (prisma.taskSubmission.findMany as any) = async (args: any) => {
      recentSubmissionWhere = args.where;
      return [];
    };
    (prisma.quiz.count as any) = async () => 0;
    (prisma.taskSubmission.count as any) = async (args: any) => {
      pendingSubmissionWhere = args.where;
      return 0;
    };
    (prisma.student.count as any) = async () => 0;

    await invokeHandler(getDoctorDashboardStats, {
      user: { id: 88, role: 'DOCTOR' },
    });
    assert.deepEqual(recentSubmissionWhere, {
      task: { doctorId: 8, isDeleted: false },
    });
    assert.deepEqual(pendingSubmissionWhere, {
      score: null,
      task: { doctorId: 8, isDeleted: false },
    });
  } finally {
    prisma.student.findUnique = originals.studentFindUnique;
    prisma.doctor.findUnique = originals.doctorFindUnique;
    prisma.payment.groupBy = originals.paymentGroupBy;
    prisma.exam.findMany = originals.examFindMany;
    prisma.scheduleSlot.findMany = originals.scheduleFindMany;
    prisma.course.findMany = originals.courseFindMany;
    prisma.quiz.findMany = originals.quizFindMany;
    prisma.quiz.count = originals.quizCount;
    prisma.task.findMany = originals.taskFindMany;
    prisma.taskSubmission.findMany = originals.taskSubmissionFindMany;
    prisma.taskSubmission.count = originals.taskSubmissionCount;
    prisma.student.count = originals.studentCount;
  }
}

async function deletedTasksAreExcludedWithoutFilteringHistoricalStudents() {
  const completedBefore = new Date('2026-09-01T00:00:00.000Z');
  const transcriptWhere = getTranscriptOverviewWhere(
    { role: 'SUPER_ADMIN' },
    completedBefore
  );
  assert.deepEqual(transcriptWhere?.task, {
    AND: [
      { isDeleted: false },
      { dueDate: { lte: completedBefore } },
      { course: {} },
    ],
  });
  assert.equal(JSON.stringify(transcriptWhere).includes('isActive'), false);

  const originalSchedule = cron.schedule;
  const originalStudentFindMany = prisma.student.findMany;
  let scheduledCallback: (() => Promise<void>) | undefined;
  let riskStudentQuery: any;
  try {
    (cron as any).schedule = (_expression: string, callback: () => Promise<void>) => {
      scheduledCallback = callback;
      return {};
    };
    (prisma.student.findMany as any) = async (args: any) => {
      riskStudentQuery = args;
      return [];
    };
    startRiskDetectionJob();
    await scheduledCallback!();
    assert.deepEqual(
      riskStudentQuery.include.enrollments.include.course.include.tasks.where,
      { isDeleted: false }
    );
    assert.deepEqual(
      riskStudentQuery.include.enrollments.where,
      { status: 'ENROLLED' }
    );
    assert.deepEqual(riskStudentQuery.where, {
      AND: [
        {},
        { isActive: true, user: { is: { isActive: true } } },
      ],
    });
    assert.deepEqual(riskStudentQuery.include.enrollments.include.taskSubmissions, {
      where: { task: { isDeleted: false } },
      select: { taskId: true },
    });
  } finally {
    (cron as any).schedule = originalSchedule;
    prisma.student.findMany = originalStudentFindMany;
  }
}

await autoEnrollmentRequiresBothStudentFlags();
await genericActivationKeepsRoleFlagsConsistent();
await staffSuggestionsAndActiveStatsUseEffectiveStatus();
await operationalSearchAndGroupCountsExcludeInactivePeople();
await rostersAndPopulationCountsUseEffectiveActivity();
await dashboardTaskSurfacesExcludeDeletedTasksButKeepPayments();
await deletedTasksAreExcludedWithoutFilteringHistoricalStudents();
console.log('Effective-active regression checks passed');
