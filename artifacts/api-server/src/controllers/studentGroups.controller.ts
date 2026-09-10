import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import { logger } from '../lib/logger';
import { StudentGroupsService } from '../services/studentGroups.service';
import { AuthorizationError, ValidationError } from '../utils/appError';
import { getAdminMutationTargetWhere } from '../utils/adminMutationScope.utils';
import {
  getAdminStudentGroupScopeWhere,
  resolveStudentGroupReadScopeWhere,
} from '../utils/studentGroupScope.utils';
import {
  validatePositiveSafeInteger,
  validateRequestedGroupCount,
} from '../utils/studentGroupAllocation.utils';

function toBase26(num: number): string {
  let res = '';
  while (num >= 0) {
    res = String.fromCharCode(65 + (num % 26)) + res;
    num = Math.floor(num / 26) - 1;
  }
  return res;
}

export const autoDivideStudents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const departmentId = parseInt(req.params.departmentId as string);
    let { numberOfGroups, maxGroupSize, confirmed, year } = req.body || {};
    
    const academicYear = year ? parseInt(year) : 1;

    if (isNaN(departmentId)) return res.status(400).json({ success: false, message: 'Invalid department ID' });
    const hasNumberOfGroups = numberOfGroups !== undefined && numberOfGroups !== null;
    const hasMaxGroupSize = maxGroupSize !== undefined && maxGroupSize !== null;
    if (hasNumberOfGroups === hasMaxGroupSize) {
      return res.status(400).json({ success: false, message: 'Exactly one of numberOfGroups or maxGroupSize must be provided' });
    }

    const allocationField = hasNumberOfGroups ? 'numberOfGroups' : 'maxGroupSize';
    const allocationValue = hasNumberOfGroups ? numberOfGroups : maxGroupSize;
    const allocationError = validatePositiveSafeInteger(allocationValue, allocationField);
    if (allocationError) {
      return res.status(400).json({ success: false, message: allocationError });
    }
    const department = await prisma.department.findFirst({
      where: getAdminMutationTargetWhere(req.user!, 'department', departmentId),
    });
    if (!department) return next(new AuthorizationError('Department is outside your managed scope'));

    const students = await prisma.student.findMany({
      where: { departmentId, year: academicYear, isActive: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
    });

    if (students.length === 0) return res.status(400).json({ success: false, message: `No active students found in this department for year ${academicYear}` });

    if (maxGroupSize) {
      numberOfGroups = Math.ceil(students.length / maxGroupSize);
    }

    // Check if we need confirmation for overwriting existing tree
    const groupCountError = validateRequestedGroupCount(numberOfGroups, students.length);
    if (groupCountError) {
      return res.status(400).json({ success: false, message: groupCountError });
    }
    const existingGroups = await prisma.studentGroup.findMany({ where: { departmentId, year: academicYear, parentGroupId: null } });
    if (existingGroups.length > 0 && !confirmed) {
      return res.json({ success: true, requiresConfirmation: true, message: 'This will overwrite existing groups for this year. Confirm to proceed.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.student.updateMany({ where: { departmentId, year: academicYear }, data: { groupId: null } });
      await tx.scheduleSlot.updateMany({ where: { group: { departmentId, year: academicYear } }, data: { groupId: null } });
      await tx.studentGroup.updateMany({ where: { departmentId, year: academicYear }, data: { parentGroupId: null } });
      await tx.studentGroup.deleteMany({ where: { departmentId, year: academicYear } });

      const groups = [];
      for (let i = 0; i < numberOfGroups; i++) {
        groups.push(await tx.studentGroup.create({
          data: { name: toBase26(i), departmentId, year: academicYear }
        }));
      }

      const studentsPerGroup = Math.ceil(students.length / numberOfGroups);
      for (let i = 0; i < numberOfGroups; i++) {
        const groupStudents = students.slice(i * studentsPerGroup, (i + 1) * studentsPerGroup);
        if (groupStudents.length === 0) break;
        
        const startName = `${groupStudents[0].firstName} ${groupStudents[0].lastName}`;
        const endName = `${groupStudents[groupStudents.length - 1].firstName} ${groupStudents[groupStudents.length - 1].lastName}`;
        
        await tx.studentGroup.update({
          where: { id: groups[i].id },
          data: { rangeStartName: startName, rangeEndName: endName }
        });

        for (const student of groupStudents) {
          await tx.student.update({
            where: { id: student.id },
            data: { groupId: groups[i].id }
          });
        }
      }
    });

    return res.json({ success: true, message: `Successfully divided ${students.length} students into ${numberOfGroups} groups.` });
  } catch (error) {
    logger.error('Error auto-dividing students: ' + (error as Error).message);
    return res.status(500).json({ success: false, message: 'Failed to auto-divide students' });
  }
};

