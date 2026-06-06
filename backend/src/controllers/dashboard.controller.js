// FIXED: Dashboard queries match Exam schema (room column in DB)
const prisma = require('../utils/prismaClient');
const { getCache, setCache } = require('../utils/redis.utils');
const catchAsync = require('../utils/catchAsync');

const getTodayDayOfWeek = () => {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[new Date().getDay()];
};

exports.getAdminStats = catchAsync(async (req, res) => {
  const today = getTodayDayOfWeek();

  // Enforce scope
  const scopeWhere = {};
  let collegeId = req.user.collegeId || 'ALL';
  let departmentId = req.user.departmentId || 'ALL';

  if (req.user.role === 'COLLEGE_ADMIN') {
    scopeWhere.department = { collegeId: req.user.collegeId };
  } else if (req.user.role === 'DEPARTMENT_ADMIN') {
    scopeWhere.departmentId = req.user.departmentId;
  }

  const cacheKey = `dashboard:${req.user.role}:${collegeId}:${departmentId}`;
  const cachedData = await getCache(cacheKey);
  if (cachedData) {
    return res.json({ success: true, data: cachedData, fromCache: true });
  }

  const [
    totalStudents,
    totalDoctors,
    totalCourses,
    totalPayments,
    totalColleges,
    totalAdmins,
    totalSuperAdmins,
    totalAtRiskStudents,
    financeStats,
    recentStudents,
    recentPayments,
    upcomingExams,
    todaySchedule,
    enrollmentByYear,
    collegesWithStudents
  ] = await Promise.all([
    prisma.student.count({ where: scopeWhere }),
    prisma.doctor.count({ where: scopeWhere }),
    prisma.course.count({ where: scopeWhere }),
    prisma.payment.count({ where: { student: scopeWhere } }),
    prisma.college.count(req.user.role === 'SUPER_ADMIN' ? {} : { where: { id: req.user.collegeId } }),
    prisma.user.count({ where: { role: { in: ['ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'] } } }),
    prisma.user.count({ where: { role: 'SUPER_ADMIN' } }),
    prisma.studentSuccessMetric.count({
      where: {
        predictedRisk: { in: ['HIGH', 'CRITICAL'] },
        student: scopeWhere
      }
    }),
    prisma.payment.groupBy({
      where: { student: scopeWhere },
      by: ['status'],
      _sum: { amount: true },
    }),
    prisma.student.findMany({
      where: scopeWhere,
      take: 5,
      orderBy: { enrolledAt: 'desc' },
      select: { firstName: true, lastName: true, studentId: true, enrolledAt: true }
    }),
    prisma.payment.findMany({
      where: { student: scopeWhere },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { firstName: true, lastName: true } }
      }
    }),
    prisma.exam.findMany({
      where: { 
        course: scopeWhere,
        date: { gte: new Date() } 
      },
      take: 3,
      orderBy: { date: 'asc' },
      include: { course: { select: { name: true } } }
    }),
    prisma.schedule.findMany({
      where: { 
        dayOfWeek: today,
        course: scopeWhere
      },
      include: {
        course: {
          select: {
            name: true,
            doctor: { select: { firstName: true, lastName: true } }
          }
        }
      }
    }),
    prisma.student.groupBy({
      by: ['enrolledAt'],
      _count: { _all: true },
      where: scopeWhere,
    }),
    prisma.college.findMany({
      where: req.user.role === 'SUPER_ADMIN' ? {} : { id: req.user.collegeId },
      select: {
        name: true,
        departments: {
          select: {
            _count: { select: { students: true } }
          }
        }
      }
    })
  ]);

  // Process enrollment by year
  const enrollmentTrends = enrollmentByYear.reduce((acc, curr) => {
    const year = new Date(curr.enrolledAt).getFullYear();
    acc[year] = (acc[year] || 0) + curr._count._all;
    return acc;
  }, {});

  const enrollmentData = Object.keys(enrollmentTrends)
    .sort()
    .map(year => ({
      name: year,
      students: enrollmentTrends[year]
    }));

  const growthData = enrollmentData.map((row) => ({
    name: row.name,
    value: row.students
  }));

  const collegeDistribution = collegesWithStudents.map((college) => ({
    name: college.name,
    students: college.departments.reduce(
      (sum, dept) => sum + dept._count.students,
      0
    )
  }));

  const finance = {
    totalCollected: financeStats.find(s => s.status === 'PAID')?._sum.amount || 0,
    totalPending: financeStats.find(s => s.status === 'PENDING')?._sum.amount || 0,
    totalOverdue: financeStats.find(s => s.status === 'OVERDUE')?._sum.amount || 0,
  };

  const responseData = {
    counts: { totalStudents, totalDoctors, totalCourses, totalPayments, totalColleges, totalAdmins, totalSuperAdmins, totalAtRiskStudents },
    finance,
    recentStudents,
    enrollmentData,
    growthData,
    collegeDistribution,
    financeOverview: [
      { name: 'PAID', value: finance.totalCollected },
      { name: 'PENDING', value: finance.totalPending },
      { name: 'OVERDUE', value: finance.totalOverdue }
    ].filter((item) => item.value > 0),
    recentPayments: recentPayments.map(p => ({
      amount: p.amount,
      type: p.type,
      status: p.status,
      studentName: `${p.student.firstName} ${p.student.lastName}`
    })),
    upcomingExams: upcomingExams.map(e => ({
      courseName: e.course.name,
      type: e.type,
      date: e.date,
      room: e.room
    })),
    todaySchedule: todaySchedule.map(s => ({
      courseName: s.course.name,
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room,
      doctorName: s.course.doctor ? `Dr. ${s.course.doctor.firstName} ${s.course.doctor.lastName}` : 'TBA'
    }))
  };

  await setCache(cacheKey, responseData, 300); // 5 min TTL

  res.json({
    success: true,
    data: responseData
  });
});

