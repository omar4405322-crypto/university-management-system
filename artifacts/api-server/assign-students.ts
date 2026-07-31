import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const prisma = new PrismaClient();

async function main() {
  console.log('Reconciling student department assignments...');

  const departments = await prisma.department.findMany({ select: { id: true, name: true } });
  if (departments.length === 0) {
    console.error('No departments found!');
    return;
  }

  const unassignedStudents = await prisma.student.findMany({
    where: { departmentId: null },
    select: { id: true }
  });

  console.log(`Found ${unassignedStudents.length} students with null departmentId.`);

  let updated = 0;
  for (let i = 0; i < unassignedStudents.length; i++) {
    const targetDept = departments[i % departments.length];
    await prisma.student.update({
      where: { id: unassignedStudents[i].id },
      data: { departmentId: targetDept.id }
    });
    updated++;
  }

  console.log(`Successfully assigned ${updated} students across ${departments.length} departments.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
