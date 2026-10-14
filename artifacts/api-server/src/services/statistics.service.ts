import prisma from '../utils/prismaClient';
import { AuthorizationError } from '../utils/appError';
import { getScopeWhere, getEffectiveActiveStudentWhere } from '../utils/scope.utils';
import { calculateStudentGpa } from '../utils/gpa.utils';
import type { AuthActor } from '../types/auth.types';

const ALLOWED_ADMIN_ROLES = new Set(['SUPER_ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN']);

export interface DepartmentStatBreakdown {
  departmentId: number;
  name: string;
  nameAr: string | null;
  collegeId: number | null;
  totalStudents: number;
  activeStudents: number;
}

export interface CollegeStatBreakdown {
  collegeId: number;
  name: string;
  nameAr: string | null;
  totalStudents: number;
  activeStudents: number;
}

export interface AcademicYearBreakdown {
  year: number;
  totalStudents: number;
  activeStudents: number;
}

export interface StandingDistribution {
  EXCELLENT: number;
  VERY_GOOD: number;
  GOOD: number;
  PASS: number;
  PROBATION: number;
  NO_GRADES_YET: number;
}

export interface StatisticsOverviewResult {
  scope: 'UNIVERSITY' | 'COLLEGE' | 'DEPARTMENT';
  entityId?: number | null;
  totalStudents: number;
  activeStudents: number;
  averageGpa: number;
  gradedStudentsCount: number;
  standingDistribution: StandingDistribution;
  byAcademicYear: AcademicYearBreakdown[];
  byDepartment: DepartmentStatBreakdown[];
  byCollege?: CollegeStatBreakdown[];
}

export async function getStatisticsOverview(user: AuthActor): Promise<StatisticsOverviewResult> {
  const role = (user?.role || '').toString().toUpperCase();
  if (!ALLOWED_ADMIN_ROLES.has(role)) {
    throw new AuthorizationError('Forbidden: Only administrative roles can access statistics overview');
  }

  const scope: 'UNIVERSITY' | 'COLLEGE' | 'DEPARTMENT' =
    role === 'SUPER_ADMIN' || role === 'ADMIN'
      ? 'UNIVERSITY'
      : role === 'COLLEGE_ADMIN'
      ? 'COLLEGE'
      : 'DEPARTMENT';

  const entityId =
    scope === 'COLLEGE'
      ? (user.managedCollegeId ?? user.collegeId ?? null)
      : scope === 'DEPARTMENT'
      ? (user.managedDepartmentId ?? user.departmentId ?? null)
      : null;

  // Determine entity scopes
  const studentScope = getScopeWhere(user, 'student');
  const activeStudentScope = getEffectiveActiveStudentWhere(studentScope);
  const departmentScope = getScopeWhere(user, 'department');

  // 1. Total and Active Students in scope
  const [totalStudents, activeStudents] = await Promise.all([
    prisma.student.count({ where: studentScope }),
    prisma.student.count({ where: activeStudentScope }),
  ]);

  // 2. Department Breakdown
  const departments = await prisma.department.findMany({
    where: departmentScope,
    select: {
      id: true,
      name: true,
      nameAr: true,
      collegeId: true,
    },
    orderBy: { name: 'asc' },
  });

  const byDepartment: DepartmentStatBreakdown[] = await Promise.all(
    departments.map(async (dept) => {
      const deptStudentFilter = { AND: [studentScope, { departmentId: dept.id }] };
      const [deptTotal, deptActive] = await Promise.all([
        prisma.student.count({ where: deptStudentFilter }),
        prisma.student.count({ where: getEffectiveActiveStudentWhere(deptStudentFilter) }),
      ]);
      return {
        departmentId: dept.id,
        name: dept.name,
        nameAr: dept.nameAr,
        collegeId: dept.collegeId,
        totalStudents: deptTotal,
        activeStudents: deptActive,
      };
    })
  );

  // 3. College Breakdown (Super Admin only)
  let byCollege: CollegeStatBreakdown[] | undefined;
  if (role === 'SUPER_ADMIN') {
    const colleges = await prisma.college.findMany({
      select: {
        id: true,
        name: true,
        nameAr: true,
      },
      orderBy: { name: 'asc' },
    });

    byCollege = await Promise.all(
      colleges.map(async (col) => {
        const colStudentFilter = { department: { collegeId: col.id } };
        const [colTotal, colActive] = await Promise.all([
          prisma.student.count({ where: colStudentFilter }),
          prisma.student.count({ where: getEffectiveActiveStudentWhere(colStudentFilter) }),
        ]);
        return {
          collegeId: col.id,
          name: col.name,
          nameAr: col.nameAr,
          totalStudents: colTotal,
          activeStudents: colActive,
        };
      })
    );
  }

  // 4. Academic Year Breakdown
  const [yearGroups, activeYearGroups] = await Promise.all([
    prisma.student.groupBy({
      by: ['year'],
      where: studentScope,
      _count: { id: true },
    }),
    prisma.student.groupBy({
      by: ['year'],
      where: activeStudentScope,
      _count: { id: true },
    }),
  ]);

  const activeByYearMap = new Map<number, number>();
  for (const ay of activeYearGroups) {
    activeByYearMap.set(ay.year, ay._count.id);
  }

  const allYears = Array.from(new Set(yearGroups.map((y) => y.year))).sort((a, b) => a - b);
  const byAcademicYear: AcademicYearBreakdown[] = allYears.map((yr) => {
    const totalForYear = yearGroups.find((y) => y.year === yr)?._count.id || 0;
    const activeForYear = activeByYearMap.get(yr) || 0;
    return {
      year: yr,
      totalStudents: totalForYear,
      activeStudents: activeForYear,
    };
  });

  // 5. Average GPA and Academic Standing Distribution (Real student data)
  const scopedStudents = await prisma.student.findMany({
    where: studentScope,
    select: { id: true },
  });

  let gpaSum = 0;
  let gradedCount = 0;
  const standingDistribution: StandingDistribution = {
    EXCELLENT: 0,
    VERY_GOOD: 0,
    GOOD: 0,
    PASS: 0,
    PROBATION: 0,
    NO_GRADES_YET: 0,
  };

  const gpaResults = await Promise.all(
    scopedStudents.map((s) => calculateStudentGpa(s.id))
  );

  for (const res of gpaResults) {
    if (res.totalCreditsAttempted > 0) {
      const gpa = res.cumulativeGpa;
      gpaSum += gpa;
      gradedCount++;

      if (gpa >= 3.5) {
        standingDistribution.EXCELLENT++;
      } else if (gpa >= 3.0) {
        standingDistribution.VERY_GOOD++;
      } else if (gpa >= 2.0) {
        standingDistribution.GOOD++;
      } else if (gpa >= 1.0) {
        standingDistribution.PASS++;
      } else {
        standingDistribution.PROBATION++;
      }
    } else {
      standingDistribution.NO_GRADES_YET++;
    }
  }

  const averageGpa = gradedCount > 0
    ? Math.round((gpaSum / gradedCount) * 100) / 100
    : 0.00;

  return {
    scope,
    entityId,
    totalStudents,
    activeStudents,
    averageGpa,
    gradedStudentsCount: gradedCount,
    standingDistribution,
    byAcademicYear,
    byDepartment,
    byCollege,
  };
}
