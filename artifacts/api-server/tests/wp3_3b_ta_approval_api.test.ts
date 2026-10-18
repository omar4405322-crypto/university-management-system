import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/prismaClient';
import { generateAccessToken } from '../src/utils/jwt.utils';
import app from '../src/app';
import { TestCleanupRegistry } from './testCleanup.utils';

test('wp3_3b_ta_approval_api: TA cross-department approval API endpoint authority, scoping, flip idempotency, revocation, and audit logging', async () => {
  const SUFFIX = `ta_api_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const passwordHash = await bcrypt.hash(crypto.randomUUID() + '!Aa1', 4);
  const cleanup = new TestCleanupRegistry();
  let server: http.Server | null = null;

  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as any;
    const baseUrl = `http://127.0.0.1:${addr.port}/api`;

    // 1. Setup Two Colleges: College 1 (Engineering), College 2 (Science)
    const college1 = await prisma.college.create({
      data: { name: `College1_${SUFFIX}` },
    });
    cleanup.trackCollege(college1.id);

    const college2 = await prisma.college.create({
      data: { name: `College2_${SUFFIX}` },
    });
    cleanup.trackCollege(college2.id);

    // Departments:
    // Dept 1A in College 1
    const dept1A = await prisma.department.create({
      data: { name: `Dept1A_${SUFFIX}`, collegeId: college1.id },
    });
    cleanup.trackDepartment(dept1A.id);

    // Dept 1B in College 1
    const dept1B = await prisma.department.create({
      data: { name: `Dept1B_${SUFFIX}`, collegeId: college1.id },
    });
    cleanup.trackDepartment(dept1B.id);

    // Dept 2 in College 2
    const dept2 = await prisma.department.create({
      data: { name: `Dept2_${SUFFIX}`, collegeId: college2.id },
    });
    cleanup.trackDepartment(dept2.id);

    // Courses:
    // Course 1 in Dept 1A (owned by College 1)
    const course1 = await prisma.course.create({
      data: {
        name: `Course1_${SUFFIX}`,
        courseCode: `C1_${SUFFIX.slice(-5)}`,
        credits: 3,
        year: 1,
        semester: 1,
        departmentId: dept1A.id,
      },
    });
    cleanup.trackCourse(course1.id);

    // Course 2 in Dept 2 (owned by College 2)
    const course2 = await prisma.course.create({
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

    // TAs:
    // TA 1 in Dept 1A (same department as Course 1)
    const taUser1A = await prisma.user.create({
      data: {
        email: `ta1a_${SUFFIX}@university.edu`,
        password: passwordHash,
        role: 'TEACHING_ASSISTANT',
        departmentId: dept1A.id,
      },
    });
    cleanup.trackUser(taUser1A.id);
    const ta1A = await prisma.teachingAssistant.create({
      data: {
        userId: taUser1A.id,
        employeeId: `EMP1A_${SUFFIX}`,
        departmentId: dept1A.id,
        firstName: 'SameDept',
        lastName: 'TA',
      },
    });
    cleanup.trackTA(ta1A.id);

    // TA 2 in Dept 2 (different department from Course 1, different college)
    const taUser2 = await prisma.user.create({
      data: {
        email: `ta2_${SUFFIX}@university.edu`,
        password: passwordHash,
        role: 'TEACHING_ASSISTANT',
        departmentId: dept2.id,
      },
    });
    cleanup.trackUser(taUser2.id);
    const ta2 = await prisma.teachingAssistant.create({
      data: {
        userId: taUser2.id,
        employeeId: `EMP2_${SUFFIX}`,
        departmentId: dept2.id,
        firstName: 'CrossDept',
        lastName: 'TA',
      },
    });
    cleanup.trackTA(ta2.id);

    // TA 1B in Dept 1B (different department, same College 1)
    const taUser1B = await prisma.user.create({
      data: {
        email: `ta1b_${SUFFIX}@university.edu`,
        password: passwordHash,
        role: 'TEACHING_ASSISTANT',
        departmentId: dept1B.id,
      },
    });
    cleanup.trackUser(taUser1B.id);
    const ta1B = await prisma.teachingAssistant.create({
      data: {
        userId: taUser1B.id,
        employeeId: `EMP1B_${SUFFIX}`,
        departmentId: dept1B.id,
        firstName: 'IntraCollege',
        lastName: 'TA',
      },
    });
    cleanup.trackTA(ta1B.id);

    // Admins:
    // SUPER_ADMIN
    const superAdmin = await prisma.user.create({
      data: {
        email: `super_${SUFFIX}@university.edu`,
        password: passwordHash,
        role: 'SUPER_ADMIN',
      },
    });
    cleanup.trackUser(superAdmin.id);
    const superAdminToken = generateAccessToken(superAdmin.id, superAdmin.tokenVersion);

    // COLLEGE_ADMIN for College 1 (owns Course 1)
    const collegeAdmin1 = await prisma.user.create({
      data: {
        email: `ca1_${SUFFIX}@university.edu`,
        password: passwordHash,
        role: 'COLLEGE_ADMIN',
        collegeId: college1.id,
        managedCollegeId: college1.id,
      },
    });
    cleanup.trackUser(collegeAdmin1.id);
    const collegeAdmin1Token = generateAccessToken(collegeAdmin1.id, collegeAdmin1.tokenVersion);

    // COLLEGE_ADMIN for College 2 (does NOT own Course 1)
    const collegeAdmin2 = await prisma.user.create({
      data: {
        email: `ca2_${SUFFIX}@university.edu`,
        password: passwordHash,
        role: 'COLLEGE_ADMIN',
        collegeId: college2.id,
        managedCollegeId: college2.id,
      },
    });
    cleanup.trackUser(collegeAdmin2.id);
    const collegeAdmin2Token = generateAccessToken(collegeAdmin2.id, collegeAdmin2.tokenVersion);

    // DEPARTMENT_ADMIN for Dept 1A
    const deptAdmin1A = await prisma.user.create({
      data: {
        email: `da1a_${SUFFIX}@university.edu`,
        password: passwordHash,
        role: 'DEPARTMENT_ADMIN',
        departmentId: dept1A.id,
        managedDepartmentId: dept1A.id,
      },
    });
    cleanup.trackUser(deptAdmin1A.id);
    const deptAdmin1AToken = generateAccessToken(deptAdmin1A.id, deptAdmin1A.tokenVersion);

    // 2. Test Rule: TA department must differ from course department (else 400)
    const sameDeptApproveRes = await fetch(`${baseUrl}/ta-cross-department-approvals/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        teachingAssistantId: ta1A.id,
        courseId: course1.id,
        reason: 'Same department approval attempt',
      }),
    });
    assert.equal(sameDeptApproveRes.status, 400, 'Attempting approval when TA and Course are in the same department must return 400');

    // 3. Test Authority & Scoping on POST /approve:
    // Case A: DEPARTMENT_ADMIN cannot approve (403)
    const daApproveRes = await fetch(`${baseUrl}/ta-cross-department-approvals/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deptAdmin1AToken}`,
      },
      body: JSON.stringify({
        teachingAssistantId: ta2.id,
        courseId: course1.id,
        reason: 'DA attempt',
      }),
    });
    assert.equal(daApproveRes.status, 403, 'DEPARTMENT_ADMIN cannot approve cross-department TA');

    // Case B: Wrong-college College Admin cannot approve Course 1 (403)
    const wrongCaApproveRes = await fetch(`${baseUrl}/ta-cross-department-approvals/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${collegeAdmin2Token}`,
      },
      body: JSON.stringify({
        teachingAssistantId: ta2.id,
        courseId: course1.id,
        reason: 'Wrong college admin attempt',
      }),
    });
    assert.equal(wrongCaApproveRes.status, 403, 'COLLEGE_ADMIN whose college does NOT own the course cannot approve');

    // Case C: Owning COLLEGE_ADMIN can approve Course 1
    const owningCaApproveRes = await fetch(`${baseUrl}/ta-cross-department-approvals/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${collegeAdmin1Token}`,
      },
      body: JSON.stringify({
        teachingAssistantId: ta2.id,
        courseId: course1.id,
        reason: 'Cross-college instruction needed',
      }),
    });
    assert.equal(owningCaApproveRes.status, 201, `Owning COLLEGE_ADMIN must be able to approve: ${await owningCaApproveRes.clone().text()}`);
    const approval1Json = await owningCaApproveRes.json();
    assert.equal(approval1Json.success, true);
    assert.equal(approval1Json.data.status, 'APPROVED');
    assert.equal(approval1Json.data.teachingAssistantId, ta2.id);
    assert.equal(approval1Json.data.courseId, course1.id);
    const approvalId = approval1Json.data.id;

    // Verify AuditLog row created for approve
    const approveAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'APPROVE_TA_CROSS_DEPARTMENT',
        entityId: String(approvalId),
      },
    });
    assert.ok(approveAudit, 'AuditLog must be recorded on approval');

    // 4. Test Idempotency on approve:
    // Calling approve again with same (TA, Course) returns existing approval with 200/201
    const duplicateApproveRes = await fetch(`${baseUrl}/ta-cross-department-approvals/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        teachingAssistantId: ta2.id,
        courseId: course1.id,
        reason: 'Re-approving same pair',
      }),
    });
    assert.ok([200, 201].includes(duplicateApproveRes.status), 'Re-approve should be idempotent');
    const dupJson = await duplicateApproveRes.json();
    assert.equal(dupJson.data.id, approvalId);
    assert.equal(dupJson.data.status, 'APPROVED');

    // 5. Test POST /api/ta-cross-department-approvals/:id/revoke:
    // Case A: Wrong-college College Admin cannot revoke (403)
    const wrongCaRevokeRes = await fetch(`${baseUrl}/ta-cross-department-approvals/${approvalId}/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${collegeAdmin2Token}`,
      },
    });
    assert.equal(wrongCaRevokeRes.status, 403, 'Wrong COLLEGE_ADMIN cannot revoke');

    // Case B: Owning College Admin successfully revokes
    const revokeRes = await fetch(`${baseUrl}/ta-cross-department-approvals/${approvalId}/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${collegeAdmin1Token}`,
      },
    });
    assert.equal(revokeRes.status, 200, `Revoke must return 200: ${await revokeRes.clone().text()}`);
    const revokeJson = await revokeRes.json();
    assert.equal(revokeJson.data.status, 'REVOKED');
    assert.equal(revokeJson.data.revokedByUserId, collegeAdmin1.id);
    assert.ok(revokeJson.data.revokedAt);

    // Verify AuditLog row created for revoke
    const revokeAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'REVOKE_TA_CROSS_DEPARTMENT',
        entityId: String(approvalId),
      },
    });
    assert.ok(revokeAudit, 'AuditLog must be recorded on revocation');

    // 6. Test Re-approve Flips REVOKED -> APPROVED:
    const flipApproveRes = await fetch(`${baseUrl}/ta-cross-department-approvals/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        teachingAssistantId: ta2.id,
        courseId: course1.id,
        reason: 'Reinstating TA assignment',
      }),
    });
    assert.equal(flipApproveRes.status, 200, 'Re-approving revoked assignment must flip back to APPROVED');
    const flippedJson = await flipApproveRes.json();
    assert.equal(flippedJson.data.id, approvalId);
    assert.equal(flippedJson.data.status, 'APPROVED');

    // 7. Test GET /api/ta-cross-department-approvals (List Scoping):
    // Also create approval for TA 1B in Dept 1B on Course 1
    const secondApprovalRes = await fetch(`${baseUrl}/ta-cross-department-approvals/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${collegeAdmin1Token}`,
      },
      body: JSON.stringify({
        teachingAssistantId: ta1B.id,
        courseId: course1.id,
        reason: 'Intra-college cross-dept approval',
      }),
    });
    assert.equal(secondApprovalRes.status, 201);
    const secondApprovalJson = await secondApprovalRes.json();
    const secondApprovalId = secondApprovalJson.data.id;

    // Case A: SUPER_ADMIN sees both approvals
    const saListRes = await fetch(`${baseUrl}/ta-cross-department-approvals`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(saListRes.status, 200);
    const saListData = await saListRes.json();
    const saApprovals = saListData.data.approvals || saListData.data;
    assert.ok(saApprovals.some((a: any) => a.id === approvalId));
    assert.ok(saApprovals.some((a: any) => a.id === secondApprovalId));

    // Case B: COLLEGE_ADMIN 1 sees Course 1 approvals
    const ca1ListRes = await fetch(`${baseUrl}/ta-cross-department-approvals`, {
      headers: { Authorization: `Bearer ${collegeAdmin1Token}` },
    });
    assert.equal(ca1ListRes.status, 200);
    const ca1ListData = await ca1ListRes.json();
    const ca1Approvals = ca1ListData.data.approvals || ca1ListData.data;
    assert.ok(ca1Approvals.some((a: any) => a.id === approvalId));

    // Case C: COLLEGE_ADMIN 2 does NOT see Course 1 approvals
    const ca2ListRes = await fetch(`${baseUrl}/ta-cross-department-approvals`, {
      headers: { Authorization: `Bearer ${collegeAdmin2Token}` },
    });
    assert.equal(ca2ListRes.status, 200);
    const ca2ListData = await ca2ListRes.json();
    const ca2Approvals = ca2ListData.data.approvals || ca2ListData.data;
    assert.equal(ca2Approvals.some((a: any) => a.id === approvalId), false);

    // Case D: DEPARTMENT_ADMIN (Dept 1A) sees approval because Course 1 is in Dept 1A
    const da1AListRes = await fetch(`${baseUrl}/ta-cross-department-approvals`, {
      headers: { Authorization: `Bearer ${deptAdmin1AToken}` },
    });
    assert.equal(da1AListRes.status, 200);
    const da1AListData = await da1AListRes.json();
    const da1AApprovals = da1AListData.data.approvals || da1AListData.data;
    assert.ok(da1AApprovals.some((a: any) => a.id === approvalId));

    // Cleanup approvals explicitly
    await (prisma as any).tACrossDepartmentApproval.deleteMany({
      where: { id: { in: [approvalId, secondApprovalId] } },
    });
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    await cleanup.teardown(prisma);
  }
});
