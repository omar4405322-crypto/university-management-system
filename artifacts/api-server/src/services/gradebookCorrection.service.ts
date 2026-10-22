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
import { CorrectGradebookInput } from '../validations/gradebook.validation';
import { runWithSerializationRetry } from './gradebookPublish.service';
import { computeEnrollmentGradeTotals } from '../utils/gradeMath.utils';

/**
 * Corrects published manual grade entries and recomputes enrollment totals in the same transaction.
 * S4: The course doctor only.
 * Body corrections [{ enrollmentId, componentId, score, isAbsent, version, reason }]
 * MANUAL components, PUBLISHED entries only, version required (stale = 409), reason required.
 * All-or-nothing transaction. One audit row per request.
 */
export async function correctGradebook(
  courseId: number,
  termIdQuery: unknown,
  actor: any,
  reqAudit: any,
  input: CorrectGradebookInput
) {
  if (!actor || !actor.role) {
    throw new AuthenticationError('Authentication required');
  }

  // Doctor only
  if (actor.role !== 'DOCTOR') {
    throw new ForbiddenError('Only assigned course doctor can correct gradebook');
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

  // Past term = 409
  if (isTermLocked(term)) {
    throw new ConflictError('Cannot correct grades for past or locked academic term');
  }

  return await runWithSerializationRetry(async (tx) => {
    const structure = await tx.courseGradeStructure.findUnique({
      where: { courseId_termId: { courseId, termId: term.id } },
      include: {
        components: { orderBy: { displayOrder: 'asc' } },
      },
    });

    if (!structure) {
      throw new ConflictError('Grade structure must be defined before correcting grades');
    }

    const componentMap = new Map(structure.components.map((c) => [c.id, c]));

    const entryBeforeAfterList: Array<{
      enrollmentId: number;
      componentId: number;
      before: { score: number | null; isAbsent: boolean; version: number };
      after: { score: number | null; isAbsent: boolean; version: number };
      reason: string;
    }> = [];

    const affectedEnrollmentIds = new Set<number>();

    for (const correction of input.corrections) {
      const comp = componentMap.get(correction.componentId);
      if (!comp) {
        throw new NotFoundError(`Component ${correction.componentId} not found in course grade structure`);
      }

      // S4: MANUAL components only
      if (comp.source !== 'MANUAL') {
        throw new ConflictError(
          `Only MANUAL components can be corrected directly. Component ${comp.id} (${comp.name}) has source ${comp.source}`
        );
      }

      // Validate score against maxPoints
      if (!correction.isAbsent && correction.score !== null) {
        if (correction.score > comp.maxPoints) {
          throw new ConflictError(
            `Score ${correction.score} exceeds maximum points (${comp.maxPoints}) for component ${comp.name}`
          );
        }
      }

      // Verify enrollment belongs to course and term
      const enrollment = await tx.enrollment.findFirst({
        where: {
          id: correction.enrollmentId,
          courseId,
          termId: term.id,
        },
        select: { id: true, status: true },
      });

      if (!enrollment) {
        throw new NotFoundError(`Enrollment ${correction.enrollmentId} not found for this course and term`);
      }

      if (enrollment.status === 'WITHDRAWN' || enrollment.status === 'BLOCKED') {
        throw new ConflictError(
          `Cannot correct grade for ${enrollment.status} enrollment ${correction.enrollmentId}`
        );
      }

      // Fetch existing entry: must exist and be PUBLISHED
      const existingEntry = await tx.courseGradeEntry.findUnique({
        where: {
          enrollmentId_componentId: {
            enrollmentId: correction.enrollmentId,
            componentId: correction.componentId,
          },
        },
      });

      if (!existingEntry) {
        throw new ConflictError(
          `No grade entry found for enrollment ${correction.enrollmentId} and component ${correction.componentId}`
        );
      }

      // S4: PUBLISHED entries only
      if (existingEntry.status !== 'PUBLISHED') {
        throw new ConflictError(
          `Only PUBLISHED grade entries can be corrected. Entry for component ${correction.componentId} is in status ${existingEntry.status}`
        );
      }

      // S4: version required (stale = 409)
      if (existingEntry.version !== correction.version) {
        throw new ConflictError(
          `Optimistic locking conflict: entry for component ${correction.componentId} has version ${existingEntry.version}, expected ${correction.version}`
        );
      }

      const newScore = correction.isAbsent ? null : correction.score;
      const newAbsent = correction.isAbsent;

      const updatedEntry = await tx.courseGradeEntry.update({
        where: { id: existingEntry.id },
        data: {
          score: newScore,
          isAbsent: newAbsent,
          version: { increment: 1 },
          notes: correction.reason,
          updatedAt: new Date(),
        },
      });

      entryBeforeAfterList.push({
        enrollmentId: correction.enrollmentId,
        componentId: correction.componentId,
        before: {
          score: existingEntry.score,
          isAbsent: existingEntry.isAbsent,
          version: existingEntry.version,
        },
        after: {
          score: updatedEntry.score,
          isAbsent: updatedEntry.isAbsent,
          version: updatedEntry.version,
        },
        reason: correction.reason,
      });

      affectedEnrollmentIds.add(correction.enrollmentId);
    }

    // S4: In the SAME transaction, recomputes that enrollment's totals and status if it was complete
    const finalBeforeAfterList: Array<{
      enrollmentId: number;
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

    for (const enrollmentId of affectedEnrollmentIds) {
      const enrollment = await tx.enrollment.findUnique({
        where: { id: enrollmentId },
        include: {
          gradeEntries: {
            where: {
              componentId: { in: structure.components.map((c) => c.id) },
              status: 'PUBLISHED',
            },
          },
        },
      });

      if (!enrollment) continue;

      // Check if all components have a PUBLISHED entry
      const missingComponents = structure.components.filter((c) => {
        const entry = enrollment.gradeEntries.find((ge) => ge.componentId === c.id);
        return !entry || (!entry.isAbsent && (entry.score === null || entry.score === undefined));
      });

      if (missingComponents.length === 0) {
        if (structure.passMark === null || structure.passMark === undefined) {
          throw new ConflictError(
            'PASSMARK_NOT_SET: Grade structure passMark must be defined before recomputing completed enrollments'
          );
        }

        const {
          finalPointsEarned: newPointsEarned,
          finalPointsMax: newPointsMax,
          finalGrade: newFinalGrade,
          status: newStatus,
        } = computeEnrollmentGradeTotals(
          structure.components,
          enrollment.gradeEntries,
          structure.passMark
        );

        await tx.enrollment.update({
          where: { id: enrollment.id },
          data: {
            finalPointsEarned: newPointsEarned,
            finalPointsMax: newPointsMax,
            finalGrade: newFinalGrade,
            status: newStatus,
          },
        });

        finalBeforeAfterList.push({
          enrollmentId,
          before: {
            finalPointsEarned: enrollment.finalPointsEarned,
            finalPointsMax: enrollment.finalPointsMax,
            finalGrade: enrollment.finalGrade,
            status: enrollment.status,
          },
          after: {
            finalPointsEarned: newPointsEarned,
            finalPointsMax: newPointsMax,
            finalGrade: newFinalGrade,
            status: newStatus,
          },
        });
      }
    }

    // S4: One audit row per request (actor, per-entry before/after, reason, final before/after; ids and numbers only)
    await auditLog(
      'GRADE_CORRECTED',
      'Course',
      courseId.toString(),
      reqAudit,
      {
        courseId,
        termId: term.id,
        correctionsCount: input.corrections.length,
        entries: entryBeforeAfterList,
        enrollmentTotals: finalBeforeAfterList,
      },
      tx
    );

    return {
      success: true,
      updatedCount: input.corrections.length,
      entries: entryBeforeAfterList,
      enrollmentTotals: finalBeforeAfterList,
    };
  });
}
