import { Prisma, GradeComponentSource } from '@prisma/client';
import prisma from '../utils/prismaClient';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../utils/appError';
import {
  canUserReadGradeStructure,
  canUserWriteGradeStructure,
} from './courseStaffAssignment.service';
import { auditLog } from '../utils/audit.utils';
import { isTermPast, isTermLocked } from '../utils/termLock.utils';

export interface GradeComponentInput {
  id?: number;
  name: string;
  nameAr?: string | null;
  maxPoints: number;
  source: GradeComponentSource;
  displayOrder?: number;
}

export interface GradeStructureInput {
  passMark?: number | null;
  components: GradeComponentInput[];
}

export interface GradeStructureResponse {
  courseId: number;
  termId: number;
  termName: string;
  totalPoints: number;
  passMark: number | null;
  components: Array<{
    id: number;
    name: string;
    nameAr: string | null;
    maxPoints: number;
    source: GradeComponentSource;
    displayOrder: number;
  }>;
  isLocked: boolean;
}

/**
 * Resolves an academic term:
 * - If termId is provided, validates that it exists.
 * - If omitted, defaults to the current term (isCurrent = true).
 * - If omitted and no current term exists, throws ValidationError (422).
 */
export async function resolveAcademicTerm(termIdQuery?: unknown) {
  if (termIdQuery !== undefined && termIdQuery !== null && termIdQuery !== '') {
    const termId = parseInt(String(termIdQuery), 10);
    if (!Number.isSafeInteger(termId) || termId <= 0) {
      throw new ValidationError('Invalid term ID format');
    }
    const term = await prisma.academicTerm.findUnique({
      where: { id: termId },
    });
    if (!term) {
      throw new NotFoundError('Academic term not found');
    }
    return term;
  }

  const currentTerm = await prisma.academicTerm.findFirst({
    where: { isCurrent: true },
  });
  if (!currentTerm) {
    throw new ValidationError(
      'No active academic term found. Please provide termId explicitly.'
    );
  }
  return currentTerm;
}

/**
 * Validates course existence and retrieves its department/college metadata.
 */
export async function getCourseWithScope(courseId: number) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      name: true,
      courseCode: true,
      departmentId: true,
      department: {
        select: {
          id: true,
          collegeId: true,
        },
      },
    },
  });
  if (!course) {
    throw new NotFoundError('Course not found');
  }
  return course;
}

/**
 * Fetches the grade structure for a course and term.
 */
export async function getGradeStructure(
  courseId: number,
  termIdQuery: unknown,
  actor: any
): Promise<GradeStructureResponse> {
  const course = await getCourseWithScope(courseId);
  const term = await resolveAcademicTerm(termIdQuery);

  const canRead = await canUserReadGradeStructure(actor, courseId, term.id, course);
  if (!canRead) {
    if (actor.role === 'DOCTOR' || actor.role === 'TEACHING_ASSISTANT') {
      throw new ForbiddenError('Staff member is not assigned to this course in this term');
    }
    if (actor.role === 'STUDENT') {
      throw new ForbiddenError('Student is not enrolled in this course in this term');
    }
    if (actor.role === 'COLLEGE_ADMIN' || actor.role === 'DEPARTMENT_ADMIN' || actor.role === 'ADMIN') {
      throw new ForbiddenError('Course is outside your administrative scope');
    }
    throw new ForbiddenError('Access denied to course grade structure');
  }

  const isTermLockedStatus = isTermLocked(term);

  const structure = await prisma.courseGradeStructure.findUnique({
    where: {
      courseId_termId: {
        courseId,
        termId: term.id,
      },
    },
    include: {
      components: {
        orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
      },
    },
  });

  if (!structure) {
    return {
      courseId,
      termId: term.id,
      termName: term.name,
      totalPoints: 0,
      passMark: null,
      components: [],
      isLocked: isTermLockedStatus,
    };
  }

  const publishedCount = await prisma.courseGradeEntry.count({
    where: {
      component: { structureId: structure.id },
      status: 'PUBLISHED',
    },
  });

  const isLocked = isTermLockedStatus || publishedCount > 0;
  const totalPoints = structure.components.reduce((sum, c) => sum + c.maxPoints, 0);

  return {
    courseId,
    termId: term.id,
    termName: term.name,
    totalPoints,
    passMark: structure.passMark,
    components: structure.components.map((c) => ({
      id: c.id,
      name: c.name,
      nameAr: c.nameAr,
      maxPoints: c.maxPoints,
      source: c.source,
      displayOrder: c.displayOrder,
    })),
    isLocked,
  };
}

