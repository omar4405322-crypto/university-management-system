import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const courses = await prisma.course.findMany({ include: { sections: true } });
  const orphanedCourses = courses.filter(c => c.sections.length === 0);
  console.log('Orphaned courses:', orphanedCourses.length);

  const sections = await prisma.courseSection.findMany({ include: { doctor: true, scheduleSlots: true } });
  const invalidDoctors = sections.filter(s => !s.doctorId);
  console.log('Sections without doctor:', invalidDoctors.length);
  
  const schedules = await prisma.scheduleSlot.findMany();
  console.log('Total ScheduleSlots mapped:', schedules.length);

  const studentGroups = await prisma.studentGroup.findMany({ include: { students: true } });
  console.log('Total StudentGroups created:', studentGroups.length);
  const studentsInGroups = studentGroups.reduce((acc, g) => acc + g.students.length, 0);
  console.log('Total students mapped to groups:', studentsInGroups);
  
  const allStudents = await prisma.student.count();
  console.log('Total students in DB:', allStudents);
}

check().then(() => process.exit(0)).catch(console.error);
