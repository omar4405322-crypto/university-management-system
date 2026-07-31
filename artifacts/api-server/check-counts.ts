import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const prisma = new PrismaClient();

async function main() {
  const studentCount = await prisma.student.count();
  const collegeCount = await prisma.college.count();
  const doctorCount = await prisma.doctor.count();
  const paymentCount = await prisma.payment.count();

  console.log('Database Counts:');
  console.log(`- Students: ${studentCount}`);
  console.log(`- Colleges: ${collegeCount}`);
  console.log(`- Doctors: ${doctorCount}`);
  console.log(`- Payments: ${paymentCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
