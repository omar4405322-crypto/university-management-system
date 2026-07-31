import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const prisma = new PrismaClient();

async function main() {
  console.log('Enrolling 10 students into their respective department courses...');

  const students = await prisma.student.findMany({
    select: { id: true, firstName: true, departmentId: true }
  });

  let createdCount = 0;
  for (const student of students) {
    if (!student.departmentId) continue;

    const deptCourses = await prisma.course.findMany({
      where: { departmentId: student.departmentId },
      select: { id: true, name: true }
    });

    for (const course of deptCourses) {
      const existing = await prisma.enrollment.findFirst({
        where: { studentId: student.id, courseId: course.id }
      });

      if (!existing) {
        await prisma.enrollment.create({
          data: {
            studentId: student.id,
            courseId: course.id,
            status: 'ENROLLED',
            semester: 1,
            academicYear: 2026
          }
        });
        createdCount++;
      }
    }
  }

  console.log(`Successfully created ${createdCount} active student enrollments.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
