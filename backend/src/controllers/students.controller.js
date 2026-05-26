const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

exports.getAllStudents = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Enforce scope based on user role
    const scopeWhere = {};
    if (req.user.role === 'COLLEGE_ADMIN') {
      scopeWhere.department = { collegeId: req.user.collegeId };
    } else if (req.user.role === 'DEPARTMENT_ADMIN') {
      scopeWhere.departmentId = req.user.departmentId;
    }

    const where = {
      ...scopeWhere,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { studentId: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [students, total, stats] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          user: {
            select: {
              email: true,
              role: true,
              profilePicture: true,
            },
          },
          department: {
            include: { college: true }
          }
        },
        skip,
        take,
        orderBy: { enrolledAt: 'desc' },
      }),
      prisma.student.count({ where }),
      Promise.all([
        prisma.student.count({ where }), // For now, just using total as placeholders
        prisma.student.count({ where }),
        prisma.student.count({ where }),
      ])
    ]);

    const [activeCount, pendingCount, inactiveCount] = stats;

    res.json({
      success: true,
      data: {
        students,
        total,
        stats: {
          total,
          active: activeCount,
          pending: pendingCount,
          inactive: inactiveCount,
        },
        page: parseInt(page),
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStudentById = async (req, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        user: {
          select: {
            email: true,
            role: true,
            profilePicture: true,
          },
        },
        department: {
          include: { college: true }
        }
      },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Enforce scope
    if (req.user.role === 'COLLEGE_ADMIN' && student.department?.collegeId !== req.user.collegeId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (req.user.role === 'DEPARTMENT_ADMIN' && student.departmentId !== req.user.departmentId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createStudent = async (req, res) => {
  let { email, password, firstName, lastName, studentId, phone, address, departmentId } = req.body;

  try {
    // Enforce scope
    if (req.user.role === 'DEPARTMENT_ADMIN') {
      departmentId = req.user.departmentId;
    } else if (req.user.role === 'COLLEGE_ADMIN') {
      if (departmentId) {
        const dept = await prisma.department.findUnique({ where: { id: parseInt(departmentId) } });
        if (!dept || dept.collegeId !== req.user.collegeId) {
          return res.status(403).json({ success: false, message: 'Invalid department for your college' });
        }
      }
    }

    // Check if email or studentId already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const existingStudent = await prisma.student.findUnique({ where: { studentId } });
    if (existingStudent) {
      return res.status(400).json({ success: false, message: 'Student ID already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          role: 'STUDENT',
        },
      });

      const student = await tx.student.create({
        data: {
          userId: user.id,
          firstName,
          lastName,
          studentId,
          phone,
          address,
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

      return student;
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateStudent = async (req, res) => {
  const { firstName, lastName, phone, address, departmentId, studentId, year } = req.body;
  const id = parseInt(req.params.id);

  try {
    // Find student first to check scope
    const student = await prisma.student.findUnique({
      where: { id },
      include: { department: true }
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Check if studentId already exists if it's being changed
    if (studentId && studentId !== student.studentId) {
      const existingStudent = await prisma.student.findUnique({ where: { studentId } });
      if (existingStudent) {
        return res.status(400).json({ success: false, message: 'Student ID already exists' });
      }
    }

    // Enforce scope
    if (req.user.role === 'COLLEGE_ADMIN' && student.department?.collegeId !== req.user.collegeId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (req.user.role === 'DEPARTMENT_ADMIN' && student.departmentId !== req.user.departmentId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // If changing department, check scope for new department
    if (departmentId) {
      if (req.user.role === 'DEPARTMENT_ADMIN' && parseInt(departmentId) !== req.user.departmentId) {
        return res.status(403).json({ success: false, message: 'Cannot move student to another department' });
      }
      if (req.user.role === 'COLLEGE_ADMIN') {
        const newDept = await prisma.department.findUnique({ where: { id: parseInt(departmentId) } });
        if (!newDept || newDept.collegeId !== req.user.collegeId) {
          return res.status(403).json({ success: false, message: 'Invalid department for your college' });
        }
      }
    }

    const updatedStudent = await prisma.student.update({
      where: { id },
      data: {
        firstName,
        lastName,
        phone,
        address,
        studentId,
        year: year ? parseInt(year) : undefined,
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

    res.json({ success: true, data: updatedStudent });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteStudent = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const student = await prisma.student.findUnique({
      where: { id },
      include: { department: true }
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Enforce scope
    if (req.user.role === 'COLLEGE_ADMIN' && student.department?.collegeId !== req.user.collegeId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (req.user.role === 'DEPARTMENT_ADMIN' && student.departmentId !== req.user.departmentId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.student.delete({ where: { id: student.id } });
      await tx.user.delete({ where: { id: student.userId } });
    });

    res.json({ success: true, message: 'Student deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
