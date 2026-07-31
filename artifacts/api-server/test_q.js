import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const q = await prisma.examQuestion.findUnique({
    where: { id: 16 }
  });
  console.log(q);
}

main().finally(() => prisma.$disconnect());
