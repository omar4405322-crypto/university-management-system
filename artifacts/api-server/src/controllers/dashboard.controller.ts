// FIXED: Dashboard queries match Exam schema (room column in DB)
import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import { getCache, setCache } from '../utils/redis.utils';
import catchAsync from '../utils/catchAsync';
import { getScopeWhere } from '../utils/scope.utils';
import { AppError, NotFoundError } from '../utils/appError';

const getTodayDayOfWeek = () => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date().getDay()];
};

export const getAdminStats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const today = getTodayDayOfWeek();

  // Use centralized scope utility for each entity type
  const studentScope: any = getScopeWhere(req.user!, 'student');
  const doctorScope: any = getScopeWhere(req.user!, 'doctor');
  const courseScope: any = getScopeWhere(req.user!, 'course');
  const departmentScope: any = getScopeWhere(req.user!, 'department');
  const paymentScope: any = { student: studentScope };
  const examScope: any = getScopeWhere(req.user!, 'exam');

  let collegeId: string | number = 'ALL';
  let departmentId: string | number = 'ALL';

  if (req.user!.role === 'COLLEGE_ADMIN' && req.user!.managedCollegeId) {
    collegeId = req.user!.managedCollegeId;
  } else if (req.user!.role === 'DEPARTMENT_ADMIN' && req.user!.managedDepartmentId) {
    departmentId = req.user!.managedDepartmentId;
  }

  const cacheKey = `dashboard:${req.user!.role}:${collegeId}:${departmentId}`;
  const cachedData = await getCache(cacheKey);
  if (cachedData) {
    return res.json({ success: true, data: cachedData, fromCache: true });
  }

  // Safe college count (avoid passing null id)
  const collegeWhere: any =
    req.user!.role === 'SUPER_ADMIN'
      ? {}
      : req.user!.managedCollegeId
        ? { id: req.user!.managedCollegeId }
        : {};
  const totalColleges = await prisma.college.count({ where: collegeWhere });

  const [
    totalStudents,
    totalDoctors,
    totalCourses,
    totalDepartments,
    totalPayments,
    totalAdmins,
    totalSuperAdmins,
    totalAtRiskStudents,
    financeStats,
    recentStudents,
    recentPayments,
    upcomingExams,
    todaySchedule,
    enrollmentByYear,
    collegesWithStudents,
  ] = await Promise.all([
    prisma.student.count({ where: studentScope }),
    prisma.doctor.count({ where: doctorScope }),
    prisma.course.count({ where: courseScope }),
    prisma.department.count({ where: departmentScope }),
    prisma.payment.count({ where: paymentScope }),
    prisma.user.count({ where: { role: { in: ['ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'] } } }),
    prisma.user.count({ where: { role: 'SUPER_ADMIN' } }),
    prisma.studentSuccessMetric.count({
      where: {
        predictedRisk: { in: ['HIGH', 'CRITICAL'] },
        student: studentScope,
      },
    }),
    prisma.payment.groupBy({
      where: paymentScope,
      by: ['status'],
      _sum: { amount: true },
    }),
    prisma.student.findMany({
      where: studentScope,
      take: 5,
      orderBy: { enrolledAt: 'desc' },
      select: { firstName: true, lastName: true, studentId: true, enrolledAt: true },
    }),
    prisma.payment.findMany({
      where: paymentScope,
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.exam.findMany({
      where: {
        course: examScope.course,
        date: { gte: new Date() },
      },
      take: 3,
      orderBy: { date: 'asc' },
      include: { course: { select: { name: true } } },
    }),
    prisma.scheduleSlot.findMany({
      where: {
        dayOfWeek: today,
        course: courseScope,
      },
      include: {
        course: { select: { name: true } },
        doctor: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.student.groupBy({
      by: ['enrolledAt'],
      _count: { _all: true },
      where: studentScope,
    }),
    prisma.college.findMany({
      where:
        req.user!.role === 'SUPER_ADMIN'
          ? {}
          : req.user!.managedCollegeId
            ? { id: req.user!.managedCollegeId }
            : {},
      select: {
        name: true,
        departments: {
          select: {
            _count: { select: { students: true } },
          },
        },
      },
    }),
  ]);

  // Process enrollment by year
  const enrollmentTrends = enrollmentByYear.reduce((acc: any, curr: any) => {
    const year = new Date(curr.enrolledAt).getFullYear();
    acc[year] = (acc[year] || 0) + curr._count._all;
    return acc;
  }, {});

  const enrollmentData = Object.keys(enrollmentTrends)
    .sort()
    .map((year) => ({
      name: year,
      students: enrollmentTrends[year],
    }));

  const growthData = enrollmentData.map((row) => ({
    name: row.name,
    value: row.students,
  }));

  const collegeDistribution = collegesWithStudents.map((college: any) => ({
    name: college.name,
    students: college.departments.reduce((sum: number, dept: any) => sum + dept._count.students, 0),
  }));

  const finance = {
    totalCollected: financeStats.find((s) => s.status === 'PAID')?._sum.amount || 0,
    totalPending: financeStats.find((s) => s.status === 'PENDING')?._sum.amount || 0,
    totalOverdue: financeStats.find((s) => s.status === 'OVERDUE')?._sum.amount || 0,
  };

  const responseData = {
    counts: {
      totalStudents,
      totalDoctors,
      totalCourses,
      totalDepartments,
      totalPayments,
      totalColleges,
      totalAdmins,
      totalSuperAdmins,
      totalAtRiskStudents,
    },
    finance,
    recentStudents,
    enrollmentData,
    growthData,
    collegeDistribution,
    financeOverview: [
      { name: 'PAID', value: finance.totalCollected },
      { name: 'PENDING', value: finance.totalPending },
      { name: 'OVERDUE', value: finance.totalOverdue },
    ].filter((item) => item.value > 0),
    recentPayments: recentPayments.map((p: any) => ({
      amount: p.amount,
      type: p.type,
      status: p.status,
      studentName: `${p.student.firstName} ${p.student.lastName}`,
    })),
    upcomingExams: upcomingExams.map((e: any) => ({
      courseName: e.course.name,
      type: e.type,
      date: e.date,
      room: e.room,
    })),
    todaySchedule: todaySchedule.map((s: any) => ({
      courseName: s.course?.name || 'N/A',
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room,
      doctorName: s.doctor
        ? `Dr. ${s.doctor.firstName} ${s.doctor.lastName}`
        : 'TBA',
    })),
  };

  await setCache(cacheKey, responseData, 300); // 5 min TTL

  return res.json({
    success: true,
    data: responseData,
  });
});

export const getStudentStats = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const today = getTodayDayOfWeek();
    const student = await prisma.student.findUnique({
      where: { userId: req.user!.id },
      include: {
        department: { include: { college: true } },
        successMetrics: true,
      },
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
    if (month >= 2 && month <= 6)
      semester = 2; // Spring
    else if (month >= 7 && month <= 8) semester = 3; // Summer

    const [
      paymentStats,
      upcomingExams,
      todaySchedule,
      curriculumCourses,
      upcomingQuizzes,
      pendingTasks,
    ] = await Promise.all([
      prisma.payment.groupBy({
        where: { studentId: student.id },
        by: ['status'],
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.exam.findMany({
        take: 3,
        where: {
          date: { gte: new Date() },
          course: {
            enrollments: {
              some: { studentId: student.id, status: 'ENROLLED' },
            },
          },
        },
        orderBy: { date: 'asc' },
        include: { course: { select: { name: true } } },
      }),
      prisma.scheduleSlot.findMany({
        where: {
          dayOfWeek: today,
          OR: [
            { groupId: student.groupId || -1 },
            { slotType: 'LECTURE', groupId: null, course: { departmentId: student.departmentId } },
          ],
        },
        include: {
          course: { select: { name: true } },
          doctor: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.course.findMany({
        where: {
          departmentId: student.departmentId,
          year: studentYear,
          semester: semester,
        },
      }),
      prisma.quiz.findMany({
        take: 3,
        where: {
          course: {
            enrollments: {
              some: { studentId: student.id, status: 'ENROLLED' },
            },
          },
          endTime: { gte: new Date() },
        },
        include: { course: true },
      }),
      prisma.task.findMany({
        take: 3,
        where: {
          course: {
            enrollments: {
              some: { studentId: student.id, status: 'ENROLLED' },
            },
          },
          dueDate: { gte: new Date() },
        },
        include: { course: true },
      }),
    ]);

    const myPayments = {
      pending: {
        count: paymentStats.find((s) => s.status === 'PENDING')?._count._all || 0,
        amount: paymentStats.find((s) => s.status === 'PENDING')?._sum.amount || 0,
      },
      paid: {
        count: paymentStats.find((s) => s.status === 'PAID')?._count._all || 0,
        amount: paymentStats.find((s) => s.status === 'PAID')?._sum.amount || 0,
      },
      overdue: {
        count: paymentStats.find((s) => s.status === 'OVERDUE')?._count._all || 0,
        amount: paymentStats.find((s) => s.status === 'OVERDUE')?._sum.amount || 0,
      },
    };

    return res.json({
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
          successMetrics: student.successMetrics,
        },
        curriculum: curriculumCourses,
        myPayments,
        upcomingExams: upcomingExams.map((e: any) => ({
          courseName: e.course.name,
          type: e.type,
          date: e.date,
          room: e.room,
        })),
        todaySchedule: todaySchedule.map((s: any) => ({
          courseName: s.course?.name || 'N/A',
          startTime: s.startTime,
          endTime: s.endTime,
          room: s.room,
          doctorName: s.doctor
            ? `Dr. ${s.doctor.firstName} ${s.doctor.lastName}`
            : 'TBA',
        })),
        upcomingQuizzes,
        pendingTasks,
      },
    });
  }
);

export const getDoctorStats = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const today = getTodayDayOfWeek();
    const doctor = await prisma.doctor.findUnique({
      where: { userId: req.user!.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        doctorId: true,
        specialty: true,
        departmentId: true,
        department: {
          select: {
            name: true,
            nameAr: true,
            college: { select: { name: true, nameAr: true } },
          },
        },
      },
    });

    if (!doctor) {
      return next(new NotFoundError('Doctor profile not found'));
    }

    const [myScheduleSlots, todaySchedule, upcomingExams, recentSubmissions] = await Promise.all([
      prisma.scheduleSlot.findMany({
        where: { doctorId: doctor.id },
        include: {
          course: {
            select: { id: true, courseCode: true, name: true, credits: true, year: true, semester: true, maxStudents: true },
          },
        },
      }),
      prisma.scheduleSlot.findMany({
        where: {
          dayOfWeek: today,
          doctorId: doctor.id,
        },
        include: {
          course: { select: { id: true, name: true, courseCode: true } },
        },
      }),
      prisma.exam.findMany({
        take: 4,
        where: {
          date: { gte: new Date() },
          course: { scheduleSlots: { some: { doctorId: doctor.id } } },
        },
        orderBy: { date: 'asc' },
        include: { course: { select: { name: true, courseCode: true } } },
      }),
      prisma.taskSubmission.findMany({
        take: 5,
        where: { task: { doctorId: doctor.id } },
        orderBy: { submittedAt: 'desc' },
        include: {
          student: { select: { firstName: true, lastName: true } },
          task: { select: { title: true } },
        },
      }),
    ]);

    const uniqueCourses = new Map();
    myScheduleSlots.forEach((slot: any) => {
      if (slot.course) {
        uniqueCourses.set(slot.course.id, slot.course);
      }
    });
    const myCourses = Array.from(uniqueCourses.values());

    const courseIds = Array.from(new Set(myScheduleSlots.map((s: any) => s.courseId).filter(Boolean)));

    const [totalQuizzes, pendingTasks, totalStudents] = await Promise.all([
      prisma.quiz.count({ where: { doctorId: doctor.id } }),
      prisma.taskSubmission.count({ where: { score: null, task: { doctorId: doctor.id } } }),
      prisma.student.count({
        where: doctor.departmentId
          ? {
              OR: [
                { enrollments: { some: { courseId: { in: courseIds } } } },
                { departmentId: doctor.departmentId },
              ],
            }
          : { enrollments: { some: { courseId: { in: courseIds } } } },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        profile: {
          firstName: doctor.firstName,
          lastName: doctor.lastName,
          doctorId: doctor.doctorId,
          specialty: doctor.specialty,
          departmentName: doctor.department?.nameAr || doctor.department?.name || '',
          collegeName: doctor.department?.college?.nameAr || doctor.department?.college?.name || '',
        },
        counts: {
          myCourses: myCourses.length,
          totalStudents,
          totalQuizzes,
          pendingTasks,
        },
        myCourses,
        todaySchedule: todaySchedule.map((s: any) => ({
          id: s.id,
          courseId: s.courseId,
          courseName: s.course?.name || 'N/A',
          courseCode: s.course?.courseCode || '',
          startTime: s.startTime,
          endTime: s.endTime,
          room: s.room || 'N/A',
          slotType: s.slotType,
        })),
        upcomingExams: upcomingExams.map((e: any) => ({
          id: e.id,
          courseName: e.course.name,
          courseCode: e.course.courseCode,
          type: e.type,
          date: e.date,
          room: e.room,
        })),
        recentActivity: recentSubmissions.map((sub: any) => ({
          id: sub.id,
          title: `تسليم واجب: ${sub.task.title}`,
          studentName: `${sub.student.firstName} ${sub.student.lastName}`,
          submittedAt: sub.submittedAt,
        })),
      },
    });
  }
);

export const getPublicLandingStats = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const [
      totalStudents,
      totalColleges,
      totalDoctors,
      totalTAs,
      totalDepartments,
      totalCourses,
      collegesList,
      sampleSlots,
    ] = await Promise.all([
      prisma.student.count(),
      prisma.college.count(),
      prisma.doctor.count(),
      prisma.teachingAssistant.count(),
      prisma.department.count(),
      prisma.course.count(),
      prisma.college.findMany({
        include: {
          departments: {
            select: {
              id: true,
              name: true,
              nameAr: true,
              _count: { select: { courses: true, students: true } },
            },
          },
        },
      }),
      prisma.scheduleSlot.findMany({
        take: 6,
        include: {
          course: { select: { name: true, courseCode: true } },
          doctor: { select: { firstName: true, lastName: true } },
          teachingAssistant: { select: { firstName: true, lastName: true } },
        },
        orderBy: { id: 'asc' },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        totalStudents,
        totalColleges,
        totalFaculty: totalDoctors + totalTAs,
        totalSpecializations: totalDepartments,
        totalCourses,
        colleges: collegesList.map((c: any) => ({
          id: c.id,
          name: c.name,
          nameAr: c.nameAr || c.name,
          description: c.description || '',
          departmentsCount: c.departments?.length || 0,
          studentsCount: c.departments?.reduce((acc: number, d: any) => acc + (d._count?.students || 0), 0) || 0,
        })),
        sampleSlots: sampleSlots.map((s: any) => ({
          id: s.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          sessionType: s.sessionType,
          room: s.room || 'N/A',
          course: s.course?.name || 'مادة دراسية',
          instructor: s.doctor
            ? `د. ${s.doctor.firstName} ${s.doctor.lastName}`
            : s.teachingAssistant
            ? `م. ${s.teachingAssistant.firstName} ${s.teachingAssistant.lastName}`
            : 'أستاذ المادة',
        })),
      },
    });
  }
);
