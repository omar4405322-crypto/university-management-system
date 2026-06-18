// FIXED: Live stats endpoint for doctors dashboard cards - Phase 2
const prisma = require('../utils/prismaClient');
const { auditLog } = require('../utils/audit.utils');
const bcrypt = require('bcryptjs');

const catchAsync = require('../utils/catchAsync');
const { AppError, NotFoundError } = require('../utils/appError');

const { getScopeWhere } = require('../utils/scope.utils');

exports.getDoctorStats = async (req, res) => {
  try {
    const scopeWhere = getScopeWhere(req.user);
    const courseWhere = {};
    if (req.user.role === 'ADMIN' && req.user.managedCollegeId) {
      courseWhere.department = { collegeId: req.user.managedCollegeId };
    } else if (req.user.role === 'COLLEGE_ADMIN') {
      courseWhere.department = { collegeId: req.user.collegeId };
    } else if (req.user.role === 'DEPARTMENT_ADMIN') {
      courseWhere.departmentId = req.user.departmentId;
    }

    const [totalFaculty, activeProfessors, totalCourses, researchProjects] = await Promise.all([
      prisma.doctor.count({ where: scopeWhere }),
      prisma.doctor.count({
        where: { ...scopeWhere, courses: { some: {} } },
      }),
      prisma.course.count({ where: courseWhere }),
      prisma.task.count({
        where: Object.keys(scopeWhere).length
          ? { doctor: scopeWhere }
          : {},
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalFaculty,
        activeProfessors,
        totalCourses,
        researchProjects,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllDoctors = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const scopeWhere = getScopeWhere(req.user);

    const where = {
      ...scopeWhere,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { doctorId: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [doctors, total] = await Promise.all([
      prisma.doctor.findMany({
        where,
        include: {
          user: {
            select: {
              email: true,
              role: true,
            },
          },
          department: {
            include: { college: true }
          },
          _count: {
            select: { courses: true },
          },
        },
        skip,
        take,
        orderBy: { id: 'desc' },
      }),
      prisma.doctor.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        doctors,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDoctorById = async (req, res) => {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        user: {
          select: {
            email: true,
            role: true,
          },
        },
        department: {
          include: { college: true }
        },
        courses: true,
      },
    });

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    // Enforce scope
    if (req.user.role === 'COLLEGE_ADMIN' && doctor.department?.collegeId !== req.user.collegeId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (req.user.role === 'DEPARTMENT_ADMIN' && doctor.departmentId !== req.user.departmentId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, data: doctor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createDoctor = async (req, res) => {
  let { email, password, firstName, lastName, doctorId, phone, specialty, departmentId } = req.body;

  try {
    // Enforce scope
    if (req.user.role === 'ADMIN' && req.user.managedCollegeId) {
      if (departmentId) {
        const dept = await prisma.department.findUnique({ where: { id: parseInt(departmentId) } });
        if (!dept || dept.collegeId !== req.user.managedCollegeId) {
          return res.status(403).json({ success: false, message: 'Invalid department for your college' });
        }
      }
    } else if (req.user.role === 'DEPARTMENT_ADMIN') {
      departmentId = req.user.departmentId;
    } else if (req.user.role === 'COLLEGE_ADMIN') {
      if (departmentId) {
        const dept = await prisma.department.findUnique({ where: { id: parseInt(departmentId) } });
        if (!dept || dept.collegeId !== req.user.collegeId) {
          return res.status(403).json({ success: false, message: 'Invalid department for your college' });
        }
      }
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const existingDoctor = await prisma.doctor.findUnique({ where: { doctorId } });
    if (existingDoctor) {
      return res.status(400).json({ success: false, message: 'Doctor ID already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          role: 'DOCTOR',
        },
      });

      const doctor = await tx.doctor.create({
        data: {
          userId: user.id,
          firstName,
          lastName,
          doctorId,
          phone,
          specialty,
          departmentId: departmentId ? parseInt(departmentId) : null,
        },
        include: {
          user: {
            select: {
              email: true,
              role: true,
            },
          },
          department: true
        },
      });

      return doctor;
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateDoctor = async (req, res) => {
  const { firstName, lastName, phone, specialty, departmentId } = req.body;
  const id = parseInt(req.params.id);

  try {
    // Find doctor first to check scope
    const doctor = await prisma.doctor.findUnique({
      where: { id },
      include: { department: true }
    });

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    // Enforce scope
    if (req.user.role === 'ADMIN' && req.user.managedCollegeId) {
      if (doctor.department?.collegeId !== req.user.managedCollegeId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    } else if (req.user.role === 'COLLEGE_ADMIN' && doctor.department?.collegeId !== req.user.collegeId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    } else if (req.user.role === 'DEPARTMENT_ADMIN' && doctor.departmentId !== req.user.departmentId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // If changing department, check scope for new department
    if (departmentId) {
      if (req.user.role === 'ADMIN' && req.user.managedCollegeId) {
        const newDept = await prisma.department.findUnique({ where: { id: parseInt(departmentId) } });
        if (!newDept || newDept.collegeId !== req.user.managedCollegeId) {
          return res.status(403).json({ success: false, message: 'Invalid department for your college' });
        }
      } else if (req.user.role === 'DEPARTMENT_ADMIN' && parseInt(departmentId) !== req.user.departmentId) {
        return res.status(403).json({ success: false, message: 'Cannot move doctor to another department' });
      } else if (req.user.role === 'COLLEGE_ADMIN') {
        const newDept = await prisma.department.findUnique({ where: { id: parseInt(departmentId) } });
        if (!newDept || newDept.collegeId !== req.user.collegeId) {
          return res.status(403).json({ success: false, message: 'Invalid department for your college' });
        }
      }
    }

    const updatedDoctor = await prisma.doctor.update({
      where: { id },
      data: {
        firstName,
        lastName,
        phone,
        specialty,
        departmentId: departmentId ? parseInt(departmentId) : undefined,
      },
      include: {
        user: {
          select: {
            email: true,
            role: true,
          },
        },
        department: true
      },
    });

    res.json({ success: true, data: updatedDoctor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteDoctor = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id },
      include: { department: true }
    });

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    // Enforce scope
    if (req.user.role === 'ADMIN' && req.user.managedCollegeId) {
      if (doctor.department?.collegeId !== req.user.managedCollegeId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    } else if (req.user.role === 'COLLEGE_ADMIN' && doctor.department?.collegeId !== req.user.collegeId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    } else if (req.user.role === 'DEPARTMENT_ADMIN' && doctor.departmentId !== req.user.departmentId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await prisma.$transaction(async (tx) => {
      // Set doctorId to null for all courses assigned to this doctor
      await tx.course.updateMany({
        where: { doctorId: doctor.id },
        data: { doctorId: null },
      });
      
      await tx.doctor.delete({ where: { id: doctor.id } });
      await tx.user.delete({ where: { id: doctor.userId } });
    });

    auditLog('DELETE_DOCTOR', 'Doctor', req.params.id, req);
    res.json({ success: true, message: 'Doctor deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.resetDoctorPassword = catchAsync(async (req, res, next) => { 
  const { id } = req.params; 
  const { newPassword } = req.body; 

  if (!newPassword || newPassword.length < 6) { 
    return next(new AppError('Password must be at least 6 characters', 400)); 
  } 

  const doctor = await prisma.doctor.findUnique({ 
    where: { id: parseInt(id) }, 
    include: { user: true } 
  }); 

  if (!doctor) { 
    return next(new NotFoundError('Doctor not found')); 
  } 

  const bcrypt = require('bcryptjs'); 
  const hashedPassword = await bcrypt.hash(newPassword, 10); 

  await prisma.user.update({ 
    where: { id: doctor.userId }, 
    data: { password: hashedPassword } 
  }); 

  auditLog('RESET_DOCTOR_PASSWORD', 'Doctor', req.params.id, req);
  res.json({ 
    success: true, 
    message: `Password reset successfully for ${doctor.firstName} ${doctor.lastName}` 
  }); 
});
