import prisma from '../utils/prismaClient';
import { AuthenticationError, ForbiddenError, NotFoundError } from '../utils/appError';

/**
 * Retrieves student grades for their own enrollments.
 * S6: STUDENT only, own enrollments only (no id from the client).
 * Per course-term: components with maxPoints, only PUBLISHED entries (ABS flagged), passMark,
 * and finalPointsEarned/Max, finalGrade, status only when complete.
 * Never a draft value, never another student.
 */
export async function getStudentMyGrades(actor: any) {
  if (!actor || !actor.role) {
    throw new AuthenticationError('Authentication required');
  }

  if (actor.role !== 'STUDENT') {
    throw new ForbiddenError('Only students can access their personal grades');
  }

  // Resolve student id from actor
  let studentId = actor.student?.id;
  if (!studentId) {
    const student = await prisma.student.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });
    if (!student) {
      throw new NotFoundError('Student profile not found');
    }
    studentId = student.id;
  }

  // Fetch own enrollments
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    include: {
      course: {
        select: {
          id: true,
          courseCode: true,
          name: true,
          credits: true,
        },
      },
      term: {
        select: {
          id: true,
          name: true,
        },
      },
      gradeEntries: {
        where: {
          status: 'PUBLISHED', // S6: PUBLISHED entries ONLY, never draft
        },
        select: {
          id: true,
          componentId: true,
          score: true,
          isAbsent: true,
          version: true,
        },
      },
    },
    orderBy: [
      { termId: 'desc' },
      { courseId: 'asc' },
    ],
  });

  const results: any[] = [];

  for (const enr of enrollments) {
    if (!enr.termId) {
      continue;
    }

    const structure = await prisma.courseGradeStructure.findUnique({
      where: {
        courseId_termId: {
          courseId: enr.courseId,
          termId: enr.termId,
        },
      },
      include: {
        components: {
          orderBy: { displayOrder: 'asc' },
          select: {
            id: true,
            name: true,
            nameAr: true,
            maxPoints: true,
            source: true,
            displayOrder: true,
          },
        },
      },
    });

    const componentsOutput: any[] = [];
    let isComplete = false;

    if (structure) {
      let missingCount = 0;
      for (const comp of structure.components) {
        const entry = enr.gradeEntries.find((ge) => ge.componentId === comp.id);
        const hasEntry = !!entry;
        const isEntered = hasEntry && (entry.isAbsent === true || (entry.score !== null && entry.score !== undefined));
        if (!isEntered) {
          missingCount++;
        }

        componentsOutput.push({
          componentId: comp.id,
          name: comp.name,
          nameAr: comp.nameAr,
          maxPoints: comp.maxPoints,
          source: comp.source,
          score: hasEntry ? (entry.isAbsent ? 0 : entry.score) : null,
          isAbsent: hasEntry ? entry.isAbsent : false,
          isPublished: hasEntry,
        });
      }

      isComplete = structure.components.length > 0 && missingCount === 0;
    }

    results.push({
      enrollmentId: enr.id,
      courseId: enr.course.id,
      termId: enr.termId,
      course: {
        id: enr.course.id,
        code: enr.course.courseCode,
        name: enr.course.name,
        credits: enr.course.credits,
      },
      term: enr.term
        ? {
            id: enr.term.id,
            name: enr.term.name,
          }
        : null,
      passMark: structure ? structure.passMark : null,
      components: componentsOutput,
      // S6: finalPointsEarned/Max, finalGrade, status ONLY when complete
      finalPointsEarned: isComplete ? enr.finalPointsEarned : null,
      finalPointsMax: isComplete ? enr.finalPointsMax : null,
      finalGrade: isComplete ? enr.finalGrade : null,
      status: isComplete ? enr.status : null,
    });
  }

  return results;
}
