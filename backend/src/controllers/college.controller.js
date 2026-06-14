const prisma = require('../utils/prismaClient');

exports.getAllColleges = async (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCollegeById = async (req, res) => {
  try {
    const collegeId = parseInt(req.params.id);

    // Scope check: COLLEGE_ADMIN can only access their managed college
    if (req.user && req.user.role === 'COLLEGE_ADMIN' && req.user.managedCollegeId !== collegeId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
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

    if (!college) return res.status(404).json({ success: false, message: 'College not found' });

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
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createCollege = async (req, res) => {
  try {
    const { name, nameAr, description } = req.body;
    const college = await prisma.college.create({
      data: { name, nameAr, description }
    });
    res.status(201).json({ success: true, data: college });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateCollege = async (req, res) => {
  try {
    const { name, nameAr, description } = req.body;
    const college = await prisma.college.update({
      where: { id: parseInt(req.params.id) },
      data: { name, nameAr, description }
    });
    res.json({ success: true, data: college });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCollege = async (req, res) => {
  try {
    const collegeId = parseInt(req.params.id);

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

    res.json({ success: true, message: 'College and its departments deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.assignAdmin = async (req, res) => {
  try {
    const collegeId = parseInt(req.params.id);
    const { adminId } = req.body;

    if (!adminId) {
      return res.status(400).json({ success: false, message: 'Admin ID is required' });
    }

    const college = await prisma.college.findUnique({ where: { id: collegeId } });
    if (!college) {
      return res.status(404).json({ success: false, message: 'College not found' });
    }

    const admin = await prisma.user.findUnique({ 
      where: { id: parseInt(adminId) },
      select: { role: true, managedCollegeId: true }
    });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (admin.role !== 'COLLEGE_ADMIN') {
      return res.status(400).json({ success: false, message: 'Only COLLEGE_ADMIN users can be assigned to colleges' });
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

    res.json({ 
      success: true, 
      message: 'Admin assigned to college successfully',
      data: {
        id: updatedAdmin.id,
        email: updatedAdmin.email,
        name: updatedAdmin.doctor ? `${updatedAdmin.doctor.firstName} ${updatedAdmin.doctor.lastName}`.trim() : null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
