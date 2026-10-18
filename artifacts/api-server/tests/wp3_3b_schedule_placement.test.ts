import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/prismaClient';
import { TestCleanupRegistry } from './testCleanup.utils';
import {
  SchedulePlacementService,
  findPlacementConflicts,
  assertValidPlacement,
  executeSchedulePlacement,
} from '../src/services/schedulePlacement.service';
import { ConflictError, AuthorizationError } from '../src/utils/appError';

test('wp3_3b_schedule_placement: Comprehensive placement validation and execution', async (t) => {
  const SUFFIX = `sp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const passwordHash = await bcrypt.hash('TestPass123!Aa', 4);
  const cleanup = new TestCleanupRegistry();

  let academicYearPast: any;
  let academicTermPast: any;

  let college1: any;
  let dept1: any;
  let dept2: any;
  let courseDept1: any;
  let courseDept2: any;
  let doctor1: any;
  let taDept1: any;
  let taDept2: any;
  let roomActive: any;
  let roomInactive: any;
  let group1: any;
  let timetable1: any;

  // Find baseline isCurrent term
  const baselineCurrentTerm = await prisma.academicTerm.findFirst({
    where: { isCurrent: true },
  });
  assert.ok(baselineCurrentTerm, 'Database must have a baseline current academic term');

  try {
    // 1. Setup isolated past AcademicYear and AcademicTerm (isCurrent: false)
    academicYearPast = await prisma.academicYear.create({
      data: {
        name: `AY_Past_${SUFFIX}`,
        startDate: new Date('2024-09-01T00:00:00Z'),
        endDate: new Date('2025-06-30T23:59:59Z'),
        isCurrent: false,
      },
    });

    academicTermPast = await prisma.academicTerm.create({
      data: {
        academicYearId: academicYearPast.id,
        name: `Term_Past_${SUFFIX}`,
        termType: 'FALL',
        semesterNumber: 1,
        startDate: new Date('2024-09-01T00:00:00Z'),
        endDate: new Date('2025-01-31T23:59:59Z'),
        isCurrent: false,
      },
    });

    // 2. Setup College and Departments
    college1 = await prisma.college.create({
      data: { name: `College_${SUFFIX}` },
    });
    cleanup.trackCollege(college1.id);

    dept1 = await prisma.department.create({
      data: { name: `Dept1_${SUFFIX}`, collegeId: college1.id },
    });
    cleanup.trackDepartment(dept1.id);

    dept2 = await prisma.department.create({
      data: { name: `Dept2_${SUFFIX}`, collegeId: college1.id },
    });
    cleanup.trackDepartment(dept2.id);

    // 3. Setup Courses
    courseDept1 = await prisma.course.create({
      data: {
        name: `Course_D1_${SUFFIX}`,
        courseCode: `CD1_${SUFFIX.slice(-6)}`,
        credits: 3,
        year: 1,
        semester: 1,
        departmentId: dept1.id,
      },
    });
    cleanup.trackCourse(courseDept1.id);

    courseDept2 = await prisma.course.create({
      data: {
        name: `Course_D2_${SUFFIX}`,
        courseCode: `CD2_${SUFFIX.slice(-6)}`,
        credits: 3,
        year: 1,
        semester: 1,
        departmentId: dept2.id,
      },
    });
    cleanup.trackCourse(courseDept2.id);

    // 4. Setup Doctor
    const docUser = await prisma.user.create({
      data: {
        email: `doc_${SUFFIX}@univ.edu`,
        password: passwordHash,
        role: 'DOCTOR',
        departmentId: dept1.id,
      },
    });
    cleanup.trackUser(docUser.id);

    doctor1 = await prisma.doctor.create({
      data: {
        userId: docUser.id,
        firstName: 'Prof',
        lastName: `Doc_${SUFFIX}`,
        departmentId: dept1.id,
      },
    });
    cleanup.trackDoctor(doctor1.id);

    // 5. Setup TAs (one in Dept 1, one in Dept 2)
    const taUser1 = await prisma.user.create({
      data: {
        email: `ta1_${SUFFIX}@univ.edu`,
        password: passwordHash,
        role: 'TEACHING_ASSISTANT',
        departmentId: dept1.id,
      },
    });
    cleanup.trackUser(taUser1.id);

    taDept1 = await prisma.teachingAssistant.create({
      data: {
        userId: taUser1.id,
        employeeId: `TA1_${SUFFIX}`,
        firstName: 'Eng',
        lastName: `TA1_${SUFFIX}`,
        departmentId: dept1.id,
      },
    });
    cleanup.trackTA(taDept1.id);

    const taUser2 = await prisma.user.create({
      data: {
        email: `ta2_${SUFFIX}@univ.edu`,
        password: passwordHash,
        role: 'TEACHING_ASSISTANT',
        departmentId: dept2.id,
      },
    });
    cleanup.trackUser(taUser2.id);

    taDept2 = await prisma.teachingAssistant.create({
      data: {
        userId: taUser2.id,
        employeeId: `TA2_${SUFFIX}`,
        firstName: 'Eng',
        lastName: `TA2_${SUFFIX}`,
        departmentId: dept2.id,
      },
    });
    cleanup.trackTA(taDept2.id);

    // 6. Setup Rooms (one active, one inactive)
    roomActive = await prisma.room.create({
      data: {
        name: `Room_Act_${SUFFIX}`,
        isActive: true,
      },
    });
    cleanup.trackRoom(roomActive.id);

    roomInactive = await prisma.room.create({
      data: {
        name: `Room_Inact_${SUFFIX}`,
        isActive: false,
      },
    });
    cleanup.trackRoom(roomInactive.id);

    // 7. Setup StudentGroup
    group1 = await prisma.studentGroup.create({
      data: {
        name: `Group_${SUFFIX}`,
        year: 1,
        departmentId: dept1.id,
      },
    });
    cleanup.trackGroup(group1.id);

    // 8. Setup Timetable
    timetable1 = await prisma.timetable.create({
      data: {
        collegeId: college1.id,
        departmentId: dept1.id,
        academicYear: 1,
        semester: 1,
        title: `TT_${SUFFIX}`,
        termId: baselineCurrentTerm.id,
      },
    });
    cleanup.trackTimetable(timetable1.id);

    // ─────────────────────────────────────────────────────────────────────────
    // T1.1: Term resolution (OD-29)
    // ─────────────────────────────────────────────────────────────────────────
    await t.test('resolves explicit termId when provided', async () => {
      const res = await findPlacementConflicts({
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '10:00',
        courseId: courseDept1.id,
        termId: baselineCurrentTerm.id,
      });
      assert.equal(res.resolvedTerm?.id, baselineCurrentTerm.id);
    });

    await t.test('resolves isCurrent term when termId is omitted', async () => {
      const res = await findPlacementConflicts({
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '10:00',
        courseId: courseDept1.id,
      });
      assert.equal(res.resolvedTerm?.id, baselineCurrentTerm.id);
      assert.equal(res.resolvedTerm?.isCurrent, true);
    });

    await t.test('flags invalid term when non-existent termId provided', async () => {
      const res = await findPlacementConflicts({
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '10:00',
        courseId: courseDept1.id,
        termId: 999999999,
      });
      assert.equal(res.isValid, false);
      assert.ok(res.conflicts.some((c) => c.type === 'INVALID_TERM'));
    });

    // ─────────────────────────────────────────────────────────────────────────
    // T1.2: Past-term lock
    // ─────────────────────────────────────────────────────────────────────────
    await t.test('locks placement in past term and throws ConflictError 409', async () => {
      const res = await findPlacementConflicts({
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '10:00',
        courseId: courseDept1.id,
        termId: academicTermPast.id,
      });
      assert.equal(res.isValid, false);
      const pastConflict = res.conflicts.find((c) => c.type === 'PAST_TERM_LOCKED');
      assert.ok(pastConflict);

      await assert.rejects(
        async () => {
          await assertValidPlacement({
            dayOfWeek: 'MONDAY',
            startTime: '08:00',
            endTime: '10:00',
            courseId: courseDept1.id,
            termId: academicTermPast.id,
          });
        },
        (err: any) => {
          assert.equal(err.statusCode, 409);
          return true;
        }
      );
    });

    // ─────────────────────────────────────────────────────────────────────────
    // T1.3: Cross-department TA Approval (OD-31 / OD-43)
    // ─────────────────────────────────────────────────────────────────────────
    await t.test('same department TA does not require cross-dept approval', async () => {
      const res = await findPlacementConflicts({
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '10:00',
        courseId: courseDept1.id,
        teachingAssistantId: taDept1.id,
      });
      assert.equal(res.isValid, true);
      assert.equal(res.conflicts.length, 0);
    });

    await t.test('cross-dept TA without approval is blocked with 403', async () => {
      const res = await findPlacementConflicts({
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '10:00',
        courseId: courseDept1.id,
        teachingAssistantId: taDept2.id,
      });
      assert.equal(res.isValid, false);
      const crossDeptConflict = res.conflicts.find((c) => c.type === 'UNAPPROVED_CROSS_DEPARTMENT_TA');
      assert.ok(crossDeptConflict);

      await assert.rejects(
        async () => {
          await assertValidPlacement({
            dayOfWeek: 'MONDAY',
            startTime: '08:00',
            endTime: '10:00',
            courseId: courseDept1.id,
            teachingAssistantId: taDept2.id,
          });
        },
        (err: any) => {
          assert.equal(err.statusCode, 403);
          return true;
        }
      );
    });

    await t.test('cross-dept TA with APPROVED row is valid', async () => {
      // Create approval row
      const approval = await prisma.tACrossDepartmentApproval.create({
        data: {
          teachingAssistantId: taDept2.id,
          courseId: courseDept1.id,
          status: 'APPROVED',
          approvedByUserId: docUser.id,
        },
      });
      cleanup.trackTAApproval(approval.id);

      const res = await findPlacementConflicts({
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '10:00',
        courseId: courseDept1.id,
        teachingAssistantId: taDept2.id,
      });
      assert.equal(res.isValid, true);
      assert.equal(res.conflicts.length, 0);

      // Revoking it makes it invalid with 403 again
      await prisma.tACrossDepartmentApproval.update({
        where: { id: approval.id },
        data: { status: 'REVOKED' },
      });

      const resRevoked = await findPlacementConflicts({
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '10:00',
        courseId: courseDept1.id,
        teachingAssistantId: taDept2.id,
      });
      assert.equal(resRevoked.isValid, false);
      assert.ok(resRevoked.conflicts.some((c) => c.type === 'UNAPPROVED_CROSS_DEPARTMENT_TA'));
    });

    // ─────────────────────────────────────────────────────────────────────────
    // T1.4: Room resolution & validation (OD-45)
    // ─────────────────────────────────────────────────────────────────────────
    await t.test('resolves active roomId successfully', async () => {
      const res = await findPlacementConflicts({
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '10:00',
        courseId: courseDept1.id,
        roomId: roomActive.id,
      });
      assert.equal(res.resolvedRoom?.id, roomActive.id);
      assert.equal(res.isValid, true);
    });

    await t.test('inactive roomId flags ROOM_INACTIVE and throws 409', async () => {
      const res = await findPlacementConflicts({
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '10:00',
        courseId: courseDept1.id,
        roomId: roomInactive.id,
      });
      assert.equal(res.isValid, false);
      assert.ok(res.conflicts.some((c) => c.type === 'ROOM_INACTIVE'));

      await assert.rejects(
        async () => {
          await assertValidPlacement({
            dayOfWeek: 'MONDAY',
            startTime: '08:00',
            endTime: '10:00',
            courseId: courseDept1.id,
            roomId: roomInactive.id,
          });
        },
        (err: any) => {
          assert.equal(err.statusCode, 409);
          return true;
        }
      );
    });

    await t.test('resolves room by name case-insensitively', async () => {
      const res = await findPlacementConflicts({
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '10:00',
        courseId: courseDept1.id,
        room: `  ${roomActive.name.toLowerCase()}  `,
      });
      assert.equal(res.resolvedRoom?.id, roomActive.id);
      assert.equal(res.isValid, true);
    });

    await t.test('inactive room by name flags ROOM_INACTIVE', async () => {
      const res = await findPlacementConflicts({
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '10:00',
        courseId: courseDept1.id,
        room: roomInactive.name.toUpperCase(),
      });
      assert.equal(res.isValid, false);
      assert.ok(res.conflicts.some((c) => c.type === 'ROOM_INACTIVE'));
    });

    await t.test('legacy unmapped room string is kept without error', async () => {
      const res = await findPlacementConflicts({
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '10:00',
        courseId: courseDept1.id,
        room: `Legacy_Lab_${SUFFIX}`,
      });
      assert.equal(res.resolvedRoom, null);
      assert.equal(res.isValid, true);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // T1.5: TimetableService conflict reuse
    // ─────────────────────────────────────────────────────────────────────────
    await t.test('detects collision with existing schedule slot', async () => {
      // Create an existing slot
      const existingSlot = await prisma.scheduleSlot.create({
        data: {
          timetableId: timetable1.id,
          courseId: courseDept1.id,
          doctorId: doctor1.id,
          dayOfWeek: 'TUESDAY',
          startTime: '10:00',
          endTime: '12:00',
          room: roomActive.name,
          roomId: roomActive.id,
          slotType: 'LECTURE',
        },
      });
      cleanup.trackSlot(existingSlot.id);

      // Colliding room conflict
      const resRoomCollision = await findPlacementConflicts({
        dayOfWeek: 'TUESDAY',
        startTime: '11:00',
        endTime: '13:00',
        courseId: courseDept1.id,
        roomId: roomActive.id,
      });
      assert.equal(resRoomCollision.isValid, false);
      assert.ok(resRoomCollision.conflicts.some((c) => c.type === 'ROOM_OCCUPIED'));

      // Colliding doctor conflict
      const resDocCollision = await findPlacementConflicts({
        dayOfWeek: 'TUESDAY',
        startTime: '11:00',
        endTime: '13:00',
        courseId: courseDept1.id,
        doctorId: doctor1.id,
      });
      assert.equal(resDocCollision.isValid, false);
      assert.ok(resDocCollision.conflicts.some((c) => c.type === 'DOCTOR_BUSY'));
    });

    // ─────────────────────────────────────────────────────────────────────────
    // T4: executeSchedulePlacement helper with serializable tx & P2034 retry
    // ─────────────────────────────────────────────────────────────────────────
    await t.test('executeSchedulePlacement executes write on valid placement', async () => {
      let writeExecuted = false;
      const result = await executeSchedulePlacement(
        {
          dayOfWeek: 'WEDNESDAY',
          startTime: '08:00',
          endTime: '10:00',
          courseId: courseDept1.id,
          roomId: roomActive.id,
        },
        async (tx, placementResult) => {
          writeExecuted = true;
          assert.ok(placementResult.isValid);
          assert.equal(placementResult.resolvedRoom?.id, roomActive.id);
          return { written: true };
        }
      );
      assert.equal(writeExecuted, true);
      assert.equal(result.written, true);
    });

    await t.test('executeSchedulePlacement deterministically maps P2034 to 409 retry error', async () => {
      const mockPrismaClient = {
        $transaction: async () => {
          const p2034Err: any = new Error('Transaction failed due to a write conflict or a deadlock. Please retry your transaction');
          p2034Err.code = 'P2034';
          throw p2034Err;
        },
      };

      await assert.rejects(
        async () => {
          await executeSchedulePlacement(
            {
              dayOfWeek: 'WEDNESDAY',
              startTime: '08:00',
              endTime: '10:00',
              courseId: courseDept1.id,
            },
            async () => {
              return { done: true };
            },
            { prismaClient: mockPrismaClient as any }
          );
        },
        (err: any) => {
          assert.equal(err.statusCode, 409);
          assert.match(err.message, /retry/i);
          return true;
        }
      );
    });
  } finally {
    await cleanup.teardown(prisma);
    if (academicTermPast?.id) await prisma.academicTerm.delete({ where: { id: academicTermPast.id } }).catch(() => {});
    if (academicYearPast?.id) await prisma.academicYear.delete({ where: { id: academicYearPast.id } }).catch(() => {});
  }
});
