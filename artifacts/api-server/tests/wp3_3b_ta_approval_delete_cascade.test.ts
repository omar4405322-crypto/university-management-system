import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/prismaClient';
import { generateAccessToken } from '../src/utils/jwt.utils';
import app from '../src/app';
import { TestCleanupRegistry } from './testCleanup.utils';

test('wp3_3b_ta_approval_delete_cascade: deleting a Course or TeachingAssistant cascades to TACrossDepartmentApproval and does not hit foreign key restrict violation', async () => {
  const SUFFIX = `ta_casc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const passwordHash = await bcrypt.hash(crypto.randomUUID() + '!Aa1', 4);
  const cleanup = new TestCleanupRegistry();
  let server: http.Server | null = null;

  try {
    // Register any prior interrupted run entities into cleanup registry
    const priorColleges = await prisma.college.findMany({ where: { name: { contains: 'ta_casc_' } }, select: { id: true } });
    const priorDepts = await prisma.department.findMany({ where: { name: { contains: 'ta_casc_' } }, select: { id: true } });
    const priorCourses = await prisma.course.findMany({ where: { name: { contains: 'ta_casc_' } }, select: { id: true } });
    const priorUsers = await prisma.user.findMany({ where: { email: { contains: 'ta_casc_' } }, select: { id: true } });
    const priorTAs = await prisma.teachingAssistant.findMany({ where: { lastName: { contains: 'ta_casc_' } }, select: { id: true } });
    const priorApprovals = await (prisma as any).tACrossDepartmentApproval.findMany({ where: { reason: { contains: 'Cross-dept coverage for Lab' } }, select: { id: true } });

    for (const a of priorApprovals) cleanup.trackTAApproval(a.id);
    for (const t of priorTAs) cleanup.trackTA(t.id);
    for (const c of priorCourses) cleanup.trackCourse(c.id);
    for (const d of priorDepts) cleanup.trackDepartment(d.id);
    for (const col of priorColleges) cleanup.trackCollege(col.id);
    for (const u of priorUsers) cleanup.trackUser(u.id);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as any;
    const baseUrl = `http://127.0.0.1:${addr.port}/api`;

    // 1. Setup Super Admin
    const superAdminUser = await prisma.user.create({
      data: {
        email: `super_${SUFFIX}@test.local`,
        password: passwordHash,
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });
    cleanup.trackUser(superAdminUser.id);
    const superAdminToken = generateAccessToken(superAdminUser.id, superAdminUser.tokenVersion);

    // 2. Setup College 1 and College 2
    const college1 = await prisma.college.create({
      data: { name: `College1_${SUFFIX}` },
    });
    cleanup.trackCollege(college1.id);

    const college2 = await prisma.college.create({
      data: { name: `College2_${SUFFIX}` },
    });
    cleanup.trackCollege(college2.id);

    // 3. Departments: Dept 1 in College 1, Dept 2 in College 2
    const dept1 = await prisma.department.create({
      data: { name: `Dept1_${SUFFIX}`, collegeId: college1.id },
    });
    cleanup.trackDepartment(dept1.id);

    const dept2 = await prisma.department.create({
      data: { name: `Dept2_${SUFFIX}`, collegeId: college2.id },
    });
    cleanup.trackDepartment(dept2.id);

    // 4. Course A in Dept 1
    const courseA = await prisma.course.create({
      data: {
        name: `CourseA_${SUFFIX}`,
        courseCode: `CA_${SUFFIX.slice(-4)}`,
        credits: 3,
        year: 1,
        semester: 1,
        departmentId: dept1.id,
      },
    });
    cleanup.trackCourse(courseA.id);

    // 5. TA 1 in Dept 2
    const ta1User = await prisma.user.create({
      data: {
        email: `ta1_${SUFFIX}@test.local`,
        password: passwordHash,
        role: 'TEACHING_ASSISTANT',
        isActive: true,
        departmentId: dept2.id,
        collegeId: college2.id,
      },
    });
    cleanup.trackUser(ta1User.id);

    const ta1 = await prisma.teachingAssistant.create({
      data: {
        userId: ta1User.id,
        firstName: 'TA1',
        lastName: SUFFIX,
        employeeId: `EMP1_${SUFFIX.slice(-4)}`,
        departmentId: dept2.id,
      },
    });
    cleanup.trackTA(ta1.id);

    // 6. Create Cross-Department Approval for TA1 on Course A via API
    const approveRes1 = await fetch(`${baseUrl}/ta-cross-department-approvals/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        teachingAssistantId: ta1.id,
        courseId: courseA.id,
        reason: 'Cross-dept coverage for Lab A',
      }),
    });
    const approveText1 = await approveRes1.text();
    assert.equal(approveRes1.status, 201, `Failed to approve TA1 for Course A: ${approveText1}`);
    const approveData1 = JSON.parse(approveText1);
    const approvalId1 = approveData1.data.id;
    cleanup.trackTAApproval(approvalId1);

    // 7. Verify approval exists in DB
    const createdApproval1 = await (prisma as any).tACrossDepartmentApproval.findUnique({
      where: { id: approvalId1 },
    });
    assert.ok(createdApproval1, 'Approval 1 should exist');

    // 8. Delete Course A through the real API
    const deleteCourseRes = await fetch(`${baseUrl}/courses/${courseA.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });

    const deleteCourseStatus = deleteCourseRes.status;
    const deleteCourseBody = await deleteCourseRes.text();
    // Expect success (200 OK, not 500)
    assert.equal(deleteCourseStatus, 200, `Expected 200 on course deletion, got ${deleteCourseStatus}: ${deleteCourseBody}`);

    // Verify approval row is gone (cascaded)
    const approvalAfterCourseDelete = await (prisma as any).tACrossDepartmentApproval.findUnique({
      where: { id: approvalId1 },
    });
    assert.equal(approvalAfterCourseDelete, null, 'Approval row must be cascade-deleted when course is deleted');

    // 9. Now test TA deletion cascade:
    // Setup Course B in Dept 1 and TA 2 in Dept 2
    const courseB = await prisma.course.create({
      data: {
        name: `CourseB_${SUFFIX}`,
        courseCode: `CB_${SUFFIX.slice(-4)}`,
        credits: 3,
        year: 1,
        semester: 1,
        departmentId: dept1.id,
      },
    });
    cleanup.trackCourse(courseB.id);

    const ta2User = await prisma.user.create({
      data: {
        email: `ta2_${SUFFIX}@test.local`,
        password: passwordHash,
        role: 'TEACHING_ASSISTANT',
        isActive: true,
        departmentId: dept2.id,
        collegeId: college2.id,
      },
    });
    cleanup.trackUser(ta2User.id);

    const ta2 = await prisma.teachingAssistant.create({
      data: {
        userId: ta2User.id,
        firstName: 'TA2',
        lastName: SUFFIX,
        employeeId: `EMP2_${SUFFIX.slice(-4)}`,
        departmentId: dept2.id,
      },
    });
    cleanup.trackTA(ta2.id);

    // Create Cross-Department Approval for TA2 on Course B
    const approveRes2 = await fetch(`${baseUrl}/ta-cross-department-approvals/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        teachingAssistantId: ta2.id,
        courseId: courseB.id,
        reason: 'Cross-dept coverage for Lab B',
      }),
    });
    const approveText2 = await approveRes2.text();
    assert.equal(approveRes2.status, 201, `Failed to approve TA2 for Course B: ${approveText2}`);
    const approveData2 = JSON.parse(approveText2);
    const approvalId2 = approveData2.data.id;
    cleanup.trackTAApproval(approvalId2);

    // Delete TA 2 through the real API
    const deleteTARes = await fetch(`${baseUrl}/teaching-assistants/${ta2.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });

    const deleteTAStatus = deleteTARes.status;
    const deleteTABody = await deleteTARes.text();
    // Expect success (200 OK, not 500)
    assert.equal(deleteTAStatus, 200, `Expected 200 on TA deletion, got ${deleteTAStatus}: ${deleteTABody}`);

    // Verify approval row is gone (cascaded)
    const approvalAfterTADelete = await (prisma as any).tACrossDepartmentApproval.findUnique({
      where: { id: approvalId2 },
    });
    assert.equal(approvalAfterTADelete, null, 'Approval row must be cascade-deleted when teaching assistant is deleted');

    // 10. Confirm AuditLog rows survive the cascade
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entity: 'TACrossDepartmentApproval',
        entityId: { in: [String(approvalId1), String(approvalId2)] },
      },
    });
    assert.equal(auditLogs.length, 2, 'AuditLog rows for TA approvals must survive cascade deletion');
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    await cleanup.teardown(prisma);
  }
});
