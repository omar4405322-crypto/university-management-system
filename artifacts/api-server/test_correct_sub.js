import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const examId = 10;
  const studentId = 2502;
  
  // Submit an exam with the CORRECT answers
  const submission = await prisma.examSubmission.create({
    data: {
      examId,
      studentId,
      answers: { "16": "A", "17": "TRUE" },
      status: "GRADED",
      score: 2,
      maxScore: 2,
    }
  });
  console.log("Created submission:", submission);
}

main().finally(() => prisma.$disconnect());
