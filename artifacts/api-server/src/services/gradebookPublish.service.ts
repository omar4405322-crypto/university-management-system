import { Prisma } from '@prisma/client';
import prisma from '../utils/prismaClient';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  AuthenticationError,
} from '../utils/appError';
import { isDoctorAssignedToCourse } from './courseStaffAssignment.service';
import { auditLog } from '../utils/audit.utils';
import { isTermLocked } from '../utils/termLock.utils';
import { resolveAcademicTerm } from './gradeStructure.service';
import { PublishGradebookInput } from '../validations/gradebook.validation';
import { computeEnrollmentGradeTotals } from '../utils/gradeMath.utils';

export type GradeCalculatorContext = {
  enrollmentId: number;
  courseId: number;
  termId: number;
  component: {
    id: number;
    name: string;
    maxPoints: number;
    source: string;
  };
  tx: Prisma.TransactionClient;
};

export type GradeCalculatorResult = number;

export type GradeCalculatorFn = (
  ctx: GradeCalculatorContext
) => Promise<number> | number;

const gradeCalculatorRegistry = new Map<string, GradeCalculatorFn>();

export function registerGradeCalculator(
  source: string,
  calculator: GradeCalculatorFn
): void {
  gradeCalculatorRegistry.set(source, calculator);
}

export function unregisterGradeCalculator(source: string): void {
  gradeCalculatorRegistry.delete(source);
}

export function getGradeCalculator(
  source: string
): GradeCalculatorFn | undefined {
  return gradeCalculatorRegistry.get(source);
}

/**
 * Runs an operation inside a Serializable transaction with 1 retry on conflict.
 */
export async function runWithSerializationRetry<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  let attempts = 0;
  while (true) {
    try {
      attempts++;
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      });
    } catch (err: any) {
      const isSerializationFailure =
        err?.code === 'P2034' ||
        err?.meta?.code === '40001' ||
        (typeof err?.message === 'string' &&
          (err.message.includes('could not serialize access') ||
            err.message.includes('Transaction failed due to a write conflict') ||
            err.message.includes('serialization_failure')));

      if (isSerializationFailure) {
        if (attempts < 2) {
          continue;
        }
        throw new ConflictError(
          'Concurrent modification conflict during gradebook operation. Please try again.'
        );
      }
      throw err;
    }
  }
}

/**
 * Publishes grade entries and evaluates completion for a course-term gradebook.
 * S1: The course doctor only (assigned via slots). Admins, TAs, others 403, anonymous 401.
 * Past term: 409.
 */
