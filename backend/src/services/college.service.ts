import prisma from '../utils/prismaClient.js';
import { NotFoundError, AuthorizationError, ValidationError } from '../utils/appError.js';

export const getAllColleges = async () => {
  const colleges = await prisma.college.findMany({
    include: {
      _count: {
        select: { departments: true }
      }
    }
  });

  const collegesWithAdmins = await Promise.all(
    colleges.map(async (college) => {
      const admin = await prisma.user.findFirst({
        where: { managedCollegeId: college.id },
        select: { id: true, email: true, doctor: { select: { firstName: true, lastName: true } } }
      });
      return {
        ...college,
        assignedAdmin: admin ? {
          id: admin.id,
          email: admin.email,
          name: admin.doctor ? `${admin.doctor.firstName} ${admin.doctor.lastName}`.trim() : null
        } : null
      };
    })
  );

  return collegesWithAdmins;
};

export const getCollegeById = async (collegeId: number, user: any) => {
  if (user && user.role === 'COLLEGE_ADMIN' && user.managedCollegeId !== collegeId) {
    throw new AuthorizationError('Access denied');
  }

  const college = await prisma.college.findUnique({
    where: { id: collegeId },
    include: { 
      departments: {
        include: {
          _count: {
            select: { students: true, doctors: true, courses: true }
          }
        }
      }
    }
  });

  if (!college) {
    throw new NotFoundError('College not found');
  }

  const admin = await prisma.user.findFirst({
    where: { managedCollegeId: college.id },
    select: { id: true, email: true, doctor: { select: { firstName: true, lastName: true } } }
  });

  const stats = college.departments.reduce((acc: any, dept: any) => {
    acc.totalStudents += dept._count.students;
    acc.totalDoctors += dept._count.doctors;
    return acc;
  }, { totalStudents: 0, totalDoctors: 0 });

  return {
    ...college,
    assignedAdmin: admin ? {
      id: admin.id,
      email: admin.email,
      name: admin.doctor ? `${admin.doctor.firstName} ${admin.doctor.lastName}`.trim() : null
    } : null,
    _count: {
      departments: college.departments.length,
      students: stats.totalStudents,
      doctors: stats.totalDoctors
    }
  };
};

export const createCollege = async (data: { name: string; nameAr?: string; description?: string }) => {
  return await prisma.college.create({
    data
  });
};

export const updateCollege = async (collegeId: number, data: { name: string; nameAr?: string; description?: string }) => {
  return await prisma.college.update({
    where: { id: collegeId },
    data
  });
};

export const deleteCollege = async (collegeId: number) => {
  await prisma.$transaction(async (tx) => {
    const departments = await tx.department.findMany({
      where: { collegeId }
    });
    const deptIds = departments.map(d => d.id);

    if (deptIds.length > 0) {
      await tx.student.updateMany({ where: { departmentId: { in: deptIds } }, data: { departmentId: null } });
      await tx.doctor.updateMany({ where: { departmentId: { in: deptIds } }, data: { departmentId: null } });
      await tx.course.updateMany({ where: { departmentId: { in: deptIds } }, data: { departmentId: null } });
      await tx.user.updateMany({ where: { departmentId: { in: deptIds } }, data: { departmentId: null } });
      await tx.registrationRequest.deleteMany({ where: { departmentId: { in: deptIds } } });

      await tx.department.deleteMany({ where: { collegeId } });
    }

    await tx.user.updateMany({
      where: { collegeId },
      data: { collegeId: null }
    });

    await tx.college.delete({
      where: { id: collegeId }
    });
  });
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

  const admin = await prisma.user.findUnique({ 
    where: { id: parsedAdminId },
    select: { role: true, managedCollegeId: true }
  });
  if (!admin) {
    throw new NotFoundError('User not found');
  }

  if (admin.role !== 'COLLEGE_ADMIN') {
    throw new ValidationError('Only COLLEGE_ADMIN users can be assigned to colleges');
  }

  await prisma.user.update({
    where: { id: parsedAdminId },
    data: { managedCollegeId: collegeId }
  });

  const updatedAdmin = await prisma.user.findUnique({
    where: { id: parsedAdminId },
    select: { id: true, email: true, doctor: { select: { firstName: true, lastName: true } } }
  });

  return {
    id: updatedAdmin!.id,
    email: updatedAdmin!.email,
    name: updatedAdmin!.doctor ? `${updatedAdmin!.doctor.firstName} ${updatedAdmin!.doctor.lastName}`.trim() : null
  };
};
