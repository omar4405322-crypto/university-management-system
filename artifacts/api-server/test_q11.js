import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const qs = await prisma.examQuestion.findMany({
    where: { examId: 11 },
    orderBy: { id: 'asc' }
  });
  console.dir(qs, { depth: null });
}

main().finally(() => prisma.$disconnect());