export const splitGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = parseInt(req.params.groupId as string);
    let { numberOfSubgroups, maxSubgroupSize, confirmed } = req.body || {};

    if (isNaN(groupId)) return res.status(400).json({ success: false, message: 'Invalid group ID' });
    const hasNumberOfSubgroups = numberOfSubgroups !== undefined && numberOfSubgroups !== null;
    const hasMaxSubgroupSize = maxSubgroupSize !== undefined && maxSubgroupSize !== null;
    if (hasNumberOfSubgroups === hasMaxSubgroupSize) {
      return res.status(400).json({ success: false, message: 'Exactly one of numberOfSubgroups or maxSubgroupSize must be provided' });
    }
    const splitField = hasNumberOfSubgroups ? 'numberOfSubgroups' : 'maxSubgroupSize';
    const splitValue = hasNumberOfSubgroups ? numberOfSubgroups : maxSubgroupSize;
    const splitError = validatePositiveSafeInteger(splitValue, splitField);
    if (splitError) {
      return res.status(400).json({ success: false, message: splitError });
    }

    const groupScope = getAdminStudentGroupScopeWhere(req.user!);
    const group = await prisma.studentGroup.findFirst({
      where: { AND: [{ id: groupId }, groupScope] },
    });
    if (!group) return next(new AuthorizationError('Group is outside your managed scope'));

    // Find all descendants to check for slots
    async function getDescendantIds(id: number): Promise<number[]> {
      const children = await prisma.studentGroup.findMany({
        where: { AND: [{ parentGroupId: id }, groupScope] },
      });
      let ids = [id];
      for (const child of children) {
        ids = ids.concat(await getDescendantIds(child.id));
      }
      return ids;
    }
    const affectedGroupIds = await getDescendantIds(groupId);
    const affectedSlots = await prisma.scheduleSlot.findMany({ where: { groupId: { in: affectedGroupIds } } });

    if (affectedSlots.length > 0 && !confirmed) {
      return res.json({ success: true, requiresConfirmation: true, affectedSlots });
    }

    const students = await prisma.student.findMany({
      where: {
        groupId,
        departmentId: group.departmentId,
        year: group.year,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
    });

    if (students.length === 0) return res.status(400).json({ success: false, message: 'No students to split in this group' });

    if (maxSubgroupSize) {
      numberOfSubgroups = Math.ceil(students.length / maxSubgroupSize);
    }
    const subgroupCountError = validateRequestedGroupCount(numberOfSubgroups, students.length);
    if (subgroupCountError) {
      return res.status(400).json({ success: false, message: subgroupCountError });
    }

    await prisma.$transaction(async (tx) => {
      const subgroups = [];
      for (let i = 0; i < numberOfSubgroups; i++) {
        subgroups.push(await tx.studentGroup.create({
          data: {
            name: `${group.name}${i + 1}`,
            departmentId: group.departmentId,
            year: group.year,
            parentGroupId: group.id,
          }
        }));
      }

      const studentsPerGroup = Math.ceil(students.length / numberOfSubgroups);
      for (let i = 0; i < numberOfSubgroups; i++) {
        const groupStudents = students.slice(i * studentsPerGroup, (i + 1) * studentsPerGroup);
        if (groupStudents.length === 0) break;
        
        const startName = `${groupStudents[0].firstName} ${groupStudents[0].lastName}`;
        const endName = `${groupStudents[groupStudents.length - 1].firstName} ${groupStudents[groupStudents.length - 1].lastName}`;
        
        await tx.studentGroup.update({
          where: { id: subgroups[i].id },
          data: { rangeStartName: startName, rangeEndName: endName }
        });

        for (const student of groupStudents) {
          await tx.student.update({
            where: { id: student.id },
            data: { groupId: subgroups[i].id }
          });
        }
      }
    });

    return res.json({ success: true, message: `Successfully split group into ${numberOfSubgroups} subgroups.` });
  } catch (error) {
    logger.error('Error splitting group: ' + (error as Error).message);
    return res.status(500).json({ success: false, message: 'Failed to split group' });
  }
};