exports.getStudentStats = catchAsync(async (req, res) => {
  const today = getTodayDayOfWeek();
  const student = await prisma.student.findUnique({
    where: { userId: req.user.id },
    include: { 
      department: { include: { college: true } },
      successMetrics: true
    }
  });

  if (!student) {
    return next(new NotFoundError('Student profile not found'));
  }

  // Year detection
  const enrolledDate = new Date(student.enrolledAt);
  const now = new Date();
  const yearsDiff = now.getFullYear() - enrolledDate.getFullYear();
  const studentYear = Math.max(1, yearsDiff + 1);

  // Semester detection
  const month = now.getMonth() + 1; // 1-12
  let semester = 1; // Default to Fall
  if (month >= 2 && month <= 6) semester = 2; // Spring
  else if (month >= 7 && month <= 8) semester = 3; // Summer

  const [paymentStats, upcomingExams, todaySchedule, curriculumCourses, upcomingQuizzes, pendingTasks] = await Promise.all([
    prisma.payment.groupBy({
      where: { studentId: student.id },
      by: ['status'],
      _sum: { amount: true },
      _count: { _all: true }
    }),
    prisma.exam.findMany({
      take: 3,
      where: { 
        date: { gte: new Date() },
        course: {
          students: {
            some: { id: student.id }
          }
        }
      },
      orderBy: { date: 'asc' },
      include: { course: { select: { name: true } } }
    }),
    prisma.schedule.findMany({
      where: { 
        dayOfWeek: today,
        course: {
          students: {
            some: { id: student.id }
          }
        }
      },
      include: {
        course: {
          select: {
            name: true,
            doctor: { select: { firstName: true, lastName: true } }
          }
        }
      }
    }),
    prisma.course.findMany({
      where: {
        departmentId: student.departmentId,
        year: studentYear,
        semester: semester
      }
    }),
    prisma.quiz.findMany({
      take: 3,
      where: {
        course: {
          students: {
            some: { id: student.id }
          }
        },
        endTime: { gte: new Date() }
      },
      include: { course: true }
    }),
    prisma.task.findMany({
      take: 3,
      where: {
        course: {
          students: {
            some: { id: student.id }
          }
        },
        dueDate: { gte: new Date() }
      },
      include: { course: true }
    })
  ]);

  const myPayments = {
    pending: {
      count: paymentStats.find(s => s.status === 'PENDING')?._count._all || 0,
      amount: paymentStats.find(s => s.status === 'PENDING')?._sum.amount || 0
    },
    paid: {
      count: paymentStats.find(s => s.status === 'PAID')?._count._all || 0,
      amount: paymentStats.find(s => s.status === 'PAID')?._sum.amount || 0
    },
    overdue: {
      count: paymentStats.find(s => s.status === 'OVERDUE')?._count._all || 0,
      amount: paymentStats.find(s => s.status === 'OVERDUE')?._sum.amount || 0
    }
  };

  res.json({
    success: true,
    data: {
      profile: {
        firstName: student.firstName,
        lastName: student.lastName,
        studentId: student.studentId,
        enrolledAt: student.enrolledAt,
        department: student.department ? student.department.name : 'N/A',
        college: student.department?.college ? student.department.college.name : 'N/A',
        year: studentYear,
        semester: semester,
        successMetrics: student.successMetrics
      },
      curriculum: curriculumCourses,
      myPayments,
      upcomingExams: upcomingExams.map(e => ({
        courseName: e.course.name,
        type: e.type,
        date: e.date,
        room: e.room
      })),
      todaySchedule: todaySchedule.map(s => ({
        courseName: s.course.name,
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room,
        doctorName: s.course.doctor ? `Dr. ${s.course.doctor.firstName} ${s.course.doctor.lastName}` : 'TBA'
      })),
      upcomingQuizzes,
      pendingTasks
    }
  });
});

exports.getDoctorStats = catchAsync(async (req, res) => {
  const today = getTodayDayOfWeek();
  const doctor = await prisma.doctor.findUnique({
    where: { userId: req.user.id },
    select: { id: true, firstName: true, lastName: true, doctorId: true, specialty: true }
  });

  if (!doctor) {
    return next(new NotFoundError('Doctor profile not found'));
  }

  const [myCourses, todaySchedule, upcomingExams] = await Promise.all([
    prisma.course.findMany({
      where: { doctorId: doctor.id },
      select: { courseCode: true, name: true, credits: true, maxStudents: true }
    }),
    prisma.schedule.findMany({
      where: {
        dayOfWeek: today,
        course: { doctorId: doctor.id }
      },
      include: { course: { select: { name: true } } }
    }),
    prisma.exam.findMany({
      take: 3,
      where: {
        date: { gte: new Date() },
        course: { doctorId: doctor.id }
      },
      orderBy: { date: 'asc' },
      include: { course: { select: { name: true } } }
    })
  ]);

  res.json({
    success: true,
    data: {
      profile: {
        firstName: doctor.firstName,
        lastName: doctor.lastName,
        doctorId: doctor.doctorId,
        specialty: doctor.specialty
      },
      myCourses,
      todaySchedule: todaySchedule.map(s => ({
        courseName: s.course.name,
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room
      })),
      upcomingExams: upcomingExams.map(e => ({
        courseName: e.course.name,
        type: e.type,
        date: e.date,
        room: e.room
      }))
    }
  });
});
