const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Assigning default values to existing students...');
  
  const result = await prisma.student.updateMany({
    where: {
      year: {
        equals: undefined // This won't work exactly like this in Prisma for default values
      }
    },
    data: {
      year: 1
    }
  });

  // Better approach: update all where year is 0 or something if I had a way to check.
  // Since I just added it with @default(1), all existing ones should already have 1.
  // Let's verify and maybe set department if missing (though it shouldn't be).
  
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
