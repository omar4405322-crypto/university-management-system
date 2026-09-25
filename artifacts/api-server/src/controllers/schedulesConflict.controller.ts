/**
 * schedulesConflict.controller.ts
 *
 * Handles the schedule conflict-check endpoint. Resolves doctor/TA names
 * via DB lookup when IDs are not supplied, then delegates to TimetableService.
 * Enforces role-based scoping (SEC-001):
 * - STUDENT is disallowed
 * - DOCTOR/TEACHING_ASSISTANT/DEPARTMENT_ADMIN are locked to their own department
 * - COLLEGE_ADMIN is restricted to departments within their managed college
 * - SUPER_ADMIN is unrestricted
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import catchAsync from '../utils/catchAsync';
import { AuthorizationError } from '../utils/appError';
import { getScopeWhere } from '../utils/scope.utils';
import { TimetableService } from '../services/timetable.service';
import { resolveDoctorByName, resolveTaByName } from './schedulesStaffResolver';

export const checkScheduleConflict = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    // 1. Authorize: block unauthorized callers and students
    if (!req.user || req.user.role === 'STUDENT') {
      return next(new AuthorizationError('Students are not authorized to check schedule conflicts'));
    }

    const {
      dayOfWeek,
      startTime,
      endTime,
      room,
      doctorName,
      doctorId,
      teachingAssistantId,
      taName,
      courseName,
      courseId,
      departmentId,
      academicYear,
      semester,
      groupId,
      excludeSlotId,
    } = req.body;

    if (!dayOfWeek || !startTime || !endTime) {
      return res.json({ success: true, hasConflict: false, conflicts: [] });
    }

    // 2. Department Scoping via getScopeWhere / user profile
    let userDeptId: number | null = null;
    if (req.user.role === 'DOCTOR') {
      userDeptId = req.user.doctor?.departmentId || req.user.departmentId || null;
    } else if (req.user.role === 'TEACHING_ASSISTANT') {
      userDeptId = (req.user as any).teachingAssistant?.departmentId || req.user.departmentId || null;
    } else if (req.user.role === 'DEPARTMENT_ADMIN') {
      userDeptId = req.user.managedDepartmentId || req.user.departmentId || null;
    }

    const deptScope = getScopeWhere(req.user, 'department') as Record<string, any>;
    if (req.user.role !== 'SUPER_ADMIN' && !deptScope.collegeId && !userDeptId) {
      return next(new AuthorizationError('Access denied: No department assigned to your account'));
    }

    let effectiveDeptId: number | null = null;
    let resolvedCourseId: number | null = courseId ? Number(courseId) : null;

    if (userDeptId) {
      // DOCTOR, TEACHING_ASSISTANT, DEPARTMENT_ADMIN: strictly locked to assigned department
      if (departmentId && Number(departmentId) !== userDeptId) {
        return next(
          new AuthorizationError(
            'Access denied: You can only check conflicts for your assigned department'
          )
        );
      }
      effectiveDeptId = userDeptId;

      if (resolvedCourseId) {
        const c = await prisma.course.findFirst({
          where: { id: resolvedCourseId, departmentId: userDeptId },
          select: { id: true },
        });
        if (!c) {
          return next(
            new AuthorizationError(
              'Access denied: Course is outside your assigned department'
            )
          );
        }
      } else if (courseName) {
        const c = await prisma.course.findFirst({
          where: {
            name: { equals: String(courseName).trim(), mode: 'insensitive' },
            departmentId: userDeptId,
          },
          select: { id: true },
        });
        if (c) resolvedCourseId = c.id;
      }
    } else if (deptScope.collegeId) {
      // COLLEGE_ADMIN / ADMIN: restricted to departments within their managed college
      const managedCollegeId = deptScope.collegeId;
      if (departmentId) {
        const targetDeptId = Number(departmentId);
        const dept = await prisma.department.findFirst({
          where: { id: targetDeptId, collegeId: managedCollegeId },
          select: { id: true },
        });
        if (!dept) {
          return next(
            new AuthorizationError(
              'Access denied: Department is outside your managed scope'
            )
          );
        }
        effectiveDeptId = dept.id;
      }

      if (resolvedCourseId) {
        const c = await prisma.course.findFirst({
          where: {
            id: resolvedCourseId,
            department: { collegeId: managedCollegeId },
          },
          select: { id: true, departmentId: true },
        });
        if (!c) {
          return next(
            new AuthorizationError(
              'Access denied: Course is outside your managed scope'
            )
          );
        }
        if (!effectiveDeptId) effectiveDeptId = c.departmentId;
      } else if (courseName) {
        const c = await prisma.course.findFirst({
          where: {
            name: { equals: String(courseName).trim(), mode: 'insensitive' },
            department: { collegeId: managedCollegeId },
          },
          select: { id: true, departmentId: true },
        });
        if (c) {
          resolvedCourseId = c.id;
          if (!effectiveDeptId) effectiveDeptId = c.departmentId;
        }
      }
    } else {
      // SUPER_ADMIN: unrestricted
      effectiveDeptId = departmentId ? Number(departmentId) : null;
      if (!resolvedCourseId && courseName) {
        const c = await prisma.course.findFirst({
          where: { name: { equals: String(courseName).trim(), mode: 'insensitive' } },
          select: { id: true, departmentId: true },
        });
        if (c) {
          resolvedCourseId = c.id;
          if (!effectiveDeptId && c.departmentId) effectiveDeptId = c.departmentId;
        }
      } else if (resolvedCourseId && !effectiveDeptId) {
        const c = await prisma.course.findUnique({
          where: { id: resolvedCourseId },
          select: { departmentId: true },
        });
        if (c?.departmentId) effectiveDeptId = c.departmentId;
      }
    }

    // 3. Staff ID Validation
    let targetDoctorId: number | null = doctorId ? Number(doctorId) : null;
    let targetTaId: string | null = teachingAssistantId ? String(teachingAssistantId) : null;

    if (userDeptId) {
      if (targetDoctorId) {
        const doc = await prisma.doctor.findFirst({
          where: { id: targetDoctorId, departmentId: userDeptId },
          select: { id: true },
        });
        if (!doc) {
          return next(
            new AuthorizationError(
              'Access denied: Doctor is outside your assigned department'
            )
          );
        }
      }
      if (targetTaId) {
        const ta = await prisma.teachingAssistant.findFirst({
          where: { id: targetTaId, departmentId: userDeptId },
          select: { id: true },
        });
        if (!ta) {
          return next(
            new AuthorizationError(
              'Access denied: Teaching assistant is outside your assigned department'
            )
          );
        }
      }
    } else if (deptScope.collegeId) {
      if (targetDoctorId) {
        const doc = await prisma.doctor.findFirst({
          where: { id: targetDoctorId, department: { collegeId: deptScope.collegeId } },
          select: { id: true },
        });
        if (!doc) {
          return next(
            new AuthorizationError(
              'Access denied: Doctor is outside your managed scope'
            )
          );
        }
      }
      if (targetTaId) {
        const ta = await prisma.teachingAssistant.findFirst({
          where: { id: targetTaId, department: { collegeId: deptScope.collegeId } },
          select: { id: true },
        });
        if (!ta) {
          return next(
            new AuthorizationError(
              'Access denied: Teaching assistant is outside your managed scope'
            )
          );
        }
      }
    }

    // 4. Disambiguation checks for name-based lookup
    const initialConflicts: Array<{ type: string; messageAr: string; messageEn: string }> = [];

    if (!targetDoctorId && doctorName) {
      const docResolve = await resolveDoctorByName(doctorName, effectiveDeptId);
      if (docResolve.isAmbiguous) {
        initialConflicts.push({
          type: 'AMBIGUOUS_DOCTOR',
          messageAr: `يوجد أكثر من عضو هيئة تدريس يطابق الاسم (${doctorName}). يرجى اختيار المحاضر من القائمة أو عبر المعرّف (Doctor ID) لتفادي الالتباس.`,
          messageEn: `Multiple faculty members match the name (${doctorName}). Please select the instructor from the list or use their numeric ID to disambiguate.`,
        });
      } else if (docResolve.id) {
        targetDoctorId = docResolve.id;
      }
    }

    if (!targetTaId && taName) {
      const taResolve = await resolveTaByName(taName, effectiveDeptId);
      if (taResolve.isAmbiguous) {
        initialConflicts.push({
          type: 'AMBIGUOUS_TA',
          messageAr: `يوجد أكثر من معيد/مدرس مساعد يطابق الاسم (${taName}). يرجى اختيار المعيد من القائمة أو عبر المعرّف (TA ID) لتفادي الالتباس.`,
          messageEn: `Multiple teaching assistants match the name (${taName}). Please select the TA from the list or use their ID to disambiguate.`,
        });
      } else if (taResolve.id) {
        targetTaId = taResolve.id;
      }
    }

    const serviceConflicts = await TimetableService.findConflicts({
      dayOfWeek,
      startTime,
      endTime,
      room,
      doctorId: targetDoctorId,
      teachingAssistantId: targetTaId,
      courseId: resolvedCourseId,
      departmentId: effectiveDeptId,
      academicYear: academicYear ? Number(academicYear) : null,
      semester: semester ? Number(semester) : null,
      groupId: groupId ? Number(groupId) : null,
      excludeSlotId: excludeSlotId ? Number(excludeSlotId) : undefined,
    });

    const allConflicts = [...initialConflicts, ...serviceConflicts];

    return res.json({
      success: true,
      hasConflict: allConflicts.length > 0,
      conflicts: allConflicts,
    });
  }
);
