import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const prisma = new PrismaClient();

async function main() {
  const students = await prisma.student.findMany({
    include: { user: true },
    take: 10
  });
  console.log('First 10 students:');
  console.log(JSON.stringify(students, null, 2));

  const countWithUser = await prisma.student.count({
    where: { user: { isNot: null } }
  });
  console.log(`\nStudents with User account: ${countWithUser}`);

  const counts = await prisma.student.count();
  console.log(`Total students: ${counts}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
