// FIXED [Phase 7.2]: Global search across students, doctors, courses, colleges, departments
import { Request, Response } from 'express';
import prisma from '../utils/prismaClient.js';
import catchAsync from '../utils/catchAsync.js';

const TAKE = 8;

export const globalSearch = catchAsync(async (req: Request, res: Response) => {
  const q = ((req.query.q as string) || '').trim();
  
  if (q.length < 2 || req.user!.role === 'STUDENT') {
    return res.json({
      success: true,
      data: { students: [], doctors: [], courses: [], colleges: [], departments: [] },
    });
  }

  const contains = { contains: q, mode: 'insensitive' as const };

  let studentWhere: any = { OR: [ { firstName: contains }, { lastName: contains }, { studentId: contains }, { user: { email: contains } } ] };
  let doctorWhere: any = { OR: [ { firstName: contains }, { lastName: contains }, { doctorId: contains }, { user: { email: contains } } ] };
  let courseWhere: any = { OR: [{ name: contains }, { courseCode: contains }] };
  let collegeWhere: any = { name: contains };
  let departmentWhere: any = { name: contains };

  if (req.user!.role === 'COLLEGE_ADMIN' && req.user!.managedCollegeId) {
    studentWhere.department = { collegeId: req.user!.managedCollegeId };
    doctorWhere.department = { collegeId: req.user!.managedCollegeId };
    courseWhere.department = { collegeId: req.user!.managedCollegeId };
    collegeWhere.id = req.user!.managedCollegeId;
    departmentWhere.collegeId = req.user!.managedCollegeId;
  } else if (req.user!.role === 'COLLEGE_ADMIN' && req.user!.collegeId) {
    studentWhere.department = { collegeId: req.user!.collegeId };
    doctorWhere.department = { collegeId: req.user!.collegeId };
    courseWhere.department = { collegeId: req.user!.collegeId };
    collegeWhere.id = req.user!.collegeId;
    departmentWhere.collegeId = req.user!.collegeId;
  }

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

  res.json({
    success: true,
    data: { students, doctors, courses, colleges, departments },
  });
});
