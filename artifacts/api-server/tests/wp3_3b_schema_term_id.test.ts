import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import prisma from '../src/utils/prismaClient';
import { TestCleanupRegistry } from './testCleanup.utils';

test('wp3_3b_schema_term_id: ScheduleSlot and Timetable nullable termId FK and restrict semantics', async () => {
  const SUFFIX = `term_id_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const cleanup = new TestCleanupRegistry();

  try {
    // 1. Setup isolated AcademicYear and AcademicTerm
    const academicYear = await prisma.academicYear.create({
      data: {
        name: `Year_${SUFFIX}`,
        startDate: new Date('2026-09-01T00:00:00Z'),
        endDate: new Date('2027-06-30T23:59:59Z'),
      },
    });

    const academicTerm = await prisma.academicTerm.create({
      data: {
        academicYearId: academicYear.id,
        name: `Fall_${SUFFIX}`,
        termType: 'FALL',
        semesterNumber: 1,
        startDate: new Date('2026-09-01T00:00:00Z'),
        endDate: new Date('2027-01-31T23:59:59Z'),
      },
    });

    // 2. Setup College, Department, Course
    const college = await prisma.college.create({
      data: {
        name: `College_${SUFFIX}`,
      },
    });
    cleanup.trackCollege(college.id);

    const department = await prisma.department.create({
      data: {
        name: `Dept_${SUFFIX}`,
        collegeId: college.id,
      },
    });
    cleanup.trackDepartment(department.id);

    const course = await prisma.course.create({
      data: {
        name: `Course_${SUFFIX}`,
        courseCode: `C_${SUFFIX.slice(-6)}`,
        credits: 3,
        year: 1,
        semester: 1,
        departmentId: department.id,
      },
    });
    cleanup.trackCourse(course.id);

    // 3. Test Timetable nullable termId
    // Case A: termId = null succeeds (OD-29 baseline compatibility)
    const timetableNullTerm = await prisma.timetable.create({
      data: {
        collegeId: college.id,
        departmentId: department.id,
        academicYear: 1,
        semester: 1,
        title: `Timetable_NullTerm_${SUFFIX}`,
        termId: null,
      } as any,
    });
    cleanup.trackTimetable(timetableNullTerm.id);
    assert.equal((timetableNullTerm as any).termId, null, 'Timetable termId must allow null');

    // Case B: termId = valid term succeeds
    const timetableWithTerm = await prisma.timetable.create({
      data: {
        collegeId: college.id,
        departmentId: department.id,
        academicYear: 2,
        semester: 1,
        title: `Timetable_WithTerm_${SUFFIX}`,
        termId: academicTerm.id,
      } as any,
    });
    cleanup.trackTimetable(timetableWithTerm.id);
    assert.equal((timetableWithTerm as any).termId, academicTerm.id, 'Timetable termId must persist valid AcademicTerm id');

    // Case C: termId with non-existent term fails with FK violation
    await assert.rejects(
      async () => {
        const invalidTimetable = await prisma.timetable.create({
          data: {
            collegeId: college.id,
            departmentId: department.id,
            academicYear: 3,
            semester: 1,
            title: `Timetable_BadTerm_${SUFFIX}`,
            termId: 999999999,
          } as any,
        });
        cleanup.trackTimetable(invalidTimetable.id);
      },
      (err: any) => {
        return err.code === 'P2003' || /foreign key/i.test(err.message);
      },
      'Non-existent termId on Timetable must be rejected by foreign key constraint'
    );

    // 4. Test ScheduleSlot nullable termId
    // Case A: termId = null succeeds
    const slotNullTerm = await prisma.scheduleSlot.create({
      data: {
        courseId: course.id,
        timetableId: timetableNullTerm.id,
        dayOfWeek: 'Monday',
        startTime: '09:00',
        endTime: '11:00',
        slotType: 'LECTURE',
        termId: null,
      } as any,
    });
    cleanup.trackSlot(slotNullTerm.id);
    assert.equal((slotNullTerm as any).termId, null, 'ScheduleSlot termId must allow null');

    // Case B: termId = valid term succeeds
    const slotWithTerm = await prisma.scheduleSlot.create({
      data: {
        courseId: course.id,
        timetableId: timetableWithTerm.id,
        dayOfWeek: 'Tuesday',
        startTime: '11:00',
        endTime: '13:00',
        slotType: 'LAB',
        termId: academicTerm.id,
      } as any,
    });
    cleanup.trackSlot(slotWithTerm.id);
    assert.equal((slotWithTerm as any).termId, academicTerm.id, 'ScheduleSlot termId must persist valid AcademicTerm id');

    // Case C: termId with non-existent term fails with FK violation
    await assert.rejects(
      async () => {
        const invalidSlot = await prisma.scheduleSlot.create({
          data: {
            courseId: course.id,
            timetableId: timetableNullTerm.id,
            dayOfWeek: 'Wednesday',
            startTime: '14:00',
            endTime: '16:00',
            slotType: 'LECTURE',
            termId: 999999999,
          } as any,
        });
        cleanup.trackSlot(invalidSlot.id);
      },
      (err: any) => {
        return err.code === 'P2003' || /foreign key/i.test(err.message);
      },
      'Non-existent termId on ScheduleSlot must be rejected by foreign key constraint'
    );

    // 5. Test ON DELETE RESTRICT semantics on AcademicTerm
    // Attempting to delete academicTerm while referenced by slotWithTerm or timetableWithTerm must fail
    await assert.rejects(
      async () => {
        await prisma.academicTerm.delete({
          where: { id: academicTerm.id },
        });
      },
      (err: any) => {
        return err.code === 'P2003' || /foreign key/i.test(err.message);
      },
      'Deleting AcademicTerm referenced by ScheduleSlot or Timetable must be rejected (ON DELETE RESTRICT)'
    );

    // 6. Test existing Timetable unique constraint is preserved: [collegeId, departmentId, academicYear, semester]
    await assert.rejects(
      async () => {
        const duplicateTimetable = await prisma.timetable.create({
          data: {
            collegeId: college.id,
            departmentId: department.id,
            academicYear: 1, // matches timetableNullTerm
            semester: 1,     // matches timetableNullTerm
            title: `Duplicate_Timetable_${SUFFIX}`,
          },
        });
        cleanup.trackTimetable(duplicateTimetable.id);
      },
      (err: any) => {
        return err.code === 'P2002' || /unique/i.test(err.message);
      },
      'Existing Timetable unique constraint on (college, department, year, semester) must remain strictly enforced'
    );
  } finally {
    await cleanup.teardown(prisma);
    // Purge the isolated term and year created for this test
    const term = await prisma.academicTerm.findFirst({ where: { name: `Fall_${SUFFIX}` } });
    if (term) {
      await prisma.academicTerm.delete({ where: { id: term.id } }).catch(() => {});
    }
    const year = await prisma.academicYear.findFirst({ where: { name: `Year_${SUFFIX}` } });
    if (year) {
      await prisma.academicYear.delete({ where: { id: year.id } }).catch(() => {});
    }
  }
});
