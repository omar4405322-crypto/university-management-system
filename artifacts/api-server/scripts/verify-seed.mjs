import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const prisma = new PrismaClient();

const admins = await prisma.user.findMany({
  where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
  select: { email: true, role: true },
  take: 5
});
console.log('Admin accounts:', JSON.stringify(admins, null, 2));

// Also show sections data
const sections = await prisma.courseSection.findMany({
  where: { course: { departmentId: 13 } },
  include: {
    course: { select: { name: true, courseCode: true } },
    doctor: { select: { firstName: true, lastName: true } },
    groupMappings: { include: { studentGroup: { include: { students: { select: { id: true, firstName: true, lastName: true } } } } } }
  }
});
console.log('\nSections:', JSON.stringify(sections, null, 2));
await prisma.$disconnect();
