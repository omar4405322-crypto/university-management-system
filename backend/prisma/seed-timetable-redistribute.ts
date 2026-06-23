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

const daysOfWeek = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday'];

// Shift days for Semester 2: Sat->Mon, Sun->Tue, Mon->Wed, Tue->Thu, Wed->Thu
const shiftDay = (day: string): string => {
  switch (day) {
    case 'Saturday': return 'Monday';
    case 'Sunday': return 'Tuesday';
    case 'Monday': return 'Wednesday';
    case 'Tuesday': return 'Thursday';
    case 'Wednesday': return 'Thursday';
    default: return day;
  }
};

// Odd departments rooms
const getOddRoom = (courseName: string, index: number): string => {
  if (
    courseName.includes('معمل') ||
    courseName.includes('مختبر') ||
    courseName.includes('مقدمة في المختبرات')
  ) {
    return 'معمل 1';
  }
  if (index === 0 || index === 2) {
    return 'قاعة A1';
  } else {
    return 'قاعة B1';
  }
};

// Even departments rooms
const getEvenRoom = (courseName: string, index: number): string => {
  if (
    courseName.includes('معمل') ||
    courseName.includes('مختبر') ||
    courseName.includes('مقدمة في المختبرات')
  ) {
    return 'معمل 2';
  }
  if (index === 0 || index === 2) {
    return 'قاعة A2';
  } else {
    return 'معمل 2';
  }
};

