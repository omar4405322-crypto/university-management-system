import { Request } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prismaClient';
import {
  AppError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from '../utils/appError';
import { auditLog } from '../utils/audit.utils';

export interface ApproveTAPayload {
  teachingAssistantId: string;
  courseId: number;
  reason?: string;
}

export interface ListApprovalsOptions {
  page?: string | number;
  limit?: string | number;
  status?: string;
}

export class TAApprovalService {
  /**
   * Approves a TA for a course across departments.
   * Idempotent: If already APPROVED, returns existing approval.
   * If REVOKED, flips back to APPROVED.
   */
  static async approve(payload: ApproveTAPayload, req: Request) {
    const actor = req.user!;
    const { teachingAssistantId, courseId, reason } = payload;

    // 1. Fetch Course with Department & College
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        department: {
          select: {
            id: true,
            collegeId: true,
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundError('Course not found');
    }

    // 2. Fetch Teaching Assistant with Department
    const ta = await prisma.teachingAssistant.findUnique({
      where: { id: teachingAssistantId },
      include: {
        department: {
          select: {
            id: true,
            collegeId: true,
          },
        },
      },
    });

    if (!ta) {
      throw new NotFoundError('Teaching assistant not found');
    }

    // 3. Rule: TA department must differ from course department (else 400)
    if (ta.departmentId && course.departmentId && ta.departmentId === course.departmentId) {
      throw new AppError('TA department must differ from course department', 400);
    }

    // 4. Authority check: SUPER_ADMIN or COLLEGE_ADMIN whose college owns the COURSE
    if (actor.role === 'SUPER_ADMIN') {
      // Unrestricted
    } else if (actor.role === 'COLLEGE_ADMIN') {
      const managedCollegeId = actor.managedCollegeId || actor.collegeId;
      const courseCollegeId = course.department?.collegeId;
      if (!managedCollegeId || courseCollegeId !== managedCollegeId) {
        throw new AuthorizationError('You can only approve TA assignments for courses in your managed college');
      }
    } else {
      throw new AuthorizationError('You do not have permission to approve cross-department TA assignments');
    }

    // 5. Check if approval already exists
    const existing = await prisma.tACrossDepartmentApproval.findUnique({
      where: {
        teachingAssistantId_courseId: {
          teachingAssistantId,
          courseId,
        },
      },
    });

    if (existing) {
      if (existing.status === 'APPROVED') {
        // Idempotent success
        return { approval: existing, isCreated: false, isFlipped: false };
      }

      // Existing is REVOKED -> Flip back to APPROVED
      const updated = await prisma.tACrossDepartmentApproval.update({
        where: { id: existing.id },
        data: {
          status: 'APPROVED',
          reason: reason !== undefined ? reason : existing.reason,
          approvedByUserId: actor.id,
          revokedByUserId: null,
          revokedAt: null,
        },
      });

      await auditLog(
        'APPROVE_TA_CROSS_DEPARTMENT',
        'TACrossDepartmentApproval',
        updated.id,
        req,
        {
          teachingAssistantId,
          courseId,
          flippedFrom: 'REVOKED',
          reason: updated.reason,
        }
      );

      return { approval: updated, isCreated: false, isFlipped: true };
    }

    // 6. Create new approval
    const approval = await prisma.tACrossDepartmentApproval.create({
      data: {
        teachingAssistantId,
        courseId,
        status: 'APPROVED',
        reason,
        approvedByUserId: actor.id,
      },
    });

    await auditLog(
      'APPROVE_TA_CROSS_DEPARTMENT',
      'TACrossDepartmentApproval',
      approval.id,
      req,
      {
        teachingAssistantId,
        courseId,
        reason: approval.reason,
      }
    );

    return { approval, isCreated: true, isFlipped: false };
  }

  /**
   * Revokes an existing cross-department TA approval.
   */
  static async revoke(approvalId: number, req: Request) {
    const actor = req.user!;

    const approval = await prisma.tACrossDepartmentApproval.findUnique({
      where: { id: approvalId },
      include: {
        course: {
          include: {
            department: {
              select: {
                id: true,
                collegeId: true,
              },
            },
          },
        },
      },
    });

    if (!approval) {
      throw new NotFoundError('Cross-department approval not found');
    }

    // Authority check: SUPER_ADMIN or COLLEGE_ADMIN whose college owns the COURSE
    if (actor.role === 'SUPER_ADMIN') {
      // Unrestricted
    } else if (actor.role === 'COLLEGE_ADMIN') {
      const managedCollegeId = actor.managedCollegeId || actor.collegeId;
      const courseCollegeId = approval.course.department?.collegeId;
      if (!managedCollegeId || courseCollegeId !== managedCollegeId) {
        throw new AuthorizationError('You can only revoke TA assignments for courses in your managed college');
      }
    } else {
      throw new AuthorizationError('You do not have permission to revoke cross-department TA assignments');
    }

    if (approval.status === 'REVOKED') {
      return approval; // Idempotent
    }

    const updated = await prisma.tACrossDepartmentApproval.update({
      where: { id: approvalId },
      data: {
        status: 'REVOKED',
        revokedByUserId: actor.id,
        revokedAt: new Date(),
      },
    });

    await auditLog(
      'REVOKE_TA_CROSS_DEPARTMENT',
      'TACrossDepartmentApproval',
      approvalId,
      req,
      {
        teachingAssistantId: approval.teachingAssistantId,
        courseId: approval.courseId,
        revokedByUserId: actor.id,
      }
    );

    return updated;
  }

  /**
   * Lists cross-department approvals scoped by caller role.
   * - SUPER_ADMIN: all
   * - COLLEGE_ADMIN: courses in their college
   * - DEPARTMENT_ADMIN: courses or TAs in their department
   */
  static async list(options: ListApprovalsOptions, req: Request) {
    const actor = req.user!;
    const { page, limit, status } = options;

    let parsedPage = 1;
    if (page !== undefined && page !== '') {
      const num = Number(page);
      if (!Number.isSafeInteger(num) || num <= 0) {
        throw new ValidationError('Invalid page parameter');
      }
      parsedPage = num;
    }

    let parsedLimit = 10;
    if (limit !== undefined && limit !== '') {
      const num = Number(limit);
      if (!Number.isSafeInteger(num) || num <= 0) {
        throw new ValidationError('Invalid limit parameter');
      }
      parsedLimit = Math.min(num, 100);
    }

    const where: Prisma.TACrossDepartmentApprovalWhereInput = {};

    if (status && (status === 'APPROVED' || status === 'REVOKED')) {
      where.status = status;
    }

    if (actor.role === 'SUPER_ADMIN') {
      // Unrestricted
    } else if (actor.role === 'COLLEGE_ADMIN') {
      const collegeId = actor.managedCollegeId || actor.collegeId;
      if (!collegeId) {
        where.course = { department: { collegeId: -1 } };
      } else {
        where.course = { department: { collegeId } };
      }
    } else if (actor.role === 'DEPARTMENT_ADMIN') {
      const deptId = actor.managedDepartmentId || actor.departmentId;
      if (!deptId) {
        where.course = { departmentId: -1 };
      } else {
        where.OR = [
          { course: { departmentId: deptId } },
          { teachingAssistant: { departmentId: deptId } },
        ];
      }
    } else {
      throw new AuthorizationError('You do not have permission to view cross-department approvals');
    }

    const skip = (parsedPage - 1) * parsedLimit;

    const [approvals, total] = await Promise.all([
      prisma.tACrossDepartmentApproval.findMany({
        where,
        include: {
          teachingAssistant: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              departmentId: true,
              department: {
                select: {
                  id: true,
                  name: true,
                  collegeId: true,
                },
              },
            },
          },
          course: {
            select: {
              id: true,
              name: true,
              courseCode: true,
              departmentId: true,
              department: {
                select: {
                  id: true,
                  name: true,
                  collegeId: true,
                },
              },
            },
          },
          approvedByUser: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
          revokedByUser: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parsedLimit,
      }),
      prisma.tACrossDepartmentApproval.count({ where }),
    ]);

    return {
      approvals,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / parsedLimit)),
      },
    };
  }
}
