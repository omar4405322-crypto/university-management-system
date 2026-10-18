import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/prismaClient';
import { generateAccessToken } from '../src/utils/jwt.utils';
import app from '../src/app';
import { TestCleanupRegistry } from './testCleanup.utils';
import {
  SchedulePlacementService,
  findPlacementConflicts,
  assertValidPlacement,
  executeSchedulePlacement,
} from '../src/services/schedulePlacement.service';

test('wp3_3b_schedule_placement_wiring: Step 0 spy test and T1-T5 placement wiring tests', async (t) => {
  const SUFFIX = `plw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const cleanup = new TestCleanupRegistry();
  let server: http.Server | null = null;
  let baseUrl = '';

  let college1: any;
  let college2: any;
  let dept1: any;
  let dept2: any;
  let course1: any;
  let course2: any;
  let docUser1: any;
  let doctor1: any;
  let taUser1: any;
  let ta1: any;
  let adminUser: any;
  let deptAdminUser: any;
  let roomActive: any;
  let roomInactive: any;
  let timetable1: any;
  let pastAcademicYear: any;
  let pastAcademicTerm: any;

  let tokenAdmin = '';
  let tokenDeptAdmin = '';
  let tokenDoctor = '';

  // Get current active term
  const baselineCurrentTerm = await prisma.academicTerm.findFirst({
    where: { isCurrent: true },
  });
  assert.ok(baselineCurrentTerm, 'Baseline current term must exist');

  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as any;
    baseUrl = `http://127.0.0.1:${addr.port}/api`;

    const passwordHash = await bcrypt.hash(crypto.randomUUID() + '!Aa1', 4);

    // Setup colleges
    college1 = await prisma.college.create({
      data: { name: `College1_${SUFFIX}`, nameAr: `كلية1_${SUFFIX}` },
    });
    cleanup.trackCollege(college1.id);

    college2 = await prisma.college.create({
      data: { name: `College2_${SUFFIX}`, nameAr: `كلية2_${SUFFIX}` },
    });
    cleanup.trackCollege(college2.id);

    // Setup departments
    dept1 = await prisma.department.create({
      data: { name: `Dept1_${SUFFIX}`, nameAr: `قسم1_${SUFFIX}`, collegeId: college1.id },
    });
    cleanup.trackDepartment(dept1.id);

    dept2 = await prisma.department.create({
      data: { name: `Dept2_${SUFFIX}`, nameAr: `قسم2_${SUFFIX}`, collegeId: college2.id },
    });
    cleanup.trackDepartment(dept2.id);

    // Setup courses
    course1 = await prisma.course.create({
      data: {
        name: `Course1_${SUFFIX}`,
        courseCode: `C1_${SUFFIX.slice(-5)}`,
        credits: 3,
        year: 1,
        semester: 1,
        departmentId: dept1.id,
      },
    });
    cleanup.trackCourse(course1.id);

    course2 = await prisma.course.create({
      data: {
        name: `Course2_${SUFFIX}`,
        courseCode: `C2_${SUFFIX.slice(-5)}`,
        credits: 3,
        year: 1,
        semester: 1,
        departmentId: dept2.id,
      },
    });
    cleanup.trackCourse(course2.id);

    // Setup rooms
    roomActive = await prisma.room.create({
      data: { name: `Hall_${SUFFIX}`, isActive: true },
    });
    cleanup.trackRoom(roomActive.id);

    roomInactive = await prisma.room.create({
      data: { name: `Lab_Inactive_${SUFFIX}`, isActive: false },
    });
    cleanup.trackRoom(roomInactive.id);

    // Setup users & staff
    adminUser = await prisma.user.create({
      data: {
        email: `admin_${SUFFIX}@unicore.edu`,
        password: passwordHash,
        role: 'SUPER_ADMIN',
      },
    });
    cleanup.trackUser(adminUser.id);
    tokenAdmin = generateAccessToken(adminUser.id);

    deptAdminUser = await prisma.user.create({
      data: {
        email: `deptadmin_${SUFFIX}@unicore.edu`,
        password: passwordHash,
        role: 'DEPARTMENT_ADMIN',
        departmentId: dept1.id,
        collegeId: college1.id,
      },
    });
    cleanup.trackUser(deptAdminUser.id);
    tokenDeptAdmin = generateAccessToken(deptAdminUser.id);

    docUser1 = await prisma.user.create({
      data: {
        email: `doc_${SUFFIX}@unicore.edu`,
        password: passwordHash,
        role: 'DOCTOR',
      },
    });
    cleanup.trackUser(docUser1.id);

    doctor1 = await prisma.doctor.create({
      data: {
        userId: docUser1.id,
        firstName: `Doc_${SUFFIX}`,
        lastName: 'Senior',
        departmentId: dept1.id,
      },
    });
    tokenDoctor = generateAccessToken(docUser1.id);

    taUser1 = await prisma.user.create({
      data: {
        email: `ta_${SUFFIX}@unicore.edu`,
        password: passwordHash,
        role: 'TEACHING_ASSISTANT',
      },
    });
    cleanup.trackUser(taUser1.id);

    ta1 = await prisma.teachingAssistant.create({
      data: {
        userId: taUser1.id,
        employeeId: `EMP_${SUFFIX}`,
        firstName: `TA_${SUFFIX}`,
        lastName: 'Junior',
        departmentId: dept1.id,
      },
    });

    // Timetable
    timetable1 = await prisma.timetable.create({
      data: {
        title: `TT_${SUFFIX}`,
        collegeId: college1.id,
        departmentId: dept1.id,
        academicYear: 1,
        semester: 1,
        termId: baselineCurrentTerm.id,
        status: 'PUBLISHED',
      },
    });
    cleanup.trackTimetable(timetable1.id);

    // Setup past academic year and term
    pastAcademicYear = await prisma.academicYear.create({
      data: {
        name: `AY_Past_${SUFFIX}`,
        startDate: new Date('2023-09-01T00:00:00Z'),
        endDate: new Date('2024-06-30T23:59:59Z'),
        isCurrent: false,
      },
    });
    pastAcademicTerm = await prisma.academicTerm.create({
      data: {
        academicYearId: pastAcademicYear.id,
        name: `Term_Past_${SUFFIX}`,
        termType: 'FALL',
        semesterNumber: 1,
        startDate: new Date('2023-09-01T00:00:00Z'),
        endDate: new Date('2024-01-31T23:59:59Z'),
        isCurrent: false,
      },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 0 (f): SPY TEST - Prove conflict queries execute strictly on tx
    // ─────────────────────────────────────────────────────────────────────────
    await t.test('Step 0(f) Spy Test: executeSchedulePlacement runs every conflict query on tx', async () => {
      const txMethodCalls: string[] = [];

      const mockTx: any = {
        academicTerm: {
          findUnique: async () => { txMethodCalls.push('academicTerm.findUnique'); return baselineCurrentTerm; },
          findFirst: async () => { txMethodCalls.push('academicTerm.findFirst'); return baselineCurrentTerm; },
        },
        room: {
          findUnique: async () => { txMethodCalls.push('room.findUnique'); return roomActive; },
          findFirst: async () => { txMethodCalls.push('room.findFirst'); return roomActive; },
        },
        teachingAssistant: {
          findUnique: async () => { txMethodCalls.push('teachingAssistant.findUnique'); return ta1; },
        },
        course: {
          findUnique: async () => { txMethodCalls.push('course.findUnique'); return course1; },
        },
        tACrossDepartmentApproval: {
          findUnique: async () => { txMethodCalls.push('tACrossDepartmentApproval.findUnique'); return null; },
        },
        scheduleSlot: {
          findMany: async () => { txMethodCalls.push('scheduleSlot.findMany'); return []; },
          findFirst: async () => { txMethodCalls.push('scheduleSlot.findFirst'); return null; },
          create: async (args: any) => { txMethodCalls.push('scheduleSlot.create'); return { id: 9999, ...args.data }; },
        },
        scheduleOverride: {
          findMany: async () => { txMethodCalls.push('scheduleOverride.findMany'); return []; },
          findFirst: async () => { txMethodCalls.push('scheduleOverride.findFirst'); return null; },
        },
      };

      const mockClient = {
        $transaction: async (cb: (tx: any) => Promise<any>) => {
          return cb(mockTx);
        },
      };

      const writeResult = await executeSchedulePlacement(
        {
          dayOfWeek: 'MONDAY',
          startTime: '08:00',
          endTime: '10:00',
          courseId: course1.id,
          doctorId: doctor1.id,
          roomId: roomActive.id,
          termId: baselineCurrentTerm.id,
        },
        async (tx, placementResult) => {
          assert.equal(tx, mockTx, 'Transaction client passed to writeOperation must be tx');
          return tx.scheduleSlot.create({ data: { courseId: course1.id } });
        },
        { prismaClient: mockClient as any }
      );

      assert.equal(writeResult.id, 9999);
      assert.ok(txMethodCalls.includes('academicTerm.findUnique'), 'tx.academicTerm.findUnique was called');
      assert.ok(txMethodCalls.includes('room.findUnique'), 'tx.room.findUnique was called');
      assert.ok(txMethodCalls.includes('scheduleSlot.findMany'), 'tx.scheduleSlot.findMany was called');
      assert.ok(txMethodCalls.includes('scheduleSlot.findFirst'), 'tx.scheduleSlot.findFirst was called');
      assert.ok(txMethodCalls.includes('scheduleSlot.create'), 'tx.scheduleSlot.create was called');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 0 (e): Fail closed when NO isCurrent term exists
    // ─────────────────────────────────────────────────────────────────────────
    await t.test('Step 0(e): findPlacementConflicts fails closed (409) when NO isCurrent term exists', async () => {
      const mockTxNoTerm: any = {
        academicTerm: {
          findFirst: async () => null,
          findUnique: async () => null,
        },
        room: {
          findUnique: async () => null,
          findFirst: async () => null,
        },
        scheduleSlot: {
          findMany: async () => [],
          findFirst: async () => null,
        },
        scheduleOverride: {
          findMany: async () => [],
          findFirst: async () => null,
        },
      };

      const result = await findPlacementConflicts(
        {
          dayOfWeek: 'MONDAY',
          startTime: '08:00',
          endTime: '10:00',
        },
        { tx: mockTxNoTerm }
      );

      assert.equal(result.isValid, false, 'Must fail validation when no active term exists');
      const termConflict = result.conflicts.find((c) => c.type === 'NO_ACTIVE_TERM');
      assert.ok(termConflict, 'Must produce NO_ACTIVE_TERM conflict type');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // T1: POST/PUT /api/schedules through executeSchedulePlacement
    // ─────────────────────────────────────────────────────────────────────────
    await t.test('T1: POST /api/schedules assigns explicit termId, case-insensitive room match sets roomId', async () => {
      const createRes = await fetch(`${baseUrl}/schedules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAdmin}`,
        },
        body: JSON.stringify({
          courseId: course1.id,
          doctorId: doctor1.id,
          dayOfWeek: 'MONDAY',
          startTime: '10:00',
          endTime: '12:00',
          room: `  ${roomActive.name.toLowerCase()}  `,
          slotType: 'LECTURE',
        }),
      });

      const body = await createRes.json();
      assert.equal(createRes.status, 201, `Expected 201, got ${createRes.status}: ${JSON.stringify(body)}`);
      assert.equal(body.data.termId, baselineCurrentTerm.id, 'Slot must have explicit termId from service');
      assert.equal(body.data.roomId, roomActive.id, 'Slot must have roomId set from case-insensitive match');
      assert.equal(body.data.room, roomActive.name, 'Slot room string normalized to Room.name');
      cleanup.trackSlot(body.data.id);

      const conflictRes = await fetch(`${baseUrl}/schedules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAdmin}`,
        },
        body: JSON.stringify({
          courseId: course1.id,
          doctorId: doctor1.id,
          dayOfWeek: 'MONDAY',
          startTime: '10:00',
          endTime: '12:00',
          roomId: roomActive.id,
          slotType: 'LECTURE',
        }),
      });
      assert.equal(conflictRes.status, 409, 'Conflict must return 409');

      const pastTermRes = await fetch(`${baseUrl}/schedules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAdmin}`,
        },
        body: JSON.stringify({
          courseId: course1.id,
          doctorId: doctor1.id,
          dayOfWeek: 'TUESDAY',
          startTime: '10:00',
          endTime: '12:00',
          termId: pastAcademicTerm.id,
          slotType: 'LECTURE',
        }),
      });
      assert.equal(pastTermRes.status, 409, 'Past term must return 409');

      const crossTaRes = await fetch(`${baseUrl}/schedules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAdmin}`,
        },
        body: JSON.stringify({
          courseId: course2.id,
          teachingAssistantId: ta1.id,
          dayOfWeek: 'WEDNESDAY',
          startTime: '10:00',
          endTime: '12:00',
          slotType: 'LAB',
        }),
      });
      assert.equal(crossTaRes.status, 403, 'Unapproved cross-department TA must return 403');
    });

    await t.test('T1: PUT /api/schedules/:id enforces conflict 409, past term 409, cross-dept TA 403', async () => {
      const slot = await prisma.scheduleSlot.create({
        data: {
          courseId: course1.id,
          doctorId: doctor1.id,
          dayOfWeek: 'THURSDAY',
          startTime: '08:00',
          endTime: '10:00',
          termId: baselineCurrentTerm.id,
          slotType: 'LECTURE',
        },
      });
      cleanup.trackSlot(slot.id);

      const putPastRes = await fetch(`${baseUrl}/schedules/${slot.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAdmin}`,
        },
        body: JSON.stringify({
          dayOfWeek: 'THURSDAY',
          startTime: '08:00',
          endTime: '10:00',
          termId: pastAcademicTerm.id,
        }),
      });
      assert.equal(putPastRes.status, 409, 'Updating slot into past term must return 409');

      const putCrossTaRes = await fetch(`${baseUrl}/schedules/${slot.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAdmin}`,
        },
        body: JSON.stringify({
          dayOfWeek: 'THURSDAY',
          startTime: '08:00',
          endTime: '10:00',
          courseId: course2.id,
          teachingAssistantId: ta1.id,
          slotType: 'LAB',
        }),
      });
      assert.equal(putCrossTaRes.status, 403, 'Updating to unapproved cross-dept TA must return 403');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // T2: POST /api/schedules/sync-grid (OD-32/OD-46)
    // ─────────────────────────────────────────────────────────────────────────
    await t.test('T2: sync-grid is all-or-nothing: any conflict -> 409 with zero writes', async () => {
      const blockerSlot = await prisma.scheduleSlot.create({
        data: {
          courseId: course1.id,
          doctorId: doctor1.id,
          dayOfWeek: 'SUNDAY',
          startTime: '10:00',
          endTime: '12:00',
          room: roomActive.name,
          roomId: roomActive.id,
          termId: baselineCurrentTerm.id,
          slotType: 'LECTURE',
        },
      });
      cleanup.trackSlot(blockerSlot.id);

      const countBefore = await prisma.scheduleSlot.count({
        where: { course: { departmentId: dept1.id } },
      });

      const syncRes = await fetch(`${baseUrl}/schedules/sync-grid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAdmin}`,
        },
        body: JSON.stringify({
          departmentId: dept1.id,
          academicYear: 1,
          semester: 1,
          slots: [
            {
              courseId: course1.id,
              courseName: course1.name,
              day: 'SUNDAY',
              startTime: '08:00',
              endTime: '10:00',
              doctorId: doctor1.id,
              room: 'Free Room',
              slotType: 'LECTURE',
            },
            {
              courseId: course1.id,
              courseName: course1.name,
              day: 'SUNDAY',
              startTime: '10:00',
              endTime: '12:00',
              doctorId: doctor1.id,
              room: roomActive.name,
              slotType: 'LECTURE',
            },
          ],
        }),
      });

      assert.equal(syncRes.status, 409, 'sync-grid collision must return 409');
      const countAfter = await prisma.scheduleSlot.count({
        where: { course: { departmentId: dept1.id } },
      });
      assert.equal(countAfter, countBefore, 'Zero writes must occur on sync-grid 409');
    });

    await t.test('T2: sync-grid validates against FINAL state: slot moved away frees its old cell', async () => {
      const existingS1 = await prisma.scheduleSlot.create({
        data: {
          courseId: course1.id,
          doctorId: doctor1.id,
          dayOfWeek: 'MONDAY',
          startTime: '14:00',
          endTime: '16:00',
          room: roomActive.name,
          roomId: roomActive.id,
          termId: baselineCurrentTerm.id,
          timetableId: timetable1.id,
          slotType: 'LECTURE',
        },
      });
      cleanup.trackSlot(existingS1.id);

      const syncRes = await fetch(`${baseUrl}/schedules/sync-grid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAdmin}`,
        },
        body: JSON.stringify({
          departmentId: dept1.id,
          academicYear: 1,
          semester: 1,
          slots: [
            {
              courseId: course1.id,
              courseName: course1.name,
              day: 'TUESDAY',
              startTime: '14:00',
              endTime: '16:00',
              doctorId: doctor1.id,
              room: roomActive.name,
              slotType: 'LECTURE',
            },
            {
              courseId: course1.id,
              courseName: course1.name,
              day: 'MONDAY',
              startTime: '14:00',
              endTime: '16:00',
              teachingAssistantId: ta1.id,
              room: roomActive.name,
              slotType: 'LAB',
            },
          ],
        }),
      });

      const body = await syncRes.json();
      assert.equal(syncRes.status, 200, `Expected 200 for valid final state, got ${syncRes.status}: ${JSON.stringify(body)}`);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // T3: Doctor and TA schedule assign handlers
    // ─────────────────────────────────────────────────────────────────────────
    await t.test('T3: assignDoctorCourse routes through service (conflict -> 409)', async () => {
      const existingOccupied = await prisma.scheduleSlot.create({
        data: {
          courseId: course1.id,
          doctorId: doctor1.id,
          dayOfWeek: 'WEDNESDAY',
          startTime: '08:00',
          endTime: '10:00',
          room: roomActive.name,
          roomId: roomActive.id,
          termId: baselineCurrentTerm.id,
          slotType: 'LECTURE',
        },
      });
      cleanup.trackSlot(existingOccupied.id);

      const docUser2 = await prisma.user.create({
        data: { email: `doc2_${SUFFIX}@unicore.edu`, password: passwordHash, role: 'DOCTOR' },
      });
      cleanup.trackUser(docUser2.id);
      const doctor2 = await prisma.doctor.create({
        data: { userId: docUser2.id, firstName: `Doc2_${SUFFIX}`, lastName: 'Doc', departmentId: dept1.id },
      });

      const assignRes = await fetch(`${baseUrl}/doctors/${doctor2.id}/assign-course`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAdmin}`,
        },
        body: JSON.stringify({
          courseId: course1.id,
          dayOfWeek: 'WEDNESDAY',
          startTime: '08:00',
          endTime: '10:00',
          room: roomActive.name,
        }),
      });
      assert.equal(assignRes.status, 409, 'Doctor assign colliding on room must return 409');
    });

    await t.test('T3: assignTACourse: unapproved cross-department TA -> 403, approved -> 200', async () => {
      const assignUnapprovedRes = await fetch(`${baseUrl}/teaching-assistants/${ta1.id}/assign-course`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAdmin}`,
        },
        body: JSON.stringify({
          courseId: course2.id,
          dayOfWeek: 'FRIDAY',
          startTime: '10:00',
          endTime: '12:00',
          slotType: 'LAB',
        }),
      });
      assert.equal(assignUnapprovedRes.status, 403, 'Cross-dept TA without approval must return 403');

      const approval = await prisma.tACrossDepartmentApproval.create({
        data: {
          teachingAssistantId: ta1.id,
          courseId: course2.id,
          status: 'APPROVED',
          approvedByUserId: adminUser.id,
        },
      });
      cleanup.trackTAApproval(approval.id);

      const assignApprovedRes = await fetch(`${baseUrl}/teaching-assistants/${ta1.id}/assign-course`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAdmin}`,
        },
        body: JSON.stringify({
          courseId: course2.id,
          dayOfWeek: 'FRIDAY',
          startTime: '10:00',
          endTime: '12:00',
          slotType: 'LAB',
        }),
      });
      const approvedBody = await assignApprovedRes.json();
      assert.equal(assignApprovedRes.status, 200, `Expected 200 after approval, got ${assignApprovedRes.status}: ${JSON.stringify(approvedBody)}`);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // T4: requests respond (approveRequest) and overrides create
    // ─────────────────────────────────────────────────────────────────────────
    await t.test('T4: approveRequest NEW_SLOT gets timetableId & termId through service', async () => {
      const changeReq = await prisma.scheduleChangeRequest.create({
        data: {
          requesterId: docUser1.id,
          courseId: course1.id,
          type: 'NEW_SLOT',
          status: 'PENDING',
          proposedData: {
            dayOfWeek: 'THURSDAY',
            startTime: '12:00',
            endTime: '14:00',
            doctorId: doctor1.id,
            slotType: 'LECTURE',
            room: roomActive.name,
          },
        },
      });
      cleanup.trackChangeRequest(changeReq.id);

      const approveRes = await fetch(`${baseUrl}/requests/${changeReq.id}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAdmin}`,
        },
        body: JSON.stringify({}),
      });
      assert.equal(approveRes.status, 200, 'Approve NEW_SLOT must succeed');

      const createdSlot = await prisma.scheduleSlot.findFirst({
        where: {
          courseId: course1.id,
          dayOfWeek: 'THURSDAY',
          startTime: '12:00',
        },
      });
      assert.ok(createdSlot, 'Slot must be created');
      assert.equal(createdSlot.termId, baselineCurrentTerm.id, 'Slot created via request must receive termId');
      assert.equal(createdSlot.timetableId, timetable1.id, 'Slot created via request must receive timetableId');
      cleanup.trackSlot(createdSlot.id);
    });

    await t.test('T4: approveRequest DELETE_SLOT with attendance evidence is blocked with 409', async () => {
      const slotWithAttendance = await prisma.scheduleSlot.create({
        data: {
          courseId: course1.id,
          doctorId: doctor1.id,
          dayOfWeek: 'FRIDAY',
          startTime: '08:00',
          endTime: '10:00',
          termId: baselineCurrentTerm.id,
          slotType: 'LECTURE',
        },
      });
      cleanup.trackSlot(slotWithAttendance.id);

      const session = await prisma.attendanceSession.create({
        data: {
          scheduleSlotId: slotWithAttendance.id,
          secretKey: `sec_${SUFFIX}`,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      cleanup.trackSession(session.id);

      const deleteReq = await prisma.scheduleChangeRequest.create({
        data: {
          requesterId: docUser1.id,
          courseId: course1.id,
          scheduleSlotId: slotWithAttendance.id,
          type: 'DELETE_SLOT',
          status: 'PENDING',
          proposedData: {},
        },
      });
      cleanup.trackChangeRequest(deleteReq.id);

      const approveDeleteRes = await fetch(`${baseUrl}/requests/${deleteReq.id}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAdmin}`,
        },
        body: JSON.stringify({}),
      });
      assert.equal(approveDeleteRes.status, 409, 'Approving DELETE_SLOT with attendance evidence must return 409');
    });

    await t.test('T4: createOverride routes through service (conflict -> 409)', async () => {
      const baseSlot = await prisma.scheduleSlot.create({
        data: {
          courseId: course1.id,
          doctorId: doctor1.id,
          dayOfWeek: 'SUNDAY',
          startTime: '14:00',
          endTime: '16:00',
          termId: baselineCurrentTerm.id,
          slotType: 'LECTURE',
        },
      });
      cleanup.trackSlot(baseSlot.id);

      const blockerSlot = await prisma.scheduleSlot.create({
        data: {
          courseId: course1.id,
          dayOfWeek: 'SUNDAY',
          startTime: '14:00',
          endTime: '16:00',
          room: roomActive.name,
          roomId: roomActive.id,
          termId: baselineCurrentTerm.id,
          slotType: 'LECTURE',
        },
      });
      cleanup.trackSlot(blockerSlot.id);

      const overrideRes = await fetch(`${baseUrl}/schedules/${baseSlot.id}/overrides`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAdmin}`,
        },
        body: JSON.stringify({
          startDate: '2026-10-20T00:00:00Z',
          endDate: '2026-10-27T00:00:00Z',
          room: roomActive.name,
          dayOfWeek: 'SUNDAY',
          startTime: '14:00',
          endTime: '16:00',
        }),
      });
      assert.equal(overrideRes.status, 409, 'Override colliding on room must return 409');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // T5: Admin filters & OD-34 scope enforcement on GET /api/schedules/week
    // ─────────────────────────────────────────────────────────────────────────
    await t.test('T5: Admin filters doctorId, teachingAssistantId, roomId, termId on GET /schedules/week', async () => {
      const getWeekRes = await fetch(
        `${baseUrl}/schedules/week?doctorId=${doctor1.id}&teachingAssistantId=${ta1.id}&roomId=${roomActive.id}&termId=${baselineCurrentTerm.id}`,
        {
          headers: {
            Authorization: `Bearer ${tokenAdmin}`,
          },
        }
      );
      assert.equal(getWeekRes.status, 200, 'Admin filtering by doctorId, TA, roomId, termId must succeed');
    });

    await t.test('T5: Department admin querying out-of-scope doctor returns 403 (OD-34)', async () => {
      const outOfScopeDoctorUser = await prisma.user.create({
        data: { email: `doc_out_${SUFFIX}@unicore.edu`, password: passwordHash, role: 'DOCTOR' },
      });
      cleanup.trackUser(outOfScopeDoctorUser.id);
      const outOfScopeDoctor = await prisma.doctor.create({
        data: { userId: outOfScopeDoctorUser.id, firstName: 'Out', lastName: 'Scope', departmentId: dept2.id },
      });

      const getWeekRes = await fetch(
        `${baseUrl}/schedules/week?doctorId=${outOfScopeDoctor.id}`,
        {
          headers: {
            Authorization: `Bearer ${tokenDeptAdmin}`,
          },
        }
      );
      assert.equal(getWeekRes.status, 403, 'Out-of-scope doctor filter for department admin must return 403');
    });

  } finally {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    await cleanup.teardown(prisma);
    if (pastAcademicTerm?.id) await prisma.academicTerm.delete({ where: { id: pastAcademicTerm.id } }).catch(() => {});
    if (pastAcademicYear?.id) await prisma.academicYear.delete({ where: { id: pastAcademicYear.id } }).catch(() => {});
  }
});