export const deleteGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = parseInt(req.params.groupId as string);
    const { confirmed } = req.body || {};

    const groupScope = getAdminStudentGroupScopeWhere(req.user!);
    const groupToDelete = await prisma.studentGroup.findFirst({
      where: { AND: [{ id: groupId }, groupScope] },
    });
    if (!groupToDelete) return next(new AuthorizationError('Group is outside your managed scope'));
    const targetParentGroupId = groupToDelete.parentGroupId;
    
    // Find all descendants to check for slots
    async function getDescendantIds(id: number): Promise<number[]> {
      const children = await prisma.studentGroup.findMany({
        where: { AND: [{ parentGroupId: id }, groupScope] },
      });
      let ids = [id];
      for (const child of children) {
        ids = ids.concat(await getDescendantIds(child.id));
      }
      return ids;
    }
    const affectedGroupIds = await getDescendantIds(groupId);
    const affectedSlots = await prisma.scheduleSlot.findMany({ where: { groupId: { in: affectedGroupIds } } });

    if (affectedSlots.length > 0 && !confirmed) {
      return res.json({ success: true, requiresConfirmation: true, affectedSlots });
    }

    await prisma.$transaction(async (tx) => {
      // Reassign students to the parent group (or null if deleting a root group)
      await tx.student.updateMany({ where: { groupId: { in: affectedGroupIds } }, data: { groupId: targetParentGroupId } });
      // Null out schedule slots referencing these groups
      await tx.scheduleSlot.updateMany({ where: { groupId: { in: affectedGroupIds } }, data: { groupId: null } });
      // Null out parentGroupId self-references to avoid constraint issues during deletion
      await tx.studentGroup.updateMany({ where: { id: { in: affectedGroupIds } }, data: { parentGroupId: null } });
      // Delete all affected groups
      await tx.studentGroup.deleteMany({ where: { id: { in: affectedGroupIds } } });
    });

    return res.json({ success: true, message: 'Group deleted successfully' });
  } catch (error) {
    logger.error('Error deleting group: ' + (error as Error).message);
    return res.status(500).json({ success: false, message: 'Failed to delete group' });
  }
};

export const getAllGroups = async (req: Request, res: Response) => {
  try {
    const { departmentId, year } = req.query as { departmentId?: string; year?: string };
    const requestedWhere: Record<string, number> = {};
    if (departmentId) requestedWhere.departmentId = parseInt(departmentId);
    if (year) requestedWhere.year = parseInt(year);
    const scopeWhere = await resolveStudentGroupReadScopeWhere(req.user!);
    const groups = await prisma.studentGroup.findMany({
      where: { AND: [requestedWhere, scopeWhere] },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            college: { select: { id: true, name: true, nameAr: true } },
          },
        },
        parentGroup: { select: { id: true, name: true } },
        _count: { select: { students: true, children: true } },
      },
      orderBy: [{ departmentId: 'asc' }, { year: 'asc' }, { name: 'asc' }],
    });
    return res.json({ success: true, data: groups });
  } catch (error) {
    logger.error('Error fetching all groups: ' + (error as Error).message);
    return res.status(500).json({ success: false, message: 'Failed to fetch student groups' });
  }
};

export const getGroupsByDepartment = async (req: Request, res: Response) => {
  try {
    const departmentId = parseInt(req.params.departmentId as string);
    // year is optional — if not provided, return groups for all years
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;

    if (isNaN(departmentId)) return res.status(400).json({ success: false, message: 'Invalid department ID' });

    const scopeWhere = await resolveStudentGroupReadScopeWhere(req.user!);
    const tree = await StudentGroupsService.getDepartmentGroupTree(
      departmentId,
      year as number,
      scopeWhere
    );
    return res.json({ success: true, data: tree });
  } catch (error) {
    logger.error('Error fetching student groups: ' + (error as Error).message);
    return res.status(500).json({ success: false, message: 'Failed to fetch student groups' });
  }
};

export const manualOverrideGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = parseInt(req.params.studentId as string);
    const { groupId } = req.body || {};

    const parsedGroupId = groupId ? Number(groupId) : null;
    if (!Number.isSafeInteger(studentId) || studentId <= 0) {
      return next(new ValidationError('studentId must be a positive integer'));
    }
    if (parsedGroupId !== null && (!Number.isSafeInteger(parsedGroupId) || parsedGroupId <= 0)) {
      return next(new ValidationError('groupId must be a positive integer'));
    }

    await prisma.$transaction(async (tx) => {
      const student = await tx.student.findFirst({
        where: getAdminMutationTargetWhere(req.user!, 'student', studentId),
        select: { id: true, departmentId: true, year: true },
      });
      if (!student) {
        throw new AuthorizationError('Student is outside your managed scope');
      }

      if (parsedGroupId !== null) {
        const group = await tx.studentGroup.findFirst({
          where: {
            AND: [
              { id: parsedGroupId },
              getAdminStudentGroupScopeWhere(req.user!),
            ],
          },
          select: { id: true, departmentId: true, year: true },
        });
        if (!group) {
          throw new AuthorizationError('Target group is outside your managed scope');
        }
        if (
          student.departmentId === null ||
          student.departmentId !== group.departmentId ||
          student.year !== group.year
        ) {
          throw new ValidationError(
            'Student and target group must have the same department and academic year'
          );
        }
      }

      await tx.student.update({
        where: { id: student.id },
        data: { groupId: parsedGroupId },
      });
    });

    return res.json({ success: true, message: 'Student group updated manually' });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof ValidationError) {
      return next(error);
    }
    logger.error('Error manually updating student group: ' + (error as Error).message);
    return res.status(500).json({ success: false, message: 'Failed to update student group' });
  }
};
