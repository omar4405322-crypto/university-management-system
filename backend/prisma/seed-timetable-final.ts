import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const arabicDeptNames: Record<number, string> = {
  1: 'تكنولوجيا المعلومات والاتصالات',
  2: 'هندسة الميكاترونكس',
  3: 'الطاقة المتجددة',
  4: 'التمريض',
  5: 'المختبرات الطبية',
  6: 'تكنولوجيا السكك الحديدية',
  7: 'تكنولوجيا السيارات',
  8: 'خدمات الطوارئ الطبية',
  9: 'الأطراف الصناعية والأجهزة التعويضية',
  10: 'الأشعة'
};

const deptCodePrefixes: Record<number, string> = {
  3: 'REE',
  4: 'NUR',
  5: 'MDL',
  6: 'RWY',
  7: 'AUT',
  8: 'EMS',
  9: 'PRO',
  10: 'RAD'
};

const deptNewCourses: Record<number, string[]> = {
  3: ["أساسيات الطاقة المتجددة", "الفيزياء التطبيقية", "الرياضيات الهندسية", "مقدمة في الطاقة الشمسية"],
  4: ["أساسيات التمريض", "علم التشريح", "الكيمياء الحيوية", "مهارات التواصل الطبي"],
  5: ["مقدمة في المختبرات الطبية", "الميكروبيولوجيا", "الكيمياء التحليلية", "أساسيات الدم"],
  6: ["أساسيات تكنولوجيا السكك الحديدية", "الميكانيكا التطبيقية", "الكهرباء والإلكترونيات", "السلامة في السكك الحديدية"],
  7: ["أساسيات السيارات", "محركات الاحتراق", "الأنظمة الكهربائية للسيارات", "صيانة السيارات"],
  8: ["الإسعافات الأولية", "طب الطوارئ", "التمريض الطارئ", "إدارة الأزمات الطبية"],
  9: ["مقدمة في الأطراف الاصطناعية", "علم الحركة", "مواد الأطراف الاصطناعية", "إعادة التأهيل"],
  10: ["أساسيات الأشعة", "التصوير الطبي", "السلامة الإشعاعية", "تحليل الصور الطبية"]
};

const slots = [
  { dayOfWeek: 'Saturday', startTime: '08:00', endTime: '10:00' },
  { dayOfWeek: 'Saturday', startTime: '10:00', endTime: '12:00' },
  { dayOfWeek: 'Sunday', startTime: '08:00', endTime: '10:00' },
  { dayOfWeek: 'Sunday', startTime: '10:00', endTime: '12:00' }
];

const getRoom = (courseName: string, courseIndex: number): string => {
  if (
    courseName.includes('معمل') ||
    courseName.includes('مختبر') ||
    courseName.includes('مقدمة في المختبرات')
  ) {
    return 'معمل 1';
  }
  // courses 1 & 3 (indexes 0 & 2) use "قاعة A1"
  // courses 2 & 4 (indexes 1 & 3) use "قاعة B1"
  if (courseIndex === 0 || courseIndex === 2) {
    return 'قاعة A1';
  } else {
    return 'قاعة B1';
  }
};

