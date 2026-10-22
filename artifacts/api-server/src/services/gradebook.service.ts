import { Prisma } from '@prisma/client';
import prisma from '../utils/prismaClient';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  AuthenticationError,
} from '../utils/appError';
import {
  isDoctorAssignedToCourse,
  isTAAssignedToCourse,
} from './courseStaffAssignment.service';
import { auditLog } from '../utils/audit.utils';
import { isTermLocked } from '../utils/termLock.utils';
import { resolveAcademicTerm } from './gradeStructure.service';
import { SaveGradebookDraftInput } from '../validations/gradebook.validation';

/**
 * Retrieves the gradebook for a course and term.
 * Readers: Course doctor, assigned TAs, scoped admins; students & others 403; anonymous 401.
 */
export async function getGradebook(courseId: number, termIdQuery: unknown, actor: any) {
  if (!actor || !actor.role) {
    throw new AuthenticationError('Authentication required');
  }

  // 1. Resolve Course with college/department relations
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      departmentId: true,
      department: { select: { id: true, collegeId: true } },
    },
  });
  if (!course) {
    throw new NotFoundError('Course not found');
  }

  // 2. Resolve Academic Term
  const term = await resolveAcademicTerm(termIdQuery);

  // 3. Reader Authorization Check
  if (actor.role === 'SUPER_ADMIN') {
    // Read-only access allowed
  } else if (actor.role === 'COLLEGE_ADMIN' || actor.role === 'ADMIN') {
    const managedCollegeId = actor.managedCollegeId || actor.collegeId;
    if (!managedCollegeId || course.department?.collegeId !== managedCollegeId) {
      throw new ForbiddenError('Not authorized for this college');
    }
  } else if (actor.role === 'DEPARTMENT_ADMIN') {
    const managedDeptId = actor.managedDepartmentId || actor.departmentId;
    if (!managedDeptId || course.departmentId !== managedDeptId) {
      throw new ForbiddenError('Not authorized for this department');
    }
  } else if (actor.role === 'DOCTOR') {
    const doctorId = actor.doctor?.id;
    if (!doctorId || !(await isDoctorAssignedToCourse(doctorId, courseId, term.id))) {
      throw new ForbiddenError('Doctor is not assigned to this course in this term');
    }
  } else if (actor.role === 'TEACHING_ASSISTANT') {
    const taId = actor.teachingAssistant?.id;
    if (!taId || !(await isTAAssignedToCourse(taId, courseId, term.id))) {
      throw new ForbiddenError('Teaching assistant is not assigned to this course in this term');
    }
  } else {
    // Students, unassigned doctors/TAs, and unknown roles are 403
    throw new ForbiddenError('Access to course gradebook is forbidden');
  }

  // 4. TA Scope Resolution: group-restricted if any slot has groupId !== null, otherwise course-wide
  let taGroupScopeIds: number[] | null = null;
  if (actor.role === 'TEACHING_ASSISTANT') {
    const taId = actor.teachingAssistant?.id;
    const slots = await prisma.scheduleSlot.findMany({
      where: {
        courseId,
        termId: term.id,
        teachingAssistantId: taId,
        isArchived: false,
      },
      select: { groupId: true },
    });
    const groupIds = slots.map((s) => s.groupId).filter((g): g is number => g !== null && g !== undefined);
    if (groupIds.length > 0) {
      taGroupScopeIds = groupIds;
    }
  }

  // 5. Structure Resolution
  const structure = await prisma.courseGradeStructure.findUnique({
    where: { courseId_termId: { courseId, termId: term.id } },
    include: {
      components: {
        orderBy: { displayOrder: 'asc' },
      },
    },
  });
  if (!structure) {
    throw new ConflictError('Grade structure has not been defined for this course and term');
  }

  // 6. Enrollments Query (Exclude WITHDRAWN; apply TA group scope if applicable)
  const enrollments = await prisma.enrollment.findMany({
    where: {
      courseId,
      termId: term.id,
      status: { not: 'WITHDRAWN' },
      ...(taGroupScopeIds !== null ? { student: { groupId: { in: taGroupScopeIds } } } : {}),
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studentId: true,
          groupId: true,
        },
      },
      gradeEntries: {
        where: {
          component: { structureId: structure.id },
        },
      },
    },
    orderBy: [
      { student: { lastName: 'asc' } },
      { student: { firstName: 'asc' } },
    ],
  });

  // 7. Format Students & Grade Entries
  const mappedStudents = enrollments.map((enr) => {
    const grades = structure.components.map((comp) => {
      if (comp.source !== 'MANUAL') {
        return {
          componentId: comp.id,
          componentName: comp.name,
          maxPoints: comp.maxPoints,
          source: comp.source,
          value: null,
          score: null,
          isAbsent: false,
          status: null,
          version: null,
          notes: null,
        };
      }

      const entry = enr.gradeEntries.find((e) => e.componentId === comp.id);
      return {
        componentId: comp.id,
        componentName: comp.name,
        maxPoints: comp.maxPoints,
        source: comp.source,
        value: entry?.score ?? null,
        score: entry?.score ?? null,
        isAbsent: entry?.isAbsent ?? false,
        status: entry?.status ?? null,
        version: entry?.version ?? null,
        notes: entry?.notes ?? null,
      };
    });

    return {
      studentId: enr.student.id,
      enrollmentId: enr.id,
      firstName: enr.student.firstName,
      lastName: enr.student.lastName,
      studentIdCode: enr.student.studentId,
      groupId: enr.student.groupId,
      status: enr.status,
      grades,
    };
  });

  const totalPoints = structure.components.reduce((sum, c) => sum + c.maxPoints, 0);

  return {
    courseId,
    termId: term.id,
    termName: term.name,
    structure: {
      id: structure.id,
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
    },
    students: mappedStudents,
  };
}