async function main() {
  console.log('--- STARTING UPGRADED REDISTRIBUTED TIMETABLE SEED (SEM 1 & SEM 2) ---');

  // Delete all existing schedule entries
  console.log('Deleting all existing schedule entries...');
  const deleteResult = await prisma.schedule.deleteMany({});
  console.log(`Deleted ${deleteResult.count} existing schedule entries.`);

  const doctorsList = await prisma.doctor.findMany({
    select: { id: true, firstName: true, lastName: true }
  });

  let scheduleCreatedCount = 0;
  let scheduleSkippedCount = 0;

  // Let's loop through the 5 days to assign slots for all 10 departments
  for (let d = 0; d < 5; d++) {
    const day = daysOfWeek[d];
    const oddDeptId = 2 * d + 1;
    const evenDeptId = 2 * d + 2;

    // Fetch odd department
    const oddDept = await prisma.department.findUnique({ where: { id: oddDeptId } });
    // Fetch even department
    const evenDept = await prisma.department.findUnique({ where: { id: evenDeptId } });

    if (!oddDept || !evenDept) {
      console.error(`Error: Department ${oddDeptId} or ${evenDeptId} not found.`);
      continue;
    }

    // Fetch Sem 1 courses for both departments (Year 1)
    const oddSem1Courses = await prisma.course.findMany({
      where: { departmentId: oddDeptId, year: 1, semester: 1 },
      orderBy: { id: 'asc' },
      take: 4
    });
    const evenSem1Courses = await prisma.course.findMany({
      where: { departmentId: evenDeptId, year: 1, semester: 1 },
      orderBy: { id: 'asc' },
      take: 4
    });

    // Update Doctor assignments for Semester 1 courses to guarantee no conflict
    const oddDoctorIds = [7, 8, 9, 10];
    for (let i = 0; i < oddSem1Courses.length; i++) {
      const course = oddSem1Courses[i];
      const targetDocId = oddDoctorIds[i];
      await prisma.course.update({
        where: { id: course.id },
        data: { doctorId: targetDocId }
      });
      course.doctorId = targetDocId;
    }

    const evenDoctorIds = [7, 8, 9, 10];
    for (let i = 0; i < evenSem1Courses.length; i++) {
      const course = evenSem1Courses[i];
      const targetDocId = evenDoctorIds[i];
      await prisma.course.update({
        where: { id: course.id },
        data: { doctorId: targetDocId }
      });
      course.doctorId = targetDocId;
    }

    // Duplicate courses for Semester 2
    const oddSem2Courses: any[] = [];
    const evenSem2Courses: any[] = [];

    console.log(`Duplicating courses for Semester 2: Dept ${oddDeptId} and ${evenDeptId}...`);

    for (const course of oddSem1Courses) {
      const sem2Code = `${course.courseCode}-S2`;
      const sem2Course = await prisma.course.upsert({
        where: { courseCode: sem2Code },
        update: {
          name: course.name,
          departmentId: course.departmentId,
          year: course.year,
          semester: 2,
          doctorId: course.doctorId,
          credits: course.credits
        },
        create: {
          courseCode: sem2Code,
          name: course.name,
          departmentId: course.departmentId!,
          year: course.year,
          semester: 2,
          doctorId: course.doctorId,
          credits: course.credits
        }
      });
      oddSem2Courses.push(sem2Course);
    }

    for (const course of evenSem1Courses) {
      const sem2Code = `${course.courseCode}-S2`;
      const sem2Course = await prisma.course.upsert({
        where: { courseCode: sem2Code },
        update: {
          name: course.name,
          departmentId: course.departmentId,
          year: course.year,
          semester: 2,
          doctorId: course.doctorId,
          credits: course.credits
        },
        create: {
          courseCode: sem2Code,
          name: course.name,
          departmentId: course.departmentId!,
          year: course.year,
          semester: 2,
          doctorId: course.doctorId,
          credits: course.credits
        }
      });
      evenSem2Courses.push(sem2Course);
    }

    // Helper to format slots array for JSON column
    const formatTimetableJsonSlots = (coursesList: any[], isEven: boolean, forSemester2: boolean) => {
      return coursesList.map((course, i) => {
        let startTime = '';
        let endTime = '';
        let room = '';
        
        if (!isEven) {
          startTime = i < 2 ? '08:00' : '10:00';
          endTime = i < 2 ? '10:00' : '12:00';
          room = getOddRoom(course.name, i);
        } else {
          startTime = i < 2 ? '10:00' : '08:00';
          endTime = i < 2 ? '12:00' : '10:00';
          room = getEvenRoom(course.name, i);
        }

        let doctorName = 'غير معين';
        if (course.doctorId) {
          const doc = doctorsList.find(d => d.id === course.doctorId);
          if (doc) doctorName = `${doc.firstName} ${doc.lastName}`;
        }

        return {
          day: forSemester2 ? shiftDay(day) : day,
          startTime,
          endTime,
          courseName: course.name,
          instructor: doctorName,
          room,
          sessionType: 'LECTURE'
        };
      });
    };

    // --- TIMETABLES SEEDING ---
    // Semester 1 Timetables
    await prisma.timetable.upsert({
      where: {
        collegeId_departmentId_academicYear_semester: {
          collegeId: oddDept.collegeId,
          departmentId: oddDeptId,
          academicYear: 1,
          semester: 1
        }
      },
      update: {
        title: `جدول ${arabicDeptNames[oddDeptId]} - السنة الأولى - الفصل الأول`,
        status: 'PUBLISHED',
        scheduleData: { slots: formatTimetableJsonSlots(oddSem1Courses, false, false) }
      },
      create: {
        collegeId: oddDept.collegeId,
        departmentId: oddDeptId,
        academicYear: 1,
        semester: 1,
        title: `جدول ${arabicDeptNames[oddDeptId]} - السنة الأولى - الفصل الأول`,
        status: 'PUBLISHED',
        scheduleData: { slots: formatTimetableJsonSlots(oddSem1Courses, false, false) }
      }
    });

    await prisma.timetable.upsert({
      where: {
        collegeId_departmentId_academicYear_semester: {
          collegeId: evenDept.collegeId,
          departmentId: evenDeptId,
          academicYear: 1,
          semester: 1
        }
      },
      update: {
        title: `جدول ${arabicDeptNames[evenDeptId]} - السنة الأولى - الفصل الأول`,
        status: 'PUBLISHED',
        scheduleData: { slots: formatTimetableJsonSlots(evenSem1Courses, true, false) }
      },
      create: {
        collegeId: evenDept.collegeId,
        departmentId: evenDeptId,
        academicYear: 1,
        semester: 1,
        title: `جدول ${arabicDeptNames[evenDeptId]} - السنة الأولى - الفصل الأول`,
        status: 'PUBLISHED',
        scheduleData: { slots: formatTimetableJsonSlots(evenSem1Courses, true, false) }
      }
    });

    // Semester 2 Timetables
    await prisma.timetable.upsert({
      where: {
        collegeId_departmentId_academicYear_semester: {
          collegeId: oddDept.collegeId,
          departmentId: oddDeptId,
          academicYear: 1,
          semester: 2
        }
      },
      update: {
        title: `جدول ${arabicDeptNames[oddDeptId]} - السنة الأولى - الفصل الثاني`,
        status: 'PUBLISHED',
        scheduleData: { slots: formatTimetableJsonSlots(oddSem2Courses, false, true) }
      },
      create: {
        collegeId: oddDept.collegeId,
        departmentId: oddDeptId,
        academicYear: 1,
        semester: 2,
        title: `جدول ${arabicDeptNames[oddDeptId]} - السنة الأولى - الفصل الثاني`,
        status: 'PUBLISHED',
        scheduleData: { slots: formatTimetableJsonSlots(oddSem2Courses, false, true) }
      }
    });

    await prisma.timetable.upsert({
      where: {
        collegeId_departmentId_academicYear_semester: {
          collegeId: evenDept.collegeId,
          departmentId: evenDeptId,
          academicYear: 1,
          semester: 2
        }
      },
      update: {
        title: `جدول ${arabicDeptNames[evenDeptId]} - السنة الأولى - الفصل الثاني`,
        status: 'PUBLISHED',
        scheduleData: { slots: formatTimetableJsonSlots(evenSem2Courses, true, true) }
      },
      create: {
        collegeId: evenDept.collegeId,
        departmentId: evenDeptId,
        academicYear: 1,
        semester: 2,
        title: `جدول ${arabicDeptNames[evenDeptId]} - السنة الأولى - الفصل الثاني`,
        status: 'PUBLISHED',
        scheduleData: { slots: formatTimetableJsonSlots(evenSem2Courses, true, true) }
      }
    });

    // --- SCHEDULES SEEDING ---
    // Semester 1 schedule configs
    const oddSem1Schedules = [
      { course: oddSem1Courses[0], slot: { startTime: '08:00', endTime: '10:00' }, roomIndex: 0, day },
      { course: oddSem1Courses[1], slot: { startTime: '08:00', endTime: '10:00' }, roomIndex: 1, day },
      { course: oddSem1Courses[2], slot: { startTime: '10:00', endTime: '12:00' }, roomIndex: 2, day },
      { course: oddSem1Courses[3], slot: { startTime: '10:00', endTime: '12:00' }, roomIndex: 3, day }
    ];

    const evenSem1Schedules = [
      { course: evenSem1Courses[2], slot: { startTime: '08:00', endTime: '10:00' }, roomIndex: 2, day },
      { course: evenSem1Courses[3], slot: { startTime: '08:00', endTime: '10:00' }, roomIndex: 3, day },
      { course: evenSem1Courses[0], slot: { startTime: '10:00', endTime: '12:00' }, roomIndex: 0, day },
      { course: evenSem1Courses[1], slot: { startTime: '10:00', endTime: '12:00' }, roomIndex: 1, day }
    ];

    // Semester 2 schedule configs (with shifted days)
    const sem2Day = shiftDay(day);
    const oddSem2Schedules = [
      { course: oddSem2Courses[0], slot: { startTime: '08:00', endTime: '10:00' }, roomIndex: 0, day: sem2Day },
      { course: oddSem2Courses[1], slot: { startTime: '08:00', endTime: '10:00' }, roomIndex: 1, day: sem2Day },
      { course: oddSem2Courses[2], slot: { startTime: '10:00', endTime: '12:00' }, roomIndex: 2, day: sem2Day },
      { course: oddSem2Courses[3], slot: { startTime: '10:00', endTime: '12:00' }, roomIndex: 3, day: sem2Day }
    ];

    const evenSem2Schedules = [
      { course: evenSem2Courses[2], slot: { startTime: '08:00', endTime: '10:00' }, roomIndex: 2, day: sem2Day },
      { course: evenSem2Courses[3], slot: { startTime: '08:00', endTime: '10:00' }, roomIndex: 3, day: sem2Day },
      { course: evenSem2Courses[0], slot: { startTime: '10:00', endTime: '12:00' }, roomIndex: 0, day: sem2Day },
      { course: evenSem2Courses[1], slot: { startTime: '10:00', endTime: '12:00' }, roomIndex: 1, day: sem2Day }
    ];

    const allDaySchedules = [
      ...oddSem1Schedules,
      ...evenSem1Schedules,
      ...oddSem2Schedules,
      ...evenSem2Schedules
    ];

    // Create DB Schedules with pre-check conflict detection
    for (const item of allDaySchedules) {
      const course = item.course;
      if (!course) continue;

      const slot = item.slot;
      const isOdd = course.departmentId === oddDeptId;
      const room = isOdd ? getOddRoom(course.name, item.roomIndex) : getEvenRoom(course.name, item.roomIndex);

      // Pre-check inside seed script itself before creating each schedule entry
      const doctorConflict = await prisma.schedule.findFirst({
        where: {
          dayOfWeek: item.day,
          startTime: slot.startTime,
          course: {
            doctorId: course.doctorId,
            semester: course.semester
          }
        }
      });

      if (doctorConflict) {
        console.log(`[WARNING] Bypassing schedule for "${course.name}" (Sem ${course.semester}) on ${item.day} ${slot.startTime} due to Doctor ${course.doctorId} conflict`);
        scheduleSkippedCount++;
        continue;
      }

      await prisma.schedule.create({
        data: {
          courseId: course.id,
          dayOfWeek: item.day,
          startTime: slot.startTime,
          endTime: slot.endTime,
          room
        }
      });
      scheduleCreatedCount++;
    }
  }

  console.log('\n--- UPGRADED REDISTRIBUTED SEED COMPLETE ---');
  console.log(`Schedules Created: ${scheduleCreatedCount}`);
  console.log(`Schedules Skipped (conflict prevented): ${scheduleSkippedCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
