import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/prismaClient';
import { TestCleanupRegistry } from './testCleanup.utils';

test('wp3_3b_ta_approval_data: TACrossDepartmentApproval data model, enum, unique constraint, and FK rules', async () => {
  const SUFFIX = `ta_appr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const passwordHash = await bcrypt.hash(crypto.randomUUID() + '!Aa1', 4);
  const cleanup = new TestCleanupRegistry();

  try {
    // 1. Setup colleges & departments
    const collegeA = await prisma.college.create({
      data: { name: `CollegeA_${SUFFIX}` },
    });
    cleanup.trackCollege(collegeA.id);

    const collegeB = await prisma.college.create({
      data: { name: `CollegeB_${SUFFIX}` },
    });
    cleanup.trackCollege(collegeB.id);

    const deptA = await prisma.department.create({
      data: { name: `DeptA_${SUFFIX}`, collegeId: collegeA.id },
    });
    cleanup.trackDepartment(deptA.id);

    const deptB = await prisma.department.create({
      data: { name: `DeptB_${SUFFIX}`, collegeId: collegeB.id },
    });
    cleanup.trackDepartment(deptB.id);

    // 2. Setup Course in DeptA
    const course = await prisma.course.create({
      data: {
        name: `Course_${SUFFIX}`,
        courseCode: `TA_${SUFFIX.slice(-6)}`,
        credits: 3,
        year: 1,
        semester: 1,
        departmentId: deptA.id,
      },
    });
    cleanup.trackCourse(course.id);

    // 3. Setup TA in DeptB (different department)
    const taUser = await prisma.user.create({
      data: {
        email: `ta_${SUFFIX}@university.edu`,
        password: passwordHash,
        role: 'TEACHING_ASSISTANT',
        departmentId: deptB.id,
      },
    });
    cleanup.trackUser(taUser.id);

    const ta = await prisma.teachingAssistant.create({
      data: {
        userId: taUser.id,
        employeeId: `EMP_${SUFFIX}`,
        departmentId: deptB.id,
        firstName: 'Cross',
        lastName: 'TA',
      },
    });
    cleanup.trackTA(ta.id);

    // 4. Setup Approving Admin User
    const adminUser = await prisma.user.create({
      data: {
        email: `admin_${SUFFIX}@university.edu`,
        password: passwordHash,
        role: 'COLLEGE_ADMIN',
        collegeId: collegeA.id,
        managedCollegeId: collegeA.id,
      },
    });
    cleanup.trackUser(adminUser.id);

    // 5. Setup Revoking Admin User
    const revokerUser = await prisma.user.create({
      data: {
        email: `revoker_${SUFFIX}@university.edu`,
        password: passwordHash,
        role: 'SUPER_ADMIN',
      },
    });
    cleanup.trackUser(revokerUser.id);

    // 6. Test Model Creation with defaults: status APPROVED, null revokedAt/revokedByUserId
    const approval = await (prisma as any).tACrossDepartmentApproval.create({
      data: {
        teachingAssistantId: ta.id, // String / CUID
        courseId: course.id,        // Int
        approvedByUserId: adminUser.id,
        reason: 'Cross-college coverage for advanced lab',
      },
    });
    assert.ok(approval.id, 'Approval record should be created with an id');
    assert.equal(approval.teachingAssistantId, ta.id);
    assert.equal(approval.courseId, course.id);
    assert.equal(approval.status, 'APPROVED', 'Default status must be APPROVED');
    assert.equal(approval.approvedByUserId, adminUser.id);
    assert.equal(approval.revokedByUserId, null, 'revokedByUserId must default to null');
    assert.equal(approval.revokedAt, null, 'revokedAt must default to null');
    assert.ok(approval.createdAt, 'createdAt must exist');
    assert.ok(approval.updatedAt, 'updatedAt must exist');

    // 7. Enforce UNIQUE(teachingAssistantId, courseId)
    await assert.rejects(
      async () => {
        await (prisma as any).tACrossDepartmentApproval.create({
          data: {
            teachingAssistantId: ta.id,
            courseId: course.id,
            approvedByUserId: adminUser.id,
            reason: 'Duplicate approval attempt',
          },
        });
      },
      (err: any) => {
        return err.code === 'P2002' || /unique/i.test(err.message);
      },
      'Duplicate (teachingAssistantId, courseId) must fail with unique constraint violation'
    );

    // 8. Test Revocation update
    const revoked = await (prisma as any).tACrossDepartmentApproval.update({
      where: { id: approval.id },
      data: {
        status: 'REVOKED',
        revokedByUserId: revokerUser.id,
        revokedAt: new Date(),
      },
    });
    assert.equal(revoked.status, 'REVOKED');
    assert.equal(revoked.revokedByUserId, revokerUser.id);
    assert.ok(revoked.revokedAt);

    // 9. Foreign Key Enforcement: non-existent teachingAssistantId
    await assert.rejects(
      async () => {
        await (prisma as any).tACrossDepartmentApproval.create({
          data: {
            teachingAssistantId: 'non_existent_ta_cuid_123',
            courseId: course.id,
            approvedByUserId: adminUser.id,
          },
        });
      },
      (err: any) => {
        return err.code === 'P2003' || /foreign key/i.test(err.message);
      },
      'Non-existent teachingAssistantId must be rejected by foreign key constraint'
    );

    // 10. Foreign Key Enforcement: non-existent courseId
    await assert.rejects(
      async () => {
        await (prisma as any).tACrossDepartmentApproval.create({
          data: {
            teachingAssistantId: ta.id,
            courseId: 99999999,
            approvedByUserId: adminUser.id,
          },
        });
      },
      (err: any) => {
        return err.code === 'P2003' || /foreign key/i.test(err.message);
      },
      'Non-existent courseId must be rejected by foreign key constraint'
    );

    // 11. Foreign Key Enforcement: approvedByUserId ON DELETE RESTRICT
    await assert.rejects(
      async () => {
        await prisma.user.delete({
          where: { id: adminUser.id },
        });
      },
      (err: any) => {
        return err.code === 'P2003' || /foreign key/i.test(err.message);
      },
      'Deleting approvedByUser must be restricted by foreign key constraint'
    );

    // Clean up approval record explicitly before general teardown
    await (prisma as any).tACrossDepartmentApproval.delete({
      where: { id: approval.id },
    });
  } finally {
    await cleanup.teardown(prisma);
  }
});
