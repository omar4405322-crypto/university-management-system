import { Request, Response } from 'express';
import prisma from '../utils/prismaClient';
import { logger } from '../lib/logger';
import { StudentGroupsService } from '../services/studentGroups.service';

function toBase26(num: number): string {
  let res = '';
  while (num >= 0) {
    res = String.fromCharCode(65 + (num % 26)) + res;
    num = Math.floor(num / 26) - 1;
  }
  return res;
}

export const autoDivideStudents = async (req: Request, res: Response) => {
  try {
    const departmentId = parseInt(req.params.departmentId as string);
    let { numberOfGroups, maxGroupSize, confirmed } = req.body;

    if (isNaN(departmentId)) return res.status(400).json({ success: false, message: 'Invalid department ID' });
    if ((!numberOfGroups && !maxGroupSize) || (numberOfGroups && maxGroupSize)) {
      return res.status(400).json({ success: false, message: 'Exactly one of numberOfGroups or maxGroupSize must be provided' });
    }

    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) return res.status(404).json({ success: false, message: 'Department not found' });

    const students = await prisma.student.findMany({
      where: { departmentId, isActive: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
    });

    if (students.length === 0) return res.status(400).json({ success: false, message: 'No active students found in this department' });

    if (maxGroupSize) {
      numberOfGroups = Math.ceil(students.length / maxGroupSize);
    }

    // Check if we need confirmation for overwriting existing tree
    const existingGroups = await prisma.studentGroup.findMany({ where: { departmentId, parentGroupId: null } });
    if (existingGroups.length > 0 && !confirmed) {
      return res.json({ success: true, requiresConfirmation: true, message: 'This will overwrite existing groups. Confirm to proceed.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.student.updateMany({ where: { departmentId }, data: { groupId: null } });
      // Delete all groups (cascade should handle self-relations if properly configured, otherwise delete leaves first)
      // Since prisma doesn't cascade self-relations easily via deleteMany, we might just wipe them
      // Alternatively, we can use a raw query or delete in loop. Let's assume Prisma handles it or we delete all.
      await tx.studentGroup.deleteMany({ where: { departmentId } });

      const groups = [];
      for (let i = 0; i < numberOfGroups; i++) {
        groups.push(await tx.studentGroup.create({
          data: { name: toBase26(i), departmentId }
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

export const splitGroup = async (req: Request, res: Response) => {
  try {
    const groupId = parseInt(req.params.groupId as string);
    let { numberOfSubgroups, maxSubgroupSize, confirmed } = req.body;

    if (isNaN(groupId)) return res.status(400).json({ success: false, message: 'Invalid group ID' });
    if ((!numberOfSubgroups && !maxSubgroupSize) || (numberOfSubgroups && maxSubgroupSize)) {
      return res.status(400).json({ success: false, message: 'Exactly one of numberOfSubgroups or maxSubgroupSize must be provided' });
    }

    const group = await prisma.studentGroup.findUnique({ where: { id: groupId } });
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

    // Find all descendants to check for slots
    async function getDescendantIds(id: number): Promise<number[]> {
      const children = await prisma.studentGroup.findMany({ where: { parentGroupId: id } });
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
      where: { groupId },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
    });

    if (students.length === 0) return res.status(400).json({ success: false, message: 'No students to split in this group' });

    if (maxSubgroupSize) {
      numberOfSubgroups = Math.ceil(students.length / maxSubgroupSize);
    }

    await prisma.$transaction(async (tx) => {
      const subgroups = [];
      for (let i = 0; i < numberOfSubgroups; i++) {
        subgroups.push(await tx.studentGroup.create({
          data: { name: `${group.name}${i + 1}`, departmentId: group.departmentId, parentGroupId: group.id }
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

export const deleteGroup = async (req: Request, res: Response) => {
  try {
    const groupId = parseInt(req.params.groupId as string);
    const { confirmed } = req.body;
    
    // Find all descendants to check for slots
    async function getDescendantIds(id: number): Promise<number[]> {
      const children = await prisma.studentGroup.findMany({ where: { parentGroupId: id } });
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
      // Null out students
      await tx.student.updateMany({ where: { groupId: { in: affectedGroupIds } }, data: { groupId: null } });
      // Delete groups (bottom up to avoid constraint issues, or let Prisma handle it)
      // Reverse array to delete leaves first
      for (const id of affectedGroupIds.reverse()) {
         await tx.studentGroup.delete({ where: { id } });
      }
    });

    return res.json({ success: true, message: 'Group deleted successfully' });
  } catch (error) {
    logger.error('Error deleting group: ' + (error as Error).message);
    return res.status(500).json({ success: false, message: 'Failed to delete group' });
  }
};

export const getGroupsByDepartment = async (req: Request, res: Response) => {
  try {
    const departmentId = parseInt(req.params.departmentId as string);
    if (isNaN(departmentId)) return res.status(400).json({ success: false, message: 'Invalid department ID' });

    const tree = await StudentGroupsService.getDepartmentGroupTree(departmentId);
    return res.json({ success: true, data: tree });
  } catch (error) {
    logger.error('Error fetching student groups: ' + (error as Error).message);
    return res.status(500).json({ success: false, message: 'Failed to fetch student groups' });
  }
};

export const manualOverrideGroup = async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(req.params.studentId as string);
    const { groupId } = req.body;

    await prisma.student.update({
      where: { id: studentId },
      data: { groupId: groupId ? parseInt(groupId) : null }
    });

    return res.json({ success: true, message: 'Student group updated manually' });
  } catch (error) {
    logger.error('Error manually updating student group: ' + (error as Error).message);
    return res.status(500).json({ success: false, message: 'Failed to update student group' });
  }
};
