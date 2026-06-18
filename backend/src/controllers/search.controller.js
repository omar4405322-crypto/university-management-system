// FIXED [Phase 7.2]: Global search across students, doctors, courses, colleges, departments
const prisma = require('../utils/prismaClient');
const catchAsync = require('../utils/catchAsync');

const TAKE = 8;

exports.globalSearch = catchAsync(async (req, res) => {
  const q = (req.query.q || '').trim();
  
  if (q.length < 2 || req.user.role === 'STUDENT') {
    return res.json({
      success: true,
      data: { students: [], doctors: [], courses: [], colleges: [], departments: [] },
    });
  }

  const contains = { contains: q, mode: 'insensitive' };

  let studentWhere = { OR: [ { firstName: contains }, { lastName: contains }, { studentId: contains }, { user: { email: contains } } ] };
  let doctorWhere = { OR: [ { firstName: contains }, { lastName: contains }, { doctorId: contains }, { user: { email: contains } } ] };
  let courseWhere = { OR: [{ name: contains }, { courseCode: contains }] };
  let collegeWhere = { name: contains };
  let departmentWhere = { name: contains };

  if (req.user.role === 'COLLEGE_ADMIN' && req.user.managedCollegeId) {
    studentWhere.department = { collegeId: req.user.managedCollegeId };
    doctorWhere.department = { collegeId: req.user.managedCollegeId };
    courseWhere.department = { collegeId: req.user.managedCollegeId };
    collegeWhere.id = req.user.managedCollegeId;
    departmentWhere.collegeId = req.user.managedCollegeId;
  } else if (req.user.role === 'COLLEGE_ADMIN' && req.user.collegeId) {
    studentWhere.department = { collegeId: req.user.collegeId };
    doctorWhere.department = { collegeId: req.user.collegeId };
    courseWhere.department = { collegeId: req.user.collegeId };
    collegeWhere.id = req.user.collegeId;
    departmentWhere.collegeId = req.user.collegeId;
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
