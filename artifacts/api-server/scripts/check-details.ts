import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const prisma = new PrismaClient();

async function main() {
  const colleges = await prisma.college.findMany({
    include: {
      departments: {
        include: {
          _count: {
            select: { students: true, doctors: true, courses: true }
          }
        }
      }
    }
  });

  console.log('Colleges & Departments:');
  for (const c of colleges) {
    console.log(`Colleges: ${c.name} (ID: ${c.id})`);
    for (const d of c.departments) {
      console.log(`  - Department: ${d.name} (ID: ${d.id})`);
      console.log(`    Students count: ${d._count.students}`);
      console.log(`    Doctors count: ${d._count.doctors}`);
      console.log(`    Courses count: ${d._count.courses}`);
    }
  }

  const roleCounts = await prisma.user.groupBy({
    by: ['role'],
    _count: { _all: true }
  });
  console.log('\nUser Role Counts:');
  console.log(roleCounts);

  const studentCount = await prisma.student.count();
  const studentsWithoutDept = await prisma.student.count({
    where: { departmentId: null }
  });
  const studentsWithDept = await prisma.student.count({
    where: { departmentId: { not: null } }
  });
  console.log(`\nStudent Records:`);
  console.log(`- Total Student records: ${studentCount}`);
  console.log(`- Students with departmentId: ${studentsWithDept}`);
  console.log(`- Students with null departmentId: ${studentsWithoutDept}`);

  // Let's also check if students are assigned to any other college/department that is not listed
  const studentDepts = await prisma.student.groupBy({
    by: ['departmentId'],
    _count: { _all: true }
  });
  console.log('\nStudent counts by departmentId:');
  console.log(studentDepts);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
