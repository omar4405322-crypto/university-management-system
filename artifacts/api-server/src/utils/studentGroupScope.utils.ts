import prisma from './prismaClient';
import {
  getAdminMutationScopeWhere,
  type AdminMutationEntity,
} from './adminMutationScope.utils';
import type { UserScope } from './scope.utils';

type StaffAssignmentClient = {
  scheduleSlot: {
    findMany: (args: Record<string, unknown>) => Promise<Array<{
      course: { departmentId: number | null; year: number };
    }>>;
  };
};

const ADMIN_ROLES = new Set([
  'SUPER_ADMIN',
  'ADMIN',
  'COLLEGE_ADMIN',
  'DEPARTMENT_ADMIN',
]);

export const denyAllStudentGroups = (): Record<string, unknown> => ({
  AND: [{ id: { equals: 0 } }, { id: { not: 0 } }],
});

export function getAdminStudentGroupScopeWhere(
  user: UserScope | null | undefined
): Record<string, unknown> {
  // Student and StudentGroup share departmentId and department relation shapes.
  return getAdminMutationScopeWhere(user, 'student' as AdminMutationEntity);
}

function staffCoursePairsToGroupWhere(
  slots: Array<{ course: { departmentId: number | null; year: number } }>
): Record<string, unknown> {
  const uniquePairs = new Map<string, { departmentId: number; year: number }>();

  for (const slot of slots) {
    const { departmentId, year } = slot.course;
    if (!Number.isInteger(departmentId) || !Number.isInteger(year)) continue;
    uniquePairs.set(`${departmentId}:${year}`, {
      departmentId: departmentId as number,
      year,
    });
  }

  const allowedPairs = [...uniquePairs.values()];
  return allowedPairs.length > 0 ? { OR: allowedPairs } : denyAllStudentGroups();
}

export async function resolveStudentGroupReadScopeWhere(
  user: UserScope | null | undefined,
  client: StaffAssignmentClient = prisma as unknown as StaffAssignmentClient
): Promise<Record<string, unknown>> {
  if (!user?.role) return denyAllStudentGroups();

  if (ADMIN_ROLES.has(user.role)) {
    return getAdminStudentGroupScopeWhere(user);
  }

  if (user.role === 'STUDENT') {
    const departmentId = user.student?.departmentId;
    const year = user.student?.year;
    if (!Number.isInteger(departmentId) || !Number.isInteger(year)) {
      return denyAllStudentGroups();
    }
    return { departmentId, year };
  }

  if (user.role === 'DOCTOR') {
    const doctorId = user.doctor?.id;
    if (!Number.isInteger(doctorId)) return denyAllStudentGroups();
    const slots = await client.scheduleSlot.findMany({
      where: { doctorId },
      select: { course: { select: { departmentId: true, year: true } } },
    });
    return staffCoursePairsToGroupWhere(slots);
  }

  if (user.role === 'TEACHING_ASSISTANT') {
    const teachingAssistantId = user.teachingAssistant?.id;
    if (typeof teachingAssistantId !== 'string' || teachingAssistantId.length === 0) {
      return denyAllStudentGroups();
    }
    const slots = await client.scheduleSlot.findMany({
      where: { teachingAssistantId },
      select: { course: { select: { departmentId: true, year: true } } },
    });
    return staffCoursePairsToGroupWhere(slots);
  }

  return denyAllStudentGroups();
}
