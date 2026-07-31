import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function normalizeMcq(val, q) {
  if (!val) return '';
  const str = String(val).trim();
  if (q) {
    if (q.optionA && str.toLowerCase() === String(q.optionA).trim().toLowerCase()) return 'A';
    if (q.optionB && str.toLowerCase() === String(q.optionB).trim().toLowerCase()) return 'B';
    if (q.optionC && str.toLowerCase() === String(q.optionC).trim().toLowerCase()) return 'C';
    if (q.optionD && str.toLowerCase() === String(q.optionD).trim().toLowerCase()) return 'D';
  }
  const upper = str.toUpperCase();
  if (['A', 'B', 'C', 'D'].includes(upper)) return upper;
  if (upper.startsWith('OPTION_') || upper.startsWith('OPTION ')) {
    const code = upper.replace(/^OPTION[_\s]*/, '').charAt(0);
    if (['A', 'B', 'C', 'D'].includes(code)) return code;
  }
  if (upper.length <= 3 && ['A', 'B', 'C', 'D'].includes(upper.charAt(0))) {
    return upper.charAt(0);
  }
  return upper;
}

function normalizeTF(val) {
  if (!val) return '';
  const str = String(val).trim().toUpperCase();
  if (['TRUE', 'T', 'A', '1', 'صواب', 'صح'].includes(str)) return 'TRUE';
  if (['FALSE', 'F', 'B', '0', 'خطأ'].includes(str)) return 'FALSE';
  return str;
}

async function main() {
  const submission = await prisma.examSubmission.findUnique({ where: { id: 7 } });
  const questions = await prisma.examQuestion.findMany({ where: { examId: submission.examId } });
  
  const answersMap = submission.answers;
  console.log("AnswersMap:", answersMap);

  questions.forEach(q => {
    const studentAnswer = answersMap[q.id.toString()] || answersMap[q.id];
    const qType = (q.type || '').toUpperCase().replace('-', '_');
    
    console.log(`\nQuestion ${q.id} (${qType}):`);
    console.log(`Student Answer Raw: "${studentAnswer}"`);
    console.log(`Correct Answer Raw: "${q.correctAnswer}"`);

    if (qType === 'MCQ' || qType === 'MULTIPLE_CHOICE') {
      const normS = normalizeMcq(studentAnswer, q);
      const normC = normalizeMcq(q.correctAnswer, q);
      console.log(`Norm S: "${normS}" | Norm C: "${normC}"`);
      console.log(`Match? ${normS === normC}`);
    } else if (qType === 'TRUE_FALSE') {
      const normS = normalizeTF(studentAnswer);
      const normC = normalizeTF(q.correctAnswer);
      console.log(`Norm S: "${normS}" | Norm C: "${normC}"`);
      console.log(`Match? ${normS === normC}`);
    }
  });
}

main().finally(() => prisma.$disconnect());
