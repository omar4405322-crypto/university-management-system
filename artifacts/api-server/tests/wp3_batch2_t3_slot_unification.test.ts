import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { TestCleanupRegistry } from './testCleanup.utils';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'wp3-batch2-t3-test-secret-2026';

const [
  { default: app },
  { default: prisma },
  { generateAccessToken },
] = await Promise.all([
  import('../src/app'),
  import('../src/utils/prismaClient'),
  import('../src/utils/jwt.utils'),
]);

async function createServer() {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  return { server, baseUrl };
}

async function closeServer(server: http.Server | null) {
  if (server) {
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-test 1: Read Path Normalization
// ─────────────────────────────────────────────────────────────────────────────
test('WP-3 Batch 2 Task 3: Read Path Normalization (legacy SECTION/TUTORIAL mapped to LAB)', async () => {
  const SUFFIX = 't3r_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const passwordHash = await bcrypt.hash(crypto.randomUUID() + '!Aa1', 4);
  const cleanup = new TestCleanupRegistry();
  let server: http.Server | null = null;

  try {
    const srv = await createServer();
    server = srv.server;
    const baseUrl = srv.baseUrl;

    // 1. College & Department
    const college = await prisma.college.create({
      data: {
        name: `College_${SUFFIX}`,
        nameAr: `كلية_${SUFFIX}`,
      },
    });
    cleanup.trackCollege(college.id);

    const department = await prisma.department.create({
      data: {
        name: `Dept_${SUFFIX}`,
        nameAr: `قسم_${SUFFIX}`,
        collegeId: college.id,
      },
    });
    cleanup.trackDepartment(department.id);

    // 2. Course
    const course = await prisma.course.create({
      data: {
        name: `Course_${SUFFIX}`,
        courseCode: `CS_${SUFFIX.slice(-4)}`,
        departmentId: department.id,
        year: 1,
        semester: 1,
        credits: 3,
        isPublished: true,
      },
    });
    cleanup.trackCourse(course.id);

    // 3. Users & Profiles
    const adminUser = await prisma.user.create({
      data: {
        email: `admin_${SUFFIX}@unicore.test`,
        password: passwordHash,
        role: 'SUPER_ADMIN',
        tokenVersion: 0,
        isActive: true,
      },
    });
    cleanup.trackUser(adminUser.id);
    const adminToken = generateAccessToken(adminUser.id, 0);

    const doctorUser = await prisma.user.create({
      data: {
        email: `doc_${SUFFIX}@unicore.test`,
        password: passwordHash,
        role: 'DOCTOR',
        tokenVersion: 0,
        isActive: true,
      },
    });
    cleanup.trackUser(doctorUser.id);

    const doctor = await prisma.doctor.create({
      data: {
        userId: doctorUser.id,
        firstName: 'Doc',
        lastName: `T3_${SUFFIX}`,
        doctorId: `DOC_${SUFFIX.slice(-4)}`,
        departmentId: department.id,
      },
    });
    cleanup.trackDoctor(doctor.id);

    const taUser = await prisma.user.create({
      data: {
        email: `ta_${SUFFIX}@unicore.test`,
        password: passwordHash,
        role: 'TEACHING_ASSISTANT',
        tokenVersion: 0,
        isActive: true,
      },
    });
    cleanup.trackUser(taUser.id);

    const ta = await prisma.teachingAssistant.create({
      data: {
        userId: taUser.id,
        firstName: 'TA',
        lastName: `T3_${SUFFIX}`,
        employeeId: `TA_${SUFFIX.slice(-4)}`,
        departmentId: department.id,
      },
    });
    cleanup.trackTA(ta.id);

    const studentUser = await prisma.user.create({
      data: {
        email: `stu_${SUFFIX}@unicore.test`,
        password: passwordHash,
        role: 'STUDENT',
        tokenVersion: 0,
        isActive: true,
      },
    });
    cleanup.trackUser(studentUser.id);

    const student = await prisma.student.create({
      data: {
        userId: studentUser.id,
        studentId: `STU_${SUFFIX.slice(-4)}`,
        firstName: 'Student',
        lastName: `T3_${SUFFIX}`,
        year: 1,
        departmentId: department.id,
      },
    });
    cleanup.trackStudent(student.id);

    const enrollment = await prisma.enrollment.create({
      data: {
        studentId: student.id,
        courseId: course.id,
        semester: 1,
        academicYear: 1,
        status: 'ENROLLED',
      },
    });
    cleanup.trackEnrollment(enrollment.id);

    // 4. Timetable
    const timetable = await prisma.timetable.create({
      data: {
        title: `Timetable_${SUFFIX}`,
        collegeId: college.id,
        departmentId: department.id,
        academicYear: 1,
        semester: 1,
        status: 'PUBLISHED',
      },
    });
    cleanup.trackTimetable(timetable.id);

    // 5. Schedule Slots: legacy SECTION, LAB, LECTURE
    const sectionSlot = await prisma.scheduleSlot.create({
      data: {
        courseId: course.id,
        doctorId: doctor.id,
        teachingAssistantId: ta.id,
        timetableId: timetable.id,
        dayOfWeek: 'SUNDAY',
        startTime: '08:00',
        endTime: '10:00',
        room: 'Room 101',
        slotType: 'SECTION',
      },
    });
    cleanup.trackSlot(sectionSlot.id);

    const labSlot = await prisma.scheduleSlot.create({
      data: {
        courseId: course.id,
        doctorId: doctor.id,
        teachingAssistantId: ta.id,
        timetableId: timetable.id,
        dayOfWeek: 'TUESDAY',
        startTime: '12:00',
        endTime: '14:00',
        room: `Lab_${SUFFIX}_201`,
        slotType: 'LAB',
      },
    });
    cleanup.trackSlot(labSlot.id);

    const lectureSlot = await prisma.scheduleSlot.create({
      data: {
        courseId: course.id,
        doctorId: doctor.id,
        timetableId: timetable.id,
        dayOfWeek: 'WEDNESDAY',
        startTime: '14:00',
        endTime: '16:00',
        room: 'Hall A',
        slotType: 'LECTURE',
      },
    });
    cleanup.trackSlot(lectureSlot.id);

    // ── READ ASSERTIONS (C3 READ PATHS) ──────────────────────────────────────────

    // 1. Weekly Timetable READ: legacy SECTION -> LAB
    const getRes = await fetch(`${baseUrl}/schedules/week?timetableId=${timetable.id}`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(getRes.status, 200);
    const getBody = (await getRes.json()) as any;
    assert.equal(getBody.success, true);

    const slots = getBody.data;
    const foundSection = slots.find((s: any) => s.id === sectionSlot.id);
    const foundLab = slots.find((s: any) => s.id === labSlot.id);
    const foundLecture = slots.find((s: any) => s.id === lectureSlot.id);

    assert.ok(foundSection, 'SECTION slot should be returned');
    assert.equal(foundSection.slotType, 'LAB', 'Legacy SECTION must be mapped to LAB');
    assert.ok(foundLab, 'LAB slot should be returned');
    assert.equal(foundLab.slotType, 'LAB', 'LAB remains LAB');
    assert.ok(foundLecture, 'LECTURE slot should be returned');
    assert.equal(foundLecture.slotType, 'LECTURE', 'LECTURE remains LECTURE');

    // 2. Archive & Restore responses (schedulesMutation): legacy SECTION -> LAB
    const archiveRes = await fetch(`${baseUrl}/schedules/${sectionSlot.id}/archive`, {
      method: 'POST',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(archiveRes.status, 200, 'archive should succeed');
    const archiveBody = (await archiveRes.json()) as any;
    assert.equal(archiveBody.data.slotType, 'LAB', 'archive response slotType must be normalized to LAB');

    const restoreRes = await fetch(`${baseUrl}/schedules/${sectionSlot.id}/restore`, {
      method: 'POST',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(restoreRes.status, 200, 'restore should succeed');
    const restoreBody = (await restoreRes.json()) as any;
    assert.equal(restoreBody.data.slotType, 'LAB', 'restore response slotType must be normalized to LAB');

    // 3. Courses Controller: list and by-id sections/scheduleSlots
    const coursesRes = await fetch(`${baseUrl}/courses?search=${course.courseCode}`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(coursesRes.status, 200);
    const coursesBody = (await coursesRes.json()) as any;
    const foundCourseInList = coursesBody.data.courses.find((c: any) => c.id === course.id);
    assert.ok(foundCourseInList, 'Course should be found in list');
    const secInList = foundCourseInList.sections.find((s: any) => s.id === sectionSlot.id);
    assert.ok(secInList, 'Legacy section slot should be in course sections');
    assert.equal(secInList.slotType, 'LAB', 'Course sections list must normalize slotType to LAB');

    const courseByIdRes = await fetch(`${baseUrl}/courses/${course.id}`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(courseByIdRes.status, 200);
    const courseByIdBody = (await courseByIdRes.json()) as any;
    const secInById = courseByIdBody.data.sections.find((s: any) => s.id === sectionSlot.id);
    assert.ok(secInById, 'Legacy section slot should be in course by-id sections');
    assert.equal(secInById.slotType, 'LAB', 'Course by-id sections must normalize slotType to LAB');

    // 4. Teaching Assistants Controller: suggested and by-id scheduleSlots
    const taSugRes = await fetch(`${baseUrl}/teaching-assistants/suggested?courseId=${course.id}`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(taSugRes.status, 200);
    const taSugBody = (await taSugRes.json()) as any;
    const foundTaSug = taSugBody.data.find((item: any) => item.id === ta.id);
    assert.ok(foundTaSug, 'TA should be in suggested list');
    const secInTaSug = foundTaSug.scheduleSlots.find((s: any) => s.id === sectionSlot.id);
    assert.ok(secInTaSug, 'Legacy slot should be in suggested TA scheduleSlots');
    assert.equal(secInTaSug.slotType, 'LAB', 'Suggested TA scheduleSlots must normalize slotType to LAB');

    const taByIdRes = await fetch(`${baseUrl}/teaching-assistants/${ta.id}`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(taByIdRes.status, 200);
    const taByIdBody = (await taByIdRes.json()) as any;
    const secInTaById = taByIdBody.data.scheduleSlots.find((s: any) => s.id === sectionSlot.id);
    assert.ok(secInTaById, 'Legacy slot should be in TA by-id scheduleSlots');
    assert.equal(secInTaById.slotType, 'LAB', 'TA by-id scheduleSlots must normalize slotType to LAB');

    // 5. Doctors Controller: suggested and by-id scheduleSlots
    const docSugRes = await fetch(`${baseUrl}/doctors/suggested?courseId=${course.id}`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(docSugRes.status, 200);
    const docSugBody = (await docSugRes.json()) as any;
    const foundDocSug = docSugBody.data.find((item: any) => item.id === doctor.id);
    assert.ok(foundDocSug, 'Doctor should be in suggested list');
    const secInDocSug = foundDocSug.scheduleSlots.find((s: any) => s.id === sectionSlot.id);
    assert.ok(secInDocSug, 'Legacy slot should be in suggested Doctor scheduleSlots');
    assert.equal(secInDocSug.slotType, 'LAB', 'Suggested Doctor scheduleSlots must normalize slotType to LAB');

    const docByIdRes = await fetch(`${baseUrl}/doctors/${doctor.id}`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(docByIdRes.status, 200);
    const docByIdBody = (await docByIdRes.json()) as any;
    const secInDocById = docByIdBody.data.scheduleSlots.find((s: any) => s.id === sectionSlot.id);
    assert.ok(secInDocById, 'Legacy slot should be in Doctor by-id scheduleSlots');
    assert.equal(secInDocById.slotType, 'LAB', 'Doctor by-id scheduleSlots must normalize slotType to LAB');

    // 6. Attendance Service: getMySlots and getCoursesForAttendance
    const { AttendanceService } = await import('../src/services/attendance.service');
    const adminActor = {
      id: adminUser.id,
      userId: adminUser.id,
      role: 'SUPER_ADMIN' as const,
    };
    const mySlots = await AttendanceService.getMySlots(adminActor);
    const foundMySlot = mySlots.find((s: any) => s.id === sectionSlot.id);
    assert.ok(foundMySlot, 'Legacy slot should be returned by AttendanceService.getMySlots');
    assert.equal(foundMySlot.slotType, 'LAB', 'AttendanceService.getMySlots must normalize slotType to LAB');

    const attendanceCourses = await AttendanceService.getMyCourses(adminActor);
    const foundAttCourse = attendanceCourses.find((c: any) => c.id === course.id);
    assert.ok(foundAttCourse, 'Course should be returned by getMyCourses');
    const secInAttCourse = (foundAttCourse as any).scheduleSlots?.find((s: any) => s.id === sectionSlot.id);
    assert.ok(secInAttCourse, 'Legacy slot should be in attendance course scheduleSlots');
    assert.equal(secInAttCourse.slotType, 'LAB', 'AttendanceService.getMyCourses must normalize slotType to LAB');

    // 7. AI Tools: student/doctor/TA schedules, admin summary groupBy, course details
    const { executeAiTool } = await import('../src/services/aiTools.service');
    const taActor = {
      id: taUser.id,
      userId: taUser.id,
      role: 'TEACHING_ASSISTANT' as const,
      teachingAssistant: { id: ta.id, departmentId: department.id },
    };
    const taAiSchedule = await executeAiTool('get_my_ta_schedule', '{}', taActor);
    assert.equal(taAiSchedule.status, 'SUCCESS');
    const foundTaAiSlot = (taAiSchedule as any).slots?.find((s: any) => s.slotType) ||
      (taAiSchedule as any).todaySlots?.find((s: any) => s.slotType);
    assert.ok(foundTaAiSlot, 'Should find slot in TA schedule from AI tool');
    assert.equal(foundTaAiSlot.slotType, 'LAB', 'AI tools must normalize slotType to LAB');

    const adminAiSummary = await executeAiTool('get_scoped_schedule_summary', '{}', adminActor);
    assert.equal(adminAiSummary.status, 'SUCCESS');
    const slotsByType = (adminAiSummary as any).slotsByType || (adminAiSummary as any).schedules?.slotsByType || [];
    assert.ok(slotsByType.every((item: any) => item.slotType === 'LECTURE' || item.slotType === 'LAB'), 'Admin summary slotsByType must contain only LECTURE or LAB');
  } finally {
    try {
      await cleanup.teardown(prisma);
    } finally {
      await closeServer(server);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Sub-test 2: Write Path Enforcement for Slots (POST, sync-grid, PUT)
// ─────────────────────────────────────────────────────────────────────────────
test('WP-3 Batch 2 Task 3: Write Path Enforcement for Slots (POST /schedules, sync-grid, PUT)', async () => {
  const SUFFIX = 't3w1_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const passwordHash = await bcrypt.hash(crypto.randomUUID() + '!Aa1', 4);
  const cleanup = new TestCleanupRegistry();
  let server: http.Server | null = null;

  try {
    const srv = await createServer();
    server = srv.server;
    const baseUrl = srv.baseUrl;

    const college = await prisma.college.create({
      data: { name: `College_${SUFFIX}` },
    });
    cleanup.trackCollege(college.id);

    const department = await prisma.department.create({
      data: { name: `Dept_${SUFFIX}`, collegeId: college.id },
    });
    cleanup.trackDepartment(department.id);

    const course = await prisma.course.create({
      data: {
        name: `Course_${SUFFIX}`,
        courseCode: `CS_${SUFFIX.slice(-4)}`,
        departmentId: department.id,
        year: 1,
        semester: 1,
        credits: 3,
        isPublished: true,
      },
    });
    cleanup.trackCourse(course.id);

    const adminUser = await prisma.user.create({
      data: {
        email: `admin_${SUFFIX}@unicore.test`,
        password: passwordHash,
        role: 'SUPER_ADMIN',
        tokenVersion: 0,
        isActive: true,
      },
    });
    cleanup.trackUser(adminUser.id);
    const adminToken = generateAccessToken(adminUser.id, 0);

    const doctorUser = await prisma.user.create({
      data: {
        email: `doc_${SUFFIX}@unicore.test`,
        password: passwordHash,
        role: 'DOCTOR',
        tokenVersion: 0,
        isActive: true,
      },
    });
    cleanup.trackUser(doctorUser.id);

    const doctor = await prisma.doctor.create({
      data: {
        userId: doctorUser.id,
        firstName: 'Doc',
        lastName: `T3_${SUFFIX}`,
        doctorId: `DOC_${SUFFIX.slice(-4)}`,
        departmentId: department.id,
      },
    });
    cleanup.trackDoctor(doctor.id);

    const timetable = await prisma.timetable.create({
      data: {
        title: `Timetable_${SUFFIX}`,
        collegeId: college.id,
        departmentId: department.id,
        academicYear: 1,
        semester: 1,
        status: 'PUBLISHED',
      },
    });
    cleanup.trackTimetable(timetable.id);

    const labSlot = await prisma.scheduleSlot.create({
      data: {
        courseId: course.id,
        doctorId: doctor.id,
        timetableId: timetable.id,
        dayOfWeek: 'TUESDAY',
        startTime: '12:00',
        endTime: '14:00',
        room: `Lab_${SUFFIX}`,
        slotType: 'LAB',
      },
    });
    cleanup.trackSlot(labSlot.id);

    // 1. POST /schedules with SECTION -> 422
    const postSecRes = await fetch(`${baseUrl}/schedules`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        courseId: course.id,
        doctorId: doctor.id,
        timetableId: timetable.id,
        dayOfWeek: 'THURSDAY',
        startTime: '08:00',
        endTime: '10:00',
        room: 'Room 999',
        slotType: 'SECTION',
      }),
    });
    assert.equal(postSecRes.status, 422, 'POST /schedules with SECTION must return 422');

    // 2. POST /schedules with TUTORIAL -> 422
    const postTutRes = await fetch(`${baseUrl}/schedules`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        courseId: course.id,
        doctorId: doctor.id,
        timetableId: timetable.id,
        dayOfWeek: 'THURSDAY',
        startTime: '10:00',
        endTime: '12:00',
        room: 'Room 998',
        slotType: 'TUTORIAL',
      }),
    });
    assert.equal(postTutRes.status, 422, 'POST /schedules with TUTORIAL must return 422');

    // 3. POST /schedules/sync-grid with SECTION -> 422
    const syncSecRes = await fetch(`${baseUrl}/schedules/sync-grid`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        slots: [
          {
            courseId: course.id,
            courseName: course.name,
            doctorId: doctor.id,
            day: 'THURSDAY',
            startTime: '12:00',
            endTime: '14:00',
            room: 'Room 997',
            slotType: 'SECTION',
          },
        ],
      }),
    });
    assert.equal(syncSecRes.status, 422, 'sync-grid with SECTION slot must return 422');

    // 4. PUT /schedules/:id with fully valid body: SECTION -> 422, LAB -> 200 (control)
    const putSecRes = await fetch(`${baseUrl}/schedules/${labSlot.id}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        courseId: course.id,
        doctorId: doctor.id,
        dayOfWeek: 'TUESDAY',
        startTime: '12:00',
        endTime: '14:00',
        room: `Lab_${SUFFIX}`,
        slotType: 'SECTION',
      }),
    });
    assert.equal(putSecRes.status, 422, 'PUT /schedules/:id with fully valid body + SECTION must return 422');

    const putLabRes = await fetch(`${baseUrl}/schedules/${labSlot.id}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        courseId: course.id,
        doctorId: doctor.id,
        dayOfWeek: 'TUESDAY',
        startTime: '12:00',
        endTime: '14:00',
        room: `Lab_${SUFFIX}`,
        slotType: 'LAB',
      }),
    });
    assert.equal(putLabRes.status, 200, 'PUT /schedules/:id with fully valid body + LAB control must return 200');
  } finally {
    try {
      await cleanup.teardown(prisma);
    } finally {
      await closeServer(server);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Sub-test 3: Write Path Enforcement for Requests & TA Course Assignment
// ─────────────────────────────────────────────────────────────────────────────
test('WP-3 Batch 2 Task 3: Write Path Enforcement for Requests & TA Assignment', async () => {
  const SUFFIX = 't3w2_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const passwordHash = await bcrypt.hash(crypto.randomUUID() + '!Aa1', 4);
  const cleanup = new TestCleanupRegistry();
  let server: http.Server | null = null;

  try {
    const srv = await createServer();
    server = srv.server;
    const baseUrl = srv.baseUrl;

    const college = await prisma.college.create({
      data: { name: `College_${SUFFIX}` },
    });
    cleanup.trackCollege(college.id);

    const department = await prisma.department.create({
      data: { name: `Dept_${SUFFIX}`, collegeId: college.id },
    });
    cleanup.trackDepartment(department.id);

    const course = await prisma.course.create({
      data: {
        name: `Course_${SUFFIX}`,
        courseCode: `CS_${SUFFIX.slice(-4)}`,
        departmentId: department.id,
        year: 1,
        semester: 1,
        credits: 3,
        isPublished: true,
      },
    });
    cleanup.trackCourse(course.id);

    const adminUser = await prisma.user.create({
      data: {
        email: `admin_${SUFFIX}@unicore.test`,
        password: passwordHash,
        role: 'SUPER_ADMIN',
        tokenVersion: 0,
        isActive: true,
      },
    });
    cleanup.trackUser(adminUser.id);
    const adminToken = generateAccessToken(adminUser.id, 0);

    const doctorUser = await prisma.user.create({
      data: {
        email: `doc_${SUFFIX}@unicore.test`,
        password: passwordHash,
        role: 'DOCTOR',
        tokenVersion: 0,
        isActive: true,
      },
    });
    cleanup.trackUser(doctorUser.id);
    const doctorToken = generateAccessToken(doctorUser.id, 0);

    const doctor = await prisma.doctor.create({
      data: {
        userId: doctorUser.id,
        firstName: 'Doc',
        lastName: `T3_${SUFFIX}`,
        doctorId: `DOC_${SUFFIX.slice(-4)}`,
        departmentId: department.id,
      },
    });
    cleanup.trackDoctor(doctor.id);

    const taUser = await prisma.user.create({
      data: {
        email: `ta_${SUFFIX}@unicore.test`,
        password: passwordHash,
        role: 'TEACHING_ASSISTANT',
        tokenVersion: 0,
        isActive: true,
      },
    });
    cleanup.trackUser(taUser.id);

    const ta = await prisma.teachingAssistant.create({
      data: {
        userId: taUser.id,
        firstName: 'TA',
        lastName: `T3_${SUFFIX}`,
        employeeId: `TA_${SUFFIX.slice(-4)}`,
        departmentId: department.id,
      },
    });
    cleanup.trackTA(ta.id);

    // 1. POST /requests with SECTION -> 422
    const postReqSecRes = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${doctorToken}`,
      },
      body: JSON.stringify({
        type: 'NEW_SLOT',
        courseId: course.id,
        reason: 'Requesting extra practical session',
        proposedData: {
          courseId: course.id,
          doctorId: doctor.id,
          dayOfWeek: 'MONDAY',
          startTime: '08:00',
          endTime: '10:00',
          room: 'Hall B',
          slotType: 'SECTION',
        },
      }),
    });
    assert.equal(postReqSecRes.status, 422, 'POST /requests with SECTION proposedData must return 422');

    // 2. PUT /requests/:id/approve with SECTION -> 422
    const changeReq = await prisma.scheduleChangeRequest.create({
      data: {
        requesterId: doctorUser.id,
        courseId: course.id,
        type: 'NEW_SLOT',
        reason: 'Legacy change request',
        proposedData: {
          courseId: course.id,
          doctorId: doctor.id,
          dayOfWeek: 'MONDAY',
          startTime: '14:00',
          endTime: '16:00',
          room: 'Hall C',
          slotType: 'SECTION',
        },
        status: 'PENDING',
      },
    });
    cleanup.trackChangeRequest(changeReq.id);

    const approveSecRes = await fetch(`${baseUrl}/requests/${changeReq.id}/approve`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ adminComment: 'approving legacy request' }),
    });
    assert.equal(approveSecRes.status, 422, 'Approving request with SECTION slotType must return 422');

    // 3. POST /teaching-assistants/:id/assign-course with SECTION -> 422, LAB -> 200 (control)
    const assignTaSecRes = await fetch(`${baseUrl}/teaching-assistants/${ta.id}/assign-course`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        courseId: course.id,
        dayOfWeek: 'MONDAY',
        startTime: '16:00',
        endTime: '18:00',
        room: `Lab_${SUFFIX}_301`,
        slotType: 'SECTION',
      }),
    });
    assert.equal(assignTaSecRes.status, 422, 'assignTACourse with SECTION must return 422');

    const assignTaLabRes = await fetch(`${baseUrl}/teaching-assistants/${ta.id}/assign-course`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        courseId: course.id,
        dayOfWeek: 'MONDAY',
        startTime: '16:00',
        endTime: '18:00',
        room: `Lab_${SUFFIX}_301`,
        slotType: 'LAB',
      }),
    });
    assert.equal(assignTaLabRes.status, 200, 'assignTACourse with LAB control must return 200');
    const assignTaLabBody = await assignTaLabRes.json();
    if (assignTaLabBody.data?.id) {
      cleanup.trackSlot(assignTaLabBody.data.id);
    }
  } finally {
    try {
      await cleanup.teardown(prisma);
    } finally {
      await closeServer(server);
    }
  }
});
