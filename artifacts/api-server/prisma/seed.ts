import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const commonPassword = await bcrypt.hash('Password123!', 10);

  // STEP 1 - Read the current state
  const colleges = await prisma.college.findMany();
  const departments = await prisma.department.findMany();

  console.log(`Found ${colleges.length} Colleges and ${departments.length} Departments. Building on top of them...`);

  let totalStudents = 0;
  let totalDoctors = 0;
  let totalTAs = 0;
  let totalCourses = 0;
  let totalTimetables = 0;
  let totalSections = 0;
  let totalSlots = 0;

  const nameMix = [
    { f: 'Ahmed', l: 'Hassan' },
    { f: 'Sarah', l: 'Smith' },
    { f: 'Mohamed', l: 'Ali' },
    { f: 'Laila', l: 'Johnson' },
    { f: 'Omar', l: 'Farooq' }
  ];

  const docNames = [
    { f: 'Dr. Youssef', l: 'Ibrahim' },
    { f: 'Dr. Emily', l: 'Davis' },
    { f: 'Dr. Tarek', l: 'Nour' }
  ];

  const taNames = [
    { f: 'Kareem', l: 'Mostafa' },
    { f: 'Jessica', l: 'Williams' }
  ];

  for (const dept of departments) {
    console.log(`\n--- Seeding Department: ${dept.name} ---`);

    // STEP 2 - Seed per department

    // 5 Students
    const deptStudents = [];
    for (let i = 0; i < 5; i++) {
      const email = `student${i}.dept${dept.id}@test.com`;
      const sId = `STU-D${dept.id}-2026-00${i}`;
      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, password: commonPassword, role: 'STUDENT' }
      });
      const st = await prisma.student.upsert({
        where: { userId: user.id },
        update: { departmentId: dept.id },
        create: {
          userId: user.id,
          firstName: nameMix[i].f,
          lastName: nameMix[i].l,
          studentId: sId,
          departmentId: dept.id,
          year: 1
        }
      });
      deptStudents.push(st);
      totalStudents++;
    }

    // 3 Doctors
    const deptDoctors = [];
    for (let i = 0; i < 3; i++) {
      const email = `doctor${i}.dept${dept.id}@test.com`;
      const docId = `DOC-D${dept.id}-${i}`;
      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, password: commonPassword, role: 'DOCTOR' }
      });
      const doc = await prisma.doctor.upsert({
        where: { userId: user.id },
        update: { departmentId: dept.id },
        create: {
          userId: user.id,
          firstName: docNames[i].f,
          lastName: docNames[i].l,
          doctorId: docId,
          departmentId: dept.id
        }
      });
      deptDoctors.push(doc);
      totalDoctors++;
    }

    // 2 TAs
    const deptTAs = [];
    const taNames = [
      { f: 'Hassan', l: 'Reda' },
      { f: 'Mona', l: 'Kamal' }
    ];
    for (let i = 0; i < 2; i++) {
      const email = `ta${i}.dept${dept.id}@test.com`;
      const empId = `TA-D${dept.id}-${i}`;
      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, password: commonPassword, role: 'TEACHING_ASSISTANT' }
      });
      const ta = await prisma.teachingAssistant.upsert({
        where: { userId: user.id },
        update: { 
          departmentId: dept.id,
          firstName: taNames[i].f,
          lastName: taNames[i].l
        },
        create: {
          userId: user.id,
          employeeId: empId,
          departmentId: dept.id,
          firstName: taNames[i].f,
          lastName: taNames[i].l
        }
      });
      deptTAs.push(ta);
      totalTAs++;
    }

    // At least 2 Courses
    let courses = await prisma.course.findMany({ where: { departmentId: dept.id } });
    if (courses.length < 2) {
      for (let i = courses.length; i < 2; i++) {
        const courseCode = `CRS-D${dept.id}-10${i}`;
        const c = await prisma.course.upsert({
          where: { courseCode },
          update: {},
          create: {
            courseCode,
            name: `Course ${i} for Dept ${dept.id}`,
            departmentId: dept.id,
            credits: 3,
            year: 1,
            semester: 1
          }
        });
        courses.push(c);
        totalCourses++;
      }
    }

    // STEP 3 - Timetable + Sections + Slots
    // For academic years 1 and 2
    for (const year of [1, 2]) {
      // 1 Timetable
      const timetable = await prisma.timetable.upsert({
        where: {
          collegeId_departmentId_academicYear_semester: {
            collegeId: dept.collegeId,
            departmentId: dept.id,
            academicYear: year,
            semester: 1
          }
        },
        update: { status: 'PUBLISHED' },
        create: {
          collegeId: dept.collegeId,
          departmentId: dept.id,
          academicYear: year,
          semester: 1,
          title: `Year ${year} Sem 1 Timetable`,
          status: 'PUBLISHED'
        }
      });
      totalTimetables++;

      // Filter courses by year
      const yearCourses = courses.filter(c => c.year === year || c.year === 1); // fallback to year 1 courses if none
      
      for (const course of yearCourses) {
        // Create ScheduleSlots directly with courseId, doctorId, groupId, slotType
        const existingSlots = await prisma.scheduleSlot.findMany({
          where: { courseId: course.id, timetableId: timetable.id }
        });

        if (existingSlots.length === 0) {
          // LECTURE
          await prisma.scheduleSlot.create({
            data: {
              courseId: course.id,
              doctorId: deptDoctors[0].id,
              timetableId: timetable.id,
              dayOfWeek: 'MONDAY',
              startTime: '09:00',
              endTime: '11:00',
              room: 'Hall A',
              slotType: 'LECTURE',
              sessionType: 'LECTURE'
            }
          });
          totalSlots++;

          // LAB assigned to TA
          await prisma.scheduleSlot.create({
            data: {
              courseId: course.id,
              doctorId: deptDoctors[0].id,
              timetableId: timetable.id,
              dayOfWeek: 'WEDNESDAY',
              startTime: '10:00',
              endTime: '12:00',
              room: 'Lab 1',
              slotType: 'LAB',
              sessionType: 'LAB',
              teachingAssistantId: deptTAs[0].id
            }
          });
          totalSlots++;
        }
      }

      // 1 StudentGroup per department/year
      const groupName = `Group A (Y${year})`;
      let group = await prisma.studentGroup.findFirst({
        where: { departmentId: dept.id, name: groupName }
      });
      
      if (!group) {
        group = await prisma.studentGroup.create({
          data: {
            name: groupName,
            departmentId: dept.id,
            rangeStartName: deptStudents.length > 0 ? `${deptStudents[0].firstName} ${deptStudents[0].lastName}` : '',
            rangeEndName: deptStudents.length > 0 ? `${deptStudents[deptStudents.length - 1].firstName} ${deptStudents[deptStudents.length - 1].lastName}` : '',
          }
        });
      }

      // Assign all students to Group A
      for (const st of deptStudents) {
        await prisma.student.update({
          where: { id: st.id },
          data: { groupId: group.id }
        });
      }
    }
  }

  // STEP 4 - Verify
  console.log('\n--- VERIFICATION COUNTS ---');
  console.log(`Total Students Seeded/Upserted: ${totalStudents}`);
  console.log(`Total Doctors Seeded/Upserted: ${totalDoctors}`);
  console.log(`Total TAs Seeded/Upserted: ${totalTAs}`);
  console.log(`Total Courses Added: ${totalCourses}`);
  console.log(`Total Timetables Seeded/Upserted: ${totalTimetables}`);
  console.log(`Total ScheduleSlots Added: ${totalSlots}`);
  
  const dbStudents = await prisma.student.count();
  const dbDoctors = await prisma.doctor.count();
  const dbTAs = await prisma.teachingAssistant.count();
  const dbTimetables = await prisma.timetable.count();
  const dbGroups = await prisma.studentGroup.count();
  const dbSlots = await prisma.scheduleSlot.count();

  console.log('\n--- TOTAL DATABASE COUNTS ---');
  console.log(`Students: ${dbStudents}`);
  console.log(`Doctors: ${dbDoctors}`);
  console.log(`Teaching Assistants: ${dbTAs}`);
  console.log(`Timetables: ${dbTimetables}`);
  console.log(`Student Groups: ${dbGroups}`);
  console.log(`Schedule Slots: ${dbSlots}`);
  
  console.log('\n✅ Seeding complete without errors.');
}

main()
  .catch((e) => {
    console.error('❌ SEED ERROR:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
