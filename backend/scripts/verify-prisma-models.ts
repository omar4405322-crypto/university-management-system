require('dotenv').config();
import {  PrismaClient  } from '@prisma/client';

const prisma = new PrismaClient();

const checks = [
  () => prisma.exam.findMany({ take: 1 }),
  () => prisma.schedule.findMany({ take: 1 }),
  () => prisma.student.findMany({ take: 1 }),
  () => prisma.course.findMany({ take: 1 }),
  () => prisma.registrationRequest.findMany({ take: 1 }),
  () => prisma.timetable.findMany({ take: 1 }),
];

async function main() {
  for (const run of checks) {
    const name = run.toString().match(/prisma\.(\w+)/)?.[1] || 'query';
    try {
      await run();
      console.log(`OK  ${name}`);
    } catch (err) {
      console.log(`FAIL ${name}:`, err.message);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