/**
 * Saves draft grade entries for a course-term gradebook.
 * Writers: Course doctor and assigned TAs only (Admins and others are 403).
 */
export async function saveGradebookDraft(
  courseId: number,
  termIdQuery: unknown,
  actor: any,
  reqAudit: any,
  input: SaveGradebookDraftInput
) {
  if (!actor || !actor.role) {
    throw new AuthenticationError('Authentication required');
  }

  // 1. Writer Authorization Check: Writers = Course Doctor and assigned TAs ONLY
  if (actor.role !== 'DOCTOR' && actor.role !== 'TEACHING_ASSISTANT') {
    throw new ForbiddenError('Only assigned course doctor and teaching assistants can save gradebook drafts');
  }

  // 2. Resolve Course
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) {
    throw new NotFoundError('Course not found');
  }

  // 3. Resolve Academic Term
  const term = await resolveAcademicTerm(termIdQuery);

  // 4. Course-level staff assignment check (reject unassigned staff with 403)
  if (actor.role === 'DOCTOR') {
    const doctorId = actor.doctor?.id;
    if (!doctorId || !(await isDoctorAssignedToCourse(doctorId, courseId))) {
      throw new ForbiddenError('Doctor is not assigned to this course');
    }
  } else if (actor.role === 'TEACHING_ASSISTANT') {
    const taId = actor.teachingAssistant?.id;
    if (!taId || !(await isTAAssignedToCourse(taId, courseId))) {
      throw new ForbiddenError('Teaching assistant is not assigned to this course');
    }
  }

  // 5. Past-Term Lock Check (D4: past term returns 409 Conflict)
  if (isTermLocked(term)) {
    throw new ConflictError('Cannot modify gradebook draft for past or locked academic term');
  }

  // 6. Term-specific assignment check for active term
  if (actor.role === 'DOCTOR') {
    const doctorId = actor.doctor?.id;
    if (!doctorId || !(await isDoctorAssignedToCourse(doctorId, courseId, term.id))) {
      throw new ForbiddenError('Doctor is not assigned to this course in this term');
    }
  } else if (actor.role === 'TEACHING_ASSISTANT') {
    const taId = actor.teachingAssistant?.id;
    if (!taId || !(await isTAAssignedToCourse(taId, courseId, term.id))) {
      throw new ForbiddenError('Teaching assistant is not assigned to this course in this term');
    }
  }

  // 7. Grade Structure Check (D4: missing structure returns 409 Conflict)
  const structure = await prisma.courseGradeStructure.findUnique({
    where: { courseId_termId: { courseId, termId: term.id } },
    include: { components: true },
  });
  if (!structure) {
    throw new ConflictError('Grade structure has not been defined for this course and term');
  }

  const compMap = new Map<number, (typeof structure.components)[0]>();
  for (const c of structure.components) {
    compMap.set(c.id, c);
  }

  // 7. Determine TA Scope
  let taGroupScopeIds: number[] | null = null;
  if (actor.role === 'TEACHING_ASSISTANT') {
    const taId = actor.teachingAssistant?.id;
    const slots = await prisma.scheduleSlot.findMany({
      where: {
        courseId,
        termId: term.id,
        teachingAssistantId: taId,
        isArchived: false,
      },
      select: { groupId: true },
    });
    const groupIds = slots.map((s) => s.groupId).filter((g): g is number => g !== null && g !== undefined);
    if (groupIds.length > 0) {
      taGroupScopeIds = groupIds;
    }
  }

  // 8. Fetch and Validate Enrollments
  const requestedEnrollmentIds = [...new Set(input.entries.map((e) => e.enrollmentId))];
  const enrollments = await prisma.enrollment.findMany({
    where: { id: { in: requestedEnrollmentIds } },
    include: { student: { select: { id: true, groupId: true } } },
  });
  const enrollMap = new Map<number, (typeof enrollments)[0]>();
  for (const e of enrollments) {
    enrollMap.set(e.id, e);
  }

  // 9. Pre-Validation of all entries against D1 & D2 invariants
  for (const entry of input.entries) {
    const comp = compMap.get(entry.componentId);
    if (!comp) {
      throw new ValidationError(`Component ID ${entry.componentId} does not belong to course grade structure`);
    }
    if (comp.source !== 'MANUAL') {
      throw new ValidationError(`Component "${comp.name}" has automatic source ${comp.source} and cannot be manually graded`);
    }

    if (entry.score !== null && entry.score > comp.maxPoints) {
      throw new ValidationError(`Score ${entry.score} exceeds maximum points of ${comp.maxPoints} for component "${comp.name}"`);
    }

    const enroll = enrollMap.get(entry.enrollmentId);
    if (!enroll || enroll.courseId !== courseId || enroll.termId !== term.id) {
      throw new ValidationError(`Enrollment ID ${entry.enrollmentId} does not belong to course in this term`);
    }

    if (enroll.status === 'WITHDRAWN') {
      throw new ValidationError(`Enrollment ID ${entry.enrollmentId} has status WITHDRAWN and cannot be graded`);
    }

    if (taGroupScopeIds !== null) {
      if (!enroll.student.groupId || !taGroupScopeIds.includes(enroll.student.groupId)) {
        throw new ForbiddenError(`Teaching Assistant is not authorized to grade enrollment ${entry.enrollmentId} outside assigned student group`);
      }
    }
  }

  // 10. Serializable Transaction (D4)
  try {
    return await prisma.$transaction(
      async (tx) => {
        // Fetch all existing entries for the target (enrollmentId, componentId) pairs
        const existingEntries = await tx.courseGradeEntry.findMany({
          where: {
            OR: input.entries.map((e) => ({
              enrollmentId: e.enrollmentId,
              componentId: e.componentId,
            })),
          },
        });

        const existingMap = new Map<string, (typeof existingEntries)[0]>();
        for (const ee of existingEntries) {
          existingMap.set(`${ee.enrollmentId}:${ee.componentId}`, ee);
        }

        const auditChanges: Array<{
          enrollmentId: number;
          componentId: number;
          beforeScore: number | null;
          afterScore: number | null;
          beforeAbsent: boolean;
          afterAbsent: boolean;
          cleared: boolean;
        }> = [];

        for (const entry of input.entries) {
          const key = `${entry.enrollmentId}:${entry.componentId}`;
          const existing = existingMap.get(key);

          // D3: PUBLISHED entries are never touched here (409)
          if (existing && existing.status === 'PUBLISHED') {
            throw new ConflictError(
              `Grade entry for enrollment ${entry.enrollmentId} and component ${entry.componentId} is PUBLISHED and cannot be modified as a draft`
            );
          }

          // D3: Existing entry requires version, and stale version throws 409
          if (existing) {
            if (entry.version === undefined || entry.version === null) {
              throw new ConflictError(
                `Version is required when updating existing grade entry for enrollment ${entry.enrollmentId} and component ${entry.componentId}`
              );
            }
            if (entry.version !== existing.version) {
              throw new ConflictError(
                `Optimistic lock failure: grade entry for enrollment ${entry.enrollmentId} was modified by another user (expected version ${existing.version}, got ${entry.version})`
              );
            }
          }

          // D3: Clearing draft row (score null with isAbsent false)
          if (entry.score === null && entry.isAbsent === false) {
            if (existing) {
              await tx.courseGradeEntry.delete({
                where: { id: existing.id },
              });
              auditChanges.push({
                enrollmentId: entry.enrollmentId,
                componentId: entry.componentId,
                beforeScore: existing.score,
                afterScore: null,
                beforeAbsent: existing.isAbsent,
                afterAbsent: false,
                cleared: true,
              });
            }
            continue;
          }

          // D3: Unchanged entry check (causes no version bump and no audit item)
          if (existing) {
            const isScoreUnchanged = existing.score === entry.score;
            const isAbsentUnchanged = existing.isAbsent === entry.isAbsent;
            const isNotesUnchanged = (existing.notes || null) === (entry.notes || null);

            if (isScoreUnchanged && isAbsentUnchanged && isNotesUnchanged) {
              // Unchanged: do nothing
              continue;
            }

            // Update with version bump
            const updated = await tx.courseGradeEntry.update({
              where: { id: existing.id },
              data: {
                score: entry.score,
                isAbsent: entry.isAbsent,
                notes: entry.notes,
                version: existing.version + 1,
                draftedById: actor.id,
                draftedAt: new Date(),
              },
            });

            auditChanges.push({
              enrollmentId: entry.enrollmentId,
              componentId: entry.componentId,
              beforeScore: existing.score,
              afterScore: updated.score,
              beforeAbsent: existing.isAbsent,
              afterAbsent: updated.isAbsent,
              cleared: false,
            });
          } else {
            // Create new draft entry with version 1
            const created = await tx.courseGradeEntry.create({
              data: {
                enrollmentId: entry.enrollmentId,
                componentId: entry.componentId,
                score: entry.score,
                isAbsent: entry.isAbsent,
                notes: entry.notes,
                status: 'DRAFT',
                version: 1,
                draftedById: actor.id,
                draftedAt: new Date(),
              },
            });

            auditChanges.push({
              enrollmentId: entry.enrollmentId,
              componentId: entry.componentId,
              beforeScore: null,
              afterScore: created.score,
              beforeAbsent: false,
              afterAbsent: created.isAbsent,
              cleared: false,
            });
          }
        }

        // D5: One audit row per request if changes occurred (numbers and IDs only)
        if (auditChanges.length > 0) {
          await auditLog(
            'GRADE_DRAFT_SAVED',
            'CourseGradeEntry',
            String(courseId),
            reqAudit,
            {
              courseId,
              termId: term.id,
              changedCount: auditChanges.length,
              changes: auditChanges,
            },
            tx
          );
        }

        return {
          courseId,
          termId: term.id,
          savedCount: auditChanges.length,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );
  } catch (err: any) {
    if (err.code === 'P2034' || err.code === '40001') {
      throw new ConflictError('Transaction conflict during gradebook draft save. Please retry.');
    }
    throw err;
  }
}
