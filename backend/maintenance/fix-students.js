const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Assigning default values to existing students...');
  
  const students = await prisma.student.findMany({
    include: { department: true }
  });

  console.log(`Found ${students.length} students.`);
  
  for (const student of students) {
    if (!student.year) {
      await prisma.student.update({
        where: { id: student.id },
        data: { year: 1 }
      });
    }
  }

  console.log('Done.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
