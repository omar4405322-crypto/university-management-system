const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAllCourses = async (req, res) => {
  try {
    const { search = '', doctorId, departmentId, collegeId } = req.query;

    // Enforce scope based on user role
    let scopeWhere = {};
    if (req.user.role === 'COLLEGE_ADMIN') {
      scopeWhere = { department: { collegeId: req.user.collegeId } };
    } else if (req.user.role === 'DEPARTMENT_ADMIN') {
      scopeWhere = { departmentId: req.user.departmentId };
    } else if (req.user.role === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.id } });
      if (doctor) {
        scopeWhere = { doctorId: doctor.id };
      }
    }

    const where = {
      AND: [
        scopeWhere,
        search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { courseCode: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
        doctorId ? { doctorId: parseInt(doctorId) } : {},
        departmentId ? { departmentId: parseInt(departmentId) } : {},
        collegeId ? { department: { collegeId: parseInt(collegeId) } } : {},
      ],
    };

    const courses = await prisma.course.findMany({
      where,
      include: {
        department: {
          include: {
            college: true
          }
        },
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            students: true
          }
        }
      },
      orderBy: { courseCode: 'asc' },
    });

    res.json({ success: true, data: courses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCourseById = async (req, res) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        department: {
          include: {
            college: true
          }
        },
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            specialty: true,
          },
        },
        students: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentId: true,
          }
        }
      },
    });

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Enforce scope
    if (req.user.role === 'COLLEGE_ADMIN' && course.department?.collegeId !== req.user.collegeId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (req.user.role === 'DEPARTMENT_ADMIN' && course.departmentId !== req.user.departmentId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, data: course });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createCourse = async (req, res) => {
  let { courseCode, name, description, credits, maxStudents, doctorId, departmentId, year, semester } = req.body;

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

    const existingCourse = await prisma.course.findUnique({ where: { courseCode } });
    if (existingCourse) {
      return res.status(400).json({ success: false, message: 'Course code already exists' });
    }

    const course = await prisma.course.create({
      data: {
        courseCode,
        name,
        description,
        credits: parseInt(credits),
        maxStudents: parseInt(maxStudents),
        doctorId: doctorId ? parseInt(doctorId) : null,
        departmentId: departmentId ? parseInt(departmentId) : null,
        year: year ? parseInt(year) : 1,
        semester: semester ? parseInt(semester) : 1,
      },
      include: {
        department: true,
        doctor: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    res.status(201).json({ success: true, data: course });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateCourse = async (req, res) => {
  const { name, description, credits, maxStudents, doctorId, departmentId, year, semester } = req.body;
  const id = parseInt(req.params.id);

  try {
    // Find course first to check scope
    const course = await prisma.course.findUnique({
      where: { id },
      include: { department: true }
    });

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Enforce scope
    if (req.user.role === 'COLLEGE_ADMIN' && course.department?.collegeId !== req.user.collegeId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (req.user.role === 'DEPARTMENT_ADMIN' && course.departmentId !== req.user.departmentId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // If changing department, check scope for new department
    if (departmentId) {
      if (req.user.role === 'DEPARTMENT_ADMIN' && parseInt(departmentId) !== req.user.departmentId) {
        return res.status(403).json({ success: false, message: 'Cannot move course to another department' });
      }
      if (req.user.role === 'COLLEGE_ADMIN') {
        const newDept = await prisma.department.findUnique({ where: { id: parseInt(departmentId) } });
        if (!newDept || newDept.collegeId !== req.user.collegeId) {
          return res.status(403).json({ success: false, message: 'Invalid department for your college' });
        }
      }
    }

    const updatedCourse = await prisma.course.update({
      where: { id },
      data: {
        name,
        description,
        credits: parseInt(credits),
        maxStudents: parseInt(maxStudents),
        doctorId: doctorId ? parseInt(doctorId) : null,
        departmentId: departmentId ? parseInt(departmentId) : null,
        year: year ? parseInt(year) : undefined,
        semester: semester ? parseInt(semester) : undefined,
      },
      include: {
        department: true,
        doctor: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    res.json({ success: true, data: updatedCourse });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCourse = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const course = await prisma.course.findUnique({
      where: { id },
      include: { department: true }
    });

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Enforce scope
    if (req.user.role === 'COLLEGE_ADMIN' && course.department?.collegeId !== req.user.collegeId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (req.user.role === 'DEPARTMENT_ADMIN' && course.departmentId !== req.user.departmentId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await prisma.course.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Course deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
