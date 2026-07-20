import prisma from '../utils/prismaClient';

export class StudentGroupsService {
  /**
   * Recursively computes all attendees for a given group.
   * If the group is a leaf, it returns its direct students.
   * If it has children, it returns the union of all students in its descendants.
   */
  static async computeAttendees(groupId: number): Promise<any[]> {
    const group = await prisma.studentGroup.findUnique({
      where: { id: groupId },
      include: {
        children: true,
        students: true
      }
    });

    if (!group) return [];

    let attendees: any[] = [...group.students];
    if (group.children.length > 0) {
      for (const child of group.children) {
        const childAttendees = await this.computeAttendees(child.id);
        attendees = attendees.concat(childAttendees);
      }
    }

    // Deduplicate by id just in case
    const uniqueIds = new Set();
    return attendees.filter(student => {
      if (!uniqueIds.has(student.id)) {
        uniqueIds.add(student.id);
        return true;
      }
      return false;
    });
  }

  /**
   * Gets the full nested group tree for a department.
   */
  static async getDepartmentGroupTree(departmentId: number) {
    const allGroups = await prisma.studentGroup.findMany({
      where: { departmentId },
      include: {
        _count: { select: { students: true } }
      },
      orderBy: { name: 'asc' }
    });

    const groupMap = new Map<number, any>();
    allGroups.forEach(g => {
      groupMap.set(g.id, {
        id: g.id,
        name: g.name,
        rangeStartName: g.rangeStartName,
        rangeEndName: g.rangeEndName,
        studentCount: g._count.students,
        parentGroupId: g.parentGroupId,
        children: []
      });
    });

    const rootNodes: any[] = [];
    groupMap.forEach(group => {
      if (group.parentGroupId) {
        const parent = groupMap.get(group.parentGroupId);
        if (parent) {
          parent.children.push(group);
        }
      } else {
        rootNodes.push(group);
      }
    });

    // Recursively compute total student count including all subgroup descendants
    function calculateTotalStudents(node: any): number {
      let total = node.studentCount || 0;
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          total += calculateTotalStudents(child);
        }
      }
      node.studentCount = total;
      return total;
    }

    rootNodes.forEach(root => calculateTotalStudents(root));

    return rootNodes;
  }

  /**
   * Assigns a newly created or activated student to the appropriate leaf group based on alphabetical ranges.
   */
  static async assignStudentToGroup(student: any) {
    if (!student.departmentId) return;

    // 1. Find all leaf groups
    const allGroups = await prisma.studentGroup.findMany({
      where: { departmentId: student.departmentId },
      include: { children: true }
    });

    if (allGroups.length === 0) return; // No groups exist yet

    const leafGroups = allGroups.filter(g => g.children.length === 0);
    if (leafGroups.length === 0) return; // Should not happen, but safety check

    // Sort leaves alphabetically by name or range
    leafGroups.sort((a, b) => a.rangeStartName.localeCompare(b.rangeStartName));

    const studentName = `${student.firstName} ${student.lastName}`;

    let assignedGroupId = null;

    // 2. Find range that contains the name
    for (const group of leafGroups) {
      if (studentName.localeCompare(group.rangeStartName) >= 0 && studentName.localeCompare(group.rangeEndName) <= 0) {
        assignedGroupId = group.id;
        break;
      }
    }

    // 3. If not found in any range, attach to nearest boundary
    if (!assignedGroupId) {
      if (studentName.localeCompare(leafGroups[0].rangeStartName) < 0) {
        assignedGroupId = leafGroups[0].id;
        await prisma.studentGroup.update({
          where: { id: assignedGroupId },
          data: { rangeStartName: studentName }
        });
      } else {
        const lastGroup = leafGroups[leafGroups.length - 1];
        assignedGroupId = lastGroup.id;
        await prisma.studentGroup.update({
          where: { id: assignedGroupId },
          data: { rangeEndName: studentName }
        });
      }
    }

    // Assign group
    if (assignedGroupId) {
      await prisma.student.update({
        where: { id: student.id },
        data: { groupId: assignedGroupId }
      });
    }
  }
}
