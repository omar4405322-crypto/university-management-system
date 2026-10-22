import { Prisma } from '@prisma/client';
import prisma from '../utils/prismaClient';
import { NotFoundError, ValidationError, ConflictError } from '../utils/appError';
import {
  getEffectiveActiveDoctorWhere,
  getEffectiveActiveStudentWhere,
  getScopeWhere,
} from '../utils/scope.utils';

const publicCollegeSelect = { id: true, name: true, nameAr: true } as const;

export const getPublicColleges = async () =>
  prisma.college.findMany({ select: publicCollegeSelect, orderBy: { name: 'asc' } });

export const getPublicCollegeById = async (collegeId: number) => {
  const college = await prisma.college.findUnique({
    where: { id: collegeId },
    select: publicCollegeSelect,
  });
  if (!college) throw new NotFoundError('College not found');
  return college;
};

export const getAllColleges = async (user: any) => {
  const colleges = await prisma.college.findMany({
    where: getScopeWhere(user, 'college'),
    include: {
      _count: {
        select: { departments: true },
      },
    },
  });

  const collegeIds = colleges.map((c) => c.id);
  const [admins, departmentStudentCounts] = await Promise.all([
    collegeIds.length > 0
      ? prisma.user.findMany({
          where: { managedCollegeId: { in: collegeIds }, isActive: true },
          orderBy: { id: 'asc' },
          select: {
            id: true,
            email: true,
            managedCollegeId: true,
            doctor: { select: { firstName: true, lastName: true } },
          },
        })
      : [],
    collegeIds.length > 0
      ? prisma.department.findMany({
          where: { collegeId: { in: collegeIds } },
          select: {
            id: true,
            collegeId: true,
            _count: {
              select: {
                students: { where: getEffectiveActiveStudentWhere() },
              },
            },
          },
        })
      : [],
  ]);

  const activeCountByCollege = new Map<number, number>();
  for (const dept of departmentStudentCounts) {
    activeCountByCollege.set(
      dept.collegeId,
      (activeCountByCollege.get(dept.collegeId) || 0) + (dept._count?.students || 0)
    );
  }

  const adminByCollegeId = new Map<number, (typeof admins)[number]>();
  for (const admin of admins) {
    if (admin.managedCollegeId && !adminByCollegeId.has(admin.managedCollegeId)) {
      adminByCollegeId.set(admin.managedCollegeId, admin);
    }
  }

  const collegesWithAdmins = colleges.map((college) => {
    const admin = adminByCollegeId.get(college.id);
    const activeStudentCount = activeCountByCollege.get(college.id) || 0;
    return {
      ...college,
      _count: {
        departments: college._count?.departments ?? 0,
        students: activeStudentCount,
      },
      activeStudentCount,
      assignedAdmin: admin
        ? {
            id: admin.id,
            email: admin.email,
            name: admin.doctor
              ? `${admin.doctor.firstName} ${admin.doctor.lastName}`.trim()
              : null,
          }
        : null,
    };
  });

  return collegesWithAdmins;
};

export const getCollegeById = async (collegeId: number, user: any) => {
  const college = await prisma.college.findFirst({
    where: { AND: [{ id: collegeId }, getScopeWhere(user, 'college')] },
    include: {
      departments: {
        include: {
          _count: {
            select: {
              students: { where: getEffectiveActiveStudentWhere() },
              doctors: { where: getEffectiveActiveDoctorWhere() },
              courses: true,
            },
          },
        },
      },
    },
  });

  if (!college) {
    throw new NotFoundError('College not found');
  }

  const admin = await prisma.user.findFirst({
    where: { managedCollegeId: college.id, isActive: true },
    select: { id: true, email: true, doctor: { select: { firstName: true, lastName: true } } },
  });

  const stats = college.departments.reduce(
    (acc: any, dept: any) => {
      acc.totalStudents += dept._count.students;
      acc.totalDoctors += dept._count.doctors;
      return acc;
    },
    { totalStudents: 0, totalDoctors: 0 }
  );

  return {
    ...college,
    assignedAdmin: admin
      ? {
        id: admin.id,
        email: admin.email,
        name: admin.doctor ? `${admin.doctor.firstName} ${admin.doctor.lastName}`.trim() : null,
      }
      : null,
    _count: {
      departments: college.departments.length,
      students: stats.totalStudents,
      doctors: stats.totalDoctors,
    },
  };
};

export const createCollege = async (data: {
  name: string;
  nameAr?: string;
  description?: string;
}, client: any = prisma) => {
  return await client.college.create({
    data,
  });
};

export const updateCollege = async (
  collegeId: number,
  data: { name: string; nameAr?: string; description?: string },
  client: any = prisma
) => {
  return await client.college.update({
    where: { id: collegeId },
    data,
  });
};

export const deleteCollege = async (
  collegeId: number,
  withinTransaction?: (tx: any) => Promise<void>
) => {
  const existing = await prisma.college.findUnique({
    where: { id: collegeId },
    include: {
      _count: {
        select: {
          departments: true,
          admins: true,
          managedAdmins: true,
          timetables: true,
          knowledgeDocuments: true,
        },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError('College not found');
  }

  const linkedRecords = Object.entries(existing._count)
    .filter(([, count]) => count > 0)
    .map(([relation, count]) => `${count} ${relation}`);

  if (linkedRecords.length > 0) {
    throw new ConflictError(
      `Cannot delete college: linked records remain (${linkedRecords.join(', ')}). Reassign or explicitly remove them first.`
    );
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const current = await tx.college.findUnique({
          where: { id: collegeId },
          include: {
            _count: {
              select: {
                departments: true,
                admins: true,
                managedAdmins: true,
                timetables: true,
                knowledgeDocuments: true,
              },
            },
          },
        });
        if (!current) throw new NotFoundError('College not found');

        const concurrentLinks = Object.values(current._count).some((count) => count > 0);
        if (concurrentLinks) {
          throw new ConflictError(
            'Cannot delete college: linked records changed during deletion. Reassign or explicitly remove them first.'
          );
        }

        await tx.college.delete({
          where: { id: collegeId },
        });
        if (withinTransaction) await withinTransaction(tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      throw new ConflictError(
        'Cannot delete college: foreign key constraint prevents deletion due to remaining linked records.'
      );
    }
    throw err;
  }
};

export const assignAdmin = async (collegeId: number, adminId: string | number) => {
  if (!adminId) {
    throw new ValidationError('Admin ID is required');
  }

  const college = await prisma.college.findUnique({ where: { id: collegeId } });
  if (!college) {
    throw new NotFoundError('College not found');
  }

  const parsedAdminId = typeof adminId === 'string' ? parseInt(adminId) : adminId;

  const admin = await prisma.user.findFirst({
    where: { id: parsedAdminId, isActive: true },
    select: { role: true, managedCollegeId: true },
  });
  if (!admin) {
    throw new NotFoundError('Active user not found');
  }

  if (admin.role !== 'COLLEGE_ADMIN') {
    throw new ValidationError('Only COLLEGE_ADMIN users can be assigned to colleges');
  }

  await prisma.user.update({
    where: { id: parsedAdminId },
    data: { managedCollegeId: collegeId },
  });

  const updatedAdmin = await prisma.user.findUnique({
    where: { id: parsedAdminId },
    select: { id: true, email: true, doctor: { select: { firstName: true, lastName: true } } },
  });

  return {
    id: updatedAdmin!.id,
    email: updatedAdmin!.email,
    name: updatedAdmin!.doctor
      ? `${updatedAdmin!.doctor.firstName} ${updatedAdmin!.doctor.lastName}`.trim()
      : null,
  };
};