/**
 * Upserts the course grade structure and components transactionally at Serializable isolation.
 */
export async function upsertGradeStructure(
  courseId: number,
  termIdQuery: unknown,
  actor: any,
  reqAudit: any,
  payload: GradeStructureInput
): Promise<GradeStructureResponse> {
  const course = await getCourseWithScope(courseId);
  const term = await resolveAcademicTerm(termIdQuery);

  const canWrite = await canUserWriteGradeStructure(actor, courseId, term.id, course);
  if (!canWrite) {
    if (actor.role === 'TEACHING_ASSISTANT') {
      throw new ForbiddenError('Teaching assistants are not permitted to modify course grade structures');
    }
    if (actor.role === 'STUDENT') {
      throw new ForbiddenError('Students are not permitted to modify course grade structures');
    }
    if (actor.role === 'DOCTOR') {
      throw new ForbiddenError('Doctors are not permitted to modify course grade structures');
    }
    if (actor.role === 'COLLEGE_ADMIN' || actor.role === 'DEPARTMENT_ADMIN' || actor.role === 'ADMIN') {
      throw new ForbiddenError('Course is outside your administrative scope');
    }
    throw new ForbiddenError('Access denied to course grade structure');
  }

  // Term immutability check
  if (isTermPast(term)) {
    throw new ConflictError('Cannot modify grade structure: academic term is in the past');
  }
  if ((term as any).status === 'LOCKED') {
    throw new ConflictError('Cannot modify grade structure: academic term is locked');
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        // 1. Fetch existing structure with components and grade entries
        const existing = await tx.courseGradeStructure.findUnique({
          where: {
            courseId_termId: {
              courseId,
              termId: term.id,
            },
          },
          include: {
            components: {
              include: {
                gradeEntries: {
                  select: { id: true, score: true, status: true },
                },
              },
            },
          },
        });

        // 2. Published grades lock (S2)
        if (existing) {
          const hasPublished = existing.components.some((c) =>
            c.gradeEntries.some((e) => e.status === 'PUBLISHED')
          );
          if (hasPublished) {
            throw new ConflictError(
              'Cannot modify grade structure: published grades exist for this course in this term'
            );
          }
        }

        // 3. Validate that every supplied component id belongs to this structure
        const existingComponentIds = new Set(
          existing ? existing.components.map((c) => c.id) : []
        );
        const incomingById = new Map<number, GradeComponentInput>();
        for (const comp of payload.components) {
          if (comp.id !== undefined && comp.id !== null) {
            if (!existingComponentIds.has(comp.id)) {
              throw new ValidationError(
                `Component id ${comp.id} does not belong to this course grade structure`
              );
            }
            if (incomingById.has(comp.id)) {
              throw new ValidationError(
                `Duplicate component id ${comp.id} in grade structure payload`
              );
            }
            incomingById.set(comp.id, comp);
          }
        }

        // 4. Draft entries invariants (S2)
        if (existing) {
          for (const existingComp of existing.components) {
            const hasEntries = existingComp.gradeEntries.length > 0;
            if (hasEntries) {
              // Rule: Cannot remove component that has entries
              const matchingIncoming = incomingById.get(existingComp.id);
              if (!matchingIncoming) {
                throw new ConflictError(
                  `Cannot remove component "${existingComp.name}": grade entries exist`
                );
              }

              // Rule: Cannot change source of component that has entries
              if (matchingIncoming.source !== existingComp.source) {
                throw new ConflictError(
                  `Cannot change source of component "${existingComp.name}": grade entries exist`
                );
              }

              // Rule: Can change maxPoints ONLY IF new maxPoints >= highest draft score already entered
              const nonNullScores = existingComp.gradeEntries
                .map((e) => e.score)
                .filter((s): s is number => typeof s === 'number' && Number.isFinite(s));
              const highestDraftScore = nonNullScores.length > 0 ? Math.max(...nonNullScores) : 0;
              if (matchingIncoming.maxPoints < highestDraftScore) {
                throw new ConflictError(
                  `Cannot reduce maxPoints below existing draft score ${highestDraftScore}`
                );
              }
            }
          }
        }

        // Snapshot before state
        const beforeSnapshot = existing
          ? {
              passMark: existing.passMark,
              components: existing.components.map((c) => ({
                id: c.id,
                name: c.name,
                maxPoints: c.maxPoints,
                source: c.source,
                displayOrder: c.displayOrder,
              })),
            }
          : null;

        // 4. Upsert CourseGradeStructure
        const structure = await tx.courseGradeStructure.upsert({
          where: {
            courseId_termId: {
              courseId,
              termId: term.id,
            },
          },
          create: {
            courseId,
            termId: term.id,
            passMark: payload.passMark ?? null,
          },
          update: {
            passMark: payload.passMark ?? null,
          },
        });

        // 5. Reconcile Components
        const existingComponents = existing ? existing.components : [];
        const incomingIds = new Set(
          payload.components
            .map((c) => c.id)
            .filter((id): id is number => typeof id === 'number')
        );

        // Delete components not in incoming list
        const componentsToDelete = existingComponents.filter((c) => !incomingIds.has(c.id));
        for (const comp of componentsToDelete) {
          await tx.courseGradeComponent.delete({
            where: { id: comp.id },
          });
        }

        // Update existing components or create new components
        for (let i = 0; i < payload.components.length; i++) {
          const comp = payload.components[i];
          const displayOrder = comp.displayOrder ?? i + 1;

          if (comp.id !== undefined && comp.id !== null) {
            await tx.courseGradeComponent.update({
              where: { id: comp.id, structureId: structure.id },
              data: {
                name: comp.name.trim(),
                nameAr: comp.nameAr ? comp.nameAr.trim() : null,
                maxPoints: comp.maxPoints,
                source: comp.source,
                displayOrder,
              },
            });
          } else {
            await tx.courseGradeComponent.create({
              data: {
                structureId: structure.id,
                name: comp.name.trim(),
                nameAr: comp.nameAr ? comp.nameAr.trim() : null,
                maxPoints: comp.maxPoints,
                source: comp.source,
                displayOrder,
              },
            });
          }
        }

        // 6. Fetch updated structure and components
        const updatedComponents = await tx.courseGradeComponent.findMany({
          where: { structureId: structure.id },
          orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
        });

        const afterSnapshot = {
          passMark: structure.passMark,
          components: updatedComponents.map((c) => ({
            id: c.id,
            name: c.name,
            maxPoints: c.maxPoints,
            source: c.source,
            displayOrder: c.displayOrder,
          })),
        };

        // 7. Audit log row
        await auditLog(
          'GRADE_STRUCTURE_UPDATED',
          'CourseGradeStructure',
          String(structure.id),
          reqAudit,
          {
            courseId,
            termId: term.id,
            before: beforeSnapshot,
            after: afterSnapshot,
          },
          tx
        );

        const totalPoints = updatedComponents.reduce((sum, c) => sum + c.maxPoints, 0);

        return {
          courseId,
          termId: term.id,
          termName: term.name,
          totalPoints,
          passMark: structure.passMark,
          components: updatedComponents.map((c) => ({
            id: c.id,
            name: c.name,
            nameAr: c.nameAr,
            maxPoints: c.maxPoints,
            source: c.source,
            displayOrder: c.displayOrder,
          })),
          isLocked: false,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );
  } catch (err: any) {
    if (err.code === 'P2034' || err.code === '40001') {
      throw new ConflictError('Transaction conflict during grade structure update. Please retry.');
    }
    throw err;
  }
}
