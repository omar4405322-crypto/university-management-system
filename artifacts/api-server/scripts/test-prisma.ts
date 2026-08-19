import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Connecting to database via Prisma Client...");
  try {
    const colleges = await prisma.college.findMany();
    const tasks = await prisma.task.count();
    console.log(`Connection SUCCESS!`);
    console.log(`Found ${colleges.length} colleges.`);
    console.log(`Found ${tasks} tasks in the database.`);
  } catch (error) {
    console.error("Connection FAILED:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
