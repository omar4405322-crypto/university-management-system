const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("--- 1. FIND DEPARTMENT ---");
  const dept = await prisma.department.findFirst({
    where: { name: { contains: 'Mechatronics' } }
  });
  console.log('Mechatronics Dept:', dept);
  
  if (!dept) {
    console.log("Department not found. Exiting.");
    return;
  }

  console.log("\n--- 2. FIND USER ---");
  const user = await prisma.user.findFirst({
    where: { email: { contains: 'omar' } },
    include: { student: true }
  });
  console.log('User:', user?.id, user?.email);
  console.log('Current Student Record:', user?.student);

  console.log("\n--- 3. UPDATE OR CREATE STUDENT ---");
  if (user?.student) {
    const updated = await prisma.student.update({
      where: { id: user.student.id },
      data: { 
        departmentId: dept.id,
        year: 1
      }
    });
    console.log('Updated Student:', updated);
  } else if (user) {
    const created = await prisma.student.create({
      data: {
        userId: user.id,
        studentId: 'STU-' + user.id,
        firstName: 'OMAR',
        lastName: 'STUDENT',
        departmentId: dept.id,
        year: 1
      }
    });
    console.log('Created Student:', created);
  }

  console.log("\n--- 4. CHECK SCHEDULES ---");
  const schedules = await prisma.schedule.findMany({
    where: {
      course: {
        departmentId: dept.id,
        year: 1
      }
    },
    include: { 
      course: true 
    },
    take: 5
  });
  console.log('Sample Schedules for Dept/Year 1:', JSON.stringify(schedules, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