export async function publishGradebook(
  courseId: number,
  termIdQuery: unknown,
  actor: any,
  reqAudit: any,
  input?: PublishGradebookInput
) {
  if (!actor || !actor.role) {
    throw new AuthenticationError('Authentication required');
  }

  // S1: Course doctor only
  if (actor.role !== 'DOCTOR') {
    throw new ForbiddenError('Only assigned course doctor can publish gradebook');
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) {
    throw new NotFoundError('Course not found');
  }

  const term = await resolveAcademicTerm(termIdQuery);

  const doctorId = actor.doctor?.id;
  if (!doctorId || !(await isDoctorAssignedToCourse(doctorId, courseId, term.id))) {
    throw new ForbiddenError('Doctor is not assigned to this course in this term');
  }

  // S1: Past term = 409
  if (isTermLocked(term)) {
    throw new ConflictError('Cannot publish gradebook for past or locked academic term');
  }

  return await runWithSerializationRetry(async (tx) => {
    const structure = await tx.courseGradeStructure.findUnique({
      where: { courseId_termId: { courseId, termId: term.id } },
      include: {
        components: { orderBy: { displayOrder: 'asc' } },
      },
    });

    if (!structure) {
      throw new ConflictError('Grade structure must be defined before publishing grades');
    }

    const whereEnrollment: Prisma.EnrollmentWhereInput = {
      courseId,
      termId: term.id,
      ...(input?.enrollmentIds && input.enrollmentIds.length > 0
        ? { id: { in: input.enrollmentIds } }
        : {}),
    };

    const enrollments = await tx.enrollment.findMany({
      where: whereEnrollment,
      include: {
        gradeEntries: {
          where: {
            componentId: { in: structure.components.map((c) => c.id) },
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    const now = new Date();
    const completeList: Array<{
      enrollmentId: number;
      studentId: number;
      finalPointsEarned: number;
      finalPointsMax: number;
      finalGrade: number;
      status: 'COMPLETED' | 'FAILED';
    }> = [];
    const incompleteList: Array<{
      enrollmentId: number;
      studentId: number;
      missingComponents: number[];
    }> = [];
    const skippedList: Array<{
      enrollmentId: number;
      studentId: number;
      status: string;
      reason: string;
    }> = [];
    const changedEnrollments: Array<{
      enrollmentId: number;
      studentId: number;
      flippedEntryIds: number[];
      before: {
        finalPointsEarned: number | null;
        finalPointsMax: number | null;
        finalGrade: number | null;
        status: string;
      };
      after: {
        finalPointsEarned: number | null;
        finalPointsMax: number | null;
        finalGrade: number | null;
        status: string;
      };
    }> = [];

    const manualComponents = structure.components.filter((c) => c.source === 'MANUAL');
    const autoComponents = structure.components.filter((c) => c.source !== 'MANUAL');

    for (const enrollment of enrollments) {
      // S3: WITHDRAWN and BLOCKED enrollments are skipped and reported; invent no absence rule.
      if (enrollment.status === 'WITHDRAWN' || enrollment.status === 'BLOCKED') {
        skippedList.push({
          enrollmentId: enrollment.id,
          studentId: enrollment.studentId,
          status: enrollment.status,
          reason: 'ENROLLMENT_STATUS_INELIGIBLE',
        });
        continue;
      }

      const beforeTotals = {
        finalPointsEarned: enrollment.finalPointsEarned,
        finalPointsMax: enrollment.finalPointsMax,
        finalGrade: enrollment.finalGrade,
        status: enrollment.status,
      };
      const flippedEntryIds: number[] = [];

      // S2: Flip DRAFT to PUBLISHED for selected enrollments
      for (const entry of enrollment.gradeEntries) {
        if (entry.status === 'DRAFT') {
          await tx.courseGradeEntry.update({
            where: { id: entry.id },
            data: {
              status: 'PUBLISHED',
              publishedById: actor.id,
              publishedAt: now,
              version: { increment: 1 },
            },
          });
          entry.status = 'PUBLISHED';
          entry.version += 1;
          entry.publishedById = actor.id;
          entry.publishedAt = now;
          flippedEntryIds.push(entry.id);
        }
      }

      // Check MANUAL components
      const missingManualComponents: number[] = [];
      for (const comp of manualComponents) {
        const entry = enrollment.gradeEntries.find((ge) => ge.componentId === comp.id);
        const isEntered =
          entry &&
          entry.status === 'PUBLISHED' &&
          (entry.isAbsent === true || (entry.score !== null && entry.score !== undefined));
        if (!isEntered) {
          missingManualComponents.push(comp.id);
        }
      }

      const isOtherwiseComplete = missingManualComponents.length === 0;

      // S2: AUTO components are snapshotted as PUBLISHED entries ONLY for an otherwise complete enrollment
      if (isOtherwiseComplete && autoComponents.length > 0) {
        for (const autoComp of autoComponents) {
          let entry = enrollment.gradeEntries.find((ge) => ge.componentId === autoComp.id);

          // If entry is not already PUBLISHED and entered, calculate and snapshot it
          if (!entry || entry.status !== 'PUBLISHED') {
            const calculator = getGradeCalculator(autoComp.source);
            if (!calculator) {
              throw new ConflictError(
                `AUTO_CALCULATOR_UNAVAILABLE: No calculator registered for source ${autoComp.source}`
              );
            }

            const calcResult = await calculator({
              enrollmentId: enrollment.id,
              courseId,
              termId: term.id,
              component: {
                id: autoComp.id,
                name: autoComp.name,
                maxPoints: autoComp.maxPoints,
                source: autoComp.source,
              },
              tx,
            });

            const hasValidDecimals =
              typeof calcResult === 'number' &&
              Number.isFinite(calcResult) &&
              Math.abs(Math.round(calcResult * 100) - calcResult * 100) <= 1e-6 &&
              !/\.\d{3,}/.test(String(calcResult));

            if (
              typeof calcResult !== 'number' ||
              !Number.isFinite(calcResult) ||
              calcResult < 0 ||
              calcResult > autoComp.maxPoints ||
              !hasValidDecimals
            ) {
              throw new ConflictError(
                `AUTO_CALCULATOR_INVALID_RESULT: Calculator for source ${autoComp.source} returned invalid score ${String(calcResult)} (must be finite, >= 0, <= ${autoComp.maxPoints}, and at most 2 decimals)`
              );
            }

            const snapshotScore = calcResult;
            const snapshotAbsent = false;

            if (entry) {
              const updatedEntry = await tx.courseGradeEntry.update({
                where: { id: entry.id },
                data: {
                  score: snapshotScore,
                  isAbsent: snapshotAbsent,
                  status: 'PUBLISHED',
                  publishedById: actor.id,
                  publishedAt: now,
                  version: { increment: 1 },
                },
              });
              entry.score = updatedEntry.score;
              entry.isAbsent = updatedEntry.isAbsent;
              entry.status = updatedEntry.status;
              entry.version = updatedEntry.version;
              flippedEntryIds.push(updatedEntry.id);
            } else {
              const createdEntry = await tx.courseGradeEntry.create({
                data: {
                  enrollmentId: enrollment.id,
                  componentId: autoComp.id,
                  score: snapshotScore,
                  isAbsent: snapshotAbsent,
                  status: 'PUBLISHED',
                  publishedById: actor.id,
                  publishedAt: now,
                  version: 1,
                },
              });
              enrollment.gradeEntries.push(createdEntry);
              flippedEntryIds.push(createdEntry.id);
            }
          }
        }
      }

      // Check full completeness: every component of structure has a PUBLISHED entry
      const missingComponents: number[] = [];
      for (const comp of structure.components) {
        const entry = enrollment.gradeEntries.find((ge) => ge.componentId === comp.id);
        const isEntered =
          entry &&
          entry.status === 'PUBLISHED' &&
          (entry.isAbsent === true || (entry.score !== null && entry.score !== undefined));
        if (!isEntered) {
          missingComponents.push(comp.id);
        }
      }

      let afterTotals = { ...beforeTotals };

      if (missingComponents.length > 0) {
        // S3: Incomplete enrollments stay untouched
        incompleteList.push({
          enrollmentId: enrollment.id,
          studentId: enrollment.studentId,
          missingComponents,
        });
      } else {
        // S3: Complete enrollment gets finalPointsEarned, finalPointsMax, finalGrade, status
        if (structure.passMark === null || structure.passMark === undefined) {
          throw new ConflictError(
            'PASSMARK_NOT_SET: Grade structure passMark must be defined before completing enrollments'
          );
        }

        // Outcome rule in gradeMath.utils: isPassed ? 'COMPLETED' : 'FAILED'
        const {
          finalPointsEarned,
          finalPointsMax,
          finalGrade,
          status: finalStatus,
        } = computeEnrollmentGradeTotals(
          structure.components,
          enrollment.gradeEntries,
          structure.passMark
        );

        await tx.enrollment.update({
          where: { id: enrollment.id },
          data: {
            finalPointsEarned,
            finalPointsMax,
            finalGrade,
            status: finalStatus,
          },
        });

        afterTotals = {
          finalPointsEarned,
          finalPointsMax,
          finalGrade,
          status: finalStatus,
        };

        completeList.push({
          enrollmentId: enrollment.id,
          studentId: enrollment.studentId,
          finalPointsEarned,
          finalPointsMax,
          finalGrade,
          status: finalStatus,
        });
      }

      const totalsChanged =
        beforeTotals.finalPointsEarned !== afterTotals.finalPointsEarned ||
        beforeTotals.finalPointsMax !== afterTotals.finalPointsMax ||
        beforeTotals.finalGrade !== afterTotals.finalGrade ||
        beforeTotals.status !== afterTotals.status;

      if (flippedEntryIds.length > 0 || totalsChanged) {
        changedEnrollments.push({
          enrollmentId: enrollment.id,
          studentId: enrollment.studentId,
          flippedEntryIds,
          before: beforeTotals,
          after: afterTotals,
        });
      }
    }

    // S5: Publish writes one GRADE_PUBLISHED audit row per request. Create no notification.
    await auditLog(
      'GRADE_PUBLISHED',
      'Course',
      courseId.toString(),
      reqAudit,
      {
        courseId,
        termId: term.id,
        completeCount: completeList.length,
        incompleteCount: incompleteList.length,
        skippedCount: skippedList.length,
        totalEvaluated: enrollments.length,
        enrollments: changedEnrollments,
      },
      tx
    );

    return {
      courseId,
      termId: term.id,
      complete: completeList,
      incomplete: incompleteList,
      skipped: skippedList,
    };
  });
}
