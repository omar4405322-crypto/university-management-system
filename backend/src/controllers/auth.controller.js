const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/jwt.utils');
const { notifyAdminsOfNewRequest } = require('../utils/notification.utils');

const prisma = new PrismaClient();

const register = async (req, res) => {
  try {
    const { email, password, role, firstName, lastName, departmentId, studentId, year } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Check if studentId already exists if it's a student
    if (role === 'STUDENT' && studentId) {
      const existingStudent = await prisma.student.findUnique({ where: { studentId } });
      if (existingStudent) {
        return res.status(400).json({ success: false, message: 'Student ID already exists' });
      }
    }

    // Check if request already exists
    const existingRequest = await prisma.registrationRequest.findUnique({ where: { email } });
    if (existingRequest) {
      return res.status(400).json({ success: false, message: 'Registration request already pending' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const request = await prisma.registrationRequest.create({
      data: {
        email,
        password: hashedPassword,
        role,
        firstName,
        lastName,
        studentId: role === 'STUDENT' ? studentId : null,
        year: role === 'STUDENT' ? (year ? parseInt(year) : 1) : null,
        departmentId: departmentId ? parseInt(departmentId) : null
      }
    });

    // Notify relevant admins
    if (request.departmentId) {
      await notifyAdminsOfNewRequest({
        role: request.role,
        firstName: request.firstName,
        lastName: request.lastName,
        departmentId: request.departmentId
      });
    }

    res.status(201).json({ 
      success: true, 
      message: 'Registration request submitted. Pending admin approval.' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getRequests = async (req, res) => {
  try {
    const { user } = req;
    let where = { status: 'PENDING' };

    // Scope filtering
    if (user.role === 'COLLEGE_ADMIN') {
      const admin = await prisma.user.findUnique({
        where: { id: user.id },
        include: { doctor: true }
      });
      if (admin.doctor && admin.doctor.departmentId) {
        const dept = await prisma.department.findUnique({
          where: { id: admin.doctor.departmentId }
        });
        where.department = { collegeId: dept.collegeId };
      }
    } else if (user.role === 'DEPARTMENT_ADMIN') {
      const admin = await prisma.user.findUnique({
        where: { id: user.id },
        include: { doctor: true }
      });
      if (admin.doctor) {
        where.departmentId = admin.doctor.departmentId;
      }
    }

    const requests = await prisma.registrationRequest.findMany({
      where,
      include: { department: { include: { college: true } } },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const approveRequest = async (req, res) => {
  const { id } = req.params;
  try {
    const request = await prisma.registrationRequest.findUnique({
      where: { id: parseInt(id) }
    });

    if (!request || request.status !== 'PENDING') {
      return res.status(404).json({ success: false, message: 'Pending request not found' });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          email: request.email,
          password: request.password,
          role: request.role
        }
      });

      // 2. Create Student or Doctor profile
      if (request.role === 'STUDENT') {
        let studentId = request.studentId;
        if (!studentId) {
          const studentCount = await tx.student.count();
          studentId = `STU${new Date().getFullYear()}${String(studentCount + 1).padStart(4, '0')}`;
        }
        
        await tx.student.create({
          data: {
            userId: user.id,
            firstName: request.firstName,
            lastName: request.lastName,
            studentId,
            year: request.year || 1,
            departmentId: request.departmentId
          }
        });
      } else if (['DOCTOR', 'DEPARTMENT_ADMIN', 'COLLEGE_ADMIN'].includes(request.role)) {
        const doctorCount = await tx.doctor.count();
        const doctorId = `DOC${new Date().getFullYear()}${String(doctorCount + 1).padStart(4, '0')}`;
        
        await tx.doctor.create({
          data: {
            userId: user.id,
            firstName: request.firstName,
            lastName: request.lastName,
            doctorId,
            departmentId: request.departmentId
          }
        });

        // If it's an admin role, update User.adminRole
        if (['DEPARTMENT_ADMIN', 'COLLEGE_ADMIN'].includes(request.role)) {
          await tx.user.update({
            where: { id: user.id },
            data: { adminRole: request.role }
          });
        }
      }

      // 3. Update request status
      await tx.registrationRequest.update({
        where: { id: parseInt(id) },
        data: { status: 'APPROVED' }
      });
    });

    res.json({ success: true, message: 'Request approved and user created' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const rejectRequest = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.registrationRequest.update({
      where: { id: parseInt(id) },
      data: { status: 'REJECTED' }
    });
    res.json({ success: true, message: 'Request rejected' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        student: true,
        doctor: true,
      },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(user.id);

    // Determine profile based on role
    let profile = null;
    if (user.role === 'STUDENT') {
      profile = user.student;
    } else if (['DOCTOR', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user.role)) {
      profile = user.doctor;
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          profilePicture: user.profilePicture,
          profile,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: error.message || 'Login failed' });
  }
};

const getMe = async (req, res) => {
  try {
    const user = req.user;

    // Determine profile based on role
    let profile = null;
    if (user.role === 'STUDENT') {
      profile = user.student;
    } else if (['DOCTOR', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'].includes(user.role)) {
      profile = user.doctor;
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch user info' });
  }
};

module.exports = {
  register,
  login,
  getMe,
  getRequests,
  approveRequest,
  rejectRequest,
};
