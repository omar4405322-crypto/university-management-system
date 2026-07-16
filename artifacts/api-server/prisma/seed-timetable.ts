import {  PrismaClient  } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting timetable seed...');

  // 1. Find the Mechatronics Department
  let department = await prisma.department.findFirst({
    where: { name: { contains: 'Mechatronics', mode: 'insensitive' } },
    include: { college: true }
  });

  if (!department) {
    console.log('Mechatronics department not found! Creating a default one...');
    const college = await prisma.college.findFirst() || await prisma.college.create({
      data: { name: 'Engineering', nameAr: 'الهندسة' }
    });
    department = await prisma.department.create({
      data: {
        name: 'Mechatronics Engineering',
        nameAr: 'هندسة الميكاترونكس',
        collegeId: college.id
      },
      include: { college: true }
    });
  }
  
  const collegeId = department.collegeId;
  console.log(`Using Department: ${department.name} (ID: ${department.id})`);

  // 2. COURSES
  const courseData = [
    { code: "MCT101", name: "Introduction to Mechatronics", nameAr: "مقدمة في الميكاترونكس" },
    { code: "MCT102", name: "Engineering Mathematics", nameAr: "رياضيات هندسية" },
    { code: "MCT103", name: "Physics for Engineers", nameAr: "فيزياء للمهندسين" },
    { code: "MCT104", name: "Programming Fundamentals", nameAr: "أساسيات البرمجة" },
    { code: "MCT105", name: "Technical Drawing", nameAr: "رسم هندسي" }
  ];

  const courses = {};
  for (const c of courseData) {
    const course = await prisma.course.upsert({
      where: { courseCode: c.code },
      update: { departmentId: department.id, year: 1, semester: 1 },
      create: {
        courseCode: c.code,
        name: c.name,
        departmentId: department.id,
        year: 1,
        semester: 1,
        credits: 3
      }
    });
    courses[c.code] = course;
  }
  console.log('Courses seeded.');

  // 3. DOCTORS
  const doctorData = [
    { firstName: "Ahmed", lastName: "Hassan", email: "ahmed.hassan@university.edu" },
    { firstName: "Sara", lastName: "Mohamed", email: "sara.mohamed@university.edu" },
    { firstName: "Omar", lastName: "Ali", email: "omar.ali@university.edu" }
  ];

  const hashedPassword = await bcrypt.hash("Doctor@123", 10);
  const doctors = {};

  for (const [index, d] of doctorData.entries()) {
    let user = await prisma.user.findUnique({ where: { email: d.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: d.email,
          password: hashedPassword,
          role: "DOCTOR"
        }
      });
    }

    const doctorIdStr = `DOC-MCT-${index + 1}`;
    let doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });
    if (!doctor) {
      doctor = await prisma.doctor.create({
        data: {
          userId: user.id,
          firstName: d.firstName,
          lastName: d.lastName,
          doctorId: doctorIdStr,
          departmentId: department.id
        }
      });
    } else {
      doctor = await prisma.doctor.update({
        where: { id: doctor.id },
        data: { departmentId: department.id }
      });
    }
    doctors[d.firstName] = doctor;
  }
  console.log('Doctors seeded.');

  // Assign doctors to courses (for the "default instructor" relation)
  await prisma.course.update({ where: { id: courses["MCT101"].id }, data: { doctorId: doctors["Ahmed"].id } });
  await prisma.course.update({ where: { id: courses["MCT102"].id }, data: { doctorId: doctors["Sara"].id } });
  await prisma.course.update({ where: { id: courses["MCT103"].id }, data: { doctorId: doctors["Omar"].id } });
  await prisma.course.update({ where: { id: courses["MCT104"].id }, data: { doctorId: doctors["Ahmed"].id } });
  await prisma.course.update({ where: { id: courses["MCT105"].id }, data: { doctorId: doctors["Sara"].id } });

  // 4. TIMETABLE RECORD (JSON structure for frontend)
  const scheduleSlots = [
    // Sunday
    { day: "Sunday", startTime: "08:00", endTime: "10:00", courseName: "Introduction to Mechatronics", instructor: "Ahmed Hassan", room: "A101", slotType: "LECTURE" },
    { day: "Sunday", startTime: "10:00", endTime: "12:00", courseName: "Engineering Mathematics", instructor: "Sara Mohamed", room: "B201", slotType: "LECTURE" },
    { day: "Sunday", startTime: "12:00", endTime: "14:00", courseName: "Physics for Engineers", instructor: "Omar Ali", room: "A102", slotType: "LECTURE" },
    // Monday
    { day: "Monday", startTime: "08:00", endTime: "10:00", courseName: "Programming Fundamentals", instructor: "Ahmed Hassan", room: "Lab1", slotType: "LAB" },
    { day: "Monday", startTime: "10:00", endTime: "12:00", courseName: "Technical Drawing", instructor: "Sara Mohamed", room: "C301", slotType: "LAB" },
    { day: "Monday", startTime: "14:00", endTime: "16:00", courseName: "Introduction to Mechatronics", instructor: "Omar Ali", room: "A101", slotType: "SECTION" },
    // Tuesday
    { day: "Tuesday", startTime: "08:00", endTime: "10:00", courseName: "Engineering Mathematics", instructor: "Ahmed Hassan", room: "B201", slotType: "LECTURE" },
    { day: "Tuesday", startTime: "10:00", endTime: "12:00", courseName: "Physics for Engineers", instructor: "Sara Mohamed", room: "A102", slotType: "LECTURE" },
    // Wednesday
    { day: "Wednesday", startTime: "08:00", endTime: "10:00", courseName: "Programming Fundamentals", instructor: "Omar Ali", room: "Lab1", slotType: "LAB" },
    { day: "Wednesday", startTime: "12:00", endTime: "14:00", courseName: "Technical Drawing", instructor: "Ahmed Hassan", room: "C301", slotType: "LAB" },
    // Thursday
    { day: "Thursday", startTime: "08:00", endTime: "10:00", courseName: "Introduction to Mechatronics", instructor: "Sara Mohamed", room: "A101", slotType: "LECTURE" },
    { day: "Thursday", startTime: "14:00", endTime: "16:00", courseName: "Physics for Engineers", instructor: "Omar Ali", room: "A102", slotType: "LECTURE" }
  ];

  // Map to the course codes for actual DB Schedule records
  const courseNameMap = {
    "Introduction to Mechatronics": "MCT101",
    "Engineering Mathematics": "MCT102",
    "Physics for Engineers": "MCT103",
    "Programming Fundamentals": "MCT104",
    "Technical Drawing": "MCT105"
  };

  // Upsert Timetable
  const timetable = await prisma.timetable.upsert({
    where: {
      collegeId_departmentId_academicYear_semester: {
        collegeId: collegeId,
        departmentId: department.id,
        academicYear: 1,
        semester: 1
      }
    },
    update: {
      title: "جدول الميكاترونكس - السنة الأولى - الفصل الأول",
      status: "PUBLISHED",
      scheduleData: { slots: scheduleSlots }
    },
    create: {
      collegeId: collegeId,
      departmentId: department.id,
      academicYear: 1,
      semester: 1,
      title: "جدول الميكاترونكس - السنة الأولى - الفصل الأول",
      status: "PUBLISHED",
      scheduleData: { slots: scheduleSlots }
    }
  });

  console.log(`Timetable upserted: ${timetable.title}`);

  // 5. Create Schedule Records (clear old ones for these courses first to avoid massive dupes)
  const courseIds = Object.values(courses).map(c => c.id);
  await prisma.schedule.deleteMany({
    where: { courseId: { in: courseIds } }
  });

  for (const slot of scheduleSlots) {
    const courseCode = courseNameMap[slot.courseName];
    const course = courses[courseCode];
    if (course) {
      await prisma.schedule.create({
        data: {
          courseId: course.id,
          dayOfWeek: slot.day,
          startTime: slot.startTime,
          endTime: slot.endTime,
          room: slot.room
        }
      });
    }
  }
  
  console.log('Schedule records created successfully!');
  console.log('--- SEED COMPLETED ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
