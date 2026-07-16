import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function fix() {
  const orphanedCourses = await prisma.course.findMany({ include: { sections: true }, where: { sections: { none: {} } } });
  if (orphanedCourses.length > 0) {
    const firstDoctor = await prisma.doctor.findFirst();
    if (!firstDoctor) { console.log('No doctor found'); return; }
    for (const course of orphanedCourses) {
      await prisma.courseSection.create({
        data: {
          courseId: course.id,
          name: 'Section A (Default)',
          doctorId: firstDoctor.id
        }
      });
    }
    console.log('Fixed', orphanedCourses.length, 'orphaned courses');
  }
}
fix().then(() => process.exit(0)).catch(console.error);
