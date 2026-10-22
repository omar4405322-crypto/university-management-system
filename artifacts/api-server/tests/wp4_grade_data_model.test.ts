import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/prismaClient';
import { generateAccessToken } from '../src/utils/jwt.utils';

function makeSuffix(tag: string) {
  return `wp4_c3_${tag}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

async function createAdminUser(suffix: string) {
  const passwordHash = await bcrypt.hash(crypto.randomUUID() + '!Aa1', 4);
  const adminUser = await prisma.user.create({
    data: {
      email: `admin_${suffix}@university.edu`,
      password: passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });
  const token = generateAccessToken(adminUser.id, adminUser.tokenVersion);
  return { adminUser, token };
}

let sharedServer: http.Server | null = null;
let sharedBaseUrl: string = '';

async function getTestBaseUrl(): Promise<string> {
  if (!sharedServer) {
    const { default: app } = await import('../src/app');
    sharedServer = http.createServer(app);
    await new Promise<void>((resolve) => sharedServer!.listen(0, '127.0.0.1', resolve));
    const address = sharedServer.address();
    assert.ok(address && typeof address === 'object');
    sharedBaseUrl = `http://127.0.0.1:${address.port}/api`;
  }
  return sharedBaseUrl;
}

test('WP-4 T-1 Model Properties: Course has no grade columns, Enrollment has nullable finalPointsEarned/Max, AttendanceSession has nullable sessionPoints', async () => {
  const suffix = makeSuffix('props');
  let college: any;
  let dept: any;
  let doctorUser: any;
  let doctor: any;
  let course: any;
  let term: any;
  let studentUser: any;
  let student: any;
  let enrollment: any;
  let slot: any;
  let session: any;

  try {
    college = await prisma.college.create({ data: { name: `College_${suffix}` } });
    dept = await prisma.department.create({ data: { name: `Dept_${suffix}`, collegeId: college.id } });

    doctorUser = await prisma.user.create({
      data: {
        email: `doc_${suffix}@university.edu`,
        password: 'hash',
        role: 'DOCTOR',
        departmentId: dept.id,
      },
    });
    doctor = await prisma.doctor.create({
      data: {
        userId: doctorUser.id,
        departmentId: dept.id,
        firstName: 'Doctor',
        lastName: suffix,
        specialty: 'CS',
      },
    });

    course = await prisma.course.create({
      data: {
        name: `Course_${suffix}`,
        courseCode: `C_${suffix.slice(-6)}`,
        credits: 3,
        year: 1,
        semester: 1,
        departmentId: dept.id,
      },
    });

    assert.strictEqual((course as any).totalPoints, undefined, 'Course must not have totalPoints column');
    assert.strictEqual((course as any).gradeScale, undefined, 'Course must not have gradeScale column');
    assert.strictEqual((course as any).passMark, undefined, 'Course must not have passMark column');

    const year = (await prisma.academicYear.findFirst()) || await prisma.academicYear.create({
      data: { name: `2026-2027_${suffix}`, startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30') },
    });
    term = await prisma.academicTerm.create({
      data: {
        name: `Term_${suffix}`,
        academicYearId: year.id,
        termType: 'FALL',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-01-31'),
        isCurrent: false,
      },
    });

    studentUser = await prisma.user.create({
      data: {
        email: `stu_${suffix}@student.edu`,
        password: 'hash',
        role: 'STUDENT',
        departmentId: dept.id,
      },
    });
    student = await prisma.student.create({
      data: {
        userId: studentUser.id,
        firstName: 'Student',
        lastName: suffix,
        studentId: `STU_${suffix}`,
        year: 1,
        departmentId: dept.id,
      },
    });

    enrollment = await prisma.enrollment.create({
      data: {
        studentId: student.id,
        courseId: course.id,
        semester: 1,
        academicYear: 2026,
        termId: term.id,
      },
    });

    assert.strictEqual(enrollment.finalPointsEarned, null, 'finalPointsEarned must be null by default');
    assert.strictEqual(enrollment.finalPointsMax, null, 'finalPointsMax must be null by default');

    slot = await prisma.scheduleSlot.create({
      data: {
        courseId: course.id,
        doctorId: doctor.id,
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '10:00',
        slotType: 'LECTURE',
        termId: term.id,
      },
    });
    session = await prisma.attendanceSession.create({
      data: {
        scheduleSlotId: slot.id,
        secretKey: `sec_${suffix}`,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    assert.strictEqual(session.sessionPoints, null, 'AttendanceSession.sessionPoints must be nullable with no default');
  } finally {
    if (session?.id) await prisma.attendanceSession.deleteMany({ where: { id: session.id } }).catch(() => {});
    if (slot?.id) await prisma.scheduleSlot.deleteMany({ where: { id: slot.id } }).catch(() => {});
    if (enrollment?.id) await prisma.enrollment.deleteMany({ where: { id: enrollment.id } }).catch(() => {});
    if (student?.id) await prisma.student.deleteMany({ where: { id: student.id } }).catch(() => {});
    if (studentUser?.id) await prisma.user.deleteMany({ where: { id: studentUser.id } }).catch(() => {});
    if (course?.id) await prisma.course.deleteMany({ where: { id: course.id } }).catch(() => {});
    if (term?.id) await prisma.academicTerm.deleteMany({ where: { id: term.id } }).catch(() => {});
    if (doctor?.id) await prisma.doctor.deleteMany({ where: { id: doctor.id } }).catch(() => {});
    if (doctorUser?.id) await prisma.user.deleteMany({ where: { id: doctorUser.id } }).catch(() => {});
    if (dept?.id) await prisma.department.deleteMany({ where: { id: dept.id } }).catch(() => {});
    if (college?.id) await prisma.college.deleteMany({ where: { id: college.id } }).catch(() => {});
  }
});

test('WP-4 T-1 Uniqueness: CourseGradeStructure unique([courseId, termId])', async () => {
  const suffix = makeSuffix('uq_struct');
  let dept: any;
  let course: any;
  let term: any;
  let structure: any;

  try {
    const college = await prisma.college.create({ data: { name: `College_${suffix}` } });
    dept = await prisma.department.create({ data: { name: `Dept_${suffix}`, collegeId: college.id } });
    course = await prisma.course.create({
      data: {
        name: `Course_${suffix}`,
        courseCode: `C_${suffix.slice(-6)}`,
        credits: 3,
        year: 1,
        semester: 1,
        departmentId: dept.id,
      },
    });
    const year = (await prisma.academicYear.findFirst()) || await prisma.academicYear.create({
      data: { name: `2026-2027_${suffix}`, startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30') },
    });
    term = await prisma.academicTerm.create({
      data: {
        name: `Term_${suffix}`,
        academicYearId: year.id,
        termType: 'FALL',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-01-31'),
        isCurrent: false,
      },
    });

    structure = await prisma.courseGradeStructure.create({
      data: {
        courseId: course.id,
        termId: term.id,
        passMark: 50.0,
      },
    });
    assert.ok(structure.id);

    await assert.rejects(
      async () => {
        await prisma.courseGradeStructure.create({
          data: {
            courseId: course.id,
            termId: term.id,
            passMark: 45.0,
          },
        });
      },
      /Unique constraint failed|duplicate key/i
    );
  } finally {
    if (structure?.id) await prisma.courseGradeStructure.deleteMany({ where: { id: structure.id } }).catch(() => {});
    if (course?.id) await prisma.course.deleteMany({ where: { id: course.id } }).catch(() => {});
    if (term?.id) await prisma.academicTerm.deleteMany({ where: { id: term.id } }).catch(() => {});
    if (dept?.id) await prisma.department.deleteMany({ where: { id: dept.id } }).catch(() => {});
  }
});

test('WP-4 T-1 Uniqueness: CourseGradeComponent unique([structureId, name])', async () => {
  const suffix = makeSuffix('uq_comp');
  let dept: any;
  let course: any;
  let term: any;
  let structure: any;
  let comp: any;

  try {
    const college = await prisma.college.create({ data: { name: `College_${suffix}` } });
    dept = await prisma.department.create({ data: { name: `Dept_${suffix}`, collegeId: college.id } });
    course = await prisma.course.create({
      data: {
        name: `Course_${suffix}`,
        courseCode: `C_${suffix.slice(-6)}`,
        credits: 3,
        year: 1,
        semester: 1,
        departmentId: dept.id,
      },
    });
    const year = (await prisma.academicYear.findFirst()) || await prisma.academicYear.create({
      data: { name: `2026-2027_${suffix}`, startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30') },
    });
    term = await prisma.academicTerm.create({
      data: {
        name: `Term_${suffix}`,
        academicYearId: year.id,
        termType: 'FALL',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-01-31'),
        isCurrent: false,
      },
    });
    structure = await prisma.courseGradeStructure.create({
      data: { courseId: course.id, termId: term.id },
    });

    comp = await prisma.courseGradeComponent.create({
      data: {
        structureId: structure.id,
        name: 'Midterm Exam',
        maxPoints: 30.0,
        source: 'MANUAL',
        displayOrder: 1,
      },
    });
    assert.ok(comp.id);

    await assert.rejects(
      async () => {
        await prisma.courseGradeComponent.create({
          data: {
            structureId: structure.id,
            name: 'Midterm Exam',
            maxPoints: 20.0,
            source: 'MANUAL',
            displayOrder: 2,
          },
        });
      },
      /Unique constraint failed|duplicate key/i
    );
  } finally {
    if (comp?.id) await prisma.courseGradeComponent.deleteMany({ where: { id: comp.id } }).catch(() => {});
    if (structure?.id) await prisma.courseGradeStructure.deleteMany({ where: { id: structure.id } }).catch(() => {});
    if (course?.id) await prisma.course.deleteMany({ where: { id: course.id } }).catch(() => {});
    if (term?.id) await prisma.academicTerm.deleteMany({ where: { id: term.id } }).catch(() => {});
    if (dept?.id) await prisma.department.deleteMany({ where: { id: dept.id } }).catch(() => {});
  }
});

test('WP-4 T-1 Uniqueness: CourseGradeEntry unique([enrollmentId, componentId])', async () => {
  const suffix = makeSuffix('uq_entry');
  let dept: any;
  let course: any;
  let term: any;
  let studentUser: any;
  let student: any;
  let enrollment: any;
  let structure: any;
  let comp: any;
  let entry: any;

  try {
    const college = await prisma.college.create({ data: { name: `College_${suffix}` } });
    dept = await prisma.department.create({ data: { name: `Dept_${suffix}`, collegeId: college.id } });
    course = await prisma.course.create({
      data: {
        name: `Course_${suffix}`,
        courseCode: `C_${suffix.slice(-6)}`,
        credits: 3,
        year: 1,
        semester: 1,
        departmentId: dept.id,
      },
    });
    const year = (await prisma.academicYear.findFirst()) || await prisma.academicYear.create({
      data: { name: `2026-2027_${suffix}`, startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30') },
    });
    term = await prisma.academicTerm.create({
      data: {
        name: `Term_${suffix}`,
        academicYearId: year.id,
        termType: 'FALL',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-01-31'),
        isCurrent: false,
      },
    });
    studentUser = await prisma.user.create({
      data: { email: `stu_${suffix}@student.edu`, password: 'hash', role: 'STUDENT', departmentId: dept.id },
    });
    student = await prisma.student.create({
      data: { userId: studentUser.id, firstName: 'Student', lastName: suffix, studentId: `STU_${suffix}`, year: 1, departmentId: dept.id },
    });
    enrollment = await prisma.enrollment.create({
      data: { studentId: student.id, courseId: course.id, semester: 1, academicYear: 2026, termId: term.id },
    });

    structure = await prisma.courseGradeStructure.create({
      data: { courseId: course.id, termId: term.id },
    });
    comp = await prisma.courseGradeComponent.create({
      data: { structureId: structure.id, name: 'Quizzes', maxPoints: 20.0, source: 'AUTO_QUIZ', displayOrder: 1 },
    });

    entry = await prisma.courseGradeEntry.create({
      data: { enrollmentId: enrollment.id, componentId: comp.id, score: 18.0, isAbsent: false },
    });
    assert.ok(entry.id);

    await assert.rejects(
      async () => {
        await prisma.courseGradeEntry.create({
          data: { enrollmentId: enrollment.id, componentId: comp.id, score: 15.0, isAbsent: false },
        });
      },
      /Unique constraint failed|duplicate key/i
    );
  } finally {
    if (entry?.id) await prisma.courseGradeEntry.deleteMany({ where: { id: entry.id } }).catch(() => {});
    if (comp?.id) await prisma.courseGradeComponent.deleteMany({ where: { id: comp.id } }).catch(() => {});
    if (structure?.id) await prisma.courseGradeStructure.deleteMany({ where: { id: structure.id } }).catch(() => {});
    if (enrollment?.id) await prisma.enrollment.deleteMany({ where: { id: enrollment.id } }).catch(() => {});
    if (student?.id) await prisma.student.deleteMany({ where: { id: student.id } }).catch(() => {});
    if (studentUser?.id) await prisma.user.deleteMany({ where: { id: studentUser.id } }).catch(() => {});
    if (course?.id) await prisma.course.deleteMany({ where: { id: course.id } }).catch(() => {});
    if (term?.id) await prisma.academicTerm.deleteMany({ where: { id: term.id } }).catch(() => {});
    if (dept?.id) await prisma.department.deleteMany({ where: { id: dept.id } }).catch(() => {});
  }
});

test('WP-4 T-1 Check Constraints: CourseGradeComponent maxPoints <= 0 fails', async () => {
  const suffix = makeSuffix('chk_comp');
  let dept: any;
  let course: any;
  let term: any;
  let structure: any;

  try {
    const college = await prisma.college.create({ data: { name: `College_${suffix}` } });
    dept = await prisma.department.create({ data: { name: `Dept_${suffix}`, collegeId: college.id } });
    course = await prisma.course.create({
      data: { name: `Course_${suffix}`, courseCode: `C_${suffix.slice(-6)}`, credits: 3, year: 1, semester: 1, departmentId: dept.id },
    });
    const year = (await prisma.academicYear.findFirst()) || await prisma.academicYear.create({
      data: { name: `2026-2027_${suffix}`, startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30') },
    });
    term = await prisma.academicTerm.create({
      data: { name: `Term_${suffix}`, academicYearId: year.id, termType: 'FALL', startDate: new Date('2026-09-01'), endDate: new Date('2027-01-31'), isCurrent: false },
    });
    structure = await prisma.courseGradeStructure.create({ data: { courseId: course.id, termId: term.id } });

    await assert.rejects(
      async () => {
        await prisma.courseGradeComponent.create({
          data: { structureId: structure.id, name: 'Negative Component', maxPoints: -5.0, source: 'MANUAL', displayOrder: 1 },
        });
      },
      /check constraint|violates check/i
    );

    await assert.rejects(
      async () => {
        await prisma.courseGradeComponent.create({
          data: { structureId: structure.id, name: 'Zero Component', maxPoints: 0.0, source: 'MANUAL', displayOrder: 1 },
        });
      },
      /check constraint|violates check/i
    );
  } finally {
    if (structure?.id) await prisma.courseGradeStructure.deleteMany({ where: { id: structure.id } }).catch(() => {});
    if (course?.id) await prisma.course.deleteMany({ where: { id: course.id } }).catch(() => {});
    if (term?.id) await prisma.academicTerm.deleteMany({ where: { id: term.id } }).catch(() => {});
    if (dept?.id) await prisma.department.deleteMany({ where: { id: dept.id } }).catch(() => {});
  }
});

test('WP-4 T-1 Check Constraints: CourseGradeEntry absence & score invariants fail', async () => {
  const suffix = makeSuffix('chk_entry');
  let dept: any;
  let course: any;
  let term: any;
  let studentUser: any;
  let student: any;
  let enrollment: any;
  let structure: any;
  let comp: any;

  try {
    const college = await prisma.college.create({ data: { name: `College_${suffix}` } });
    dept = await prisma.department.create({ data: { name: `Dept_${suffix}`, collegeId: college.id } });
    course = await prisma.course.create({
      data: { name: `Course_${suffix}`, courseCode: `C_${suffix.slice(-6)}`, credits: 3, year: 1, semester: 1, departmentId: dept.id },
    });
    const year = (await prisma.academicYear.findFirst()) || await prisma.academicYear.create({
      data: { name: `2026-2027_${suffix}`, startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30') },
    });
    term = await prisma.academicTerm.create({
      data: { name: `Term_${suffix}`, academicYearId: year.id, termType: 'FALL', startDate: new Date('2026-09-01'), endDate: new Date('2027-01-31'), isCurrent: false },
    });
    studentUser = await prisma.user.create({
      data: { email: `stu_${suffix}@student.edu`, password: 'hash', role: 'STUDENT', departmentId: dept.id },
    });
    student = await prisma.student.create({
      data: { userId: studentUser.id, firstName: 'Student', lastName: suffix, studentId: `STU_${suffix}`, year: 1, departmentId: dept.id },
    });
    enrollment = await prisma.enrollment.create({
      data: { studentId: student.id, courseId: course.id, semester: 1, academicYear: 2026, termId: term.id },
    });
    structure = await prisma.courseGradeStructure.create({ data: { courseId: course.id, termId: term.id } });
    comp = await prisma.courseGradeComponent.create({
      data: { structureId: structure.id, name: 'Attendance', maxPoints: 10.0, source: 'AUTO_ATTENDANCE', displayOrder: 1 },
    });

    // isAbsent=true with score!=null must fail
    await assert.rejects(
      async () => {
        await prisma.courseGradeEntry.create({
          data: { enrollmentId: enrollment.id, componentId: comp.id, score: 5.0, isAbsent: true },
        });
      },
      /check constraint|violates check/i
    );

    // isAbsent=false with score=null must fail
    await assert.rejects(
      async () => {
        await prisma.courseGradeEntry.create({
          data: { enrollmentId: enrollment.id, componentId: comp.id, score: null, isAbsent: false },
        });
      },
      /check constraint|violates check/i
    );

    // score < 0 must fail
    await assert.rejects(
      async () => {
        await prisma.courseGradeEntry.create({
          data: { enrollmentId: enrollment.id, componentId: comp.id, score: -1.0, isAbsent: false },
        });
      },
      /check constraint|violates check/i
    );
  } finally {
    if (comp?.id) await prisma.courseGradeComponent.deleteMany({ where: { id: comp.id } }).catch(() => {});
    if (structure?.id) await prisma.courseGradeStructure.deleteMany({ where: { id: structure.id } }).catch(() => {});
    if (enrollment?.id) await prisma.enrollment.deleteMany({ where: { id: enrollment.id } }).catch(() => {});
    if (student?.id) await prisma.student.deleteMany({ where: { id: student.id } }).catch(() => {});
    if (studentUser?.id) await prisma.user.deleteMany({ where: { id: studentUser.id } }).catch(() => {});
    if (course?.id) await prisma.course.deleteMany({ where: { id: course.id } }).catch(() => {});
    if (term?.id) await prisma.academicTerm.deleteMany({ where: { id: term.id } }).catch(() => {});
    if (dept?.id) await prisma.department.deleteMany({ where: { id: dept.id } }).catch(() => {});
  }
});

test('WP-4 T-1 Restrict FK: AcademicTerm delete blocked by CourseGradeStructure (CourseGradeStructure_termId_fkey)', async () => {
  const suffix = makeSuffix('fk_term');
  let dept: any;
  let course: any;
  let termSolo: any;
  let structure: any;

  try {
    const college = await prisma.college.create({ data: { name: `College_${suffix}` } });
    dept = await prisma.department.create({ data: { name: `Dept_${suffix}`, collegeId: college.id } });
    course = await prisma.course.create({
      data: { name: `Course_${suffix}`, courseCode: `C_${suffix.slice(-6)}`, credits: 3, year: 1, semester: 1, departmentId: dept.id },
    });

    const year = (await prisma.academicYear.findFirst()) || await prisma.academicYear.create({
      data: { name: `2026-2027_${suffix}`, startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30') },
    });
    // Create an AcademicTerm referenced ONLY by CourseGradeStructure (NO timetable, NO slots, NO tasks, NO enrollments)
    termSolo = await prisma.academicTerm.create({
      data: {
        name: `TermSolo_${suffix}`,
        academicYearId: year.id,
        termType: 'SPRING',
        startDate: new Date('2027-02-01'),
        endDate: new Date('2027-06-30'),
        isCurrent: false,
      },
    });

    structure = await prisma.courseGradeStructure.create({
      data: {
        courseId: course.id,
        termId: termSolo.id,
        passMark: 60.0,
      },
    });

    await assert.rejects(
      async () => {
        await prisma.academicTerm.delete({ where: { id: termSolo.id } });
      },
      (err: any) => {
        const msg = String(err?.message || '');
        assert.match(msg, /CourseGradeStructure_termId_fkey|Foreign key constraint violated/i);
        return true;
      },
      'Deleting AcademicTerm referenced only by CourseGradeStructure must fail with CourseGradeStructure_termId_fkey constraint violation'
    );
  } finally {
    if (structure?.id) await prisma.courseGradeStructure.deleteMany({ where: { id: structure.id } }).catch(() => {});
    if (termSolo?.id) await prisma.academicTerm.deleteMany({ where: { id: termSolo.id } }).catch(() => {});
    if (course?.id) await prisma.course.deleteMany({ where: { id: course.id } }).catch(() => {});
    if (dept?.id) await prisma.department.deleteMany({ where: { id: dept.id } }).catch(() => {});
  }
});

test('WP-4 T-1 Restrict FK: CourseGradeStructure delete blocked by CourseGradeComponent (CourseGradeComponent_structureId_fkey)', async () => {
  const suffix = makeSuffix('fk_struct');
  let dept: any;
  let course: any;
  let term: any;
  let structure: any;
  let comp: any;

  try {
    const college = await prisma.college.create({ data: { name: `College_${suffix}` } });
    dept = await prisma.department.create({ data: { name: `Dept_${suffix}`, collegeId: college.id } });
    course = await prisma.course.create({
      data: { name: `Course_${suffix}`, courseCode: `C_${suffix.slice(-6)}`, credits: 3, year: 1, semester: 1, departmentId: dept.id },
    });
    const year = (await prisma.academicYear.findFirst()) || await prisma.academicYear.create({
      data: { name: `2026-2027_${suffix}`, startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30') },
    });
    term = await prisma.academicTerm.create({
      data: { name: `Term_${suffix}`, academicYearId: year.id, termType: 'FALL', startDate: new Date('2026-09-01'), endDate: new Date('2027-01-31'), isCurrent: false },
    });
    structure = await prisma.courseGradeStructure.create({ data: { courseId: course.id, termId: term.id } });
    comp = await prisma.courseGradeComponent.create({
      data: { structureId: structure.id, name: 'Oral Exam', maxPoints: 10.0, source: 'MANUAL', displayOrder: 1 },
    });

    await assert.rejects(
      async () => {
        await prisma.courseGradeStructure.delete({ where: { id: structure.id } });
      },
      (err: any) => {
        const msg = String(err?.message || '');
        assert.match(msg, /CourseGradeComponent_structureId_fkey|Foreign key constraint violated/i);
        return true;
      },
      'Deleting CourseGradeStructure with components must fail with CourseGradeComponent_structureId_fkey'
    );
  } finally {
    if (comp?.id) await prisma.courseGradeComponent.deleteMany({ where: { id: comp.id } }).catch(() => {});
    if (structure?.id) await prisma.courseGradeStructure.deleteMany({ where: { id: structure.id } }).catch(() => {});
    if (course?.id) await prisma.course.deleteMany({ where: { id: course.id } }).catch(() => {});
    if (term?.id) await prisma.academicTerm.deleteMany({ where: { id: term.id } }).catch(() => {});
    if (dept?.id) await prisma.department.deleteMany({ where: { id: dept.id } }).catch(() => {});
  }
});

test('WP-4 T-1 Restrict FK: CourseGradeComponent delete blocked by CourseGradeEntry (CourseGradeEntry_componentId_fkey)', async () => {
  const suffix = makeSuffix('fk_comp');
  let dept: any;
  let course: any;
  let term: any;
  let studentUser: any;
  let student: any;
  let enrollment: any;
  let structure: any;
  let comp: any;
  let entry: any;

  try {
    const college = await prisma.college.create({ data: { name: `College_${suffix}` } });
    dept = await prisma.department.create({ data: { name: `Dept_${suffix}`, collegeId: college.id } });
    course = await prisma.course.create({
      data: { name: `Course_${suffix}`, courseCode: `C_${suffix.slice(-6)}`, credits: 3, year: 1, semester: 1, departmentId: dept.id },
    });
    const year = (await prisma.academicYear.findFirst()) || await prisma.academicYear.create({
      data: { name: `2026-2027_${suffix}`, startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30') },
    });
    term = await prisma.academicTerm.create({
      data: { name: `Term_${suffix}`, academicYearId: year.id, termType: 'FALL', startDate: new Date('2026-09-01'), endDate: new Date('2027-01-31'), isCurrent: false },
    });
    studentUser = await prisma.user.create({
      data: { email: `stu_${suffix}@student.edu`, password: 'hash', role: 'STUDENT', departmentId: dept.id },
    });
    student = await prisma.student.create({
      data: { userId: studentUser.id, firstName: 'Student', lastName: suffix, studentId: `STU_${suffix}`, year: 1, departmentId: dept.id },
    });
    enrollment = await prisma.enrollment.create({
      data: { studentId: student.id, courseId: course.id, semester: 1, academicYear: 2026, termId: term.id },
    });
    structure = await prisma.courseGradeStructure.create({ data: { courseId: course.id, termId: term.id } });
    comp = await prisma.courseGradeComponent.create({
      data: { structureId: structure.id, name: 'Final Exam', maxPoints: 50.0, source: 'MANUAL', displayOrder: 1 },
    });
    entry = await prisma.courseGradeEntry.create({
      data: { enrollmentId: enrollment.id, componentId: comp.id, score: 45.0, isAbsent: false },
    });

    await assert.rejects(
      async () => {
        await prisma.courseGradeComponent.delete({ where: { id: comp.id } });
      },
      (err: any) => {
        const msg = String(err?.message || '');
        assert.match(msg, /CourseGradeEntry_componentId_fkey|Foreign key constraint violated/i);
        return true;
      },
      'Deleting CourseGradeComponent with grade entries must fail with CourseGradeEntry_componentId_fkey'
    );
  } finally {
    if (entry?.id) await prisma.courseGradeEntry.deleteMany({ where: { id: entry.id } }).catch(() => {});
    if (comp?.id) await prisma.courseGradeComponent.deleteMany({ where: { id: comp.id } }).catch(() => {});
    if (structure?.id) await prisma.courseGradeStructure.deleteMany({ where: { id: structure.id } }).catch(() => {});
    if (enrollment?.id) await prisma.enrollment.deleteMany({ where: { id: enrollment.id } }).catch(() => {});
    if (student?.id) await prisma.student.deleteMany({ where: { id: student.id } }).catch(() => {});
    if (studentUser?.id) await prisma.user.deleteMany({ where: { id: studentUser.id } }).catch(() => {});
    if (course?.id) await prisma.course.deleteMany({ where: { id: course.id } }).catch(() => {});
    if (term?.id) await prisma.academicTerm.deleteMany({ where: { id: term.id } }).catch(() => {});
    if (dept?.id) await prisma.department.deleteMany({ where: { id: dept.id } }).catch(() => {});
  }
});

test('WP-4 T-1 Restrict FK: Enrollment delete blocked by CourseGradeEntry (CourseGradeEntry_enrollmentId_fkey)', async () => {
  const suffix = makeSuffix('fk_enr');
  let dept: any;
  let course: any;
  let term: any;
  let studentUser: any;
  let student: any;
  let enrollment: any;
  let structure: any;
  let comp: any;
  let entry: any;

  try {
    const college = await prisma.college.create({ data: { name: `College_${suffix}` } });
    dept = await prisma.department.create({ data: { name: `Dept_${suffix}`, collegeId: college.id } });
    course = await prisma.course.create({
      data: { name: `Course_${suffix}`, courseCode: `C_${suffix.slice(-6)}`, credits: 3, year: 1, semester: 1, departmentId: dept.id },
    });
    const year = (await prisma.academicYear.findFirst()) || await prisma.academicYear.create({
      data: { name: `2026-2027_${suffix}`, startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30') },
    });
    term = await prisma.academicTerm.create({
      data: { name: `Term_${suffix}`, academicYearId: year.id, termType: 'FALL', startDate: new Date('2026-09-01'), endDate: new Date('2027-01-31'), isCurrent: false },
    });
    studentUser = await prisma.user.create({
      data: { email: `stu_${suffix}@student.edu`, password: 'hash', role: 'STUDENT', departmentId: dept.id },
    });
    student = await prisma.student.create({
      data: { userId: studentUser.id, firstName: 'Student', lastName: suffix, studentId: `STU_${suffix}`, year: 1, departmentId: dept.id },
    });
    enrollment = await prisma.enrollment.create({
      data: { studentId: student.id, courseId: course.id, semester: 1, academicYear: 2026, termId: term.id },
    });
    structure = await prisma.courseGradeStructure.create({ data: { courseId: course.id, termId: term.id } });
    comp = await prisma.courseGradeComponent.create({
      data: { structureId: structure.id, name: 'Project', maxPoints: 20.0, source: 'MANUAL', displayOrder: 1 },
    });
    entry = await prisma.courseGradeEntry.create({
      data: { enrollmentId: enrollment.id, componentId: comp.id, score: 19.0, isAbsent: false },
    });

    await assert.rejects(
      async () => {
        await prisma.enrollment.delete({ where: { id: enrollment.id } });
      },
      (err: any) => {
        const msg = String(err?.message || '');
        assert.match(msg, /CourseGradeEntry_enrollmentId_fkey|Foreign key constraint violated/i);
        return true;
      },
      'Deleting Enrollment with grade entries must fail with CourseGradeEntry_enrollmentId_fkey'
    );
  } finally {
    if (entry?.id) await prisma.courseGradeEntry.deleteMany({ where: { id: entry.id } }).catch(() => {});
    if (comp?.id) await prisma.courseGradeComponent.deleteMany({ where: { id: comp.id } }).catch(() => {});
    if (structure?.id) await prisma.courseGradeStructure.deleteMany({ where: { id: structure.id } }).catch(() => {});
    if (enrollment?.id) await prisma.enrollment.deleteMany({ where: { id: enrollment.id } }).catch(() => {});
    if (student?.id) await prisma.student.deleteMany({ where: { id: student.id } }).catch(() => {});
    if (studentUser?.id) await prisma.user.deleteMany({ where: { id: studentUser.id } }).catch(() => {});
    if (course?.id) await prisma.course.deleteMany({ where: { id: course.id } }).catch(() => {});
    if (term?.id) await prisma.academicTerm.deleteMany({ where: { id: term.id } }).catch(() => {});
    if (dept?.id) await prisma.department.deleteMany({ where: { id: dept.id } }).catch(() => {});
  }
});

test('WP-4 T-1 Restrict FK: User delete blocked by CourseGradeEntry draftedById (CourseGradeEntry_draftedById_fkey)', async () => {
  const suffix = makeSuffix('fk_user_draft');
  let dept: any;
  let course: any;
  let term: any;
  let studentUser: any;
  let student: any;
  let enrollment: any;
  let structure: any;
  let comp: any;
  let staffUser: any;
  let entry: any;

  try {
    const college = await prisma.college.create({ data: { name: `College_${suffix}` } });
    dept = await prisma.department.create({ data: { name: `Dept_${suffix}`, collegeId: college.id } });
    course = await prisma.course.create({
      data: { name: `Course_${suffix}`, courseCode: `C_${suffix.slice(-6)}`, credits: 3, year: 1, semester: 1, departmentId: dept.id },
    });
    const year = (await prisma.academicYear.findFirst()) || await prisma.academicYear.create({
      data: { name: `2026-2027_${suffix}`, startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30') },
    });
    term = await prisma.academicTerm.create({
      data: { name: `Term_${suffix}`, academicYearId: year.id, termType: 'FALL', startDate: new Date('2026-09-01'), endDate: new Date('2027-01-31'), isCurrent: false },
    });
    studentUser = await prisma.user.create({
      data: { email: `stu_${suffix}@student.edu`, password: 'hash', role: 'STUDENT', departmentId: dept.id },
    });
    student = await prisma.student.create({
      data: { userId: studentUser.id, firstName: 'Student', lastName: suffix, studentId: `STU_${suffix}`, year: 1, departmentId: dept.id },
    });
    enrollment = await prisma.enrollment.create({
      data: { studentId: student.id, courseId: course.id, semester: 1, academicYear: 2026, termId: term.id },
    });
    structure = await prisma.courseGradeStructure.create({ data: { courseId: course.id, termId: term.id } });
    comp = await prisma.courseGradeComponent.create({
      data: { structureId: structure.id, name: 'Homework', maxPoints: 10.0, source: 'MANUAL', displayOrder: 1 },
    });

    staffUser = await prisma.user.create({
      data: { email: `staff_${suffix}@university.edu`, password: 'hash', role: 'TEACHING_ASSISTANT', departmentId: dept.id },
    });
    entry = await prisma.courseGradeEntry.create({
      data: { enrollmentId: enrollment.id, componentId: comp.id, score: 9.0, isAbsent: false, draftedById: staffUser.id },
    });

    await assert.rejects(
      async () => {
        await prisma.user.delete({ where: { id: staffUser.id } });
      },
      (err: any) => {
        const msg = String(err?.message || '');
        assert.match(msg, /CourseGradeEntry_draftedById_fkey|Foreign key constraint violated/i);
        return true;
      },
      'Deleting User referenced by CourseGradeEntry draftedById must fail with CourseGradeEntry_draftedById_fkey'
    );
  } finally {
    if (entry?.id) await prisma.courseGradeEntry.deleteMany({ where: { id: entry.id } }).catch(() => {});
    if (staffUser?.id) await prisma.user.deleteMany({ where: { id: staffUser.id } }).catch(() => {});
    if (comp?.id) await prisma.courseGradeComponent.deleteMany({ where: { id: comp.id } }).catch(() => {});
    if (structure?.id) await prisma.courseGradeStructure.deleteMany({ where: { id: structure.id } }).catch(() => {});
    if (enrollment?.id) await prisma.enrollment.deleteMany({ where: { id: enrollment.id } }).catch(() => {});
    if (student?.id) await prisma.student.deleteMany({ where: { id: student.id } }).catch(() => {});
    if (studentUser?.id) await prisma.user.deleteMany({ where: { id: studentUser.id } }).catch(() => {});
    if (course?.id) await prisma.course.deleteMany({ where: { id: course.id } }).catch(() => {});
    if (term?.id) await prisma.academicTerm.deleteMany({ where: { id: term.id } }).catch(() => {});
    if (dept?.id) await prisma.department.deleteMany({ where: { id: dept.id } }).catch(() => {});
  }
});

test('WP-4 T-1 Restrict FK: User delete blocked by CourseGradeEntry publishedById (CourseGradeEntry_publishedById_fkey)', async () => {
  const suffix = makeSuffix('fk_user_pub');
  let dept: any;
  let course: any;
  let term: any;
  let studentUser: any;
  let student: any;
  let enrollment: any;
  let structure: any;
  let comp: any;
  let docUser: any;
  let entry: any;

  try {
    const college = await prisma.college.create({ data: { name: `College_${suffix}` } });
    dept = await prisma.department.create({ data: { name: `Dept_${suffix}`, collegeId: college.id } });
    course = await prisma.course.create({
      data: { name: `Course_${suffix}`, courseCode: `C_${suffix.slice(-6)}`, credits: 3, year: 1, semester: 1, departmentId: dept.id },
    });
    const year = (await prisma.academicYear.findFirst()) || await prisma.academicYear.create({
      data: { name: `2026-2027_${suffix}`, startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30') },
    });
    term = await prisma.academicTerm.create({
      data: { name: `Term_${suffix}`, academicYearId: year.id, termType: 'FALL', startDate: new Date('2026-09-01'), endDate: new Date('2027-01-31'), isCurrent: false },
    });
    studentUser = await prisma.user.create({
      data: { email: `stu_${suffix}@student.edu`, password: 'hash', role: 'STUDENT', departmentId: dept.id },
    });
    student = await prisma.student.create({
      data: { userId: studentUser.id, firstName: 'Student', lastName: suffix, studentId: `STU_${suffix}`, year: 1, departmentId: dept.id },
    });
    enrollment = await prisma.enrollment.create({
      data: { studentId: student.id, courseId: course.id, semester: 1, academicYear: 2026, termId: term.id },
    });
    structure = await prisma.courseGradeStructure.create({ data: { courseId: course.id, termId: term.id } });
    comp = await prisma.courseGradeComponent.create({
      data: { structureId: structure.id, name: 'Oral', maxPoints: 10.0, source: 'MANUAL', displayOrder: 1 },
    });

    docUser = await prisma.user.create({
      data: { email: `doc_pub_${suffix}@university.edu`, password: 'hash', role: 'DOCTOR', departmentId: dept.id },
    });
    entry = await prisma.courseGradeEntry.create({
      data: { enrollmentId: enrollment.id, componentId: comp.id, score: 10.0, isAbsent: false, status: 'PUBLISHED', publishedById: docUser.id },
    });

    await assert.rejects(
      async () => {
        await prisma.user.delete({ where: { id: docUser.id } });
      },
      (err: any) => {
        const msg = String(err?.message || '');
        assert.match(msg, /CourseGradeEntry_publishedById_fkey|Foreign key constraint violated/i);
        return true;
      },
      'Deleting User referenced by CourseGradeEntry publishedById must fail with CourseGradeEntry_publishedById_fkey'
    );
  } finally {
    if (entry?.id) await prisma.courseGradeEntry.deleteMany({ where: { id: entry.id } }).catch(() => {});
    if (docUser?.id) await prisma.user.deleteMany({ where: { id: docUser.id } }).catch(() => {});
    if (comp?.id) await prisma.courseGradeComponent.deleteMany({ where: { id: comp.id } }).catch(() => {});
    if (structure?.id) await prisma.courseGradeStructure.deleteMany({ where: { id: structure.id } }).catch(() => {});
    if (enrollment?.id) await prisma.enrollment.deleteMany({ where: { id: enrollment.id } }).catch(() => {});
    if (student?.id) await prisma.student.deleteMany({ where: { id: student.id } }).catch(() => {});
    if (studentUser?.id) await prisma.user.deleteMany({ where: { id: studentUser.id } }).catch(() => {});
    if (course?.id) await prisma.course.deleteMany({ where: { id: course.id } }).catch(() => {});
    if (term?.id) await prisma.academicTerm.deleteMany({ where: { id: term.id } }).catch(() => {});
    if (dept?.id) await prisma.department.deleteMany({ where: { id: dept.id } }).catch(() => {});
  }
});

test('WP-4 T-1 HTTP Deletion Guard: DELETE /api/courses/:id returns 409 when grade structure exists', async () => {
  const suffix = makeSuffix('guard_course');
  const { adminUser, token } = await createAdminUser(suffix);
  const baseUrl = await getTestBaseUrl();

  let dept: any;
  let course: any;
  let term: any;
  let structure: any;

  try {
    const college = await prisma.college.create({ data: { name: `College_${suffix}` } });
    dept = await prisma.department.create({ data: { name: `Dept_${suffix}`, collegeId: college.id } });
    course = await prisma.course.create({
      data: { name: `Course_${suffix}`, courseCode: `C_${suffix.slice(-6)}`, credits: 3, year: 1, semester: 1, departmentId: dept.id },
    });
    const year = (await prisma.academicYear.findFirst()) || await prisma.academicYear.create({
      data: { name: `2026-2027_${suffix}`, startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30') },
    });
    term = await prisma.academicTerm.create({
      data: { name: `Term_${suffix}`, academicYearId: year.id, termType: 'FALL', startDate: new Date('2026-09-01'), endDate: new Date('2027-01-31'), isCurrent: false },
    });
    structure = await prisma.courseGradeStructure.create({
      data: { courseId: course.id, termId: term.id, passMark: 50.0 },
    });

    const res = await fetch(`${baseUrl}/courses/${course.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(res.status, 409, 'DELETE /courses/:id with existing grade structure must return HTTP 409 Conflict');
    const json = await res.json();
    assert.match(json.message, /grade structures/i);
  } finally {
    if (structure?.id) await prisma.courseGradeStructure.deleteMany({ where: { id: structure.id } }).catch(() => {});
    if (course?.id) await prisma.course.deleteMany({ where: { id: course.id } }).catch(() => {});
    if (term?.id) await prisma.academicTerm.deleteMany({ where: { id: term.id } }).catch(() => {});
    if (dept?.id) await prisma.department.deleteMany({ where: { id: dept.id } }).catch(() => {});
    if (adminUser?.id) await prisma.user.deleteMany({ where: { id: adminUser.id } }).catch(() => {});
  }
});

test('WP-4 T-1 HTTP Deletion Guard: DELETE /api/doctors/:id returns 409 when doctor has grade entries', async () => {
  const suffix = makeSuffix('guard_doc');
  const { adminUser, token } = await createAdminUser(suffix);
  const baseUrl = await getTestBaseUrl();

  let dept: any;
  let docUser: any;
  let doctor: any;
  let course: any;
  let term: any;
  let studentUser: any;
  let student: any;
  let enrollment: any;
  let structure: any;
  let comp: any;
  let entry: any;

  try {
    const college = await prisma.college.create({ data: { name: `College_${suffix}` } });
    dept = await prisma.department.create({ data: { name: `Dept_${suffix}`, collegeId: college.id } });

    docUser = await prisma.user.create({
      data: { email: `doc_${suffix}@university.edu`, password: 'hash', role: 'DOCTOR', departmentId: dept.id },
    });
    doctor = await prisma.doctor.create({
      data: { userId: docUser.id, departmentId: dept.id, firstName: 'Doc', lastName: suffix, specialty: 'CS' },
    });

    course = await prisma.course.create({
      data: { name: `Course_${suffix}`, courseCode: `C_${suffix.slice(-6)}`, credits: 3, year: 1, semester: 1, departmentId: dept.id },
    });
    const year = (await prisma.academicYear.findFirst()) || await prisma.academicYear.create({
      data: { name: `2026-2027_${suffix}`, startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30') },
    });
    term = await prisma.academicTerm.create({
      data: { name: `Term_${suffix}`, academicYearId: year.id, termType: 'FALL', startDate: new Date('2026-09-01'), endDate: new Date('2027-01-31'), isCurrent: false },
    });
    studentUser = await prisma.user.create({
      data: { email: `stu_${suffix}@student.edu`, password: 'hash', role: 'STUDENT', departmentId: dept.id },
    });
    student = await prisma.student.create({
      data: { userId: studentUser.id, firstName: 'Student', lastName: suffix, studentId: `STU_${suffix}`, year: 1, departmentId: dept.id },
    });
    enrollment = await prisma.enrollment.create({
      data: { studentId: student.id, courseId: course.id, semester: 1, academicYear: 2026, termId: term.id },
    });
    structure = await prisma.courseGradeStructure.create({ data: { courseId: course.id, termId: term.id } });
    comp = await prisma.courseGradeComponent.create({
      data: { structureId: structure.id, name: 'Midterm', maxPoints: 30.0, source: 'MANUAL', displayOrder: 1 },
    });
    entry = await prisma.courseGradeEntry.create({
      data: { enrollmentId: enrollment.id, componentId: comp.id, score: 25.0, isAbsent: false, draftedById: docUser.id },
    });

    const res = await fetch(`${baseUrl}/doctors/${doctor.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(res.status, 409, 'DELETE /doctors/:id with drafted grade entries must return HTTP 409 Conflict');
    const json = await res.json();
    assert.match(json.message, /grade entries/i);
  } finally {
    if (entry?.id) await prisma.courseGradeEntry.deleteMany({ where: { id: entry.id } }).catch(() => {});
    if (comp?.id) await prisma.courseGradeComponent.deleteMany({ where: { id: comp.id } }).catch(() => {});
    if (structure?.id) await prisma.courseGradeStructure.deleteMany({ where: { id: structure.id } }).catch(() => {});
    if (enrollment?.id) await prisma.enrollment.deleteMany({ where: { id: enrollment.id } }).catch(() => {});
    if (student?.id) await prisma.student.deleteMany({ where: { id: student.id } }).catch(() => {});
    if (studentUser?.id) await prisma.user.deleteMany({ where: { id: studentUser.id } }).catch(() => {});
    if (course?.id) await prisma.course.deleteMany({ where: { id: course.id } }).catch(() => {});
    if (term?.id) await prisma.academicTerm.deleteMany({ where: { id: term.id } }).catch(() => {});
    if (doctor?.id) await prisma.doctor.deleteMany({ where: { id: doctor.id } }).catch(() => {});
    if (docUser?.id) await prisma.user.deleteMany({ where: { id: docUser.id } }).catch(() => {});
    if (dept?.id) await prisma.department.deleteMany({ where: { id: dept.id } }).catch(() => {});
    if (adminUser?.id) await prisma.user.deleteMany({ where: { id: adminUser.id } }).catch(() => {});
  }
});

test('WP-4 T-1 HTTP Deletion Guard: DELETE /api/teaching-assistants/:id returns 409 when TA has grade entries', async () => {
  const suffix = makeSuffix('guard_ta');
  const { adminUser, token } = await createAdminUser(suffix);
  const baseUrl = await getTestBaseUrl();

  let dept: any;
  let taUser: any;
  let ta: any;
  let course: any;
  let term: any;
  let studentUser: any;
  let student: any;
  let enrollment: any;
  let structure: any;
  let comp: any;
  let entry: any;

  try {
    const college = await prisma.college.create({ data: { name: `College_${suffix}` } });
    dept = await prisma.department.create({ data: { name: `Dept_${suffix}`, collegeId: college.id } });

    taUser = await prisma.user.create({
      data: { email: `ta_${suffix}@university.edu`, password: 'hash', role: 'TEACHING_ASSISTANT', departmentId: dept.id },
    });
    ta = await prisma.teachingAssistant.create({
      data: {
        userId: taUser.id,
        departmentId: dept.id,
        firstName: 'TA',
        lastName: suffix,
        employeeId: `TA_${suffix.slice(-8)}`,
      },
    });

    course = await prisma.course.create({
      data: { name: `Course_${suffix}`, courseCode: `C_${suffix.slice(-6)}`, credits: 3, year: 1, semester: 1, departmentId: dept.id },
    });
    const year = (await prisma.academicYear.findFirst()) || await prisma.academicYear.create({
      data: { name: `2026-2027_${suffix}`, startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30') },
    });
    term = await prisma.academicTerm.create({
      data: { name: `Term_${suffix}`, academicYearId: year.id, termType: 'FALL', startDate: new Date('2026-09-01'), endDate: new Date('2027-01-31'), isCurrent: false },
    });
    studentUser = await prisma.user.create({
      data: { email: `stu_${suffix}@student.edu`, password: 'hash', role: 'STUDENT', departmentId: dept.id },
    });
    student = await prisma.student.create({
      data: { userId: studentUser.id, firstName: 'Student', lastName: suffix, studentId: `STU_${suffix}`, year: 1, departmentId: dept.id },
    });
    enrollment = await prisma.enrollment.create({
      data: { studentId: student.id, courseId: course.id, semester: 1, academicYear: 2026, termId: term.id },
    });
    structure = await prisma.courseGradeStructure.create({ data: { courseId: course.id, termId: term.id } });
    comp = await prisma.courseGradeComponent.create({
      data: { structureId: structure.id, name: 'Lab Practical', maxPoints: 20.0, source: 'MANUAL', displayOrder: 1 },
    });
    entry = await prisma.courseGradeEntry.create({
      data: { enrollmentId: enrollment.id, componentId: comp.id, score: 18.0, isAbsent: false, draftedById: taUser.id },
    });

    const res = await fetch(`${baseUrl}/teaching-assistants/${ta.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(res.status, 409, 'DELETE /teaching-assistants/:id with drafted grade entries must return HTTP 409 Conflict');
    const json = await res.json();
    assert.match(json.message, /grade entries/i);
  } finally {
    if (entry?.id) await prisma.courseGradeEntry.deleteMany({ where: { id: entry.id } }).catch(() => {});
    if (comp?.id) await prisma.courseGradeComponent.deleteMany({ where: { id: comp.id } }).catch(() => {});
    if (structure?.id) await prisma.courseGradeStructure.deleteMany({ where: { id: structure.id } }).catch(() => {});
    if (enrollment?.id) await prisma.enrollment.deleteMany({ where: { id: enrollment.id } }).catch(() => {});
    if (student?.id) await prisma.student.deleteMany({ where: { id: student.id } }).catch(() => {});
    if (studentUser?.id) await prisma.user.deleteMany({ where: { id: studentUser.id } }).catch(() => {});
    if (course?.id) await prisma.course.deleteMany({ where: { id: course.id } }).catch(() => {});
    if (term?.id) await prisma.academicTerm.deleteMany({ where: { id: term.id } }).catch(() => {});
    if (ta?.id) await prisma.teachingAssistant.deleteMany({ where: { id: ta.id } }).catch(() => {});
    if (taUser?.id) await prisma.user.deleteMany({ where: { id: taUser.id } }).catch(() => {});
    if (dept?.id) await prisma.department.deleteMany({ where: { id: dept.id } }).catch(() => {});
    if (adminUser?.id) await prisma.user.deleteMany({ where: { id: adminUser.id } }).catch(() => {});
  }
});

test('WP-4 T-1 HTTP Deletion Guard: DELETE /api/students/:id returns 409 when student has grade entries', async () => {
  const suffix = makeSuffix('guard_stu');
  const { adminUser, token } = await createAdminUser(suffix);
  const baseUrl = await getTestBaseUrl();

  let dept: any;
  let course: any;
  let term: any;
  let studentUser: any;
  let student: any;
  let enrollment: any;
  let structure: any;
  let comp: any;
  let entry: any;

  try {
    const college = await prisma.college.create({ data: { name: `College_${suffix}` } });
    dept = await prisma.department.create({ data: { name: `Dept_${suffix}`, collegeId: college.id } });
    course = await prisma.course.create({
      data: { name: `Course_${suffix}`, courseCode: `C_${suffix.slice(-6)}`, credits: 3, year: 1, semester: 1, departmentId: dept.id },
    });
    const year = (await prisma.academicYear.findFirst()) || await prisma.academicYear.create({
      data: { name: `2026-2027_${suffix}`, startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30') },
    });
    term = await prisma.academicTerm.create({
      data: { name: `Term_${suffix}`, academicYearId: year.id, termType: 'FALL', startDate: new Date('2026-09-01'), endDate: new Date('2027-01-31'), isCurrent: false },
    });
    studentUser = await prisma.user.create({
      data: { email: `stu_${suffix}@student.edu`, password: 'hash', role: 'STUDENT', departmentId: dept.id },
    });
    student = await prisma.student.create({
      data: { userId: studentUser.id, firstName: 'Student', lastName: suffix, studentId: `STU_${suffix}`, year: 1, departmentId: dept.id },
    });
    enrollment = await prisma.enrollment.create({
      data: { studentId: student.id, courseId: course.id, semester: 1, academicYear: 2026, termId: term.id },
    });
    structure = await prisma.courseGradeStructure.create({ data: { courseId: course.id, termId: term.id } });
    comp = await prisma.courseGradeComponent.create({
      data: { structureId: structure.id, name: 'Attendance', maxPoints: 10.0, source: 'AUTO_ATTENDANCE', displayOrder: 1 },
    });
    entry = await prisma.courseGradeEntry.create({
      data: { enrollmentId: enrollment.id, componentId: comp.id, score: 9.5, isAbsent: false },
    });

    const res = await fetch(`${baseUrl}/students/${student.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(res.status, 409, 'DELETE /students/:id with grade entries must return HTTP 409 Conflict');
    const json = await res.json();
    assert.match(json.message, /records exist|academic.*preserved/i);
  } finally {
    if (entry?.id) await prisma.courseGradeEntry.deleteMany({ where: { id: entry.id } }).catch(() => {});
    if (comp?.id) await prisma.courseGradeComponent.deleteMany({ where: { id: comp.id } }).catch(() => {});
    if (structure?.id) await prisma.courseGradeStructure.deleteMany({ where: { id: structure.id } }).catch(() => {});
    if (enrollment?.id) await prisma.enrollment.deleteMany({ where: { id: enrollment.id } }).catch(() => {});
    if (student?.id) await prisma.student.deleteMany({ where: { id: student.id } }).catch(() => {});
    if (studentUser?.id) await prisma.user.deleteMany({ where: { id: studentUser.id } }).catch(() => {});
    if (course?.id) await prisma.course.deleteMany({ where: { id: course.id } }).catch(() => {});
    if (term?.id) await prisma.academicTerm.deleteMany({ where: { id: term.id } }).catch(() => {});
    if (dept?.id) await prisma.department.deleteMany({ where: { id: dept.id } }).catch(() => {});
    if (adminUser?.id) await prisma.user.deleteMany({ where: { id: adminUser.id } }).catch(() => {});
  }
});

test('WP-4 T-1 HTTP Deletion Guard: DELETE /api/users/:id/confirmed-purge returns 409 when user has linked grade records', async () => {
  const suffix = makeSuffix('guard_user');
  const { adminUser, token } = await createAdminUser(suffix);
  const baseUrl = await getTestBaseUrl();

  let dept: any;
  let targetUser: any;
  let course: any;
  let term: any;
  let studentUser: any;
  let student: any;
  let enrollment: any;
  let structure: any;
  let comp: any;
  let entry: any;

  try {
    const college = await prisma.college.create({ data: { name: `College_${suffix}` } });
    dept = await prisma.department.create({ data: { name: `Dept_${suffix}`, collegeId: college.id } });

    targetUser = await prisma.user.create({
      data: { email: `target_${suffix}@university.edu`, password: 'hash', role: 'DOCTOR', departmentId: dept.id },
    });

    course = await prisma.course.create({
      data: { name: `Course_${suffix}`, courseCode: `C_${suffix.slice(-6)}`, credits: 3, year: 1, semester: 1, departmentId: dept.id },
    });
    const year = (await prisma.academicYear.findFirst()) || await prisma.academicYear.create({
      data: { name: `2026-2027_${suffix}`, startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30') },
    });
    term = await prisma.academicTerm.create({
      data: { name: `Term_${suffix}`, academicYearId: year.id, termType: 'FALL', startDate: new Date('2026-09-01'), endDate: new Date('2027-01-31'), isCurrent: false },
    });
    studentUser = await prisma.user.create({
      data: { email: `stu_${suffix}@student.edu`, password: 'hash', role: 'STUDENT', departmentId: dept.id },
    });
    student = await prisma.student.create({
      data: { userId: studentUser.id, firstName: 'Student', lastName: suffix, studentId: `STU_${suffix}`, year: 1, departmentId: dept.id },
    });
    enrollment = await prisma.enrollment.create({
      data: { studentId: student.id, courseId: course.id, semester: 1, academicYear: 2026, termId: term.id },
    });
    structure = await prisma.courseGradeStructure.create({ data: { courseId: course.id, termId: term.id } });
    comp = await prisma.courseGradeComponent.create({
      data: { structureId: structure.id, name: 'Oral', maxPoints: 10.0, source: 'MANUAL', displayOrder: 1 },
    });
    entry = await prisma.courseGradeEntry.create({
      data: { enrollmentId: enrollment.id, componentId: comp.id, score: 10.0, isAbsent: false, draftedById: targetUser.id },
    });

    const res = await fetch(`${baseUrl}/users/${targetUser.id}/confirmed-purge`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(res.status, 409, 'DELETE /users/:id/confirmed-purge with linked grade records must return HTTP 409 Conflict');
    const json = await res.json();
    assert.match(json.message, /Cannot permanently delete/i);
  } finally {
    if (entry?.id) await prisma.courseGradeEntry.deleteMany({ where: { id: entry.id } }).catch(() => {});
    if (comp?.id) await prisma.courseGradeComponent.deleteMany({ where: { id: comp.id } }).catch(() => {});
    if (structure?.id) await prisma.courseGradeStructure.deleteMany({ where: { id: structure.id } }).catch(() => {});
    if (enrollment?.id) await prisma.enrollment.deleteMany({ where: { id: enrollment.id } }).catch(() => {});
    if (student?.id) await prisma.student.deleteMany({ where: { id: student.id } }).catch(() => {});
    if (studentUser?.id) await prisma.user.deleteMany({ where: { id: studentUser.id } }).catch(() => {});
    if (course?.id) await prisma.course.deleteMany({ where: { id: course.id } }).catch(() => {});
    if (term?.id) await prisma.academicTerm.deleteMany({ where: { id: term.id } }).catch(() => {});
    if (targetUser?.id) await prisma.user.deleteMany({ where: { id: targetUser.id } }).catch(() => {});
    if (dept?.id) await prisma.department.deleteMany({ where: { id: dept.id } }).catch(() => {});
    if (adminUser?.id) await prisma.user.deleteMany({ where: { id: adminUser.id } }).catch(() => {});
  }
});

test('WP-4 T-1 Enrollment Status Change: DELETE /api/enrollments/:id succeeds (200) even when grade entries exist', async () => {
  const suffix = makeSuffix('withdraw_ok');
  const { adminUser, token } = await createAdminUser(suffix);
  const baseUrl = await getTestBaseUrl();

  let dept: any;
  let course: any;
  let term: any;
  let studentUser: any;
  let student: any;
  let enrollment: any;
  let structure: any;
  let comp: any;
  let entry: any;

  try {
    const college = await prisma.college.create({ data: { name: `College_${suffix}` } });
    dept = await prisma.department.create({ data: { name: `Dept_${suffix}`, collegeId: college.id } });
    course = await prisma.course.create({
      data: { name: `Course_${suffix}`, courseCode: `C_${suffix.slice(-6)}`, credits: 3, year: 1, semester: 1, departmentId: dept.id },
    });
    const year = (await prisma.academicYear.findFirst()) || await prisma.academicYear.create({
      data: { name: `2026-2027_${suffix}`, startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30') },
    });
    term = await prisma.academicTerm.create({
      data: { name: `Term_${suffix}`, academicYearId: year.id, termType: 'FALL', startDate: new Date('2026-09-01'), endDate: new Date('2027-01-31'), isCurrent: false },
    });
    studentUser = await prisma.user.create({
      data: { email: `stu_${suffix}@student.edu`, password: 'hash', role: 'STUDENT', departmentId: dept.id },
    });
    student = await prisma.student.create({
      data: { userId: studentUser.id, firstName: 'Student', lastName: suffix, studentId: `STU_${suffix}`, year: 1, departmentId: dept.id },
    });
    enrollment = await prisma.enrollment.create({
      data: { studentId: student.id, courseId: course.id, semester: 1, academicYear: 2026, termId: term.id },
    });
    structure = await prisma.courseGradeStructure.create({ data: { courseId: course.id, termId: term.id } });
    comp = await prisma.courseGradeComponent.create({
      data: { structureId: structure.id, name: 'Quizzes', maxPoints: 20.0, source: 'AUTO_QUIZ', displayOrder: 1 },
    });
    entry = await prisma.courseGradeEntry.create({
      data: { enrollmentId: enrollment.id, componentId: comp.id, score: 17.5, isAbsent: false },
    });

    // Student withdrawal/drop is a STATUS CHANGE, not a hard delete.
    // It must succeed (200), transition status to WITHDRAWN, and preserve grade rows.
    const res = await fetch(`${baseUrl}/enrollments/${enrollment.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'Student withdrew due to medical excuse' }),
    });

    assert.strictEqual(
      res.status,
      200,
      `DELETE /enrollments/:id with existing grade entries must succeed with 200 (status change), got ${res.status}`
    );
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.status, 'WITHDRAWN');

    const freshEnrollment = await prisma.enrollment.findUnique({ where: { id: enrollment.id } });
    assert.strictEqual(freshEnrollment?.status, 'WITHDRAWN');

    const freshEntry = await prisma.courseGradeEntry.findUnique({ where: { id: entry.id } });
    assert.ok(freshEntry, 'CourseGradeEntry row must remain preserved after withdrawal');
  } finally {
    if (entry?.id) await prisma.courseGradeEntry.deleteMany({ where: { id: entry.id } }).catch(() => {});
    if (comp?.id) await prisma.courseGradeComponent.deleteMany({ where: { id: comp.id } }).catch(() => {});
    if (structure?.id) await prisma.courseGradeStructure.deleteMany({ where: { id: structure.id } }).catch(() => {});
    if (enrollment?.id) await prisma.enrollment.deleteMany({ where: { id: enrollment.id } }).catch(() => {});
    if (student?.id) await prisma.student.deleteMany({ where: { id: student.id } }).catch(() => {});
    if (studentUser?.id) await prisma.user.deleteMany({ where: { id: studentUser.id } }).catch(() => {});
    if (course?.id) await prisma.course.deleteMany({ where: { id: course.id } }).catch(() => {});
    if (term?.id) await prisma.academicTerm.deleteMany({ where: { id: term.id } }).catch(() => {});
    if (dept?.id) await prisma.department.deleteMany({ where: { id: dept.id } }).catch(() => {});
    if (adminUser?.id) await prisma.user.deleteMany({ where: { id: adminUser.id } }).catch(() => {});
  }
});

test.after(async () => {
  if (sharedServer) {
    await new Promise<void>((resolve) => sharedServer!.close(() => resolve()));
  }
});

