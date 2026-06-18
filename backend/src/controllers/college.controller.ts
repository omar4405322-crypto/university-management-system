import { Request, Response } from 'express';
import prisma from '../utils/prismaClient.js';
import { auditLog } from '../utils/audit.utils.js';
import catchAsync from '../utils/catchAsync.js';
import { NotFoundError, AuthorizationError, ValidationError } from '../utils/appError.js';

export const getAllColleges = catchAsync(async (req: Request, res: Response) => {
  const colleges = await prisma.college.findMany({
    include: {
      _count: {
        select: { departments: true }
      }
    }
  });

  // Fetch admin for each college
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

  res.json({ success: true, data: collegesWithAdmins });
});

export const getCollegeById = catchAsync(async (req: Request, res: Response) => {
  const collegeId = parseInt(req.params.id as string);

  // Scope check: COLLEGE_ADMIN can only access their managed college
  if (req.user && req.user.role === 'COLLEGE_ADMIN' && req.user.managedCollegeId !== collegeId) {
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

  // Fetch assigned admin
  const admin = await prisma.user.findFirst({
    where: { managedCollegeId: college.id },
    select: { id: true, email: true, doctor: { select: { firstName: true, lastName: true } } }
  });

  // Calculate total students and doctors across all departments
  const stats = college.departments.reduce((acc, dept) => {
    acc.totalStudents += dept._count.students;
    acc.totalDoctors += dept._count.doctors;
    return acc;
  }, { totalStudents: 0, totalDoctors: 0 });

  res.json({ 
    success: true, 
    data: {
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
    } 
  });
});

export const createCollege = catchAsync(async (req: Request, res: Response) => {
  const { name, nameAr, description } = req.body;
  const college = await prisma.college.create({
    data: { name, nameAr, description }
  });
  res.status(201).json({ success: true, data: college });
});

export const updateCollege = catchAsync(async (req: Request, res: Response) => {
  const { name, nameAr, description } = req.body;
  const college = await prisma.college.update({
    where: { id: parseInt(req.params.id as string) },
    data: { name, nameAr, description }
  });
  res.json({ success: true, data: college });
});

export const deleteCollege = catchAsync(async (req: Request, res: Response) => {
  const collegeId = parseInt(req.params.id as string);

  // Use a transaction to ensure all related data is handled
  await prisma.$transaction(async (tx) => {
    // 1. Find all departments in this college
    const departments = await tx.department.findMany({
      where: { collegeId }
    });
    const deptIds = departments.map(d => d.id);

    if (deptIds.length > 0) {
      // 2. Disconnect/Cleanup relations for all departments in this college
      // For simplicity in this logic, we'll nullify references or delete children
      // In a real production app, you might want to prevent deletion if students/doctors exist
      
      // Nullify department references in other models
      await tx.student.updateMany({ where: { departmentId: { in: deptIds } }, data: { departmentId: null } });
      await tx.doctor.updateMany({ where: { departmentId: { in: deptIds } }, data: { departmentId: null } });
      await tx.course.updateMany({ where: { departmentId: { in: deptIds } }, data: { departmentId: null } });
      await tx.user.updateMany({ where: { departmentId: { in: deptIds } }, data: { departmentId: null } });
      await tx.registrationRequest.deleteMany({ where: { departmentId: { in: deptIds } } });

      // Delete all departments
      await tx.department.deleteMany({ where: { collegeId } });
    }

    // 3. Nullify college references for admins
    await tx.user.updateMany({
      where: { collegeId },
      data: { collegeId: null }
    });

    // 4. Finally delete the college
    await tx.college.delete({
      where: { id: collegeId }
    });
  });

  auditLog('DELETE_COLLEGE', 'College', req.params.id as string, req);
  res.json({ success: true, message: 'College and its departments deleted successfully' });
});

export const assignAdmin = catchAsync(async (req: Request, res: Response) => {
  const collegeId = parseInt(req.params.id as string);
  const { adminId } = req.body;

  if (!adminId) {
    throw new ValidationError('Admin ID is required');
  }

  const college = await prisma.college.findUnique({ where: { id: collegeId } });
  if (!college) {
    throw new NotFoundError('College not found');
  }

  const admin = await prisma.user.findUnique({ 
    where: { id: parseInt(adminId) },
    select: { role: true, managedCollegeId: true }
  });
  if (!admin) {
    throw new NotFoundError('User not found');
  }

  if (admin.role !== 'COLLEGE_ADMIN') {
    throw new ValidationError('Only COLLEGE_ADMIN users can be assigned to colleges');
  }

  // Update admin to manage this college
  await prisma.user.update({
    where: { id: parseInt(adminId) },
    data: { managedCollegeId: collegeId }
  });

  // Fetch updated admin info
  const updatedAdmin = await prisma.user.findUnique({
    where: { id: parseInt(adminId) },
    select: { id: true, email: true, doctor: { select: { firstName: true, lastName: true } } }
  });

  auditLog('ASSIGN_COLLEGE_ADMIN', 'College', req.params.id as string, req);
  res.json({ 
    success: true, 
    message: 'Admin assigned to college successfully',
    data: {
      id: updatedAdmin!.id,
      email: updatedAdmin!.email,
      name: updatedAdmin!.doctor ? `${updatedAdmin!.doctor.firstName} ${updatedAdmin!.doctor.lastName}`.trim() : null
    }
  });
});
