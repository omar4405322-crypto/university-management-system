import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const studentsWithoutGroup = await prisma.student.count({ where: { studentGroupId: null } });
  console.log(`Students without StudentGroup: ${studentsWithoutGroup}`);
  
  const scheduleSlotsCount = await prisma.scheduleSlot.count();
  console.log(`Total ScheduleSlots: ${scheduleSlotsCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
