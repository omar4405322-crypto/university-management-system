// FIXED [Phase 7.2]: Global search across students, doctors, courses, colleges, departments
import { Request, Response } from 'express';
import prisma from '../utils/prismaClient';
import catchAsync from '../utils/catchAsync';
import { AuthorizationError } from '../utils/appError';
import { getSearchScopes } from '../utils/searchScope.utils';

const TAKE = 8;

export const globalSearch = catchAsync(async (req: Request, res: Response) => {
  const q = ((req.query.q as string) || '').trim();
  const scopes = getSearchScopes(req.user);

  if (!scopes) {
    throw new AuthorizationError('Access denied: Your account has no global search scope');
  }

  if (q.length < 2) {
    return res.json({
      success: true,
      data: { students: [], doctors: [], courses: [], colleges: [], departments: [] },
    });
  }

  const contains = { contains: q, mode: 'insensitive' as const };

  const studentWhere: any = {
    AND: [
      {
        OR: [
          { firstName: contains },
          { lastName: contains },
          { studentId: contains },
          { user: { email: contains } },
        ],
      },
      scopes.student,
    ],
  };
  const doctorWhere: any = {
    AND: [
      {
        OR: [
          { firstName: contains },
          { lastName: contains },
          { doctorId: contains },
          { user: { email: contains } },
        ],
      },
      scopes.doctor,
    ],
  };
  const courseWhere: any = {
    AND: [{ OR: [{ name: contains }, { courseCode: contains }] }, scopes.course],
  };
  const collegeWhere: any = { AND: [{ name: contains }, scopes.college] };
  const departmentWhere: any = { AND: [{ name: contains }, scopes.department] };

  const [students, doctors, courses, colleges, departments] = await Promise.all([
    prisma.student.findMany({
      where: studentWhere,
      select: { id: true, firstName: true, lastName: true, studentId: true },
      take: TAKE,
      orderBy: { lastName: 'asc' },
    }),
    prisma.doctor.findMany({
      where: doctorWhere,
      select: { id: true, firstName: true, lastName: true, doctorId: true },
      take: TAKE,
      orderBy: { lastName: 'asc' },
    }),
    prisma.course.findMany({
      where: courseWhere,
      select: { id: true, name: true, courseCode: true },
      take: TAKE,
      orderBy: { name: 'asc' },
    }),
    prisma.college.findMany({
      where: collegeWhere,
      select: { id: true, name: true },
      take: TAKE,
      orderBy: { name: 'asc' },
    }),
    prisma.department.findMany({
      where: departmentWhere,
      select: { id: true, name: true, college: { select: { id: true, name: true } } },
      take: TAKE,
      orderBy: { name: 'asc' },
    }),
  ]);

  return res.json({
    success: true,
    data: { students, doctors, courses, colleges, departments },
  });
});
