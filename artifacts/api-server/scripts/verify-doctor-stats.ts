import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const prisma = new PrismaClient();

async function main() {
  const yussefDoctor = await prisma.doctor.findFirst({
    where: { user: { email: 'yussef@university.com' } },
    include: { scheduleSlots: true }
  });

  if (!yussefDoctor) {
    console.error('Doctor Yussef not found!');
    return;
  }

  const doctor = yussefDoctor;
  const myScheduleSlots = doctor.scheduleSlots;

  const uniqueCourses = new Map();
  myScheduleSlots.forEach((slot: any) => {
    if (slot.courseId) {
      uniqueCourses.set(slot.courseId, slot.courseId);
    }
  });
  const myCoursesCount = uniqueCourses.size;

  const courseIds = Array.from(uniqueCourses.keys());

  const [totalQuizzes, pendingTasks, totalStudents] = await Promise.all([
    prisma.quiz.count({ where: { doctorId: doctor.id } }),
    prisma.taskSubmission.count({ where: { score: null, task: { doctorId: doctor.id } } }),
    prisma.student.count({
      where: doctor.departmentId
        ? {
            OR: [
              { enrollments: { some: { courseId: { in: courseIds } } } },
              { departmentId: doctor.departmentId },
            ],
          }
        : { enrollments: { some: { courseId: { in: courseIds } } } },
    }),
  ]);

  console.log(`Doctor Yussef (${doctor.firstName} ${doctor.lastName}):`);
  console.log(`- myCourses count: ${myCoursesCount}`);
  console.log(`- totalStudents count: ${totalStudents}`);
  console.log(`- totalQuizzes count: ${totalQuizzes}`);
  console.log(`- pendingTasks count: ${pendingTasks}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
