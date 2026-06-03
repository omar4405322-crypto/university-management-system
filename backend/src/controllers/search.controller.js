// FIXED [Phase 7.2]: Global search across students, doctors, courses, colleges, departments
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const catchAsync = require('../utils/catchAsync');

const TAKE = 8;

exports.globalSearch = catchAsync(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) {
    return res.json({
      success: true,
      data: { students: [], doctors: [], courses: [], colleges: [], departments: [] },
    });
  }

  const contains = { contains: q, mode: 'insensitive' };

  const [students, doctors, courses, colleges, departments] = await Promise.all([
    prisma.student.findMany({
      where: {
        OR: [
          { firstName: contains },
          { lastName: contains },
          { studentId: contains },
          { user: { email: contains } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, studentId: true },
      take: TAKE,
      orderBy: { lastName: 'asc' },
    }),
    prisma.doctor.findMany({
      where: {
        OR: [
          { firstName: contains },
          { lastName: contains },
          { doctorId: contains },
          { user: { email: contains } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, doctorId: true },
      take: TAKE,
      orderBy: { lastName: 'asc' },
    }),
    prisma.course.findMany({
      where: {
        OR: [{ name: contains }, { courseCode: contains }],
      },
      select: { id: true, name: true, courseCode: true },
      take: TAKE,
      orderBy: { name: 'asc' },
    }),
    prisma.college.findMany({
      where: { name: contains },
      select: { id: true, name: true },
      take: TAKE,
      orderBy: { name: 'asc' },
    }),
    prisma.department.findMany({
      where: { name: contains },
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
