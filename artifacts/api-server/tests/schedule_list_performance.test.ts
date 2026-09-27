import assert from "node:assert/strict";
import prisma from "../src/utils/prismaClient";
import { getWeeklyTimetable } from "../src/controllers/schedules.controller";
import { getTimetables } from "../src/controllers/timetable.controller";

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

async function runScheduleListPerformanceTests() {
  const originals = {
    slotFindMany: prisma.scheduleSlot.findMany,
    slotCount: prisma.scheduleSlot.count,
    studentFindUnique: prisma.student.findUnique,
    enrollmentFindMany: prisma.enrollment.findMany,
    groupFindMany: prisma.studentGroup.findMany,
    groupFindUnique: prisma.studentGroup.findUnique,
    timetableFindMany: prisma.timetable.findMany,
    timetableCount: prisma.timetable.count,
  };

  try {
    let slotArgs: any;
    (prisma.scheduleSlot as any).findMany = async (args: any) => {
      slotArgs = args;
      return [];
    };
    (prisma.scheduleSlot as any).count = async () => 45;

    const adminResult = await invokeController(getWeeklyTimetable, {
      user: { role: "SUPER_ADMIN" },
      query: {
        doctorId: "12",
        departmentId: "7",
        year: "3",
        semester: "2",
        page: "2",
        limit: "20",
      },
    });
    assert.equal(slotArgs.skip, 20);
    assert.equal(slotArgs.take, 20);
    assert.equal(slotArgs.where.doctorId, 12);
    assert.deepEqual(slotArgs.where.course, {
      departmentId: 7,
      year: 3,
      semester: 2,
    });
    assert.deepEqual(adminResult.pagination, {
      page: 2,
      limit: 20,
      total: 45,
      totalPages: 3,
    });

    let groupBatchReads = 0;
    let groupPointReads = 0;
    (prisma.student as any).findUnique = async () => ({
      id: 1,
      groupId: 30,
      departmentId: 7,
      year: 3,
    });
    (prisma.enrollment as any).findMany = async () => [{ courseId: 40 }];
    (prisma.studentGroup as any).findMany = async (args: any) => {
      groupBatchReads += 1;
      assert.deepEqual(args.where, { departmentId: 7 });
      return [
        { id: 30, parentGroupId: 20 },
        { id: 20, parentGroupId: 10 },
        { id: 10, parentGroupId: null },
      ];
    };
    (prisma.studentGroup as any).findUnique = async () => {
      groupPointReads += 1;
      return null;
    };
    await invokeController(getWeeklyTimetable, {
      user: { id: 9, role: "STUDENT" },
      query: {},
    });
    assert.equal(groupBatchReads, 1);
    assert.equal(
      groupPointReads,
      0,
      "Group ancestry must not issue one query per level",
    );

    let timetableArgs: any;
    (prisma.timetable as any).findMany = async (args: any) => {
      timetableArgs = args;
      return [];
    };
    (prisma.timetable as any).count = async () => 12;
    const timetableResult = await invokeController(getTimetables, {
      user: { role: "SUPER_ADMIN" },
      query: { departmentId: "7", page: "2", limit: "5" },
    });
    assert.equal(timetableArgs.skip, 5);
    assert.equal(timetableArgs.take, 5);
    assert.equal(timetableResult.pagination.total, 12);
  } finally {
    (prisma.scheduleSlot as any).findMany = originals.slotFindMany;
    (prisma.scheduleSlot as any).count = originals.slotCount;
    (prisma.student as any).findUnique = originals.studentFindUnique;
    (prisma.enrollment as any).findMany = originals.enrollmentFindMany;
    (prisma.studentGroup as any).findMany = originals.groupFindMany;
    (prisma.studentGroup as any).findUnique = originals.groupFindUnique;
    (prisma.timetable as any).findMany = originals.timetableFindMany;
    (prisma.timetable as any).count = originals.timetableCount;
  }
}

await runScheduleListPerformanceTests();
console.log("Schedule list performance checks passed");