async function main() {
  console.log('--- STARTING TIMETABLE SEED SYSTEM ---');

  // STEP 1 - Assign doctors to courses with null doctorId in department 1
  console.log('\nSTEP 1: Assigning doctors to null doctorId courses...');
  const step1Assignments = [
    { courseName: 'Computer Architecture', doctorId: 10 },
    { courseName: 'Calculus I', doctorId: 8 },
    { courseName: 'English Composition I', doctorId: 9 },
    { courseName: 'Physics for Engineers', doctorId: 7 }
  ];

  for (const assign of step1Assignments) {
    const course = await prisma.course.findFirst({
      where: { name: assign.courseName, departmentId: 1 }
    });
    if (course) {
      await prisma.course.update({
        where: { id: course.id },
        data: { doctorId: assign.doctorId }
      });
      console.log(`Assigned Doctor ${assign.doctorId} to Course: "${assign.courseName}" (ID: ${course.id})`);
    } else {
      console.log(`Warning: Course "${assign.courseName}" not found in Department 1.`);
    }
  }

  // STEP 2 - Create courses for remaining departments (3-10)
  console.log('\nSTEP 2: Creating courses for remaining departments (3-10)...');
  const doctorIds = [7, 8, 9, 10];
  let docIndex = 0;
  let coursesCreatedCount = 0;

  for (const deptIdStr of Object.keys(deptNewCourses)) {
    const deptId = parseInt(deptIdStr);
    const courseNames = deptNewCourses[deptId];
    const prefix = deptCodePrefixes[deptId];

    for (let i = 0; i < courseNames.length; i++) {
      const courseName = courseNames[i];
      const courseCode = `${prefix}10${i + 1}`;
      const doctorId = doctorIds[docIndex % 4];
      docIndex++;

      await prisma.course.upsert({
        where: { courseCode },
        update: {
          name: courseName,
          departmentId: deptId,
          year: 1,
          semester: 1,
          doctorId
        },
        create: {
          courseCode,
          name: courseName,
          departmentId: deptId,
          year: 1,
          semester: 1,
          doctorId,
          credits: 3
        }
      });
      coursesCreatedCount++;
    }
    console.log(`Processed 4 courses for Department ID ${deptId} (prefix: ${prefix}).`);
  }
  console.log(`Total courses created/upserted: ${coursesCreatedCount}`);

  // Fetch doctors list for timetable json formatting
  const doctorsList = await prisma.doctor.findMany({
    select: { id: true, firstName: true, lastName: true }
  });

  // STEP 3 & 4 - Create Timetables and Schedules for all departments except 2
  console.log('\nSTEP 3 & 4: Creating Timetables and Schedules for departments (1, 3-10)...');
  const activeDepartments = [1, 3, 4, 5, 6, 7, 8, 9, 10];
  let timetablesCreatedCount = 0;
  let schedulesCreatedCount = 0;

  for (const deptId of activeDepartments) {
    const dept = await prisma.department.findUnique({
      where: { id: deptId }
    });
    if (!dept) {
      console.log(`Error: Department ID ${deptId} not found.`);
      continue;
    }

    const collegeId = dept.collegeId;
    const deptArabicName = arabicDeptNames[deptId] || dept.name;
    const title = `جدول ${deptArabicName} - السنة الأولى - الفصل الأول`;

    // Fetch the first 4 courses for Year 1, Semester 1 of this department
    const courses = await prisma.course.findMany({
      where: { departmentId: deptId, year: 1, semester: 1 },
      orderBy: { id: 'asc' },
      take: 4
    });

    if (courses.length < 4) {
      console.log(`Warning: Department ID ${deptId} only has ${courses.length} courses. Expected at least 4.`);
    }

    // Format schedule slots for the JSON column
    const scheduleDataSlots = courses.map((course, i) => {
      const slot = slots[i % slots.length];
      const room = getRoom(course.name, i);
      let doctorName = 'غير معين';
      if (course.doctorId) {
        const doc = doctorsList.find(d => d.id === course.doctorId);
        if (doc) doctorName = `${doc.firstName} ${doc.lastName}`;
      }
      return {
        day: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        courseName: course.name,
        instructor: doctorName,
        room,
        sessionType: 'LECTURE'
      };
    });

    // Create / Update Timetable
    const timetable = await prisma.timetable.upsert({
      where: {
        collegeId_departmentId_academicYear_semester: {
          collegeId,
          departmentId: deptId,
          academicYear: 1,
          semester: 1
        }
      },
      update: {
        title,
        status: 'PUBLISHED',
        scheduleData: { slots: scheduleDataSlots }
      },
      create: {
        collegeId,
        departmentId: deptId,
        academicYear: 1,
        semester: 1,
        title,
        status: 'PUBLISHED',
        scheduleData: { slots: scheduleDataSlots }
      }
    });
    timetablesCreatedCount++;

    // Create database Schedule records
    // Clear old schedules first to prevent duplicate entries for these courses
    const courseIds = courses.map(c => c.id);
    await prisma.schedule.deleteMany({
      where: { courseId: { in: courseIds } }
    });

    for (let i = 0; i < courses.length; i++) {
      const course = courses[i];
      const slot = slots[i % slots.length];
      const room = getRoom(course.name, i);

      await prisma.schedule.create({
        data: {
          courseId: course.id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          room
        }
      });
      schedulesCreatedCount++;
    }

    console.log(`Created Timetable and ${courses.length} Schedule entries for Department ID ${deptId} (${dept.name})`);
  }

  console.log('\n--- SEED COMPLETE ---');
  console.log(`Timetables created/updated: ${timetablesCreatedCount}`);
  console.log(`Schedule entries created: ${schedulesCreatedCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
