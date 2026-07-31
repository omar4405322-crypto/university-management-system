import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const subs = await prisma.examSubmission.findMany({
    orderBy: { id: 'desc' },
    select: {
      id: true,
      examId: true,
      studentId: true,
      status: true,
      score: true,
      maxScore: true,
      answers: true,
      submittedAt: true,
    }
  });
  console.dir(subs, { depth: null });
}

main().finally(() => prisma.$disconnect());
