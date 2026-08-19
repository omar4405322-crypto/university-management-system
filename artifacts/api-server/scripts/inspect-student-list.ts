import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const prisma = new PrismaClient();

async function main() {
  const allStudents = await prisma.student.findMany({
    include: { user: true, department: true }
  });

  console.log(`Total Student Records in DB: ${allStudents.length}`);

  const dummyStudents = allStudents.filter(s => 
    s.user.email.match(/^s\d+@test\.com$/i) ||
    s.user.email === 'mid@test.com' ||
    s.firstName.startsWith('StudentA') ||
    s.firstName.startsWith('StudentB') ||
    s.firstName.startsWith('Student')
  );

  const realStudents = allStudents.filter(s => !dummyStudents.includes(s));

  console.log(`\nDummy/Test Students Count: ${dummyStudents.length}`);
  console.log(`Real Students Count: ${realStudents.length}`);

  console.log('\nReal Students List:');
  for (const s of realStudents) {
    console.log(`- ID: ${s.id}, Name: ${s.firstName} ${s.lastName}, Email: ${s.user.email}, Dept: ${s.department?.name || 'NONE'}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
