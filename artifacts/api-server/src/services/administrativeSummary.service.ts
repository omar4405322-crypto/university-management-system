import type { AuthActor } from '../types/auth.types';
import { AuthorizationError } from '../utils/appError';
import { getAdministrativeAnalyticsScopes } from '../utils/administrativeAnalyticsScope.utils';
import prisma from '../utils/prismaClient';

type CountDb = Pick<typeof prisma, 'college' | 'department' | 'student' | 'doctor' | 'course'>;

/** Shared, read-only dashboard counts. Scope always comes from the authenticated actor. */
export async function getScopedUniversityCounts(actor: AuthActor, db: CountDb = prisma) {
  const scopes = getAdministrativeAnalyticsScopes(actor);
  if (!scopes) throw new AuthorizationError('Access denied: Administrative scope is not configured');

  const [totalColleges, totalDepartments, totalStudents, totalDoctors, totalCourses] = await Promise.all([
    db.college.count({ where: scopes.college }),
    db.department.count({ where: scopes.department }),
    db.student.count({ where: scopes.student }),
    db.doctor.count({ where: scopes.doctor }),
    db.course.count({ where: scopes.course }),
  ]);

  return { totalColleges, totalDepartments, totalStudents, totalDoctors, totalCourses };
}
