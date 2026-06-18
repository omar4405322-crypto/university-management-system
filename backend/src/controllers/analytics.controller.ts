import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient.js';
import catchAsync from '../utils/catchAsync.js';

export const getGeneralAnalytics = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { departmentId, startDate, endDate } = req.query;

  const dateFilter: any = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.gte = new Date(startDate as string);
    if (endDate) dateFilter.createdAt.lte = new Date(endDate as string);
  }

  const scopeWhere: any = {};
  if (departmentId) scopeWhere.departmentId = parseInt(departmentId as string);

  const [
    enrollmentByCollege,
    financialOverview,
    studentYearDistribution,
    departmentStats,
    monthlyEnrollment,
    examStats,
    attendanceOverview
  ] = await Promise.all([
    // 1. Enrollment by College
    prisma.college.findMany({
      select: {
        name: true,
        departments: {
          select: {
            _count: {
              select: { students: true }
            }
          }
        }
      }
    }),

    // 2. Financial Overview
    prisma.payment.groupBy({
      by: ['status'],
      _sum: { amount: true },
      _count: { _all: true },
      where: dateFilter
    }),

    // 3. Student distribution by year
    prisma.student.groupBy({
      by: ['year'],
      _count: { _all: true },
      where: scopeWhere
    }),

    // 4. Department Stats
    prisma.department.findMany({
      select: {
        name: true,
        _count: {
          select: { students: true, doctors: true, courses: true }
        }
      }
    }),

    // 5. Monthly Enrollment Trends (Last 12 months)
    prisma.student.findMany({
      where: {
        enrolledAt: {
          gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1))
        },
        ...scopeWhere
      },
      select: { enrolledAt: true }
    }),

    // 6. Exam Statistics
    prisma.exam.groupBy({
      by: ['type'],
      _count: { _all: true }
    }),

    // 7. Attendance Overview
    prisma.attendance.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: {
        date: {
          gte: new Date(new Date().setDate(new Date().getDate() - 30)) // Last 30 days
        }
      }
    })
  ]);

  // Process Enrollment by College
  const collegeData = enrollmentByCollege.map((college: any) => ({
    name: college.name,
    students: college.departments.reduce((sum: number, dept: any) => sum + dept._count.students, 0)
  }));

  // Process Monthly Enrollment
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const trendData = monthlyEnrollment.reduce((acc: any, student: any) => {
    const month = months[new Date(student.enrolledAt).getMonth()];
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {});

  const trendArray = months.map(month => ({
    name: month,
    count: trendData[month] || 0
  }));

  res.json({
    success: true,
    data: {
      collegeDistribution: collegeData,
      finance: financialOverview,
      yearDistribution: studentYearDistribution,
      departmentStats,
      enrollmentTrends: trendArray,
      examStats,
      attendanceOverview
    }
  });
});
