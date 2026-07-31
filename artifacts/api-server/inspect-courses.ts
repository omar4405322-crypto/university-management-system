import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const prisma = new PrismaClient();

async function main() {
  const courses = await prisma.course.findMany({
    include: {
      department: true,
      scheduleSlots: { include: { doctor: true } },
      enrollments: true,
      _count: { select: { enrollments: true } }
    }
  });

  console.log(`Total Courses in DB: ${courses.length}`);
  for (const c of courses) {
    console.log(`- Course ID: ${c.id}, Code: ${c.courseCode}, Name: ${c.name}, DeptId: ${c.departmentId} (${c.department?.name})`);
    console.log(`  ScheduleSlots: ${c.scheduleSlots.length}`);
    for (const s of c.scheduleSlots) {
      console.log(`    * Slot Doctor: ${s.doctor?.firstName} ${s.doctor?.lastName} (DocID: ${s.doctorId})`);
    }
    console.log(`  Enrollments count: ${c._count.enrollments}`);
  }

  const students = await prisma.student.findMany({ select: { id: true, firstName: true, departmentId: true } });
  console.log('\nStudents Dept Distribution:');
  students.forEach(st => console.log(`- Student: ${st.firstName}, DeptId: ${st.departmentId}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
