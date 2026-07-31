import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const created = await prisma.examQuestion.create({
    data: {
      examId: 10,
      text: 'Test Question',
      type: 'MCQ',
      optionA: 'Opt A',
      optionB: 'Opt B',
      optionC: 'Opt C',
      optionD: 'Opt D',
      correctAnswer: 'D',
      points: 1,
      order: 1
    }
  });
  console.log('Created:', created);
}

main().finally(() => prisma.$disconnect());
