import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const q = await prisma.examQuestion.findMany({
    take: 10,
    orderBy: { id: 'desc' },
    select: { id: true, type: true, optionA: true, optionB: true, correctAnswer: true }
  });
  console.log(q);
}

main().finally(() => prisma.$disconnect());
