import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: 'yussef', mode: 'insensitive' } },
        { doctor: { firstName: { contains: 'yussef', mode: 'insensitive' } } },
        { doctor: { lastName: { contains: 'yussef', mode: 'insensitive' } } }
      ]
    },
    include: {
      doctor: {
        include: {
          department: true,
          scheduleSlots: {
            include: { course: true }
          },
          quizzes: true,
          tasks: true
        }
      }
    }
  });

  console.log('User/Doctor Yussef Search Results:');
  console.log(JSON.stringify(users, null, 2));

  const allDoctors = await prisma.doctor.findMany({
    include: {
      user: { select: { email: true, role: true } },
      department: true,
      scheduleSlots: { include: { course: true } }
    }
  });

  console.log('\nAll Doctors in DB:');
  for (const doc of allDoctors) {
    console.log(`- Doctor ID: ${doc.id}, Name: ${doc.firstName} ${doc.lastName}, Email: ${doc.user?.email}, Dept: ${doc.department?.name || 'NONE'}`);
    console.log(`  ScheduleSlots Count: ${doc.scheduleSlots.length}`);
    for (const slot of doc.scheduleSlots) {
      console.log(`    * Slot ID: ${slot.id}, Course: ${slot.course?.name} (${slot.course?.courseCode})`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
