/**
 * Seed Script: IT Department - 20 Students, 2 Sections, 2 Groups of 10
 *
 * Usage: node seed-it-department.mjs
 *
 * This script:
 * 1. Finds (or creates) an IT Department
 * 2. Finds (or creates) a Doctor to assign to sections
 * 3. Finds (or creates) a Course in the IT Department
 * 4. Creates 20 students with User accounts in the IT Department
 * 5. Creates 2 Course Sections (Section A & Section B)
 * 6. Creates 2 Student Groups (Group A & Group B), 10 students each
 * 7. Maps Group A -> Section A, Group B -> Section B
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const prisma = new PrismaClient();

const IT_STUDENTS = [
  { firstName: 'Ahmed',    lastName: 'Al-Rashidi',   studentId: 'IT-2024-001', year: 2 },
  { firstName: 'Sara',     lastName: 'Hassan',        studentId: 'IT-2024-002', year: 2 },
  { firstName: 'Omar',     lastName: 'Khalid',        studentId: 'IT-2024-003', year: 2 },
  { firstName: 'Fatima',   lastName: 'Al-Zahra',      studentId: 'IT-2024-004', year: 2 },
  { firstName: 'Mohammed', lastName: 'Nasser',        studentId: 'IT-2024-005', year: 2 },
  { firstName: 'Aisha',    lastName: 'Al-Mansouri',   studentId: 'IT-2024-006', year: 2 },
  { firstName: 'Youssef',  lastName: 'Ibrahim',       studentId: 'IT-2024-007', year: 2 },
  { firstName: 'Layla',    lastName: 'Al-Ahmad',      studentId: 'IT-2024-008', year: 2 },
  { firstName: 'Khalid',   lastName: 'Al-Otaibi',     studentId: 'IT-2024-009', year: 2 },
  { firstName: 'Maryam',   lastName: 'Al-Sayed',      studentId: 'IT-2024-010', year: 2 },
  { firstName: 'Abdullah', lastName: 'Al-Harbi',      studentId: 'IT-2024-011', year: 2 },
  { firstName: 'Nora',     lastName: 'Al-Shammari',   studentId: 'IT-2024-012', year: 2 },
  { firstName: 'Hassan',   lastName: 'Al-Qahtan',     studentId: 'IT-2024-013', year: 2 },
  { firstName: 'Rana',     lastName: 'Mahmoud',       studentId: 'IT-2024-014', year: 2 },
  { firstName: 'Tariq',    lastName: 'Al-Ghamdi',     studentId: 'IT-2024-015', year: 2 },
  { firstName: 'Haya',     lastName: 'Al-Mutairi',    studentId: 'IT-2024-016', year: 2 },
  { firstName: 'Bilal',    lastName: 'Saleh',         studentId: 'IT-2024-017', year: 2 },
  { firstName: 'Dalia',    lastName: 'Al-Fahad',      studentId: 'IT-2024-018', year: 2 },
  { firstName: 'Sami',     lastName: 'Al-Zahrani',    studentId: 'IT-2024-019', year: 2 },
  { firstName: 'Reem',     lastName: 'Al-Dossari',    studentId: 'IT-2024-020', year: 2 },
];

async function main() {
  console.log('Starting IT Department Seed Script...\n');

  // 1. Find or Create College
  let college = await prisma.college.findFirst({
    where: { name: { contains: 'Engineering', mode: 'insensitive' } },
  });
  if (!college) {
    college = await prisma.college.findFirst();
  }
  if (!college) {
    college = await prisma.college.create({
      data: { name: 'College of Engineering & IT', nameAr: 'كلية الهندسة وتقنية المعلومات' },
    });
    console.log('Created college: ' + college.name);
  } else {
    console.log('Using college: ' + college.name + ' (ID: ' + college.id + ')');
  }

  // 2. Find or Create IT Department
  let department = await prisma.department.findFirst({
    where: {
      collegeId: college.id,
      name: { contains: 'Information Technology', mode: 'insensitive' },
    },
  });
  if (!department) {
    department = await prisma.department.findFirst({
      where: {
        collegeId: college.id,
        OR: [
          { name: { contains: 'IT', mode: 'insensitive' } },
          { name: { contains: 'Computer', mode: 'insensitive' } },
        ],
      },
    });
  }
  if (!department) {
    department = await prisma.department.create({
      data: {
        name: 'Information Technology',
        nameAr: 'تقنية المعلومات',
        collegeId: college.id,
      },
    });
    console.log('Created IT department (ID: ' + department.id + ')');
  } else {
    console.log('Using IT department: ' + department.name + ' (ID: ' + department.id + ')');
  }

  // 3. Find or Create a Doctor
  let doctor = await prisma.doctor.findFirst({
    where: { departmentId: department.id },
  });
  if (!doctor) {
    doctor = await prisma.doctor.findFirst();
  }
  if (!doctor) {
    const hashedPwd = await bcrypt.hash('Doctor@1234', 10);
    const doctorUser = await prisma.user.create({
      data: {
        email: 'dr.it.default@university.edu',
        password: hashedPwd,
        role: 'DOCTOR',
        departmentId: department.id,
      },
    });
    doctor = await prisma.doctor.create({
      data: {
        userId: doctorUser.id,
        firstName: 'Ali',
        lastName: 'Al-Hussain',
        departmentId: department.id,
        specialty: 'Computer Science',
      },
    });
    console.log('Created doctor: ' + doctor.firstName + ' ' + doctor.lastName + ' (ID: ' + doctor.id + ')');
  } else {
    console.log('Using doctor ID: ' + doctor.id);
  }

  // 4. Find or Create a Course
  let course = await prisma.course.findFirst({
    where: { departmentId: department.id },
  });
  if (!course) {
    course = await prisma.course.create({
      data: {
        courseCode: 'IT-301-' + department.id,
        name: 'Introduction to Information Technology',
        description: 'Core IT fundamentals course for second-year students',
        credits: 3,
        maxStudents: 30,
        year: 2,
        semester: 1,
        departmentId: department.id,
      },
    });
    console.log('Created course: ' + course.name + ' (ID: ' + course.id + ')');
  } else {
    console.log('Using course: ' + course.name + ' (ID: ' + course.id + ')');
  }

  // 5. Create 20 Students
  console.log('\nCreating 20 IT Department Students...');
  const hashedPwd = await bcrypt.hash('Student@1234', 10);
  const createdStudents = [];

  for (const s of IT_STUDENTS) {
    const email = s.studentId.toLowerCase().replace(/-/g, '.') + '@it.university.edu';

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingStudent = await prisma.student.findUnique({ where: { userId: existingUser.id } });
      if (existingStudent) {
        console.log('  SKIP ' + s.firstName + ' ' + s.lastName + ' already exists (ID: ' + existingStudent.id + ')');
        createdStudents.push(existingStudent);
        continue;
      }
    }

    const byStudentId = await prisma.student.findUnique({ where: { studentId: s.studentId } });
    if (byStudentId) {
      console.log('  SKIP studentId ' + s.studentId + ' already exists (ID: ' + byStudentId.id + ')');
      createdStudents.push(byStudentId);
      continue;
    }

    try {
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPwd,
          role: 'STUDENT',
          departmentId: department.id,
        },
      });

      const student = await prisma.student.create({
        data: {
          userId: user.id,
          firstName: s.firstName,
          lastName: s.lastName,
          studentId: s.studentId,
          year: s.year,
          departmentId: department.id,
          isActive: true,
        },
      });

      createdStudents.push(student);
      console.log('  OK ' + s.firstName + ' ' + s.lastName + ' (' + s.studentId + ')');
    } catch (err) {
      console.error('  FAIL ' + s.firstName + ' ' + s.lastName + ': ' + err.message);
    }
  }

  console.log('\nTotal students ready: ' + createdStudents.length);

  // 6. Create 2 Course Sections
  console.log('\nCreating 2 Course Sections...');

  let sectionA = await prisma.courseSection.findFirst({
    where: { courseId: course.id, name: 'Section A' },
  });
  if (!sectionA) {
    sectionA = await prisma.courseSection.create({
      data: { courseId: course.id, doctorId: doctor.id, name: 'Section A' },
    });
    console.log('  Created Section A (ID: ' + sectionA.id + ')');
  } else {
    console.log('  Section A already exists (ID: ' + sectionA.id + ')');
  }

  let sectionB = await prisma.courseSection.findFirst({
    where: { courseId: course.id, name: 'Section B' },
  });
  if (!sectionB) {
    sectionB = await prisma.courseSection.create({
      data: { courseId: course.id, doctorId: doctor.id, name: 'Section B' },
    });
    console.log('  Created Section B (ID: ' + sectionB.id + ')');
  } else {
    console.log('  Section B already exists (ID: ' + sectionB.id + ')');
  }

  // 7. Clear Existing Groups & Reassign
  console.log('\nClearing existing student groups for IT department...');
  await prisma.student.updateMany({
    where: { departmentId: department.id },
    data: { studentGroupId: null },
  });
  await prisma.studentGroup.deleteMany({
    where: { departmentId: department.id },
  });

  // 8. Create 2 Student Groups
  console.log('\nCreating 2 Student Groups (10 each)...');

  const groupA = await prisma.studentGroup.create({
    data: { name: 'Group A', departmentId: department.id },
  });
  const groupB = await prisma.studentGroup.create({
    data: { name: 'Group B', departmentId: department.id },
  });

  console.log('  Created Group A (ID: ' + groupA.id + ')');
  console.log('  Created Group B (ID: ' + groupB.id + ')');

  // 9. Assign students to groups (sorted alphabetically)
  console.log('\nAssigning students to groups...');

  const sortedStudents = [...createdStudents].sort((a, b) =>
    a.firstName.localeCompare(b.firstName)
  );

  const groupAStudents = sortedStudents.slice(0, 10);
  const groupBStudents = sortedStudents.slice(10, 20);

  for (const student of groupAStudents) {
    await prisma.student.update({
      where: { id: student.id },
      data: { studentGroupId: groupA.id },
    });
    console.log('  [Group A] ' + student.firstName + ' ' + student.lastName);
  }

  for (const student of groupBStudents) {
    await prisma.student.update({
      where: { id: student.id },
      data: { studentGroupId: groupB.id },
    });
    console.log('  [Group B] ' + student.firstName + ' ' + student.lastName);
  }

  // 10. Map Groups to Sections
  console.log('\nMapping Groups to Sections...');

  await prisma.sectionGroupMapping.deleteMany({
    where: {
      OR: [
        { courseSectionId: sectionA.id },
        { courseSectionId: sectionB.id },
      ],
    },
  });

  await prisma.sectionGroupMapping.create({
    data: { courseSectionId: sectionA.id, studentGroupId: groupA.id },
  });
  console.log('  Group A -> Section A');

  await prisma.sectionGroupMapping.create({
    data: { courseSectionId: sectionB.id, studentGroupId: groupB.id },
  });
  console.log('  Group B -> Section B');

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SEED COMPLETE!');
  console.log('='.repeat(60));
  console.log('College:    ' + college.name + ' (ID: ' + college.id + ')');
  console.log('Department: ' + department.name + ' (ID: ' + department.id + ')');
  console.log('Course:     ' + course.name + ' (ID: ' + course.id + ')');
  console.log('Doctor:     ID ' + doctor.id);
  console.log('Students:   ' + createdStudents.length + ' total');
  console.log('Section A:  ID ' + sectionA.id + ' -> ' + groupAStudents.length + ' students (Group A)');
  console.log('Section B:  ID ' + sectionB.id + ' -> ' + groupBStudents.length + ' students (Group B)');
  console.log('='.repeat(60));
  console.log('Student Login Credentials:');
  console.log('  Email: it.2024.XXX@it.university.edu');
  console.log('  Password: Student@1234');
  console.log('='.repeat(60));
  console.log('Next Steps in the App:');
  console.log('  1. Go to Sections Management');
  console.log('  2. Select department: ' + department.name);
  console.log('  3. Select course: ' + course.name);
  console.log('  4. You should see: Section A and Section B');
  console.log('  5. Use "Manage Groups" to see the group-section mappings');
  console.log('='.repeat(60));
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
