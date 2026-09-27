/**
 * Shared staff name-resolution helpers used by both the timetable sync
 * and conflict-check controllers.
 */

import prisma from '../utils/prismaClient';
import {
  getEffectiveActiveDoctorWhere,
  getEffectiveActiveTeachingAssistantWhere,
} from '../utils/scope.utils';

export interface StaffResolveResult<T> {
  id: T | null;
  isAmbiguous: boolean;
  matchCount: number;
}

/** Resolves a free-text doctor name to a single doctor ID via DB lookup. */
export async function resolveDoctorByName(
  rawName: string,
  departmentId?: number | null
): Promise<StaffResolveResult<number>> {
  const cleanName = rawName
    .trim()
    .replace(/^(د\.|أ\.د\.|دكتور\s+|dr\.|dr\s+|prof\.|prof\s+)\s*/i, '')
    .trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { id: null, isAmbiguous: false, matchCount: 0 };

  const deptFilter = departmentId ? { departmentId: Number(departmentId) } : {};

  // Step 1: Scoped Exact Match
  const exactWhere =
    parts.length >= 2
      ? {
          firstName: { equals: parts[0], mode: 'insensitive' as const },
          lastName: { equals: parts[parts.length - 1], mode: 'insensitive' as const },
          ...deptFilter,
        }
      : {
          OR: [
            { firstName: { equals: parts[0], mode: 'insensitive' as const } },
            { lastName: { equals: parts[0], mode: 'insensitive' as const } },
          ],
          ...deptFilter,
        };

  let candidates = await prisma.doctor.findMany({
    where: getEffectiveActiveDoctorWhere(exactWhere),
  });

  if (candidates.length === 1) return { id: candidates[0].id, isAmbiguous: false, matchCount: 1 };
  if (candidates.length > 1) return { id: null, isAmbiguous: true, matchCount: candidates.length };

  // Step 2: Scoped Contains Match
  const containsWhere =
    parts.length >= 2
      ? {
          firstName: { contains: parts[0], mode: 'insensitive' as const },
          lastName: { contains: parts[parts.length - 1], mode: 'insensitive' as const },
          ...deptFilter,
        }
      : {
          OR: [
            { firstName: { contains: parts[0], mode: 'insensitive' as const } },
            { lastName: { contains: parts[0], mode: 'insensitive' as const } },
          ],
          ...deptFilter,
        };

  candidates = await prisma.doctor.findMany({
    where: getEffectiveActiveDoctorWhere(containsWhere),
  });

  if (candidates.length === 1) return { id: candidates[0].id, isAmbiguous: false, matchCount: 1 };
  if (candidates.length > 1) return { id: null, isAmbiguous: true, matchCount: candidates.length };

  return { id: null, isAmbiguous: false, matchCount: 0 };
}

/** Resolves a free-text TA name to a single teaching-assistant ID via DB lookup. */
export async function resolveTaByName(
  rawName: string,
  departmentId?: number | null
): Promise<StaffResolveResult<string>> {
  const cleanName = rawName
    .trim()
    .replace(/^(م\.|مهندس\s+|eng\.|eng\s+|ta\.|ta\s+|معيد\s+)\s*/i, '')
    .trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { id: null, isAmbiguous: false, matchCount: 0 };

  const deptFilter = departmentId ? { departmentId: Number(departmentId) } : {};

  // Step 1: Scoped Exact Match
  const exactWhere =
    parts.length >= 2
      ? {
          firstName: { equals: parts[0], mode: 'insensitive' as const },
          lastName: { equals: parts[parts.length - 1], mode: 'insensitive' as const },
          ...deptFilter,
        }
      : {
          OR: [
            { firstName: { equals: parts[0], mode: 'insensitive' as const } },
            { lastName: { equals: parts[0], mode: 'insensitive' as const } },
          ],
          ...deptFilter,
        };

  let candidates = await prisma.teachingAssistant.findMany({
    where: getEffectiveActiveTeachingAssistantWhere(exactWhere),
  });

  if (candidates.length === 1) return { id: candidates[0].id, isAmbiguous: false, matchCount: 1 };
  if (candidates.length > 1) return { id: null, isAmbiguous: true, matchCount: candidates.length };

  // Step 2: Scoped Contains Match
  const containsWhere =
    parts.length >= 2
      ? {
          firstName: { contains: parts[0], mode: 'insensitive' as const },
          lastName: { contains: parts[parts.length - 1], mode: 'insensitive' as const },
          ...deptFilter,
        }
      : {
          OR: [
            { firstName: { contains: parts[0], mode: 'insensitive' as const } },
            { lastName: { contains: parts[0], mode: 'insensitive' as const } },
          ],
          ...deptFilter,
        };

  candidates = await prisma.teachingAssistant.findMany({
    where: getEffectiveActiveTeachingAssistantWhere(containsWhere),
  });

  if (candidates.length === 1) return { id: candidates[0].id, isAmbiguous: false, matchCount: 1 };
  if (candidates.length > 1) return { id: null, isAmbiguous: true, matchCount: candidates.length };

  return { id: null, isAmbiguous: false, matchCount: 0 };
}
